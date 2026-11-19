import { create } from 'zustand';
import { useSecurityStore } from './securityStore';

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

  // Actions
  setPanels: (panels: Panel[]) => void;
  setActivePanel: (panel: Panel | null) => void;
  setCurrentAccount: (account: Account | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPanelPingMs: (ping: number | null) => void;
  recordLatency: (durationMs: number) => void;

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

  setPanels: (panels) => set({ panels }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setCurrentAccount: (account) => set({ currentAccount: account }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setPanelPingMs: (panelPingMs) => set({ panelPingMs }),
  recordLatency: (durationMs) => {
    if (typeof durationMs === 'number' && durationMs >= 0) {
      set({ panelPingMs: Math.round(durationMs) });
    }
  },

  checkPanelPing: async () => {
    if (useSecurityStore.getState().isLocked) {
      return null;
    }
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app?.PingActivePanel) {
        const ping = await app.PingActivePanel();
        const pingNum = typeof ping === 'number' ? Math.round(ping) : null;
        set({ panelPingMs: pingNum });
        return pingNum;
      } else if (app?.GetActivePanelPing) {
        const ping = await app.GetActivePanelPing();
        const pingNum = typeof ping === 'number' && ping > 0 ? Math.round(ping) : null;
        set({ panelPingMs: pingNum });
        return pingNum;
      }
    } catch {
      // Non-fatal if offline
    }
    return null;
  },

  fetchPanels: async () => {
    set({ loading: true, error: null });
    try {
      const app = getWailsBindings();
      const panels = await app.GetPanels();
      set({ panels: panels || [], loading: false });

      // Automatically fetch accounts for each panel that has a client key
      if (panels && panels.length > 0) {
        panels.forEach((p: Panel) => {
          if (p.hasClientKey) {
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
      set({ activePanel: panel });
      if (panel) {
        await get().fetchCurrentAccount();
        get().checkPanelPing();
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch active panel' });
    }
  },

  fetchCurrentAccount: async () => {
    try {
      const app = getWailsBindings();
      const account = await app.GetCurrentAccount();
      if (account) {
        set({ currentAccount: account });
        const active = get().activePanel;
        if (active) {
          set((state) => ({
            panelAccounts: {
              ...state.panelAccounts,
              [active.id]: account,
            },
          }));
        }
      }
    } catch {
      // Ignored if account not available or offline
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
    return panel;
  },

  updatePanel: async (id, input) => {
    const app = getWailsBindings();
    const panel = await app.UpdatePanel(id, input);
    await get().fetchPanels();
    return panel;
  },

  deletePanel: async (id) => {
    const app = getWailsBindings();
    await app.DeletePanel(id);
    await get().fetchPanels();
    if (get().activePanel?.id === id) {
      set({ activePanel: null, currentAccount: null });
    }
  },

  switchPanel: async (id) => {
    // Immediately set active panel and cached account from state to avoid any visual lag
    const targetPanel = get().panels.find((p) => p.id === id);
    if (targetPanel) {
      set({
        activePanel: targetPanel,
        currentAccount: get().panelAccounts[id] || null,
      });
    }

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
}));
