import React, { useEffect, useState } from 'react';
import { History, CheckCircle2, AlertCircle, RefreshCw, Filter } from 'lucide-react';
import { usePanelStore } from '../stores/panelStore';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { useI18n } from '../i18n';

interface Activity {
  id: number;
  panelId: string;
  panelName: string;
  serverId: string;
  action: string;
  result: string;
  error: string;
  timestamp: string;
}

export const ActivityLogsPage: React.FC = () => {
  const { activePanel } = usePanelStore();
  const { t } = useI18n();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadActivities();
  }, [activePanel?.id]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app) {
        const acts = await app.GetRecentActivities();
        setActivities(acts || []);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', padding: '24px 28px', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            Activity Logs
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Audit log of server power commands, panel modifications, and client actions
          </p>
        </div>

        <button
          onClick={loadActivities}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
            borderRadius: '6px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} /> {t('activityLogs.refresh')}
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : activities.length === 0 ? (
        <EmptyState
          icon={History}
          title={t('activityLogs.emptyTitle')}
          description={t('activityLogs.emptyDesc')}
        />
      ) : (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '160px 1.5fr 1fr 100px 1.5fr',
              padding: '12px 18px',
              borderBottom: '1px solid var(--color-border)',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <span>{t('activityLogs.timestamp')}</span>
            <span>{t('activityLogs.action')}</span>
            <span>{t('activityLogs.targetServer')}</span>
            <span>{t('activityLogs.result')}</span>
            <span>{t('activityLogs.detailsError')}</span>
          </div>

          {activities.map((act, i) => (
            <div
              key={act.id || i}
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 1.5fr 1fr 100px 1.5fr',
                alignItems: 'center',
                padding: '12px 18px',
                borderBottom: i < activities.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                fontSize: '13px',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                {new Date(act.timestamp).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>

              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                {act.action}
              </span>

              <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                {act.serverId || '—'}
              </span>

              <div>
                {act.result === 'success' ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--color-success)',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle2 size={13} /> OK
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--color-error)',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <AlertCircle size={13} /> Failed
                  </span>
                )}
              </div>

              <span
                style={{
                  color: act.error ? 'var(--color-error)' : 'var(--color-text-muted)',
                  fontSize: '12px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {act.error || 'Operation completed normally'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
