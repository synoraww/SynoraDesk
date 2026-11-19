import { create } from 'zustand';
import { usePanelStore } from './panelStore';

export type WorkspaceTabType =
  | 'dashboard'
  | 'server'
  | 'file-editor'
  | 'settings'
  | 'nodes'
  | 'databases'
  | 'sftp'
  | 'activities'
  | 'apikeys'
  | 'eggs'
  | 'ide';

export interface WorkspaceTab {
  id: string;
  title: string;
  iconType: 'folder' | 'server' | 'file' | 'settings' | 'nodes' | 'database' | 'terminal' | 'sftp' | 'code';
  type: WorkspaceTabType;
  panelId?: string; // Explicit panel session bound to this tab
  serverIdentifier?: string;
  serverName?: string;
  serverSubTab?: string;
  filePath?: string;
  isSftp?: boolean;
  isDirty?: boolean;
}

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeTabId: string;
  editorOpenInNewTab: boolean;

  // Actions
  openTab: (tab: Omit<WorkspaceTab, 'id'> & { id?: string }) => string;
  closeTab: (tabId: string) => void;
  setActiveTabId: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<WorkspaceTab>) => void;
  navigateCurrentTab: (updates: Partial<WorkspaceTab>) => void;
  setEditorOpenInNewTab: (enabled: boolean) => void;
  openServerTab: (identifier: string, name?: string, subTab?: string, inNewTab?: boolean) => string;
  openFileInTab: (identifier: string, filePath: string, isSftp?: boolean, inNewTab?: boolean) => string;
}

const getInitialEditorPreference = (): boolean => {
  const saved = localStorage.getItem('pterodesk_editor_open_new_tab');
  return saved ? saved === 'true' : false;
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  const initialTab: WorkspaceTab = {
    id: 'tab-default',
    title: 'SynoraDesk',
    iconType: 'folder',
    type: 'dashboard',
  };

  return {
    tabs: [initialTab],
    activeTabId: initialTab.id,
    editorOpenInNewTab: getInitialEditorPreference(),

    setEditorOpenInNewTab: (enabled: boolean) => {
      localStorage.setItem('pterodesk_editor_open_new_tab', String(enabled));
      set({ editorOpenInNewTab: enabled });
    },

    // Open a brand-new independent tab without hijacking any existing tab
    openTab: (tabInput) => {
      const state = get();
      const id = tabInput.id || `tab-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const activePanel = usePanelStore.getState().activePanel;

      const newTab: WorkspaceTab = {
        ...tabInput,
        panelId: tabInput.panelId || activePanel?.id,
        id,
      };

      set({
        tabs: [...state.tabs, newTab],
        activeTabId: id,
      });

      // Synchronize panel if this tab belongs to a different panel
      if (newTab.panelId && newTab.panelId !== activePanel?.id) {
        usePanelStore.getState().switchPanel(newTab.panelId);
      }

      return id;
    },

    // Update the active tab in-place (keeps the tab session completely independent)
    navigateCurrentTab: (updates) => {
      const { activeTabId } = get();
      get().updateTab(activeTabId, updates);
    },

    closeTab: (tabId) => {
      const state = get();
      const currentActivePanel = usePanelStore.getState().activePanel;

      if (state.tabs.length <= 1) {
        // Don't close the last tab, reset it to default dashboard
        set({
          tabs: [
            {
              id: 'tab-default',
              title: 'SynoraDesk',
              iconType: 'folder',
              type: 'dashboard',
              panelId: currentActivePanel?.id,
            },
          ],
          activeTabId: 'tab-default',
        });
        return;
      }

      const index = state.tabs.findIndex((t) => t.id === tabId);
      const newTabs = state.tabs.filter((t) => t.id !== tabId);

      let nextActiveId = state.activeTabId;
      if (state.activeTabId === tabId) {
        // Activate previous or next tab
        const nextIndex = Math.max(0, index - 1);
        nextActiveId = newTabs[nextIndex]?.id || newTabs[0].id;
      }

      set({
        tabs: newTabs,
        activeTabId: nextActiveId,
      });

      // Synchronize panel session for the next active tab
      const nextTab = newTabs.find((t) => t.id === nextActiveId);
      if (nextTab && nextTab.panelId && nextTab.panelId !== currentActivePanel?.id) {
        usePanelStore.getState().switchPanel(nextTab.panelId);
      }
    },

    setActiveTabId: (tabId) => {
      const state = get();
      const targetTab = state.tabs.find((t) => t.id === tabId);
      set({ activeTabId: tabId });

      // If the target tab belongs to a panel different from the currently active panel,
      // seamlessly switch the backend active panel and account to match this tab's session!
      if (targetTab && targetTab.panelId) {
        const currentActivePanelId = usePanelStore.getState().activePanel?.id;
        if (targetTab.panelId !== currentActivePanelId) {
          usePanelStore.getState().switchPanel(targetTab.panelId);
        }
      }
    },

    updateTab: (tabId, updates) => {
      set((state) => ({
        tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t)),
      }));
    },

    openServerTab: (identifier, name, subTab = 'console', inNewTab = false) => {
      const title = name || identifier;
      const currentActivePanel = usePanelStore.getState().activePanel;

      const tabData = {
        title,
        iconType: 'server' as const,
        type: 'server' as const,
        panelId: currentActivePanel?.id,
        serverIdentifier: identifier,
        serverName: name,
        serverSubTab: subTab,
      };

      if (inNewTab) {
        return get().openTab(tabData);
      }

      // Navigate inside current active tab
      const currentTab = get().tabs.find((t) => t.id === get().activeTabId);
      if (currentTab) {
        get().navigateCurrentTab(tabData);
        return currentTab.id;
      }

      return get().openTab(tabData);
    },

    openFileInTab: (identifier, filePath, isSftp = false, inNewTab?: boolean) => {
      const fileName = filePath.split('/').pop() || filePath;
      const openInTab = inNewTab !== undefined ? inNewTab : get().editorOpenInNewTab;
      const currentActivePanel = usePanelStore.getState().activePanel;

      const tabData = {
        title: fileName,
        iconType: 'file' as const,
        type: 'file-editor' as const,
        panelId: currentActivePanel?.id,
        serverIdentifier: identifier,
        filePath,
        isSftp,
      };

      if (openInTab) {
        return get().openTab(tabData);
      }

      // Navigate inside current tab
      const currentTab = get().tabs.find((t) => t.id === get().activeTabId);
      if (currentTab) {
        get().navigateCurrentTab(tabData);
        return currentTab.id;
      }

      return get().openTab(tabData);
    },
  };
});
