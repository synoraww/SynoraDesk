import React from 'react';
import {
  LayoutDashboard,
  Server,
  User,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Radio,
  ExternalLink,
  Code2,
} from 'lucide-react';
import logo from '../../assets/images/logo-universal.png';
import { useUIStore } from '../../stores/uiStore';
import { usePanelStore } from '../../stores/panelStore';
import { useI18n } from '../../i18n';
import { APP_CONFIG } from '../../config/version';
import { PanelFavicon } from '../common/PanelFavicon';

export type NavItemKey =
  | 'dashboard'
  | 'servers'
  | 'apikeys'
  | 'settings';

interface SidebarProps {
  currentTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
}

interface NavItem {
  key: NavItemKey;
  labelKey: string;
  icon: any;
  adminOnly?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { activePanel, panels } = usePanelStore();
  const { t } = useI18n();

  const navItems: NavItem[] = [
    { key: 'dashboard', labelKey: 'common.dashboard', icon: LayoutDashboard },
    { key: 'servers', labelKey: 'common.servers', icon: Server },
    { key: 'apikeys', labelKey: 'nav.accountManager', icon: User },
    { key: 'settings', labelKey: 'common.settings', icon: Settings },
  ];

  return (
    <aside
      className="glass-panel"
      style={{
        width: sidebarCollapsed ? '56px' : '230px',
        backgroundColor: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        zIndex: 20,
        userSelect: 'none',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: '52px',
          padding: sidebarCollapsed ? '0 12px' : '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              flexShrink: 0,
              overflow: 'hidden',
              borderRadius: '6px',
            }}
          >
            <img
              src={logo}
              alt="SynoraDesk"
              style={{
                display: 'block',
                width: '40px',
                height: '40px',
                objectFit: 'cover',
                objectPosition: 'center top',
              }}
            />
          </div>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
                SynoraDesk
              </span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 1 }}>
                Phiên bản {APP_CONFIG.version}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Active Panel Indicator */}
      <div
        style={{
          padding: sidebarCollapsed ? '8px 6px' : '10px 12px',
          borderBottom: '1px solid var(--color-border-subtle)',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
        }}
      >
        {activePanel ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: sidebarCollapsed ? '6px' : '6px 8px',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              borderRadius: '6px',
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
            }}
            onClick={() => onSelectTab('apikeys')}
            title={t('common.activePanel', { name: activePanel.name, url: activePanel.url })}
          >
            <div style={{ position: 'relative', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PanelFavicon url={activePanel.url} name={activePanel.name} size={18} />
              <div
                style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-success)',
                  border: '1px solid var(--color-surface)',
                }}
              />
            </div>
            {!sidebarCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {activePanel.name}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--color-text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {activePanel.url.replace(/^https?:\/\//, '')}
                </span>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => onSelectTab('apikeys')}
            style={{
              width: '100%',
              padding: '6px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-primary-muted)',
              border: '1px dashed var(--color-primary)',
              color: 'var(--color-primary-light)',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <ExternalLink size={12} />
            {!sidebarCollapsed && 'Connect Panel'}
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav
        style={{
          flex: 1,
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          overflowY: 'auto',
        }}
      >
        {navItems.map((item) => {
          const isActive = currentTab === item.key;
          const Icon = item.icon;
          const label = t(item.labelKey);

          return (
            <button
              key={item.key}
              onClick={() => onSelectTab(item.key)}
              title={sidebarCollapsed ? label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: sidebarCollapsed ? '8px 0' : '8px 10px',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                color: isActive ? '#FFFFFF' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background-color 0.12s ease, color 0.12s ease',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                  e.currentTarget.style.color = 'var(--color-text)';
                  const svg = e.currentTarget.querySelector('svg');
                  if (svg) svg.style.stroke = 'var(--color-text)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  const svg = e.currentTarget.querySelector('svg');
                  if (svg) svg.style.stroke = 'var(--color-text-secondary)';
                }
              }}
            >
              <Icon size={16} color={isActive ? '#FFFFFF' : 'var(--color-text-secondary)'} style={{ flexShrink: 0 }} />
              {!sidebarCollapsed && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {label}
                </span>
              )}
              {item.adminOnly && !sidebarCollapsed && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '9px',
                    padding: '1px 4px',
                    borderRadius: '4px',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'var(--color-surface-hover)',
                    color: isActive ? '#FFFFFF' : 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  Admin
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle Footer */}
      <div
        style={{
          padding: '8px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-end',
          gap: '6px',
        }}
      >
        {/* Collapse button */}
        <button
          onClick={toggleSidebar}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
};
