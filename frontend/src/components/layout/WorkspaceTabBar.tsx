import React, { useRef } from 'react';
import {
  Folder,
  Server,
  FileCode2,
  Terminal,
  Settings,
  Database,
  Layers,
  X,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { useWorkspaceStore, WorkspaceTab } from '../../stores/workspaceStore';
import { useI18n } from '../../i18n';
import { OpenDetachedWindow } from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';

export const WorkspaceTabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTabId, closeTab, openTab, duplicateHighlightTabId } = useWorkspaceStore();
  const { t } = useI18n();
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleDetachTab = async (e: React.MouseEvent, tab: WorkspaceTab) => {
    e.stopPropagation();
    try {
      await OpenDetachedWindow(new main.DetachedWindowConfig({
        isDetached: true,
        type: tab.type,
        server: tab.serverIdentifier || '',
        subtab: tab.serverSubTab || 'ide',
        filePath: tab.filePath || '',
        title: tab.title,
      }));
    } catch (err) {
      console.error('Failed to detach tab:', err);
    }
  };

  const getTabIcon = (tab: WorkspaceTab) => {
    switch (tab.iconType) {
      case 'folder':
        return <Folder size={14} color="#EAB308" fill="#EAB308" fillOpacity={0.8} />;
      case 'server':
        return <Server size={14} color="var(--color-primary-light)" />;
      case 'file':
        return <FileCode2 size={14} color="#60A5FA" />;
      case 'terminal':
        return <Terminal size={14} color="#10B981" />;
      case 'settings':
        return <Settings size={14} color="#9CA3AF" />;
      case 'database':
        return <Database size={14} color="#F97316" />;
      default:
        return <Folder size={14} color="#EAB308" />;
    }
  };

  const handleNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    openTab(
      {
        title: 'SynoraDesk',
        iconType: 'folder',
        type: 'dashboard',
      },
      true
    );
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (tabListRef.current) {
      tabListRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <div
      className="wails-drag glass-panel"
      style={{
        height: '38px',
        backgroundColor: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'flex-end',
        padding: '0 8px',
        userSelect: 'none',
        position: 'relative',
        zIndex: 20,
        gap: '4px',
        overflow: 'hidden',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Tabs list with horizontal mouse wheel scroll, zero scrollbars */}
      <div
        ref={tabListRef}
        onWheel={handleWheel}
        className="tabbar-scroll-container"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '2px',
          height: '34px',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          maxWidth: 'calc(100vw - 160px)',
          flexShrink: 1,
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isHighlighted = tab.id === duplicateHighlightTabId;

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className="wails-no-drag"
              title={isHighlighted ? (t('common.tabAlreadyOpen') || 'Đã chuyển đến tab đang mở (tránh mở 2 tab trùng lặp)') : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                height: '32px',
                padding: '0 12px 0 10px',
                borderRadius: '8px 8px 0 0',
                backgroundColor: isActive ? 'var(--color-surface)' : 'transparent',
                color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)',
                borderTop: isHighlighted ? '2px solid #22C55E' : isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                borderLeft: isActive || isHighlighted ? '1px solid var(--color-border)' : '1px solid transparent',
                borderRight: isActive || isHighlighted ? '1px solid var(--color-border)' : '1px solid transparent',
                borderBottom: isActive ? '1px solid var(--color-surface)' : 'none',
                boxShadow: isHighlighted ? '0 0 12px rgba(34, 197, 94, 0.6)' : 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.15s ease',
                maxWidth: '220px',
                minWidth: '110px',
                position: 'relative',
                marginBottom: '-1px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {/* Icon */}
              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {getTabIcon(tab)}
              </div>

              {/* Title */}
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={tab.title}
              >
                {tab.title}
              </span>

              {/* Dirty indicator if file unsaved */}
              {tab.isDirty && (
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-warning)',
                    flexShrink: 0,
                  }}
                  title={t('workspace.unsavedChanges')}
                />
              )}

              {/* Detach Tab Button (Opens in separate window without sidebar) */}
              <button
                onClick={(e) => handleDetachTab(e, tab)}
                title={t('workspace.detachTab')}
                className="wails-no-drag"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  borderRadius: '4px',
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  opacity: isActive ? 0.75 : 0.45,
                  padding: 0,
                  flexShrink: 0,
                  transition: 'opacity 0.12s, background-color 0.12s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = isActive ? '0.75' : '0.45';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <ExternalLink size={11} />
              </button>

              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                title={t('workspace.closeTab')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  borderRadius: '4px',
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  opacity: isActive ? 0.75 : 0.45,
                  padding: 0,
                  flexShrink: 0,
                  transition: 'opacity 0.12s, background-color 0.12s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = isActive ? '0.75' : '0.45';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add New Tab Button (+) */}
      <button
        onClick={handleNewTab}
        className="wails-no-drag"
        title={t('workspace.newTab')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '26px',
          height: '26px',
          borderRadius: '6px',
          background: 'none',
          border: 'none',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          marginBottom: '3px',
          transition: 'background-color 0.15s, color 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.color = 'var(--color-text)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--color-text-secondary)';
        }}
      >
        <Plus size={15} />
      </button>

      {/* Empty draggable space to allow dragging the window */}
      <div style={{ flex: 1, height: '100%' }} />
    </div>
  );
};
