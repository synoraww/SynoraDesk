import { create } from 'zustand';
import {
  GetSecurityLockoutStatus,
  GetSecurityPreferences,
  GetLockType,
  IsSessionLocked,
  LockSession,
  SetLockConfig,
  SetSecurityPreferences,
  UnlockSession,
  UpdateSecurityLockoutConfig,
} from '../../wailsjs/go/main/App';

export type LockType = 'none' | 'pin4' | 'pin6' | 'pin8' | 'password';

interface SecurityState {
  isLocked: boolean;
  lockType: LockType;
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
  setupLock: (type: LockType, passcode: string, currentPasscode?: string) => Promise<boolean>;
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

let idleTimeoutId: ReturnType<typeof setTimeout> | null = null;
let lockoutCountdownInterval: ReturnType<typeof setInterval> | null = null;

const savedLockType = (localStorage.getItem('pterodesk_lock_type') as LockType) || 'none';
const savedLockOnLaunch = localStorage.getItem('pterodesk_lock_on_launch') === 'true';
const isInitialLocked = true; // Fail closed until the backend confirms the lock state.

export const useSecurityStore = create<SecurityState>((set, get) => ({
  isLocked: isInitialLocked,
  lockType: savedLockType,
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
    // Never trust WebView storage for lock configuration.
    localStorage.removeItem('pterodesk_passcode_hash');
    localStorage.removeItem('pterodesk_salt');
    try {
      const type = (await GetLockType()) as LockType;
      const locked = await IsSessionLocked();
      let effectiveLockOnLaunch = true;
      let effectiveAutoLock = 0;
      try {
        const prefs = await GetSecurityPreferences();
        if (prefs) {
          effectiveLockOnLaunch = prefs.lock_on_launch ?? (type !== 'none');
          effectiveAutoLock = prefs.auto_lock_minutes ?? 0;
        }
      } catch {}

      localStorage.setItem('pterodesk_lock_type', type);
      localStorage.setItem('pterodesk_lock_on_launch', String(effectiveLockOnLaunch));
      localStorage.setItem('pterodesk_autolock_minutes', String(effectiveAutoLock));

      set({
        lockType: type,
        isLocked: locked,
        lockOnLaunch: effectiveLockOnLaunch,
        autoLockMinutes: effectiveAutoLock,
      });
    } catch {
      set({ isLocked: true });
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
    const { lockType } = get();
    if (lockType !== 'none') {
      set({ isLocked: true });
      void LockSession();
    }
  },

  setupLock: async (type: LockType, passcode: string, currentPasscode = '') => {
    try {
      await SetLockConfig(type !== 'none', type, passcode, currentPasscode);
      localStorage.removeItem('pterodesk_passcode_hash');
      localStorage.removeItem('pterodesk_salt');
      localStorage.setItem('pterodesk_lock_type', type);
      const isEnabling = type !== 'none';
      if (isEnabling) {
        localStorage.setItem('pterodesk_lock_on_launch', 'true');
        try {
          await SetSecurityPreferences({
            auto_lock_minutes: get().autoLockMinutes,
            lock_on_launch: true,
          } as any);
        } catch {}
      }
      set({
        lockType: type,
        isLocked: false,
        lockOnLaunch: isEnabling ? true : get().lockOnLaunch,
        failedAttempts: 0,
        isLockedOut: false,
        remainingLockoutSeconds: 0,
      });
      get().resetActivityTimer();
      return true;
    } catch {
      return false;
    }
  },

  unlock: async (passcode: string) => {
    try {
      if (await UnlockSession(passcode)) {
        set({ isLocked: false, failedAttempts: 0, isLockedOut: false, remainingLockoutSeconds: 0 });
        get().resetActivityTimer();
        return true;
      }
    } catch {
      // Backend records incorrect passcodes and enforces lockout.
    }
    try {
      const status = await GetSecurityLockoutStatus();
      set({ failedAttempts: status.failed_attempts, isLockedOut: status.is_locked_out,
        remainingLockoutSeconds: status.remaining_lockout_seconds });
    } catch {}
    return false;
  },

  disableLock: async (currentPasscode: string) => get().setupLock('none', '', currentPasscode),

  setAutoLockMinutes: (minutes: number) => {
    localStorage.setItem('pterodesk_autolock_minutes', String(minutes));
    set({ autoLockMinutes: minutes });
    get().resetActivityTimer();
    try {
      SetSecurityPreferences({
        auto_lock_minutes: minutes,
        lock_on_launch: get().lockOnLaunch,
      } as any);
    } catch {}
  },

  setLockOnLaunch: (enabled: boolean) => {
    localStorage.setItem('pterodesk_lock_on_launch', String(enabled));
    set({ lockOnLaunch: enabled });
    try {
      SetSecurityPreferences({
        auto_lock_minutes: get().autoLockMinutes,
        lock_on_launch: enabled,
      } as any);
    } catch {}
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
