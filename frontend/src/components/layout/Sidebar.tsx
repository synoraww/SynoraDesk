import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  Server,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Shield,
  Users,
  Layers,
  Globe,
  LayoutGrid,
  Cpu,
  Network,
  Database,
  Gamepad2,
  Home,
  Wrench,
  ArrowLeft,
  Lock,
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
  | 'settings'
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

interface SidebarProps {
  currentTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
}

interface NavItem {
  key: NavItemKey;
  labelKey: string;
  fallbackLabel?: string;
  icon: any;
  probeKey?: string;
}

interface AdminGroup {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { sidebarCollapsed, toggleSidebar, sidebarMode, setSidebarMode } = useUIStore();
  const { activePanel, adminPermissions, probingPermissions, probeAdminPermissions } = usePanelStore();
  const { t } = useI18n();

  // Keep sidebarMode strictly synchronized with the active tab's independent session
  useEffect(() => {
    const expectedMode = currentTab.startsWith('admin-') ? 'admin' : 'client';
    if (sidebarMode !== expectedMode) {
      setSidebarMode(expectedMode);
    }
  }, [currentTab]);

  // Auto-probe Application API permissions whenever activePanel changes or F5 reload fires
  useEffect(() => {
    if (activePanel?.hasAppKey) {
      probeAdminPermissions();
    }
    const onReload = () => {
      if (activePanel?.hasAppKey) {
        probeAdminPermissions(true);
      }
    };
    window.addEventListener('synora:reload', onReload);
    return () => window.removeEventListener('synora:reload', onReload);
  }, [activePanel?.id, activePanel?.hasAppKey]);

  const panelPerms = activePanel ? adminPermissions[activePanel.id] : undefined;
  const hasReadableAppApi = Boolean(
    activePanel?.hasAppKey &&
      panelPerms &&
      Object.values(panelPerms).some((p) => p.allowed)
  );
  const adminLocked = !activePanel?.hasAppKey || (Boolean(panelPerms) && !hasReadableAppApi) || (!panelPerms && probingPermissions);

  const clientNavItems: NavItem[] = [
    { key: 'dashboard', labelKey: 'common.dashboard', icon: LayoutDashboard },
    { key: 'servers', labelKey: 'common.servers', icon: Server },
    { key: 'apikeys', labelKey: 'nav.accountManager', icon: User },
    { key: 'settings', labelKey: 'common.settings', icon: Settings },
  ];

  const adminGroups: AdminGroup[] = [
    {
      title: t('admin.groupBasic'),
      items: [
        { key: 'admin-overview', labelKey: 'admin.overview', fallbackLabel: 'Overview', icon: Home },
        { key: 'admin-panel-settings', labelKey: 'admin.panelSettings', fallbackLabel: 'Settings', icon: Wrench },
      ],
    },
    {
      title: t('admin.groupManagement'),
      items: [
        { key: 'admin-databases', labelKey: 'admin.databases', fallbackLabel: 'Databases', icon: Database, probeKey: 'databases' },
        { key: 'admin-locations', labelKey: 'admin.locations', fallbackLabel: 'Locations', icon: Globe, probeKey: 'locations' },
        { key: 'admin-nodes', labelKey: 'admin.nodes', fallbackLabel: 'Nodes', icon: Layers, probeKey: 'nodes' },
        { key: 'admin-allocations', labelKey: 'admin.allocations', fallbackLabel: 'Allocations', icon: Network, probeKey: 'allocations' },
        { key: 'admin-servers', labelKey: 'admin.servers', fallbackLabel: 'Servers', icon: Server, probeKey: 'servers' },
        { key: 'admin-users', labelKey: 'admin.users', fallbackLabel: 'Users', icon: Users, probeKey: 'users' },
      ],
    },
    {
      title: t('admin.groupService'),
      items: [
        { key: 'admin-nests', labelKey: 'admin.nests', fallbackLabel: 'Nests', icon: LayoutGrid, probeKey: 'nests' },
        { key: 'admin-eggs', labelKey: 'admin.eggs', fallbackLabel: 'Eggs', icon: Cpu, probeKey: 'nests' },
      ],
    },
  ];

  const getLabel = (item: NavItem) => {
    const translated = t(item.labelKey);
    return translated === item.labelKey && item.fallbackLabel ? item.fallbackLabel : translated;
  };

