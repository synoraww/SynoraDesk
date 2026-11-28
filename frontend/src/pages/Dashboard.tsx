import React, { useEffect, useState } from 'react';
import {
  Server,
  Activity,
  Layers,
  Radio,
  Clock,
  ArrowUpRight,
  RefreshCw,
  HardDrive,
  Cpu,
  Plus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { usePanelStore } from '../stores/panelStore';
import { useServerStore } from '../stores/serverStore';
import { StatusBadge } from '../components/common/StatusBadge';
import { CardSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { PanelFavicon } from '../components/common/PanelFavicon';
import { useI18n } from '../i18n';

interface DashboardProps {
  onNavigateTab: (tab: any) => void;
  onOpenPanelModal: () => void;
  onSelectServer?: (identifier: string, name?: string, inNewTab?: boolean) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateTab,
  onOpenPanelModal,
  onSelectServer,
}) => {
  const { panels, activePanel, connectionStatus, connectionError, checkPanelPing } = usePanelStore();
  const { t } = useI18n();
  const {
    servers,
    dashboardStats,
    resources,
    loading: serversLoading,
    error: serversError,
    fetchServers,
    fetchDashboardStats,
    fetchResources,
  } = useServerStore();

  const [activities, setActivities] = useState<any[]>([]);
  const [recentServers, setRecentServers] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  useEffect(() => {
    if (activePanel) {
      fetchServers();
      fetchDashboardStats();
      loadActivitiesAndRecent();
    }
  }, [activePanel?.id, activePanel?.hasClientKey, activePanel?.hasAppKey]);

  useEffect(() => {
    if (servers.length > 0) {
      servers.slice(0, 6).forEach((s) => {
        fetchResources(s.identifier);
      });
    }
  }, [servers.length]);

  const loadActivitiesAndRecent = async () => {
    setLoadingActivities(true);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app) {
        const [acts, recents] = await Promise.all([
          app.GetRecentActivities(),
          app.GetRecentServers(),
        ]);
        setActivities(acts || []);
        setRecentServers(recents || []);
      }
    } catch (e) {
      console.error('Failed to load activities', e);
    } finally {
      setLoadingActivities(false);
    }
  };

  if (!activePanel) {
    return (
      <div style={{ width: '100%', padding: '32px', maxWidth: '1000px', margin: '0 auto', boxSizing: 'border-box' }}>
        <EmptyState
          icon={Radio}
          title={t('dashboard.noPanelTitle')}
          description={t('dashboard.noPanelDesc')}
          action={{
            label: t('dashboard.addFirstPanel'),
            onClick: onOpenPanelModal,
          }}
        />
      </div>
    );
  }

  const runningCount = dashboardStats?.runningServers ?? 0;
  const offlineCount = (servers.length - runningCount) >= 0 ? servers.length - runningCount : 0;
  const totalNodes = dashboardStats?.totalNodes ?? 0;

  return (
    <div style={{ width: '100%', padding: '24px 28px', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Top Banner / Greeting */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            {t('dashboard.title')}
            <span
              title={connectionStatus === 'disconnected' ? (connectionError || 'Không thể kết nối đến máy chủ') : undefined}
              style={{
                fontSize: '12px',
                fontWeight: 500,
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor:
                  connectionStatus === 'disconnected'
                    ? 'rgba(239, 68, 68, 0.12)'
                    : !activePanel.hasClientKey
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(34, 197, 94, 0.1)',
                color:
                  connectionStatus === 'disconnected'
                    ? 'var(--color-error)'
                    : !activePanel.hasClientKey
                    ? 'var(--color-warning)'
                    : 'var(--color-success)',
                border: `1px solid ${
                  connectionStatus === 'disconnected'
                    ? 'rgba(239, 68, 68, 0.25)'
                    : !activePanel.hasClientKey
                    ? 'rgba(245, 158, 11, 0.25)'
                    : 'rgba(34, 197, 94, 0.2)'
                }`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <PanelFavicon url={activePanel.url} name={activePanel.name} size={14} />
              {connectionStatus === 'disconnected'
                ? `Không thể kết nối đến máy chủ: ${activePanel.name}`
                : !activePanel.hasClientKey
                ? `${activePanel.name} (Chưa có Client API)`
                : t('dashboard.connectedTo', { name: activePanel.name })}
            </span>
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {t('dashboard.subtitle')}
          </p>
        </div>

        <button
          onClick={() => {
            fetchServers();
            fetchDashboardStats();
            loadActivitiesAndRecent();
          }}
          className="btn-interactive"
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
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} />
          {t('dashboard.refresh')}
        </button>
      </div>

      {/* KPI Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {/* Total Servers */}
        <div
          onClick={() => onNavigateTab('servers')}
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, transform 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              {t('dashboard.totalServers')}
            </span>
            <Server size={16} color="var(--color-primary-light)" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)' }}>
            {serversLoading ? '...' : servers.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {t('dashboard.totalServersDesc')}
          </div>
        </div>

        {/* Running Servers */}
        <div
          onClick={() => onNavigateTab('servers')}
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, transform 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-success)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              {t('dashboard.runningServers')}
            </span>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-success)',
                boxShadow: '0 0 8px var(--color-success)',
              }}
            />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-success)' }}>
            {serversLoading ? '...' : runningCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {t('dashboard.runningServersDesc')}
          </div>
        </div>

        {/* Offline Servers */}
        <div
          onClick={() => onNavigateTab('servers')}
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, transform 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-primary-light)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              {t('dashboard.offlineServers')}
            </span>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-text-muted)',
              }}
            />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
            {serversLoading ? '...' : offlineCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {t('dashboard.offlineServersDesc')}
          </div>
        </div>

        {/* Total Nodes */}
        <div
          onClick={() => onNavigateTab('nodes')}
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, transform 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              {t('dashboard.nodesManaged')}
            </span>
            <Layers size={16} color="var(--color-warning)" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)' }}>
            {totalNodes > 0 ? totalNodes : activePanel.hasAppKey ? '0' : '—'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {activePanel.hasAppKey ? t('dashboard.nodesWingsDesc') : t('dashboard.nodesAppKeyRequired')}
          </div>
        </div>
      </div>

      {/* Main Grid: Recently Accessed Servers & Activity Logs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Servers Quick List */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={16} color="var(--color-primary-light)" />
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
                {t('dashboard.serversOverview')}
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab('servers')}
              className="btn-interactive"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary-light)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {t('dashboard.viewAll')} <ArrowUpRight size={13} />
            </button>
          </div>

          {serversLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : servers.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              {t('dashboard.noServersFound')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {servers.slice(0, 6).map((s) => {
                const usage = resources[s.identifier];
                const isRunning = usage?.current_state === 'running';
                const isStarting = usage?.current_state === 'starting';
                const dotColor = s.is_suspended
                  ? 'var(--color-error)'
                  : isRunning
                  ? 'var(--color-success)'
                  : isStarting
                  ? 'var(--color-warning)'
                  : 'var(--color-text-muted)';

                return (
                  <div
                    key={s.identifier}
                    onClick={() => onSelectServer?.(s.identifier, s.name, false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border-subtle)',
                      cursor: 'pointer',
                      transition: 'border-color 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-subtle)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: dotColor,
                          boxShadow: isRunning ? '0 0 6px var(--color-success)' : 'none',
                        }}
                      />
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--color-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {s.name}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--color-text-muted)',
                          display: 'flex',
                          gap: '8px',
                        }}
                      >
                        <span>{s.node}</span>
                        <span>•</span>
                        <span>{s.limits.memory > 0 ? `${s.limits.memory} MB` : t('dashboard.unlimitedRam')}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--color-text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {s.identifier}
                    </span>
                    <ArrowUpRight size={13} color="var(--color-text-muted)" />
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>

        {/* Recent Activity Logs */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} color="var(--color-primary-light)" />
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
                {t('dashboard.recentActivities')}
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab('activities')}
              className="btn-interactive"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary-light)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {t('dashboard.viewAll')} <ArrowUpRight size={13} />
            </button>
          </div>

          {loadingActivities ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="skeleton" style={{ height: '36px', borderRadius: '6px' }} />
              <div className="skeleton" style={{ height: '36px', borderRadius: '6px' }} />
              <div className="skeleton" style={{ height: '36px', borderRadius: '6px' }} />
            </div>
          ) : activities.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              {t('dashboard.noRecentActivities')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activities.slice(0, 7).map((act) => (
                <div
                  key={act.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border-subtle)',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    {act.result === 'success' ? (
                      <CheckCircle2 size={13} color="var(--color-success)" style={{ flexShrink: 0 }} />
                    ) : (
                      <AlertCircle size={13} color="var(--color-error)" style={{ flexShrink: 0 }} />
                    )}
                    <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                      {act.action}
                    </span>
                    {act.serverId && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--color-text-muted)',
                          fontFamily: 'var(--font-mono)',
                          backgroundColor: 'var(--color-surface)',
                          padding: '1px 4px',
                          borderRadius: '3px',
                        }}
                      >
                        {act.serverId}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
