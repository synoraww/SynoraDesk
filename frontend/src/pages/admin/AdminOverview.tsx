import React from 'react';
import {
  Users,
  Server,
  Layers,
  MapPin,
  Box,
  Cpu,
  Network,
  Database,
  KeyRound,
  CheckCircle2,
  XCircle,
  Shield,
  Lock,
} from 'lucide-react';
import { usePanelStore } from '../../stores/panelStore';
import { useI18n } from '../../i18n';
import { AdminGuard } from '../../components/admin/AdminGuard';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { APP_CONFIG } from '../../config/version';

export type AdminSectionKey =
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

interface AdminOverviewProps {
  onNavigateAdmin: (section: AdminSectionKey) => void;
  onOpenPanelModal: () => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  onNavigateAdmin,
  onOpenPanelModal,
}) => {
  const { activePanel, currentAccount, adminPermissions, connectionStatus, connectionError } = usePanelStore();
  const { t } = useI18n();
  const panelPerms = activePanel ? adminPermissions[activePanel.id] : undefined;
  const hasReadableAppApi = Boolean(
    activePanel?.hasAppKey &&
      panelPerms &&
      Object.values(panelPerms).some((p) => p.allowed)
  );

  const modules: { key: AdminSectionKey; title: string; desc: string; icon: any; probeKey?: string }[] = [
    { key: 'admin-users', title: t('admin.users'), desc: t('admin.modUsersDesc'), icon: Users, probeKey: 'users' },
    { key: 'admin-servers', title: t('admin.servers'), desc: t('admin.modServersDesc'), icon: Server, probeKey: 'servers' },
    { key: 'admin-nodes', title: t('admin.nodes'), desc: t('admin.modNodesDesc'), icon: Layers, probeKey: 'nodes' },
    { key: 'admin-locations', title: t('admin.locations'), desc: t('admin.modLocationsDesc'), icon: MapPin, probeKey: 'locations' },
    { key: 'admin-nests', title: t('admin.nests'), desc: t('admin.modNestsDesc'), icon: Box, probeKey: 'nests' },
    { key: 'admin-eggs', title: t('admin.eggs'), desc: t('admin.modEggsDesc'), icon: Cpu, probeKey: 'nests' },
    { key: 'admin-allocations', title: t('admin.allocations'), desc: t('admin.modAllocationsDesc'), icon: Network, probeKey: 'allocations' },
    { key: 'admin-databases', title: t('admin.databases'), desc: t('admin.modDatabasesDesc'), icon: Database, probeKey: 'databases' },
    { key: 'admin-panel-settings', title: t('admin.panelSettings'), desc: t('admin.modSettingsDesc'), icon: KeyRound },
  ];

  return (
    <AdminGuard onOpenPanelModal={onOpenPanelModal}>
    <div style={{ width: '100%', padding: '20px 24px', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box' }}>
      <AdminPageHeader
        title={t('admin.overviewTitle')}
        subtitle={t('admin.overviewSubtitle')}
        icon={Shield}
        breadcrumbs={[{ label: t('admin.title') }, { label: t('admin.overview') }]}
      />

      {/* Pterodactyl-style System Information Box */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderTop: `2px solid ${connectionStatus === 'disconnected' ? 'var(--color-error)' : 'var(--color-success)'}`,
          borderRadius: '4px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--color-border)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--color-text)',
          }}
        >
          {t('admin.systemInfo')}
        </div>
        <div style={{ padding: '14px', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          {activePanel ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>
                {connectionStatus === 'disconnected' ? (
                  <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>
                    Không thể kết nối đến máy chủ {activePanel.name} ({activePanel.url})
                    {connectionError ? ` — ${connectionError}` : ''}
                  </span>
                ) : (
                  <>
                    {t('admin.connectedTo', { name: activePanel.name, url: activePanel.url })}
                    {activePanel.version ? (
                      <>
                        {' '}{t('admin.runningVersion')}{' '}
                        <code
                          style={{
                            padding: '1px 6px',
                            borderRadius: '3px',
                            backgroundColor: 'var(--color-surface-elevated)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          {activePanel.version}
                        </code>
                      </>
                    ) : null}
                    .
                  </>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '4px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {hasReadableAppApi ? (
                    <CheckCircle2 size={14} color="var(--color-success)" />
                  ) : (
                    <XCircle size={14} color="var(--color-error)" />
                  )}
                  Application API:{' '}
                  {!activePanel.hasAppKey
                    ? t('admin.notConfigured')
                    : connectionStatus === 'disconnected'
                    ? 'Không thể kết nối'
                    : hasReadableAppApi
                    ? t('admin.appApiReadable')
                    : panelPerms
                    ? t('admin.appApiUnreadable')
                    : t('admin.checking')}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {activePanel.hasClientKey ? (
                    <CheckCircle2 size={14} color="var(--color-success)" />
                  ) : (
                    <XCircle size={14} color="var(--color-text-muted)" />
                  )}
                  Client API: {activePanel.hasClientKey ? t('admin.configured') : t('admin.notConfigured')}
                </span>
                {currentAccount && (
                  <span>
                    {t('admin.signedInAs')} <strong>{currentAccount.username}</strong> ({currentAccount.email})
                  </span>
                )}
                <span>
                  {t('admin.desktopVersion')} <code>v{APP_CONFIG.version}</code>
                </span>
              </div>
            </div>
          ) : (
            <div>
              {t('admin.connectPanelPrompt')}{' '}
              <button
                type="button"
                onClick={onOpenPanelModal}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--color-primary-light)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {t('admin.configurePanel')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Administration Modules Table */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--color-border)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--color-text)',
          }}
        >
          {t('admin.modulesTitle')}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
              <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {t('admin.moduleCol')}
              </th>
              <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {t('admin.descCol')}
              </th>
              <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {t('admin.actionCol')}
              </th>
            </tr>
          </thead>
          <tbody>
            {modules.map((mod) => {
              const Icon = mod.icon;
              const probe = mod.probeKey && panelPerms ? panelPerms[mod.probeKey] : undefined;
              const isLockedMod = Boolean(mod.probeKey && (!activePanel?.hasAppKey || (probe && !probe.allowed)));
              return (
                <tr
                  key={mod.key}
                  style={{
                    borderBottom: '1px solid var(--color-border-subtle)',
                    opacity: isLockedMod ? 0.55 : 1,
                  }}
                >
                  <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--color-text)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon size={15} color={isLockedMod ? 'var(--color-text-muted)' : 'var(--color-primary-light)'} />
                      <span>{mod.title}</span>
                      {isLockedMod && <Lock size={12} color="var(--color-text-muted)" />}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>{mod.desc}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <button
                      type="button"
                      disabled={isLockedMod}
                      onClick={() => {
                        if (!isLockedMod) onNavigateAdmin(mod.key);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface-hover)',
                        color: isLockedMod ? 'var(--color-text-muted)' : 'var(--color-text)',
                        fontSize: '12px',
                        cursor: isLockedMod ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isLockedMod ? t('admin.locked') : t('admin.open')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </AdminGuard>
  );
};
