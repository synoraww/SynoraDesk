import React, { useState } from 'react';
import { Wifi, WifiOff, CheckCircle2, ShieldCheck, Database as DbIcon, Server, Wrench } from 'lucide-react';
import { usePanelStore } from '../../stores/panelStore';
import { useServerStore } from '../../stores/serverStore';
import { useSecurityStore } from '../../stores/securityStore';
import { useI18n } from '../../i18n';
import { SystemDiagnosticsModal } from '../common/SystemDiagnosticsModal';

export const StatusBar: React.FC = () => {
  const { activePanel, panelPingMs, connectionStatus, connectionError, adminPermissions } = usePanelStore();
  const { servers, dashboardStats } = useServerStore();
  const isLocked = useSecurityStore((s) => s.isLocked);
  const { t } = useI18n();
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  const panelPerms = activePanel ? adminPermissions[activePanel.id] : undefined;
  const hasReadableAppApi = Boolean(
    activePanel?.hasAppKey &&
      panelPerms &&
      Object.values(panelPerms).some((p) => p.allowed)
  );

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
              {connectionStatus === 'disconnected' ? (
                <WifiOff size={12} color="var(--color-error)" />
              ) : (
                <Wifi size={12} color={connectionStatus === 'connected' ? 'var(--color-success)' : 'var(--color-text-muted)'} />
              )}
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {activePanel.name}
              </span>
              {connectionStatus === 'disconnected' && (
                <span
                  title={connectionError || 'Không thể kết nối đến máy chủ'}
                  style={{
                    color: 'var(--color-error)',
                    backgroundColor: 'var(--color-error-bg)',
                    padding: '1px 6px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontWeight: 600,
                  }}
                >
                  Không thể kết nối
                </span>
              )}
              <span style={{ color: 'var(--color-border)' }}>|</span>
              <span style={{ color: 'var(--color-text-muted)' }}>
                {activePanel.hasClientKey ? t('layout.clientApi') : t('layout.noClientKey')}
              </span>
              {activePanel.hasAppKey && (
                <span
                  title={
                    hasReadableAppApi
                      ? t('admin.appApiReadable')
                      : panelPerms
                      ? t('admin.appApiUnreadable')
                      : t('admin.checking')
                  }
                  style={{
                    backgroundColor: hasReadableAppApi
                      ? 'rgba(34, 197, 94, 0.15)'
                      : panelPerms
                      ? 'var(--color-error-bg)'
                      : 'var(--color-surface-elevated)',
                    color: hasReadableAppApi
                      ? 'var(--color-success)'
                      : panelPerms
                      ? 'var(--color-error)'
                      : 'var(--color-text-muted)',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    fontSize: '9px',
                    fontWeight: 600,
                  }}
                >
                  APP API
                </span>
              )}
              {connectionStatus !== 'disconnected' && panelPingMs !== null && !isLocked && (
                <span
                  title={`${t('ping.latency') || 'Độ trễ Panel'}: ${panelPingMs} ms`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: panelPingMs < 150 ? '#22C55E' : panelPingMs < 350 ? '#EAB308' : '#EF4444',
                  }}
                >
                  • {panelPingMs}ms
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

      {/* Right: Security & App Diagnostics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          onClick={() => setIsDiagnosticsOpen(true)}
          title="Kiểm tra công cụ, DPAPI, phần mềm và chẩn đoán báo lỗi"
          className="btn-interactive"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            color: 'var(--color-success)',
            background: 'none',
            border: 'none',
            fontSize: '11px',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <ShieldCheck size={12} />
          <span>{t('layout.dpapiEncrypted')}</span>
          <span style={{ fontSize: '9px', backgroundColor: 'rgba(34, 197, 94, 0.2)', padding: '1px 4px', borderRadius: '3px' }}>
            {t('diagnostics.badge')}
          </span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <DbIcon size={11} />
          <span>{t('common.sqliteWal')}</span>
        </div>
      </div>

      <SystemDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />
    </footer>
  );
};
