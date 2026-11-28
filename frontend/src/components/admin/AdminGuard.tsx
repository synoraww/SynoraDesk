import React from 'react';
import { Lock, RefreshCw, Server } from 'lucide-react';
import { usePanelStore } from '../../stores/panelStore';
import { useI18n } from '../../i18n';
import { EmptyState } from '../common/EmptyState';

interface AdminGuardProps {
  onOpenPanelModal: () => void;
  children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ onOpenPanelModal, children }) => {
  const { activePanel, adminPermissions, probingPermissions, probeAdminPermissions, connectionStatus, connectionError, checkPanelPing } = usePanelStore();
  const { t } = useI18n();

  if (!activePanel) {
    return (
      <div style={{ width: '100%', padding: '40px 24px', maxWidth: '640px', margin: '0 auto' }}>
        <EmptyState
          icon={Server}
          title={t('admin.noPanelTitle')}
          description={t('admin.noPanelDesc')}
          action={{
            label: t('admin.configurePanel'),
            onClick: onOpenPanelModal,
          }}
        />
      </div>
    );
  }

  const panelPerms = adminPermissions[activePanel.id];
  const permStatuses = panelPerms ? Object.values(panelPerms) : [];
  const hasReadableAppApi = Boolean(
    activePanel.hasAppKey &&
      panelPerms &&
      permStatuses.some((p) => p.allowed)
  );
  const allUnreachable =
    connectionStatus === 'disconnected' ||
    (permStatuses.length > 0 &&
      !hasReadableAppApi &&
      permStatuses.every((p) => !p.statusCode || p.statusCode === 0));

  if (!activePanel.hasAppKey || allUnreachable || (panelPerms && !hasReadableAppApi)) {
    const isUnreachable = Boolean(activePanel.hasAppKey && allUnreachable);
    const isUnreadable = Boolean(activePanel.hasAppKey && !isUnreachable && panelPerms && !hasReadableAppApi);
    return (
      <div
        style={{
          width: '100%',
          padding: '40px 24px',
          maxWidth: '620px',
          margin: '32px auto',
          textAlign: 'center',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderTop: `2px solid ${isUnreachable || isUnreadable ? 'var(--color-error)' : 'var(--color-warning)'}`,
          borderRadius: '6px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: isUnreachable || isUnreadable ? 'var(--color-error-bg)' : 'var(--color-warning-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            color: isUnreachable || isUnreadable ? 'var(--color-error)' : 'var(--color-warning)',
          }}
        >
          <Lock size={22} />
        </div>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>
          {isUnreachable
            ? 'Không thể kết nối đến máy chủ'
            : isUnreadable
            ? t('admin.appApiUnreadableTitle')
            : t('admin.appKeyRequiredTitle')}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '18px' }}>
          {isUnreachable
            ? connectionError || `Không thể kết nối tới ${activePanel.name} (${activePanel.url}).`
            : isUnreadable
            ? t('admin.appApiUnreadableDesc', { name: activePanel.name })
            : t('admin.appKeyRequiredDesc', { name: activePanel.name })}
        </p>
        <div style={{ display: 'inline-flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {(isUnreachable || isUnreadable) && (
            <button
              type="button"
              disabled={probingPermissions}
              onClick={() => {
                checkPanelPing();
                probeAdminPermissions(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '4px',
                backgroundColor: 'var(--color-surface-elevated)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: probingPermissions ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={13} /> {probingPermissions ? t('admin.checking') : t('admin.recheckPermissions')}
            </button>
          )}
          <button
            type="button"
            onClick={onOpenPanelModal}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              backgroundColor: 'var(--color-primary)',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t('admin.configureAppKey')}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
