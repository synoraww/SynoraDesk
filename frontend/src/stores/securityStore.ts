import { create } from 'zustand';
import {
  GetSecurityLockoutStatus,
  RecordFailedPasscodeAttempt,
  RecordSuccessfulPasscodeAttempt,
  UpdateSecurityLockoutConfig,
  WipeAllData,
} from '../../wailsjs/go/main/App';

export type LockType = 'none' | 'pin4' | 'pin6' | 'pin8' | 'password';

interface SecurityState {
  isLocked: boolean;
  lockType: LockType;
  passcodeHash: string;
  salt: string;
  autoLockMinutes: number; // 0 = off, 1, 5, 15, 30
  lockOnLaunch: boolean;
  encryptDatabase: boolean;
  failedAttempts: number;

  // Anti-Brute-Force Lockout State & Options
  isLockedOut: boolean;
  remainingLockoutSeconds: number;
  enableLockout: boolean;
  maxAttempts: number; // e.g. 3, 5, 10
  lockoutDurationMinutes: number; // e.g. 1, 5, 15, 30, 60
  enableAutoWipe: boolean; // Self-destruct wipe on excessive attempts
  wipeAttempts: number; // e.g. 10
  isDataWiped: boolean;

  // Actions
  setupLock: (type: LockType, passcode: string) => Promise<boolean>;
  disableLock: (currentPasscode: string) => Promise<boolean>;
  unlock: (passcode: string) => Promise<boolean>;
  lockApp: () => void;
  setAutoLockMinutes: (minutes: number) => void;
  setLockOnLaunch: (enabled: boolean) => void;
  setEncryptDatabase: (enabled: boolean) => void;
  setLockoutConfig: (config: {
    enableLockout?: boolean;
    maxAttempts?: number;
    lockoutDurationMinutes?: number;
    enableAutoWipe?: boolean;
    wipeAttempts?: number;
  }) => Promise<void>;
  initSecurity: () => void;
  resetActivityTimer: () => void;
}

