import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';
export type AccentTheme = 'blue' | 'green' | 'purple' | 'amber' | 'rose';
export type WallpaperFitMode = 'cover' | 'contain' | 'custom';
export type AnimationMode = 'full' | 'light';
export type SidebarMode = 'client' | 'admin';

export interface CustomBackgroundState {
  enabled: boolean;
  path: string;
  dataUrl: string;
  opacity: number;
  blur: number;
  scale: number;
  positionX: number;
  positionY: number;
  fitMode: WallpaperFitMode;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  timestamp: number;
}

interface UIState {
  // Theme Mode (Dark/Light)
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;

  // Accent Color Theme (Blue, Green, Purple, Amber, Rose)
  accentTheme: AccentTheme;
  setAccentTheme: (accent: AccentTheme) => void;

  // Animation Mode (Full, Light)
  animationMode: AnimationMode;
  setAnimationMode: (mode: AnimationMode) => void;

  // Custom Background Wallpaper
  customBackground: CustomBackgroundState;
  setCustomBackground: (bg: Partial<CustomBackgroundState>) => void;
  loadCustomBackgroundFromBackend: () => Promise<void>;
  selectAndApplyBackgroundImage: () => Promise<void>;
  updateBackgroundSettings: (
    opacity: number,
    blur: number,
    scale?: number,
    positionX?: number,
    positionY?: number,
    fitMode?: WallpaperFitMode
  ) => Promise<void>;
  removeCustomBackground: () => Promise<void>;

  // Sidebar
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  sidebarMode: SidebarMode;
  setSidebarMode: (mode: SidebarMode) => void;

  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Loading states
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
  loadingStates: Record<string, boolean>;
  setLoading: (key: string, loading: boolean) => void;
  isLoading: (key: string) => boolean;

  // Search
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;
}

let notificationCounter = 0;

// Initialize persisted values from localStorage
const savedTheme = (localStorage.getItem('pterodesk_theme') as ThemeMode) || 'dark';
const savedAccent = (localStorage.getItem('pterodesk_accent_theme') as AccentTheme) || 'blue';
const savedAnimation = (localStorage.getItem('pterodesk_animation_mode') as AnimationMode) || 'full';
const savedBgCached = localStorage.getItem('pterodesk_custom_bg_cache');

let initialCustomBg: CustomBackgroundState = {
  enabled: false,
  path: '',
  dataUrl: '',
  opacity: 0.75,
  blur: 0,
  scale: 1.0,
  positionX: 50,
  positionY: 50,
  fitMode: 'cover',
};

if (savedBgCached) {
  try {
    const parsed = JSON.parse(savedBgCached);
    if (parsed && typeof parsed === 'object') {
      initialCustomBg = { ...initialCustomBg, ...parsed };
    }
  } catch (e) {
    console.error('Failed to parse cached background:', e);
  }
}

// Apply attributes to DOM immediately
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.documentElement.setAttribute('data-accent', savedAccent);
  document.documentElement.setAttribute('data-animation', savedAnimation);
  if (initialCustomBg.enabled && initialCustomBg.dataUrl) {
    document.documentElement.setAttribute('data-has-custom-bg', 'true');
  } else {
    document.documentElement.removeAttribute('data-has-custom-bg');
  }
}

