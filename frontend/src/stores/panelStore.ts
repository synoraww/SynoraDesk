import { create } from 'zustand';
import { useSecurityStore } from './securityStore';
import { useServerStore } from './serverStore';
import { PermissionProbeStatus } from '../types/admin';

// Types matching Go backend models
export interface Panel {
  id: string;
  name: string;
  url: string;
  version: string;
  isActive: boolean;
  hasClientKey: boolean;
  hasAppKey: boolean;
  maskedClientKey?: string;
  maskedAppKey?: string;
  accountUsername?: string;
  accountEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: number;
  admin: boolean;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  language?: string;
  '2fa'?: boolean;
  '2fa_enabled'?: boolean;
}

export interface PanelInput {
  name: string;
  url: string;
  clientApiKey?: string;
  appApiKey?: string;
}

export interface ConnectionTestResult {
  clientApi: boolean;
  clientError?: string;
  appApi: boolean;
  appError?: string;
  version?: string;
  accountName?: string;
  accountEmail?: string;
  accountAdmin?: boolean;
}

interface PanelState {
  // Panel list
  panels: Panel[];
  activePanel: Panel | null;
  currentAccount: Account | null;
  panelAccounts: Record<string, Account>;
  loading: boolean;
  error: string | null;
  panelPingMs: number | null;
  connectionStatus: 'idle' | 'checking' | 'connected' | 'disconnected';
  connectionError: string | null;
  adminPermissions: Record<string, Record<string, PermissionProbeStatus>>;
  probingPermissions: boolean;