// Generate SHA-256 hash using Web Crypto API
async function sha256(text: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text + '::' + salt + '::pterodesk_salt_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateRandomSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

let idleTimeoutId: ReturnType<typeof setTimeout> | null = null;
let lockoutCountdownInterval: ReturnType<typeof setInterval> | null = null;

const savedLockType = (localStorage.getItem('pterodesk_lock_type') as LockType) || 'none';
const savedPasscodeHash = localStorage.getItem('pterodesk_passcode_hash') || '';
const savedLockOnLaunch = localStorage.getItem('pterodesk_lock_on_launch') === 'true';
const isInitialLocked = savedLockType !== 'none' && Boolean(savedPasscodeHash) && savedLockOnLaunch;

export const useSecurityStore = create<SecurityState>((set, get) => ({
  isLocked: isInitialLocked,
  lockType: savedLockType,
  passcodeHash: savedPasscodeHash,
  salt: localStorage.getItem('pterodesk_salt') || '',
  autoLockMinutes: parseInt(localStorage.getItem('pterodesk_autolock_minutes') || '0', 10),
  lockOnLaunch: savedLockOnLaunch,
  encryptDatabase: localStorage.getItem('pterodesk_encrypt_db') === 'true',
  failedAttempts: 0,

  isLockedOut: false,
  remainingLockoutSeconds: 0,
  enableLockout: localStorage.getItem('pterodesk_enable_lockout') !== 'false',
  maxAttempts: parseInt(localStorage.getItem('pterodesk_lockout_max_attempts') || '5', 10),
  lockoutDurationMinutes: parseInt(localStorage.getItem('pterodesk_lockout_duration_mins') || '15', 10),
  enableAutoWipe: localStorage.getItem('pterodesk_enable_auto_wipe') === 'true',
  wipeAttempts: parseInt(localStorage.getItem('pterodesk_wipe_attempts') || '10', 10),
  isDataWiped: false,

  initSecurity: async () => {
    const { lockType, lockOnLaunch, passcodeHash, salt } = get();

    // Sync current lock config to backend
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app?.SetLockConfig) {
        await app.SetLockConfig(
          lockType !== 'none',
          lockType,
          passcodeHash,
          salt
        );
      }
    } catch {
      // Backend not ready yet
    }

    // 1. Check tamper-proof lockout status from backend DPAPI storage
    try {
      const status = await GetSecurityLockoutStatus();
      if (status) {
        const isLockedOutNow = status.is_locked_out && status.remaining_lockout_seconds > 0;
        set({
          isLockedOut: isLockedOutNow,
          remainingLockoutSeconds: status.remaining_lockout_seconds || 0,
          failedAttempts: status.failed_attempts || 0,
          enableLockout: status.enable_lockout ?? true,
          maxAttempts: status.max_attempts || 5,
          lockoutDurationMinutes: status.lockout_duration_minutes || 15,
          enableAutoWipe: status.enable_auto_wipe ?? false,
          wipeAttempts: status.wipe_attempts || 10,
        });

        if (isLockedOutNow) {
          set({ isLocked: true });
        }
      }
    } catch {
      // Backend not ready yet
    }

    // Start local 1-second countdown for lockout
    if (lockoutCountdownInterval) clearInterval(lockoutCountdownInterval);
    lockoutCountdownInterval = setInterval(() => {
      const { remainingLockoutSeconds, isLockedOut } = get();
      if (isLockedOut && remainingLockoutSeconds > 0) {
        const next = remainingLockoutSeconds - 1;
        if (next <= 0) {
          set({ isLockedOut: false, remainingLockoutSeconds: 0, failedAttempts: 0 });
        } else {
          set({ remainingLockoutSeconds: next });
        }
      }
    }, 1000);

    // If lock is enabled and lockOnLaunch is true (or locked out), lock immediately on startup
    if (lockType !== 'none' && passcodeHash && (lockOnLaunch || get().isLockedOut || get().isLocked)) {
      set({ isLocked: true });
      try {
        // @ts-ignore
        const app = window.go?.main?.App;
        if (app?.LockSession) {
          await app.LockSession();
        }
      } catch {}
    }

    // Setup global idle activity listener
    const handleUserActivity = () => {
      get().resetActivityTimer();
    };

    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('mousedown', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('touchstart', handleUserActivity, { passive: true });

    // Listen for data-wiped event from backend
    if ((window as any).runtime?.EventsOn) {
      (window as any).runtime.EventsOn('security:data-wiped', () => {
        localStorage.clear();
        set({
          isDataWiped: true,
          lockType: 'none',
          passcodeHash: '',
          salt: '',
          isLocked: true,
          isLockedOut: true,
          remainingLockoutSeconds: 0,
        });
      });
    }

    get().resetActivityTimer();
  },

  resetActivityTimer: () => {
    if (idleTimeoutId) {
      clearTimeout(idleTimeoutId);
      idleTimeoutId = null;
    }

    const { autoLockMinutes, lockType, isLocked } = get();
    if (lockType === 'none' || autoLockMinutes <= 0 || isLocked) {
      return;
    }

    const ms = autoLockMinutes * 60 * 1000;
    idleTimeoutId = setTimeout(() => {
      if (get().lockType !== 'none' && !get().isLocked) {
        get().lockApp();
      }
    }, ms);
  },

  lockApp: () => {
    const { lockType, passcodeHash } = get();
    if (lockType !== 'none' && passcodeHash) {
      set({ isLocked: true });
      try {
        // @ts-ignore
        const app = window.go?.main?.App;
        if (app?.LockSession) {
          app.LockSession();
        }
      } catch {}
    }
  },

  setupLock: async (type: LockType, passcode: string) => {
    if (type === 'none') {
      localStorage.removeItem('pterodesk_lock_type');
      localStorage.removeItem('pterodesk_passcode_hash');
      localStorage.removeItem('pterodesk_salt');
      set({ lockType: 'none', passcodeHash: '', salt: '', isLocked: false });
      try {
        // @ts-ignore
        const app = window.go?.main?.App;
        if (app?.SetLockConfig) {
          await app.SetLockConfig(false, 'none', '', '');
        }
        if (app?.UnlockSession) {
          await app.UnlockSession('');
        }
      } catch {}
      return true;
    }

    const salt = generateRandomSalt();
    const hash = await sha256(passcode, salt);

    localStorage.setItem('pterodesk_lock_type', type);
    localStorage.setItem('pterodesk_passcode_hash', hash);
    localStorage.setItem('pterodesk_salt', salt);

    set({
      lockType: type,
      passcodeHash: hash,
      salt: salt,
      isLocked: false,
      failedAttempts: 0,
      isLockedOut: false,
      remainingLockoutSeconds: 0,
    });

    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app?.SetLockConfig) {
        await app.SetLockConfig(true, type, hash, salt);
      }
      if (app?.UnlockSession) {
        await app.UnlockSession(hash);
      }
      await RecordSuccessfulPasscodeAttempt();
    } catch {}

    return true;
  },

  unlock: async (passcode: string) => {
    const { salt, passcodeHash, isLockedOut } = get();

    if (isLockedOut) {
      return false;
    }

    if (!salt || !passcodeHash) {
      set({ isLocked: false });
      try {
        // @ts-ignore
        const app = window.go?.main?.App;
        if (app?.UnlockSession) {
          await app.UnlockSession('');
        }
      } catch {}
      return true;
    }

    const hash = await sha256(passcode, salt);
    if (hash === passcodeHash) {
      try {
        // @ts-ignore
        const app = window.go?.main?.App;
        if (app?.UnlockSession) {
          await app.UnlockSession(hash);
        }
        await RecordSuccessfulPasscodeAttempt();
      } catch {}
      set({
        isLocked: false,
        failedAttempts: 0,
        isLockedOut: false,
        remainingLockoutSeconds: 0,
      });
      get().resetActivityTimer();
      return true;
    }

    // Record failure in tamper-proof backend
    try {
      const res = await RecordFailedPasscodeAttempt();
      if (res) {
        if (res.data_wiped) {
          localStorage.clear();
          set({ isDataWiped: true, isLockedOut: true, isLocked: true });
          return false;
        }

        set({
          failedAttempts: res.failed_attempts,
          isLockedOut: res.is_locked_out && res.remaining_lockout_seconds > 0,
          remainingLockoutSeconds: res.remaining_lockout_seconds || 0,
        });
      }
    } catch {
      set((state) => ({ failedAttempts: state.failedAttempts + 1 }));
    }

    return false;
  },

  disableLock: async (currentPasscode: string) => {
    const valid = await get().unlock(currentPasscode);
    if (valid) {
      localStorage.removeItem('pterodesk_lock_type');
      localStorage.removeItem('pterodesk_passcode_hash');
      localStorage.removeItem('pterodesk_salt');
      set({
        lockType: 'none',
        passcodeHash: '',
        salt: '',
        isLocked: false,
        failedAttempts: 0,
        isLockedOut: false,
        remainingLockoutSeconds: 0,
      });
      try {
        // @ts-ignore
        const app = window.go?.main?.App;
        if (app?.SetLockConfig) {
          await app.SetLockConfig(false, 'none', '', '');
        }
        if (app?.UnlockSession) {
          await app.UnlockSession('');
        }
      } catch {}
      return true;
    }
    return false;
  },

  setAutoLockMinutes: (minutes: number) => {
    localStorage.setItem('pterodesk_autolock_minutes', String(minutes));
    set({ autoLockMinutes: minutes });
    get().resetActivityTimer();
  },

  setLockOnLaunch: (enabled: boolean) => {
    localStorage.setItem('pterodesk_lock_on_launch', String(enabled));
    set({ lockOnLaunch: enabled });
  },

  setEncryptDatabase: (enabled: boolean) => {
    localStorage.setItem('pterodesk_encrypt_db', String(enabled));
    set({ encryptDatabase: enabled });
  },

  setLockoutConfig: async (config) => {
    const current = get();
    const updated = {
      enable_lockout: config.enableLockout ?? current.enableLockout,
      max_attempts: config.maxAttempts ?? current.maxAttempts,
      lockout_duration_minutes: config.lockoutDurationMinutes ?? current.lockoutDurationMinutes,
      enable_auto_wipe: config.enableAutoWipe ?? current.enableAutoWipe,
      wipe_attempts: config.wipeAttempts ?? current.wipeAttempts,
    };

    localStorage.setItem('pterodesk_enable_lockout', String(updated.enable_lockout));
    localStorage.setItem('pterodesk_lockout_max_attempts', String(updated.max_attempts));
    localStorage.setItem('pterodesk_lockout_duration_mins', String(updated.lockout_duration_minutes));
    localStorage.setItem('pterodesk_enable_auto_wipe', String(updated.enable_auto_wipe));
    localStorage.setItem('pterodesk_wipe_attempts', String(updated.wipe_attempts));

    set({
      enableLockout: updated.enable_lockout,
      maxAttempts: updated.max_attempts,
      lockoutDurationMinutes: updated.lockout_duration_minutes,
      enableAutoWipe: updated.enable_auto_wipe,
      wipeAttempts: updated.wipe_attempts,
    });

    try {
      await UpdateSecurityLockoutConfig(updated);
    } catch {}
  },
}));