export const useUIStore = create<UIState>((set, get) => ({
  // Theme Mode
  theme: savedTheme,
  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem('pterodesk_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  },
  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(newTheme);
  },

  // Accent Color Theme
  accentTheme: savedAccent,
  setAccentTheme: (accentTheme) => {
    set({ accentTheme });
    localStorage.setItem('pterodesk_accent_theme', accentTheme);
    document.documentElement.setAttribute('data-accent', accentTheme);
  },

  // Animation Mode (Full, Light)
  animationMode: savedAnimation,
  setAnimationMode: (animationMode) => {
    set({ animationMode });
    localStorage.setItem('pterodesk_animation_mode', animationMode);
    document.documentElement.setAttribute('data-animation', animationMode);
  },

  // Custom Background
  customBackground: initialCustomBg,
  setCustomBackground: (bgUpdates) => {
    const next = { ...get().customBackground, ...bgUpdates };
    set({ customBackground: next });
    localStorage.setItem('pterodesk_custom_bg_cache', JSON.stringify(next));
    if (next.enabled && next.dataUrl) {
      document.documentElement.setAttribute('data-has-custom-bg', 'true');
    } else {
      document.documentElement.removeAttribute('data-has-custom-bg');
    }
  },

  loadCustomBackgroundFromBackend: async () => {
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app?.GetCustomBackground) {
        const info = await app.GetCustomBackground();
        if (info) {
          get().setCustomBackground({
            enabled: info.enabled,
            path: info.path || '',
            dataUrl: info.dataUrl || '',
            opacity: typeof info.opacity === 'number' ? info.opacity : 0.75,
            blur: typeof info.blur === 'number' ? info.blur : 0,
            scale: typeof info.scale === 'number' && info.scale > 0 ? info.scale : 1.0,
            positionX: typeof info.positionX === 'number' ? info.positionX : 50,
            positionY: typeof info.positionY === 'number' ? info.positionY : 50,
            fitMode: (info.fitMode as WallpaperFitMode) || 'cover',
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load custom background from backend:', e);
    }
  },

  selectAndApplyBackgroundImage: async () => {
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app?.SelectAndSaveBackgroundImage) {
        const info = await app.SelectAndSaveBackgroundImage();
        if (info && info.dataUrl) {
          get().setCustomBackground({
            enabled: true,
            path: info.path || '',
            dataUrl: info.dataUrl,
            opacity: typeof info.opacity === 'number' ? info.opacity : 0.75,
            blur: typeof info.blur === 'number' ? info.blur : 0,
            scale: typeof info.scale === 'number' && info.scale > 0 ? info.scale : 1.0,
            positionX: typeof info.positionX === 'number' ? info.positionX : 50,
            positionY: typeof info.positionY === 'number' ? info.positionY : 50,
            fitMode: (info.fitMode as WallpaperFitMode) || 'cover',
          });
          get().addNotification({
            type: 'success',
            title: 'Background Updated',
            message: 'Custom background saved to persistent storage.',
          });
        }
      }
    } catch (e: any) {
      console.error('Failed to select background image:', e);
      get().addNotification({
        type: 'error',
        title: 'Background Error',
        message: e?.message || 'Failed to select background image',
      });
    }
  },

  updateBackgroundSettings: async (opacity, blur, scale, positionX, positionY, fitMode) => {
    const current = get().customBackground;
    const nextScale = typeof scale === 'number' ? scale : (current.scale ?? 1.0);
    const nextPosX = typeof positionX === 'number' ? positionX : (current.positionX ?? 50);
    const nextPosY = typeof positionY === 'number' ? positionY : (current.positionY ?? 50);
    const nextFit = fitMode || current.fitMode || 'cover';

    get().setCustomBackground({
      opacity,
      blur,
      scale: nextScale,
      positionX: nextPosX,
      positionY: nextPosY,
      fitMode: nextFit,
    });

    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app?.SaveCustomBackgroundSettings) {
        await app.SaveCustomBackgroundSettings(opacity, blur, nextScale, nextPosX, nextPosY, nextFit);
      }
    } catch (e) {
      console.warn('Failed to persist background settings:', e);
    }
  },

  removeCustomBackground: async () => {
    get().setCustomBackground({
      enabled: false,
      dataUrl: '',
      path: '',
    });
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app?.RemoveCustomBackground) {
        await app.RemoveCustomBackground();
      }
      get().addNotification({
        type: 'info',
        title: 'Background Cleared',
        message: 'Reverted to default background.',
      });
    } catch (e) {
      console.warn('Failed to remove custom background from backend:', e);
    }
  },

  // Sidebar
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  sidebarMode: 'client',
  setSidebarMode: (sidebarMode) => set({ sidebarMode }),

  // Notifications
  notifications: [],
  addNotification: (notification) => {
    const id = `notif-${++notificationCounter}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      duration: notification.duration ?? 5000,
    };
    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));
    // Auto-remove after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, newNotification.duration);
    }
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clearNotifications: () => set({ notifications: [] }),

  // Loading
  globalLoading: false,
  setGlobalLoading: (loading) => set({ globalLoading: loading }),
  loadingStates: {},
  setLoading: (key, loading) =>
    set((state) => ({
      loadingStates: { ...state.loadingStates, [key]: loading },
    })),
  isLoading: (key) => get().loadingStates[key] ?? false,

  // Search
  globalSearchOpen: false,
  setGlobalSearchOpen: (open) => set({ globalSearchOpen: open }),
}));