  // Actions
  setPanels: (panels: Panel[]) => void;
  setActivePanel: (panel: Panel | null) => void;
  setCurrentAccount: (account: Account | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPanelPingMs: (ping: number | null) => void;
  recordLatency: (durationMs: number) => void;
  markDisconnected: (errorMsg?: string) => void;

  // Async actions (call Go backend)
  fetchPanels: () => Promise<void>;
  fetchActivePanel: () => Promise<void>;
  fetchCurrentAccount: () => Promise<void>;
  fetchPanelAccount: (panelId: string) => Promise<Account | null>;
  checkPanelPing: () => Promise<number | null>;
  addPanel: (input: PanelInput) => Promise<Panel>;
  updatePanel: (id: string, input: PanelInput) => Promise<Panel>;
  deletePanel: (id: string) => Promise<void>;
  switchPanel: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<ConnectionTestResult>;
  probeAdminPermissions: (force?: boolean) => Promise<void>;
}

const getWailsBindings = () => {
  // @ts-ignore - Wails generates these at build time
  const go = window.go;
  if (!go?.main?.App) {
    throw new Error('Wails bindings not available');
  }
  return go.main.App;
};

export const usePanelStore = create<PanelState>((set, get) => ({
  panels: [],
  activePanel: null,
  currentAccount: null,
  panelAccounts: {},
  loading: false,
  error: null,
  panelPingMs: null,
  connectionStatus: 'idle',
  connectionError: null,
  adminPermissions: {},
  probingPermissions: false,

  setPanels: (panels) => set({ panels }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setCurrentAccount: (account) => set({ currentAccount: account }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setPanelPingMs: (panelPingMs) => set({ panelPingMs }),
  recordLatency: (durationMs) => {
    if (typeof durationMs === 'number' && durationMs >= 0) {
      set({
        panelPingMs: Math.round(durationMs),
        connectionStatus: 'connected',
        connectionError: null,
      });
    }
  },
  markDisconnected: (errorMsg) => {
    set({
      panelPingMs: null,
      connectionStatus: 'disconnected',
      connectionError: errorMsg || 'Không thể kết nối đến máy chủ',
    });
  },

  checkPanelPing: async () => {
    if (useSecurityStore.getState().isLocked) {
      return null;
    }
    const active = get().activePanel;
    if (!active) {
      set({ panelPingMs: null, connectionStatus: 'idle', connectionError: null });
      return null;
    }
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app?.PingActivePanel) {
        const ping = await app.PingActivePanel();
        const pingNum = typeof ping === 'number' ? Math.round(ping) : 0;
        set({
          panelPingMs: pingNum,
          connectionStatus: 'connected',
          connectionError: null,
        });
        return pingNum;
      }
    } catch (err: any) {
      const msg = err?.message || String(err) || 'Không thể kết nối đến máy chủ';
      set({
        panelPingMs: null,
        connectionStatus: 'disconnected',
        connectionError: msg,
      });
    }
    return null;
  },

  fetchPanels: async () => {
    set({ loading: true, error: null });
    try {
      const app = getWailsBindings();
      const panels = await app.GetPanels();
      set({ panels: panels || [], loading: false });

      // Automatically fetch accounts for panels that have a client key and are not already cached
      if (panels && panels.length > 0) {
        const activeId = get().activePanel?.id;
        const cachedAccounts = get().panelAccounts;
        panels.forEach((p: Panel) => {
          if (p.hasClientKey && p.id !== activeId && !cachedAccounts[p.id]) {
            get().fetchPanelAccount(p.id);
          }
        });
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch panels', loading: false });
    }
  },

  fetchActivePanel: async () => {
    try {
      const app = getWailsBindings();
      const panel = await app.GetActivePanel();
      if (!panel) {
        set({
          activePanel: null,
          currentAccount: null,
          panelPingMs: null,
          connectionStatus: 'idle',
          connectionError: null,
        });
        useServerStore.getState().resetPanelData();
        return;
      }
      set({
        activePanel: panel,
        currentAccount: panel.hasClientKey ? get().panelAccounts[panel.id] || null : null,
      });
      if (!panel.hasClientKey) {
        useServerStore.getState().resetPanelData();
      } else {
        await get().fetchCurrentAccount();
      }
      await get().checkPanelPing();
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch active panel' });
    }
  },

  fetchCurrentAccount: async () => {
    const active = get().activePanel;
    if (!active || !active.hasClientKey) {
      set({ currentAccount: null });
      return;
    }
    try {
      const app = getWailsBindings();
      const account = await app.GetCurrentAccount();
      if (account) {
        set({ currentAccount: account });
        set((state) => ({
          panelAccounts: {
            ...state.panelAccounts,
            [active.id]: account,
          },
        }));
      }
    } catch (err: any) {
      set({ currentAccount: null });
    }
  },

  fetchPanelAccount: async (panelId: string) => {
    try {
      const app = getWailsBindings();
      const account = await app.GetPanelAccount(panelId);
      if (account) {
        set((state) => ({
          panelAccounts: {
            ...state.panelAccounts,
            [panelId]: account,
          },
        }));
        return account;
      }
    } catch {
      // Ignore errors for individual panels
    }
    return null;
  },

  addPanel: async (input) => {
    const app = getWailsBindings();
    const panel = await app.AddPanel(input);
    await get().fetchPanels();
    await get().fetchActivePanel();
    return panel;
  },

  updatePanel: async (id, input) => {
    const app = getWailsBindings();
    const panel = await app.UpdatePanel(id, input);
    set((state) => {
      const nextPerms = { ...state.adminPermissions };
      delete nextPerms[id];
      const nextAccounts = { ...state.panelAccounts };
      delete nextAccounts[id];
      return { adminPermissions: nextPerms, panelAccounts: nextAccounts };
    });
    await get().fetchPanels();
    if (get().activePanel?.id === id) {
      useServerStore.getState().resetPanelData();
      set({
        currentAccount: null,
        panelPingMs: null,
        connectionStatus: 'checking',
        connectionError: null,
      });
      await get().fetchActivePanel();
      get().probeAdminPermissions(true);
    }
    return panel;
  },

  deletePanel: async (id) => {
    const app = getWailsBindings();
    await app.DeletePanel(id);
    set((state) => {
      const nextPerms = { ...state.adminPermissions };
      delete nextPerms[id];
      const nextAccounts = { ...state.panelAccounts };
      delete nextAccounts[id];
      return { adminPermissions: nextPerms, panelAccounts: nextAccounts };
    });
    await get().fetchPanels();
    if (get().activePanel?.id === id) {
      useServerStore.getState().resetPanelData();
      set({
        activePanel: null,
        currentAccount: null,
        panelPingMs: null,
        connectionStatus: 'idle',
        connectionError: null,
      });
    }
  },

  switchPanel: async (id) => {
    const targetPanel = get().panels.find((p) => p.id === id);
    useServerStore.getState().resetPanelData();
    set({
      activePanel: targetPanel || null,
      currentAccount: targetPanel?.hasClientKey ? get().panelAccounts[id] || null : null,
      panelPingMs: null,
      connectionStatus: 'checking',
      connectionError: null,
    });

    const app = getWailsBindings();
    await app.SwitchPanel(id);
    await get().fetchActivePanel();
    await get().fetchPanels();
    get().checkPanelPing();
  },

  testConnection: async (id) => {
    const app = getWailsBindings();
    const res = await app.TestPanelConnection(id);
    if (res && res.clientApi && res.accountName) {
      set((state) => ({
        panelAccounts: {
          ...state.panelAccounts,
          [id]: {
            id: 0,
            admin: res.accountAdmin || false,
            username: res.accountName || '',
            email: res.accountEmail || '',
          },
        },
      }));
    }
    return res;
  },

  probeAdminPermissions: async (force = false) => {
    const active = get().activePanel;
    if (!active || !active.hasAppKey || useSecurityStore.getState().isLocked) return;
    if (!force && get().adminPermissions[active.id]) return;
    if (get().probingPermissions) return;

    set({ probingPermissions: true });
    try {
      const app = getWailsBindings();
      if (app?.AdminProbePermissions) {
        const res = await app.AdminProbePermissions();
        if (res) {
          set((state) => ({
            adminPermissions: {
              ...state.adminPermissions,
              [active.id]: res,
            },
          }));
          const statuses = Object.values(res) as PermissionProbeStatus[];
          const anyAllowed = statuses.some((s) => s.allowed);
          const allUnreachable =
            statuses.length > 0 &&
            !anyAllowed &&
            statuses.every((s) => !s.statusCode || s.statusCode === 0);
          if (allUnreachable) {
            const firstErr = statuses.find((s) => s.error)?.error || 'Không thể kết nối đến máy chủ';
            get().markDisconnected(firstErr);
          }
        }
      }
    } catch (err: any) {
      get().markDisconnected(err?.message || 'Không thể kết nối đến máy chủ');
    } finally {
      set({ probingPermissions: false });
    }
  },
}));
