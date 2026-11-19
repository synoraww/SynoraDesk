import React, { useEffect, useState } from 'react';
import {
  Server as ServerIcon,
  Search,
  RotateCw,
  Cpu,
  HardDrive,
  Activity,
  LayoutGrid,
  List,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Users,
  Radio,
} from 'lucide-react';
import { useServerStore, Server } from '../stores/serverStore';
import { usePanelStore } from '../stores/panelStore';
import { useI18n } from '../i18n';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';

interface ServersPageProps {
  onSelectServer: (identifier: string, name?: string, inNewTab?: boolean) => void;
  onOpenPanelModal: () => void;
}

export const ServersPage: React.FC<ServersPageProps> = ({
  onSelectServer,
  onOpenPanelModal,
}) => {
  const { activePanel } = usePanelStore();
  const { t } = useI18n();
  const {
    servers,
    loading,
    searchQuery,
    setSearchQuery,
    fetchServers,
    resources,
    fetchResources,
  } = useServerStore();

  // View mode with localStorage memory
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('pterodesk_servers_view') as 'list' | 'grid') || 'list';
  });

  // Filters
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'mine'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'offline' | 'suspended'>('all');

  useEffect(() => {
    localStorage.setItem('pterodesk_servers_view', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (activePanel) {
      fetchServers();
    }
  }, [activePanel?.id]);

  // Periodic resource fetch
  useEffect(() => {
    if (servers.length === 0) return;
    const interval = setInterval(() => {
      servers.slice(0, 15).forEach((s) => {
        fetchResources(s.identifier);
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [servers]);

  if (!activePanel) {
    return (
      <div style={{ width: '100%', padding: '32px', maxWidth: '800px', margin: '0 auto', boxSizing: 'border-box' }}>
        <EmptyState
          icon={ServerIcon}
          title={t('servers.noPanelTitle')}
          description={t('servers.noPanelDesc')}
          action={{
            label: t('servers.openPanelManager'),
            onClick: onOpenPanelModal,
          }}
        />
      </div>
    );
  }

  // Filter and sort servers
  const filteredServers = servers
    .filter((s) => {
      if (ownerFilter === 'mine' && !s.server_owner) {
        return false;
      }

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        s.name.toLowerCase().includes(query) ||
        s.identifier.toLowerCase().includes(query) ||
        s.node.toLowerCase().includes(query) ||
        (s.egg_name && s.egg_name.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      const res = resources[s.identifier];
      const state = res?.current_state || (s.is_suspended ? 'suspended' : 'offline');

      if (statusFilter === 'running') return state === 'running';
      if (statusFilter === 'offline') return state === 'offline' || state === 'stopped';
      if (statusFilter === 'suspended') return s.is_suspended;

      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const formatMemory = (mb: number) => {
    if (!mb || mb === 0) return '∞ RAM';
    if (mb >= 1024) {
      const gb = (mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1);
      return `${gb} GiB`;
    }
    return `${mb} MiB`;
  };

  const formatDisk = (mb: number) => {
    if (!mb || mb === 0) return '∞ Disk';
    if (mb >= 1024) {
      const gb = (mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1);
      return `${gb} GiB`;
    }
    return `${mb} MiB`;
  };

  const formatNetSpeed = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 K';
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)}K`;
    return `${(kb / 1024).toFixed(1)}M`;
  };

  const getPrimaryAddress = (server: Server) => {
    // Priority: Allocations with is_default, then first allocation, with ip_alias/alias preferred
    const allocs = (server.allocations && server.allocations.length > 0)
      ? server.allocations
      // @ts-ignore
      : (server.relationships?.allocations?.data?.map((d: any) => d.attributes) || []);

    if (allocs && allocs.length > 0) {
      const def = allocs.find((a: any) => a.is_default) || allocs[0];
      const host = def.ip_alias || def.alias || def.ip;
      return `${host}:${def.port}`;
    }
    if (server.sftp_details?.ip && server.sftp_details?.port) {
      return `${server.sftp_details.ip}:${server.sftp_details.port}`;
    }
    return `${server.node || 'localhost'}:---`;
  };

  const getStatusInfo = (server: Server) => {
    const usage = resources[server.identifier];
    const state = usage?.current_state || (server.is_suspended ? 'suspended' : 'offline');

    if (server.is_suspended || state === 'suspended') {
      return { text: t('servers.status.suspended'), bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', dot: '#EF4444' };
    }
    if (server.is_installing || state === 'installing') {
      return { text: t('servers.status.installing'), bg: 'var(--color-primary-muted)', color: 'var(--color-primary-light)', dot: 'var(--color-primary)' };
    }
    if (state === 'running') {
      return { text: t('servers.status.running'), bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981', dot: '#10B981' };
    }
    if (state === 'starting') {
      return { text: t('servers.status.starting'), bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', dot: '#F59E0B' };
    }
    if (state === 'stopping') {
      return { text: t('servers.status.stopping'), bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', dot: '#F59E0B' };
    }
    return { text: t('servers.status.offline'), bg: 'rgba(148, 163, 184, 0.12)', color: '#94A3B8', dot: '#64748B' };
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '24px 28px',
        boxSizing: 'border-box',
        overflowX: 'auto',
      }}
    >
      {/* Top Filter and Search Control Bar matching UI structure */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'nowrap',
          width: '100%',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '10px',
            border: '1px solid var(--color-border)',
            padding: '0 14px',
            height: '42px',
            flex: 1,
            minWidth: '220px',
            maxWidth: '650px',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
          }}
        >
          <Search size={16} color="var(--color-text-muted)" style={{ marginRight: '10px', flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('servers.searchPlaceholder')}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--color-text)',
              fontSize: '13px',
              width: '100%',
            }}
          />
        </div>

        {/* Ownership Toggle (My Servers vs All Servers) */}
        <div
          style={{
            display: 'inline-flex',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '10px',
            border: '1px solid var(--color-border)',
            padding: '3px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setOwnerFilter('all')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: ownerFilter === 'all' ? '#1E293B' : 'transparent',
              color: ownerFilter === 'all' ? '#FFFFFF' : 'var(--color-text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Users size={13} /> {t('servers.allServers')}
          </button>
          <button
            onClick={() => setOwnerFilter('mine')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: ownerFilter === 'mine' ? '#1E293B' : 'transparent',
              color: ownerFilter === 'mine' ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <ShieldCheck size={13} /> {t('servers.myServers')}
          </button>
        </div>

        {/* Status Dropdown */}
        <div style={{ flexShrink: 0 }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              height: '42px',
              padding: '0 16px',
              borderRadius: '10px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              appearance: 'auto',
            }}
          >
            <option value="all">{t('servers.status.all')}</option>
            <option value="running">{t('servers.status.running')}</option>
            <option value="offline">{t('servers.status.offline')}</option>
            <option value="suspended">{t('servers.status.suspended')}</option>
          </select>
        </div>

        {/* View Switcher Icons (Grid / List) */}
        <div
          style={{
            display: 'inline-flex',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '10px',
            border: '1px solid var(--color-border)',
            padding: '3px',
            flexShrink: 0,
            gap: '2px',
          }}
        >
          <button
            onClick={() => setViewMode('grid')}
            title={t('servers.gridView')}
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: viewMode === 'grid' ? '#1E293B' : 'transparent',
              color: viewMode === 'grid' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            title={t('servers.listView')}
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: viewMode === 'list' ? '#1E293B' : 'transparent',
              color: viewMode === 'list' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <List size={16} />
          </button>
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => fetchServers()}
          title={t('servers.refreshList')}
          style={{
            height: '42px',
            width: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <RotateCw size={15} />
        </button>
      </div>

      {/* Content Rendering */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : filteredServers.length === 0 ? (
        <EmptyState
          icon={ServerIcon}
          title={searchQuery ? t('servers.emptyTitle') : t('servers.emptyNoServers')}
          description={
            searchQuery
              ? t('servers.searchNoMatch', { query: searchQuery })
              : t('servers.emptyNoServersDesc')
          }
        />
      ) : viewMode === 'list' ? (
        /* LIST VIEW matching UI layout with native PteroDesk dark/slate theme */
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)',
            minWidth: '880px',
          }}
        >
          {/* Header Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2.5fr 2fr 1.3fr 2.5fr 44px',
              padding: '14px 24px',
              borderBottom: '1px solid var(--color-border)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <span>{t('servers.columns.nameNode')}</span>
            <span>{t('servers.columns.ipPort')}</span>
            <span>{t('servers.columns.status')}</span>
            <span>{t('servers.resourceUsage')}</span>
            <span></span>
          </div>

          {/* Rows */}
          {filteredServers.map((s, idx) => {
            const status = getStatusInfo(s);
            const address = getPrimaryAddress(s);
            const usage = resources[s.identifier];
            const cpuVal = usage?.resources?.cpu_absolute !== undefined ? Math.round(usage.resources.cpu_absolute) : 0;
            const memValMB = usage?.resources?.memory_bytes ? Math.round(usage.resources.memory_bytes / (1024 * 1024)) : 0;
            const diskValMB = usage?.resources?.disk_bytes ? Math.round(usage.resources.disk_bytes / (1024 * 1024)) : 0;

            const cpuOverloaded = cpuVal >= 85;
            const memOverloaded = s.limits?.memory ? (memValMB / s.limits.memory) >= 0.85 : false;
            const diskOverloaded = s.limits?.disk ? (diskValMB / s.limits.disk) >= 0.85 : false;

            return (
              <div
                key={s.identifier}
                onClick={() => onSelectServer(s.identifier, s.name, false)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2.5fr 2fr 1.3fr 2.5fr 44px',
                  alignItems: 'center',
                  padding: '16px 24px',
                  borderBottom: idx < filteredServers.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                  backgroundColor: 'transparent',
                  transition: 'background-color 0.15s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                  const chevron = e.currentTarget.querySelector('.server-chevron') as HTMLElement;
                  if (chevron) {
                    chevron.style.transform = 'translateX(4px)';
                    chevron.style.color = 'var(--color-primary-light)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  const chevron = e.currentTarget.querySelector('.server-chevron') as HTMLElement;
                  if (chevron) {
                    chevron.style.transform = 'translateX(0)';
                    chevron.style.color = 'var(--color-text-muted)';
                  }
                }}
              >
                {/* Column 1: Server Name, Node & Egg */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden', paddingRight: '16px' }}>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      letterSpacing: '-0.01em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    <span>{t('servers.nodeLabel')} <strong style={{ color: 'var(--color-text-secondary)' }}>{s.node}</strong></span>
                    {s.egg_name && (
                      <>
                        <span>•</span>
                        <span style={{ color: 'var(--color-primary-light)' }}>{t('servers.eggLabel')} {s.egg_name}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Column 2: IP:Port */}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {address}
                </div>

                {/* Column 3: Status Badge */}
                <div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: status.bg,
                      color: status.color,
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: status.dot,
                        boxShadow: `0 0 8px ${status.dot}`,
                      }}
                    />
                    {status.text}
                  </span>
                </div>

                {/* Column 4: Real-time Resource Usage (CPU / RAM / Disk / Network) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: cpuOverloaded ? '#EF4444' : 'var(--color-text)' }} title={t('servers.cpuUsage')}>
                    <Cpu size={14} color={cpuOverloaded ? '#EF4444' : '#38BDF8'} />
                    <span>{cpuVal}%</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: memOverloaded ? '#EF4444' : 'var(--color-text)' }} title={t('servers.ramUsage')}>
                    <Activity size={14} color={memOverloaded ? '#EF4444' : '#34D399'} />
                    <span>{memValMB} / {s.limits?.memory ? `${s.limits.memory}M` : '∞'}</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: diskOverloaded ? '#EF4444' : 'var(--color-text)' }} title={t('servers.diskUsage')}>
                    <HardDrive size={14} color={diskOverloaded ? '#EF4444' : '#94A3B8'} />
                    <span>{diskValMB} / {s.limits?.disk ? `${s.limits.disk}M` : '∞'}</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)', fontSize: '11px' }} title="Network (Rx / Tx)">
                    <Radio size={13} color="var(--color-primary-light)" />
                    <span>{formatNetSpeed(usage?.resources?.network_rx_bytes || 0)} / {formatNetSpeed(usage?.resources?.network_tx_bytes || 0)}</span>
                  </span>
                </div>

                {/* Column 5: Modern Sleek Chevron Action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <div
                    className="server-chevron"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-text-muted)',
                      backgroundColor: 'transparent',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <ChevronRight size={18} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* GRID VIEW (view vuông) */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
            gap: '16px',
          }}
        >
          {filteredServers.map((s) => {
            const status = getStatusInfo(s);
            const address = getPrimaryAddress(s);
            const usage = resources[s.identifier];
            const cpuVal = usage?.resources?.cpu_absolute !== undefined ? Math.round(usage.resources.cpu_absolute) : 0;
            const memValMB = usage?.resources?.memory_bytes ? Math.round(usage.resources.memory_bytes / (1024 * 1024)) : 0;
            const diskValMB = usage?.resources?.disk_bytes ? Math.round(usage.resources.disk_bytes / (1024 * 1024)) : 0;

            const cpuOverloaded = cpuVal >= 85;
            const memOverloaded = s.limits?.memory ? (memValMB / s.limits.memory) >= 0.85 : false;
            const diskOverloaded = s.limits?.disk ? (diskValMB / s.limits.disk) >= 0.85 : false;

            return (
              <div
                key={s.identifier}
                onClick={() => onSelectServer(s.identifier, s.name, false)}
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px var(--color-primary-glow)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                {/* Top Row: Egg Badge + Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-primary-light)',
                      backgroundColor: 'var(--color-primary-muted)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    {s.egg_name || 'Generic'}
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: status.bg,
                      color: status.color,
                      fontSize: '10px',
                      fontWeight: 700,
                    }}
                  >
                    <span
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor: status.dot,
                      }}
                    />
                    {status.text}
                  </span>
                </div>

                {/* Server Name and IP */}
                <div>
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.name}
                  </h3>
                  <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                    {address}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Node: {s.node}
                  </div>
                </div>

                {/* Resource Usage Row (Full Metrics & Progress Bars) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>CPU</span>
                      <span style={{ color: cpuOverloaded ? '#EF4444' : '#38BDF8', fontWeight: 600 }}>{cpuVal}%</span>
                    </div>
                    <div style={{ height: '3px', backgroundColor: 'var(--color-border)', borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(cpuVal, 100)}%`, height: '100%', backgroundColor: cpuOverloaded ? '#EF4444' : '#38BDF8', transition: 'width 0.3s' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>RAM</span>
                      <span style={{ color: memOverloaded ? '#EF4444' : '#34D399', fontWeight: 600 }}>
                        {memValMB}M / {s.limits?.memory ? `${s.limits.memory}M` : '∞'}
                      </span>
                    </div>
                    <div style={{ height: '3px', backgroundColor: 'var(--color-border)', borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${s.limits?.memory ? Math.min((memValMB / s.limits.memory) * 100, 100) : 0}%`, height: '100%', backgroundColor: memOverloaded ? '#EF4444' : '#34D399', transition: 'width 0.3s' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>DISK</span>
                      <span style={{ color: diskOverloaded ? '#EF4444' : '#94A3B8', fontWeight: 600 }}>
                        {diskValMB}M / {s.limits?.disk ? `${s.limits.disk}M` : '∞'}
                      </span>
                    </div>
                    <div style={{ height: '3px', backgroundColor: 'var(--color-border)', borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${s.limits?.disk ? Math.min((diskValMB / s.limits.disk) * 100, 100) : 0}%`, height: '100%', backgroundColor: diskOverloaded ? '#EF4444' : '#94A3B8', transition: 'width 0.3s' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>NET</span>
                      <span style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>
                        {formatNetSpeed(usage?.resources?.network_rx_bytes || 0)}
                      </span>
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      ↑ {formatNetSpeed(usage?.resources?.network_tx_bytes || 0)}
                    </div>
                  </div>
                </div>

                {/* Action button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectServer(s.identifier, s.name, false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-primary-muted)',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    color: 'var(--color-primary-light)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                    e.currentTarget.style.color = '#FFFFFF';
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-primary-muted)';
                    e.currentTarget.style.color = 'var(--color-primary-light)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.35)';
                  }}
                >
                  {t('servers.manageBtn')} <ArrowRight size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