  return (
    <aside
      className="glass-panel"
      style={{
        width: sidebarCollapsed ? '56px' : '230px',
        backgroundColor: sidebarMode === 'admin' ? 'var(--color-admin-sidebar)' : 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease',
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
                {sidebarMode === 'admin' ? (activePanel?.name || 'SynoraDesk Admin') : 'SynoraDesk'}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 1 }}>
                {sidebarMode === 'admin' ? t('admin.administration') : `v${APP_CONFIG.version}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Active Panel Indicator (shown in Client mode) */}
      {sidebarMode === 'client' && (
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
      )}

      {/* Navigation Links */}
      <nav
        style={{
          flex: 1,
          padding: sidebarMode === 'admin' ? '0' : '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: sidebarMode === 'admin' ? '0' : '2px',
          overflowY: 'auto',
        }}
      >
        {sidebarMode === 'client' ? (
          <>
            {clientNavItems.map((item) => {
              const isActive = currentTab === item.key;
              const Icon = item.icon;
              const label = getLabel(item);

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
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                      e.currentTarget.style.color = 'var(--color-text)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }
                  }}
                >
                  <Icon size={16} color={isActive ? '#FFFFFF' : 'var(--color-text-secondary)'} style={{ flexShrink: 0 }} />
                  {!sidebarCollapsed && (
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {label}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Switch to Admin Mode Button (requires readable Application API) */}
            <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle)' }}>
              <button
                disabled={adminLocked}
                onClick={() => {
                  if (adminLocked) return;
                  setSidebarMode('admin');
                  onSelectTab('admin-overview');
                }}
                title={
                  !activePanel?.hasAppKey
                    ? t('admin.appKeyRequiredTitle')
                    : probingPermissions && !panelPerms
                    ? t('admin.checking')
                    : !hasReadableAppApi
                    ? t('admin.appApiUnreadableTitle')
                    : sidebarCollapsed
                    ? t('admin.title')
                    : undefined
                }
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: sidebarCollapsed ? '8px 0' : '8px 10px',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-elevated)',
                  color: adminLocked ? 'var(--color-text-muted)' : 'var(--color-text)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: adminLocked ? 'not-allowed' : 'pointer',
                  opacity: adminLocked ? 0.55 : 1,
                  transition: 'background-color 0.12s ease, border-color 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!adminLocked) {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!adminLocked) {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-elevated)';
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                  }
                }}
              >
                <Shield size={16} color={adminLocked ? 'var(--color-text-muted)' : 'var(--color-primary-light)'} style={{ flexShrink: 0 }} />
                {!sidebarCollapsed && (
                  <>
                    <span>{t('admin.title')}</span>
                    {adminLocked ? (
                      <Lock size={13} color="var(--color-text-muted)" style={{ marginLeft: 'auto' }} />
                    ) : (
                      <ChevronRight size={14} color="var(--color-text-muted)" style={{ marginLeft: 'auto' }} />
                    )}
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          /* Pterodactyl-style Admin Sidebar */
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {adminGroups.map((group) => (
              <div key={group.title} style={{ marginBottom: '4px' }}>
                {!sidebarCollapsed && (
                  <div
                    style={{
                      padding: '10px 14px 6px',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      color: '#64748B',
                      backgroundColor: 'rgba(0, 0, 0, 0.18)',
                    }}
                  >
                    {group.title}
                  </div>
                )}
                {group.items.map((item) => {
                  const isActive = currentTab === item.key;
                  const Icon = item.icon;
                  const label = getLabel(item);
                  const probe = item.probeKey && panelPerms ? panelPerms[item.probeKey] : undefined;
                  const noAppKey = Boolean(item.probeKey && (!activePanel || !activePanel.hasAppKey));
                  const isLockedItem = noAppKey || Boolean(probe && !probe.allowed);
                  const lockReason = noAppKey
                    ? 'Application API key required'
                    : probe && !probe.allowed
                    ? `Unavailable (${probe.statusCode || 'connection failed'} after ${probe.attempts} attempt${probe.attempts > 1 ? 's' : ''}): ${probe.error || 'No access'}`
                    : undefined;

                  return (
                    <button
                      key={item.key}
                      disabled={isLockedItem}
                      onClick={() => {
                        if (!isLockedItem) onSelectTab(item.key);
                      }}
                      title={isLockedItem ? lockReason : sidebarCollapsed ? label : undefined}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: sidebarCollapsed ? '9px 0' : '9px 14px',
                        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                        border: 'none',
                        borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                        backgroundColor: isActive ? '#0c1017' : 'transparent',
                        color: isLockedItem ? '#475569' : isActive ? '#FFFFFF' : '#94A3B8',
                        fontWeight: isActive ? 600 : 500,
                        fontSize: '13px',
                        cursor: isLockedItem ? 'not-allowed' : 'pointer',
                        opacity: isLockedItem ? 0.55 : 1,
                        transition: 'background-color 0.12s ease, color 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive && !isLockedItem) {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                          e.currentTarget.style.color = '#E2E8F0';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive && !isLockedItem) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#94A3B8';
                        }
                      }}
                    >
                      <Icon size={15} color={isLockedItem ? '#475569' : isActive ? '#FFFFFF' : '#94A3B8'} style={{ flexShrink: 0 }} />
                      {!sidebarCollapsed && (
                        <>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {label}
                          </span>
                          {isLockedItem && (
                            <Lock size={12} color="#64748B" style={{ marginLeft: 'auto', flexShrink: 0 }} />
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer: Back to Client (when in Admin mode) + Collapse Toggle */}
      <div
        style={{
          padding: '8px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : sidebarMode === 'admin' ? 'space-between' : 'flex-end',
          gap: '6px',
        }}
      >
        {sidebarMode === 'admin' && (
          <button
            onClick={() => {
              setSidebarMode('client');
              onSelectTab('dashboard');
            }}
            title="Quay lại Client"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: sidebarCollapsed ? '6px' : '6px 10px',
              borderRadius: '4px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#E2E8F0',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            <ArrowLeft size={14} />
            {!sidebarCollapsed && <span>{t('admin.backToClient')}</span>}
          </button>
        )}

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
