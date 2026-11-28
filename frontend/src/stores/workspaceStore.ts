import { create } from 'zustand';
import { usePanelStore } from './panelStore';

export type WorkspaceTabType =
  | 'dashboard'
  | 'server'
  | 'file-editor'
  | 'settings'
  | 'nodes'
  | 'activities'
  | 'apikeys'
  | 'eggs'
  | 'ide'
  | 'admin-overview'
  | 'admin-users'
  | 'admin-servers'
  | 'admin-nodes'
  | 'admin-locations'
  | 'admin-nests'
  | 'admin-eggs'
  | 'admin-allocations'
  | 'admin-databases'
  | 'admin-panel-settings'
  | 'admin-api-settings';

export interface WorkspaceTab {
  id: string;
  title: string;
  iconType: 'folder' | 'server' | 'file' | 'settings' | 'nodes' | 'database' | 'terminal' | 'code';
  type: WorkspaceTabType;
  panelId?: string; // Explicit panel session bound to this tab
  serverIdentifier?: string;
  serverName?: string;
  serverSubTab?: string;
  filePath?: string;
  isDirty?: boolean;
  targetEntityId?: number;
}

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeTabId: string;
  editorOpenInNewTab: boolean;
  duplicateHighlightTabId: string | null;

  // Actions
  openTab: (tab: Omit<WorkspaceTab, 'id'> & { id?: string }, allowDuplicate?: boolean) => string;
  closeTab: (tabId: string) => void;
  setActiveTabId: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<WorkspaceTab>) => void;
  navigateCurrentTab: (updates: Partial<WorkspaceTab>) => void;
  setEditorOpenInNewTab: (enabled: boolean) => void;
  openServerTab: (identifier: string, name?: string, subTab?: string, inNewTab?: boolean) => string;
  openFileInTab: (identifier: string, filePath: string, inNewTab?: boolean) => string;
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
    duplicateHighlightTabId: null,

    setEditorOpenInNewTab: (enabled: boolean) => {
      localStorage.setItem('pterodesk_editor_open_new_tab', String(enabled));
      set({ editorOpenInNewTab: enabled });
    },

    // Open tab with duplicate tab prevention mechanism (chống mở 2 tab trùng)
    openTab: (tabInput, allowDuplicate = false) => {
      const state = get();
      const activePanel = usePanelStore.getState().activePanel;
      const targetPanelId = tabInput.panelId || activePanel?.id;

      // Duplicate check: if an identical tab is already open, focus it instead of duplicating!
      if (!allowDuplicate) {
        const existingTab = state.tabs.find((t) => {
          // Case 1: Same server
          if (tabInput.serverIdentifier && t.serverIdentifier) {
            return (
              t.serverIdentifier === tabInput.serverIdentifier &&
              (t.panelId === targetPanelId || !t.panelId || !targetPanelId)
            );
          }

          // Case 2: Same file editor
          if (tabInput.filePath && t.filePath) {
            return (
              t.filePath === tabInput.filePath &&
              t.serverIdentifier === tabInput.serverIdentifier
            );
          }

          // Case 3: Same singleton view (dashboard, settings, nodes, activities, apikeys, admin-*)
          if (
            [
              'dashboard',
              'settings',
              'nodes',
              'activities',
              'apikeys',
              'admin-overview',
              'admin-users',
              'admin-servers',
              'admin-nodes',
              'admin-locations',
              'admin-nests',
              'admin-eggs',
              'admin-allocations',
              'admin-databases',
              'admin-panel-settings',
              'admin-api-settings',
            ].includes(tabInput.type)
          ) {
            return t.type === tabInput.type && (t.panelId === targetPanelId || !t.panelId || !targetPanelId);
          }

          return false;
        });

        if (existingTab) {
          // Switch to already open tab
          get().setActiveTabId(existingTab.id);

          // Update subtab if provided
          if (tabInput.serverSubTab && existingTab.serverSubTab !== tabInput.serverSubTab) {
            get().updateTab(existingTab.id, { serverSubTab: tabInput.serverSubTab });
          }

          // Highlight the existing tab briefly
          set({ duplicateHighlightTabId: existingTab.id });
          setTimeout(() => {
            if (get().duplicateHighlightTabId === existingTab.id) {
              set({ duplicateHighlightTabId: null });
            }
          }, 1200);

          return existingTab.id;
        }
      }

      const id = tabInput.id || `tab-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const newTab: WorkspaceTab = {
        ...tabInput,
        panelId: targetPanelId,
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
      get().updateTab(activeTabId, { targetEntityId: undefined, ...updates });
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

      // Duplicate prevention: check if this server is already open in ANY existing tab
      const existingTab = get().tabs.find(
        (t) =>
          t.serverIdentifier === identifier &&
          (t.panelId === currentActivePanel?.id || !t.panelId || !currentActivePanel?.id)
      );

      if (existingTab) {
        get().setActiveTabId(existingTab.id);
        if (subTab && existingTab.serverSubTab !== subTab) {
          get().updateTab(existingTab.id, { serverSubTab: subTab });
        }
        set({ duplicateHighlightTabId: existingTab.id });
        setTimeout(() => {
          if (get().duplicateHighlightTabId === existingTab.id) {
            set({ duplicateHighlightTabId: null });
          }
        }, 1200);
        return existingTab.id;
      }

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

    openFileInTab: (identifier, filePath, inNewTab?: boolean) => {
      const fileName = filePath.split('/').pop() || filePath;
      const openInTab = inNewTab !== undefined ? inNewTab : get().editorOpenInNewTab;
      const currentActivePanel = usePanelStore.getState().activePanel;

      // Duplicate prevention: check if this exact file is already open in another tab
      const existingTab = get().tabs.find(
        (t) =>
          t.type === 'file-editor' &&
          t.filePath === filePath &&
          t.serverIdentifier === identifier
      );

      if (existingTab) {
        get().setActiveTabId(existingTab.id);
        set({ duplicateHighlightTabId: existingTab.id });
        setTimeout(() => {
          if (get().duplicateHighlightTabId === existingTab.id) {
            set({ duplicateHighlightTabId: null });
          }
        }, 1200);
        return existingTab.id;
      }

      const tabData = {
        title: fileName,
        iconType: 'file' as const,
        type: 'file-editor' as const,
        panelId: currentActivePanel?.id,
        serverIdentifier: identifier,
        filePath,
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
