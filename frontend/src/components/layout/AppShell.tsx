import React, { useEffect, useState } from 'react';
import { Sidebar, NavItemKey } from './Sidebar';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { WorkspaceTabBar } from './WorkspaceTabBar';
import { CustomTitleBar } from './CustomTitleBar';
import { AppLockScreen } from '../security/AppLockScreen';
import { UpdateCheckerModal } from '../common/UpdateCheckerModal';
import { useUIStore } from '../../stores/uiStore';
import { useSecurityStore } from '../../stores/securityStore';
import { WindowGetSize, WindowGetPosition, WindowIsMaximised } from '../../../wailsjs/runtime/runtime';
import { SaveWindowState } from '../../../wailsjs/go/main/App';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface AppShellProps {
  currentTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
  onOpenPanelModal: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onSelectTab,
  onOpenPanelModal,
  children,
}) => {
  const { notifications, removeNotification, customBackground, theme } = useUIStore();
  const { initSecurity } = useSecurityStore();
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const hasBg = customBackground.enabled && Boolean(customBackground.dataUrl);

  useEffect(() => {
    initSecurity();
  }, []);

  // Window bounds auto-save debouncer
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleWindowChange = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const isMax = await WindowIsMaximised();
          const size = await WindowGetSize();
          const pos = await WindowGetPosition();
          if (size && pos && (size.w > 0 || size.h > 0)) {
            await SaveWindowState(size.w, size.h, pos.x, pos.y, isMax);
          }
        } catch {
          // Ignore if runtime not available
        }
      }, 400);
    };

    window.addEventListener('resize', handleWindowChange);
    return () => {
      window.removeEventListener('resize', handleWindowChange);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      className="app-shell-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minWidth: '100%',
        maxWidth: '100%',
        height: '100%',
        minHeight: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        backgroundColor: hasBg ? 'transparent' : 'var(--color-bg)',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* App Lock Screen Overlay */}
      <AppLockScreen />

      {/* Update Checker Modal */}
      <UpdateCheckerModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
      />

      {/* Custom Frameless TitleBar */}
      <CustomTitleBar onCheckUpdates={() => setIsUpdateModalOpen(true)} />

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

      {/* Main UI Layout Container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          position: 'relative',
          zIndex: 2,
          overflow: 'hidden',
        }}
      >
        {/* Top Workspace Tab Bar (Multi-task tabs) */}
        <WorkspaceTabBar />

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Sidebar Navigation */}
          <Sidebar currentTab={currentTab} onSelectTab={onSelectTab} />

          {/* Main Body */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            <TopBar onOpenPanelModal={onOpenPanelModal} onNavigateTab={onSelectTab} />

            {/* Content Area */}
            <main
              className="custom-scrollbar"
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                overflowX: 'hidden',
                backgroundColor: hasBg ? 'transparent' : 'var(--color-bg)',
                position: 'relative',
                minHeight: 0,
                width: '100%',
              }}
            >
              {children}
            </main>

            <StatusBar />
          </div>
        </div>
      </div>

      {/* Toast Notification Container */}
      <div
        style={{
          position: 'fixed',
          bottom: '36px',
          right: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 10000,
          pointerEvents: 'none',
        }}
      >
        {notifications.map((n) => {
          const getIcon = () => {
            switch (n.type) {
              case 'success':
                return <CheckCircle2 size={16} color="var(--color-success)" />;
              case 'error':
                return <AlertCircle size={16} color="var(--color-error)" />;
              case 'warning':
                return <AlertTriangle size={16} color="var(--color-warning)" />;
              case 'info':
              default:
                return <Info size={16} color="var(--color-info)" />;
            }
          };

          return (
            <div
              key={n.id}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-lg)',
                minWidth: '280px',
                maxWidth: '400px',
                animation: 'slide-in-right 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div style={{ marginTop: '2px', flexShrink: 0 }}>{getIcon()}</div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                  {n.title}
                </div>
                {n.message && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-text-secondary)',
                      marginTop: '2px',
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                    }}
                  >
                    {n.message}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeNotification(n.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
