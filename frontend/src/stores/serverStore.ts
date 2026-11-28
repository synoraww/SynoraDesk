import { create } from 'zustand';
import { usePanelStore } from './panelStore';

export interface Server {
  server_owner: boolean;
  identifier: string;
  internal_id?: number;
  uuid: string;
  name: string;
  node: string;
  description: string;
  limits: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
    threads: string | null;
  };
  feature_limits: {
    databases: number;
    allocations: number;
    backups: number;
  };
  status: string | null;
  is_suspended: boolean;
  is_installing: boolean;
  is_transferring: boolean;
  allocations?: Array<{
    id: number;
    ip: string;
    ip_alias: string | null;
    port: number;
    notes: string | null;
    is_default: boolean;
  }>;
  docker_image?: string;
  egg_name?: string;
  user_permissions?: string[];
  sftp_details?: {
    ip: string;
    port: number;
  };
}

export interface ResourceUsage {
  current_state: string;
  is_suspended: boolean;
  resources: {
    memory_bytes: number;
    cpu_absolute: number;
    disk_bytes: number;
    network_rx_bytes: number;
    network_tx_bytes: number;
    uptime: number;
  };
}

export interface DashboardStats {
  totalPanels: number;
  activePanel: string;
  activePanelName: string;
  totalServers: number;
  runningServers: number;
  offlineServers: number;
  totalNodes: number;
}

interface ServerState {
  servers: Server[];
  selectedServer: Server | null;
  resources: Record<string, ResourceUsage>;
  dashboardStats: DashboardStats | null;
  loading: boolean;
  error: string | null;
  searchQuery: string;

  // Actions
  setServers: (servers: Server[]) => void;
  setSelectedServer: (server: Server | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  resetPanelData: () => void;

  // Async actions
  fetchServers: () => Promise<void>;
  fetchServer: (identifier: string) => Promise<void>;
  fetchResources: (identifier: string) => Promise<void>;
  sendPowerAction: (identifier: string, signal: string) => Promise<void>;
  fetchDashboardStats: () => Promise<void>;
}

const getWailsBindings = () => {
  // @ts-ignore
  const go = window.go;
  if (!go?.main?.App) {
    throw new Error('Wails bindings not available');
  }
  return go.main.App;
};

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  selectedServer: null,
  resources: {},
  dashboardStats: null,
  loading: false,
  error: null,
  searchQuery: '',

  setServers: (servers) => set({ servers }),
  setSelectedServer: (server) => set({ selectedServer: server }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  resetPanelData: () =>
    set({
      servers: [],
      selectedServer: null,
      resources: {},
      dashboardStats: null,
      error: null,
      loading: false,
    }),

  fetchServers: async () => {
    const active = usePanelStore.getState().activePanel;
    if (!active || !active.hasClientKey) {
      set({
        servers: [],
        selectedServer: null,
        resources: {},
        error: null,
        loading: false,
      });
      return;
    }
    set({ loading: true, error: null });
    const start = performance.now();
    try {
      const app = getWailsBindings();
      const servers = await app.ListServers();
      const elapsed = performance.now() - start;
      usePanelStore.getState().recordLatency(elapsed);
      set({ servers: servers || [], loading: false, error: null });
    } catch (err: any) {
      const msg = err?.message || String(err) || 'Không thể kết nối đến máy chủ';
      usePanelStore.getState().markDisconnected(msg);
      set({
        servers: [],
        selectedServer: null,
        resources: {},
        error: msg,
        loading: false,
      });
    }
  },

  fetchServer: async (identifier) => {
    const start = performance.now();
    try {
      const app = getWailsBindings();
      const server = await app.GetServer(identifier);
      const elapsed = performance.now() - start;
      usePanelStore.getState().recordLatency(elapsed);
      set({ selectedServer: server, error: null });
    } catch (err: any) {
      const msg = err?.message || String(err) || 'Không thể kết nối đến máy chủ';
      usePanelStore.getState().markDisconnected(msg);
      set({ error: msg });
    }
  },

  fetchResources: async (identifier) => {
    try {
      const app = getWailsBindings();
      const usage = await app.GetServerResources(identifier);
      set((state) => ({
        resources: { ...state.resources, [identifier]: usage },
      }));
    } catch (err: any) {
      // Non-fatal - resource fetch can fail temporarily
    }
  },

  sendPowerAction: async (identifier, signal) => {
    const app = getWailsBindings();
    await app.SendPowerAction(identifier, signal);
  },

  fetchDashboardStats: async () => {
    const active = usePanelStore.getState().activePanel;
    if (!active) {
      set({ dashboardStats: null });
      return;
    }
    const start = performance.now();
    try {
      const app = getWailsBindings();
      const stats = await app.GetDashboardStats();
      const elapsed = performance.now() - start;
      if (active.hasClientKey) {
        usePanelStore.getState().recordLatency(elapsed);
      }
      set({ dashboardStats: stats });
    } catch (err: any) {
      const msg = err?.message || String(err) || 'Không thể kết nối đến máy chủ';
      usePanelStore.getState().markDisconnected(msg);
      set({ dashboardStats: null, error: msg });
    }
  },
}));
