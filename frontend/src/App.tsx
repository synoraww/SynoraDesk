import React, { useEffect, useState, useRef } from 'react';
import { AppShell } from './components/layout/AppShell';
import { CustomTitleBar } from './components/layout/CustomTitleBar';
import { NavItemKey } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { ServersPage } from './pages/Servers';
import { ServerDetail } from './pages/ServerDetail';
import { PanelManager, PanelModal } from './pages/PanelManager';
import { NodesPage } from './pages/Nodes';
import { ActivityLogsPage } from './pages/ActivityLogs';
import { SettingsPage } from './pages/Settings';
import { FileEditorTab } from './components/common/FileEditorTab';
import { WelcomeModal } from './components/common/WelcomeModal';
import { MultiTabAlertBanner } from './components/common/MultiTabAlertBanner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { APP_CONFIG } from './config/version';
import { usePanelStore } from './stores/panelStore';
import { useSecurityStore } from './stores/securityStore';
import { useUIStore } from './stores/uiStore';
import { useWorkspaceStore, WorkspaceTab } from './stores/workspaceStore';
import { GetDetachedModeInfo, CloseCurrentWindow } from '../wailsjs/go/main/App';
import { main } from '../wailsjs/go/models';

export function App() {
  const [isPanelModalOpen, setIsPanelModalOpen] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(() => {
    // Detached secondary windows do not need onboarding
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('detached') === 'true') return false;

    const accepted = localStorage.getItem('pterodesk_terms_accepted') === 'true';
    const version = localStorage.getItem('pterodesk_terms_version');
    return !accepted || version !== APP_CONFIG.termsVersion;
  });

  // Detached standalone window configuration (via Go process flags or URL params)
  const [detachedConfig, setDetachedConfig] = useState<main.DetachedWindowConfig | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('detached') === 'true') {
      return new main.DetachedWindowConfig({
        isDetached: true,
        type: urlParams.get('type') || 'server',
        server: urlParams.get('server') || '',
        subtab: urlParams.get('subtab') || 'ide',
        filePath: urlParams.get('file') || '',
        title: urlParams.get('title') || '',
      });
    }
    return null;
  });

  useEffect(() => {
    if (!detachedConfig?.isDetached) {
      GetDetachedModeInfo().then((info: any) => {
        if (info && info.isDetached) {
          setDetachedConfig(info);
        }
      }).catch(() => {});
    }
  }, []);

  const { fetchPanels, fetchActivePanel } = usePanelStore();
  const { theme, accentTheme, loadCustomBackgroundFromBackend, customBackground } = useUIStore();
  const { tabs, activeTabId, openTab, openServerTab, setActiveTabId, navigateCurrentTab } = useWorkspaceStore();
  const hasBg = customBackground.enabled && Boolean(customBackground.dataUrl);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Global Zoom State and Keyboard Hotkeys (Ctrl + / Ctrl - / Ctrl 0 / Ctrl + Wheel)
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    const saved = localStorage.getItem('pterodesk_zoom_level');
    const parsed = saved ? parseInt(saved, 10) : 100;
    return !isNaN(parsed) && parsed >= 50 && parsed <= 200 ? parsed : 100;
  });
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyZoom = (newZoom: number) => {
    const clamped = Math.max(50, Math.min(200, Math.round(newZoom)));
    setZoomLevel(clamped);
    (document.documentElement.style as any).zoom = `${clamped}%`;
    localStorage.setItem('pterodesk_zoom_level', String(clamped));

    setShowZoomIndicator(true);
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => {
      setShowZoomIndicator(false);
    }, 1500);
  };

  useEffect(() => {
    // Clean up any legacy manual #root styles and apply saved zoom to documentElement
    const root = document.getElementById('root');
    if (root) {
      (root.style as any).zoom = '';
      root.style.width = '100%';
      root.style.height = '100%';
    }

    const saved = localStorage.getItem('pterodesk_zoom_level');
    const initial = saved ? parseInt(saved, 10) : 100;
    const clamped = !isNaN(initial) && initial >= 50 && initial <= 200 ? initial : 100;
    (document.documentElement.style as any).zoom = `${clamped}%`;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Zoom in: Ctrl + Equal or Ctrl + Plus or NumpadAdd
        if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd' || e.code === 'Equal') {
          e.preventDefault();
          setZoomLevel((prev) => {
            const next = Math.min(200, prev + 10);
            applyZoom(next);
            return next;
          });
        }
        // Zoom out: Ctrl + Minus or NumpadSubtract
        else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.code === 'Minus') {
          e.preventDefault();
          setZoomLevel((prev) => {
            const next = Math.max(50, prev - 10);
            applyZoom(next);
            return next;
          });
        }
        // Reset zoom: Ctrl + 0 or Numpad0
        else if (e.key === '0' || e.code === 'Numpad0' || e.code === 'Digit0') {
          e.preventDefault();
          applyZoom(100);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 10 : -10;
        setZoomLevel((prev) => {
          const next = Math.max(50, Math.min(200, prev + delta));
          applyZoom(next);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
      if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    };
  }, []);

  const isLocked = useSecurityStore((s) => s.isLocked);

  useEffect(() => {
    // Set theme and accent attributes
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-accent', accentTheme);

    // Load custom background from backend
    loadCustomBackgroundFromBackend();

    // Listen for Wails events if runtime is available
    // @ts-ignore
    if (window.runtime?.EventsOn) {
      // @ts-ignore
      window.runtime.EventsOn('panel:switched', () => {
        if (!useSecurityStore.getState().isLocked) {
          fetchActivePanel();
        }
      });
    }
  }, []);

  // Intercept initial data fetching: check useSecurityStore.getState().isLocked
  // Once isLocked becomes false, trigger fetchPanels() and start normal pinging
  useEffect(() => {
    if (isLocked) {
      return;
    }

    fetchPanels();
    fetchActivePanel().then(() => {
      const panel = usePanelStore.getState().activePanel;
      if (panel) {
        const { tabs, updateTab } = useWorkspaceStore.getState();
        if (tabs.length > 0 && !tabs[0].panelId) {
          updateTab(tabs[0].id, { panelId: panel.id });
        }
      }
    });

    // Start normal periodic ping loop while unlocked
    const pingInterval = setInterval(() => {
      if (!useSecurityStore.getState().isLocked) {
        usePanelStore.getState().checkPanelPing();
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
    };
  }, [isLocked]);

  // Map active tab type to Sidebar NavItemKey
  const getSidebarKey = (tab: WorkspaceTab): NavItemKey => {
    switch (tab.type) {
      case 'dashboard':
        return 'dashboard';
      case 'server':
        return 'servers';
      case 'apikeys':
        return 'apikeys';
      case 'settings':
        return 'settings';
      default:
        return 'dashboard';
    }
  };

  const handleSidebarNavigate = (navKey: NavItemKey) => {
    switch (navKey) {
      case 'dashboard':
        navigateCurrentTab({ title: 'pterodesk', iconType: 'folder', type: 'dashboard', serverIdentifier: undefined, filePath: undefined });
        break;
      case 'servers':
        navigateCurrentTab({ title: 'Servers', iconType: 'server', type: 'server', serverIdentifier: undefined, filePath: undefined });
        break;
      case 'apikeys':
        navigateCurrentTab({ title: 'Account Manager', iconType: 'settings', type: 'apikeys', serverIdentifier: undefined, filePath: undefined });
        break;
      case 'settings':
        navigateCurrentTab({ title: 'Settings', iconType: 'settings', type: 'settings', serverIdentifier: undefined, filePath: undefined });
        break;
    }
  };

  const handleSelectServer = (identifier: string, name?: string, inNewTab = false) => {
    openServerTab(identifier, name, 'console', inNewTab);
  };

  const renderTabContent = (tab: WorkspaceTab) => {
    if (tab.type === 'dashboard') {
      return (
        <Dashboard
          onNavigateTab={handleSidebarNavigate}
          onOpenPanelModal={() => setIsPanelModalOpen(true)}
          onSelectServer={handleSelectServer}
        />
      );
    }

    if (tab.type === 'server') {
      if (tab.serverIdentifier) {
        return (
          <ServerDetail
            identifier={tab.serverIdentifier}
            onBack={() => {
              // Switch or reset back to servers list
              useWorkspaceStore.getState().updateTab(tab.id, {
                serverIdentifier: undefined,
                title: 'Servers',
              });
            }}
          />
        );
      }
      return (
        <ServersPage
          onSelectServer={handleSelectServer}
          onOpenPanelModal={() => setIsPanelModalOpen(true)}
        />
      );
    }

    if (tab.type === 'file-editor' && tab.serverIdentifier && tab.filePath) {
      return (
        <FileEditorTab
          serverIdentifier={tab.serverIdentifier}
          filePath={tab.filePath}
          tabId={tab.id}
        />
      );
    }

    if (tab.type === 'nodes') {
      return <NodesPage onOpenPanelModal={() => setIsPanelModalOpen(true)} />;
    }

    if (tab.type === 'apikeys') {
      return <PanelManager onOpenModal={() => setIsPanelModalOpen(true)} />;
    }

    if (tab.type === 'activities') {
      return <ActivityLogsPage />;
    }

    if (tab.type === 'settings') {
      return <SettingsPage />;
    }

    if (tab.type === 'eggs') {
      return (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>
            Egg & Nest Manager
          </h2>
          <p style={{ fontSize: '13px', maxWidth: '460px', margin: '0 auto' }}>
            Manage server game categories and eggs via Application API.
          </p>
        </div>
      );
    }

    return null;
  };

  // If running in detached standalone window, render with CustomTitleBar
  if (detachedConfig?.isDetached) {
    const handleClose = () => {
      CloseCurrentWindow().catch(() => window.close());
    };

    const detachedTitle =
      detachedConfig.title ||
      (detachedConfig.type === 'file-editor' && detachedConfig.filePath
        ? `${detachedConfig.filePath.split('/').pop()} - Trình chỉnh sửa`
        : detachedConfig.server
        ? `Máy chủ: ${detachedConfig.server}`
        : detachedConfig.type === 'nodes'
        ? 'Quản lý Nodes'
        : detachedConfig.type === 'apikeys'
        ? 'Quản lý Tài khoản & API Key'
        : detachedConfig.type === 'settings'
        ? 'Cài đặt'
        : 'SynoraDesk - Cửa sổ phụ');

    return (
      <div
        className="app-shell-root"
        style={{
          width: '100%',
          height: '100%',
          minWidth: '100%',
          maxWidth: '100%',
          minHeight: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-bg)',
          overflow: 'hidden',
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        {/* Custom Draggable TitleBar for Detached Window */}
        <CustomTitleBar
          title={detachedTitle}
          isDetached={true}
          onClose={handleClose}
        />

        {/* Background Image Layer */}
        {hasBg && (
          <div
            className="app-custom-bg-layer"
            style={{
              filter: customBackground.blur > 0 ? `blur(${customBackground.blur}px)` : 'none',
            }}
          >
            <img
              src={customBackground.dataUrl}
              alt="App Wallpaper"
              style={{
                width: '100%',
                height: '100%',
                objectFit: customBackground.fitMode === 'contain' ? 'contain' : 'cover',
                objectPosition: `${customBackground.positionX ?? 50}% ${customBackground.positionY ?? 50}%`,
                transform: `scale(${customBackground.scale ?? 1})`,
                transformOrigin: `${customBackground.positionX ?? 50}% ${customBackground.positionY ?? 50}%`,
                transition: 'filter 0.15s ease, transform 0.1s ease',
                display: 'block',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          </div>
        )}

        {/* Background Tint Overlay */}
        {hasBg && (
          <div
            className="app-custom-bg-overlay"
            style={{
              backgroundColor:
                theme === 'dark'
                  ? `rgba(11, 15, 25, ${customBackground.opacity})`
                  : `rgba(248, 250, 252, ${customBackground.opacity})`,
            }}
          />
        )}

        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2 }}>
          <ErrorBoundary>
            {detachedConfig.type === 'file-editor' && detachedConfig.server && detachedConfig.filePath ? (
              <FileEditorTab
                serverIdentifier={detachedConfig.server}
                filePath={detachedConfig.filePath}
                tabId="detached-file-editor"
              />
            ) : detachedConfig.server ? (
              <ServerDetail
                identifier={detachedConfig.server}
                onBack={handleClose}
                initialTab={detachedConfig.subtab || 'ide'}
                isDetachedWindow={true}
              />
            ) : detachedConfig.type === 'nodes' ? (
              <NodesPage onOpenPanelModal={() => setIsPanelModalOpen(true)} />
            ) : detachedConfig.type === 'apikeys' ? (
              <PanelManager onOpenModal={() => setIsPanelModalOpen(true)} />
            ) : detachedConfig.type === 'settings' ? (
              <SettingsPage />
            ) : (
              <div style={{ padding: '24px', color: 'var(--color-text)' }}>
                Cửa sổ riêng độc lập
              </div>
            )}
          </ErrorBoundary>
        </div>

        {/* Floating Zoom Indicator Pill */}
        {showZoomIndicator && (
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 999999,
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--color-border)',
              borderRadius: '24px',
              padding: '8px 16px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px var(--color-primary-glow)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            <span style={{ color: 'var(--color-primary-light)' }}>Thu phóng:</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{zoomLevel}%</span>
            {zoomLevel !== 100 && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                (Ctrl + 0 để về 100%)
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <AppShell
        currentTab={getSidebarKey(activeTab)}
        onSelectTab={handleSidebarNavigate}
        onOpenPanelModal={() => setIsPanelModalOpen(true)}
      >
        {/* Preserved multi-tab containers in the DOM */}
        {tabs.map((tab) => {
          const isVisible = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              style={{
                display: isVisible ? 'flex' : 'none',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                height: '100%',
                width: '100%',
              }}
            >
              <ErrorBoundary>
                {renderTabContent(tab)}
              </ErrorBoundary>
            </div>
          );
        })}

        {/* Global Add/Edit Panel Modal */}
        <PanelModal
          isOpen={isPanelModalOpen}
          onClose={() => setIsPanelModalOpen(false)}
          onSaved={() => {
            fetchPanels();
            fetchActivePanel();
          }}
        />

        {/* First-time Welcome & Privacy Terms Onboarding Modal */}
        <WelcomeModal
          isOpen={isWelcomeOpen}
          onClose={() => setIsWelcomeOpen(false)}
          canDismissWithoutAccept={false}
        />

        {/* Multi-Tab Conflict Alert Banner */}
        <MultiTabAlertBanner />
      </AppShell>

      {/* Floating Zoom Indicator Pill */}
      {showZoomIndicator && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 999999,
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--color-border)',
            borderRadius: '24px',
            padding: '8px 16px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px var(--color-primary-glow)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 600,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: 'var(--color-primary-light)' }}>Thu phóng:</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{zoomLevel}%</span>
          {zoomLevel !== 100 && (
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 400 }}>
              (Ctrl + 0 để về 100%)
            </span>
          )}
        </div>
      )}
    </>
  );
}

export default App;
