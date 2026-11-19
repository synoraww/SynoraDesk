import React from 'react';
import { Wifi, WifiOff, CheckCircle2, ShieldCheck, Database as DbIcon, Server } from 'lucide-react';
import { usePanelStore } from '../../stores/panelStore';
import { useServerStore } from '../../stores/serverStore';
import { useI18n } from '../../i18n';

export const StatusBar: React.FC = () => {
  const { activePanel } = usePanelStore();
  const { servers, dashboardStats } = useServerStore();
  const { t } = useI18n();

  const totalServers = servers.length;
  const runningServers = dashboardStats?.runningServers ?? 0;

  return (
    <footer
      className="glass-panel"
      style={{
        height: '28px',
        flexShrink: 0,
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        fontSize: '11px',
        color: 'var(--color-text-muted)',
        userSelect: 'none',
        zIndex: 10,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Left: Active Panel & Connection */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {activePanel ? (
            <>
              <Wifi size={12} color="var(--color-success)" />
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {activePanel.name}
              </span>
              <span style={{ color: 'var(--color-border)' }}>|</span>
              <span style={{ color: 'var(--color-text-muted)' }}>
                {activePanel.hasClientKey ? t('layout.clientApi') : t('layout.noClientKey')}
              </span>
              {activePanel.hasAppKey && (
                <span
                  style={{
                    backgroundColor: 'var(--color-primary-muted)',
                    color: 'var(--color-primary-light)',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    fontSize: '9px',
                    fontWeight: 600,
                  }}
                >
                  APP API
                </span>
              )}
            </>
          ) : (
            <>
              <WifiOff size={12} color="var(--color-text-muted)" />
              <span>{t('layout.noPanelConnected')}</span>
            </>
          )}
        </div>
      </div>

      {/* Center: Server Summary */}
      {activePanel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Server size={11} />
            <span>
              {t('layout.serverCount', { count: totalServers })}
            </span>
          </div>
          {runningServers > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)' }}>
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-success)',
                }}
              />
              <span>{t('layout.runningCount', { count: runningServers })}</span>
            </div>
          )}
        </div>
      )}

      {/* Right: Security & App Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)' }}
          title={t('layout.dpapiTitle')}
        >
          <ShieldCheck size={12} />
          <span>{t('layout.dpapiEncrypted')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <DbIcon size={11} />
          <span>{t('common.sqliteWal')}</span>
        </div>
      </div>
    </footer>
  );
};
