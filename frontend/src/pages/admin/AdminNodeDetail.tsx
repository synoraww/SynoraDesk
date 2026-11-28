import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Info,
  Settings,
  FileCode,
  Network,
  Server as ServerIcon,
  HardDrive,
  Cpu,
  Trash2,
  Save,
  Copy,
  Check,
  Plus,
  Terminal,
  HeartPulse,
} from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { PaginationBar } from '../../components/admin/PaginationBar';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useUIStore } from '../../stores/uiStore';
import { useI18n } from '../../i18n';
import {
  adminCheckNodeHealth,
  adminCreateNodeAllocations,
  adminDeleteNode,
  adminDeleteNodeAllocation,
  adminGetNodeConfiguration,
  adminListLocations,
  adminListNodeAllocations,
  adminListServers,
  adminUpdateNode,
  parseBackendError,
} from '../../services/adminApi';
import {
  AdminLocation,
  AdminNode,
  AppServer,
  NodeAllocation,
  NodeConfiguration,
  NodeHealthStatus,
  PaginationMeta,
} from '../../types/admin';

type NodeTab = 'about' | 'settings' | 'configuration' | 'allocation' | 'servers';

interface AdminNodeDetailProps {
  node: AdminNode;
  initialTab?: NodeTab;
  onBack: () => void;
  onNavigateOverview: () => void;
  onChanged: () => void;
}

function formatConfigYaml(cfg: NodeConfiguration): string {
  return [
    `debug: ${cfg.debug}`,
    `uuid: ${cfg.uuid}`,
    `token_id: ${cfg.token_id}`,
    `token: ${cfg.token}`,
    `api:`,
    `  host: ${cfg.api.host}`,
    `  port: ${cfg.api.port}`,
    `  ssl:`,
    `    enabled: ${cfg.api.ssl.enabled}`,
    `    cert: ${cfg.api.ssl.cert}`,
    `    key: ${cfg.api.ssl.key}`,
    `  upload_limit: ${cfg.api.upload_limit}`,
    `system:`,
    `  data: ${cfg.system.data}`,
    `  sftp:`,
    `    bind_port: ${cfg.system.sftp.bind_port}`,
    `allowed_mounts: ${cfg.allowed_mounts && cfg.allowed_mounts.length > 0 ? '\n  - ' + cfg.allowed_mounts.join('\n  - ') : '[]'}`,
    `remote: '${cfg.remote}'`,
  ].join('\n');
}

export const AdminNodeDetail: React.FC<AdminNodeDetailProps> = ({
  node: initialNode,
  initialTab = 'about',
  onBack,
  onNavigateOverview,
  onChanged,
}) => {
  const { addNotification } = useUIStore();
  const { t } = useI18n();
  const [node, setNode] = useState<AdminNode>(initialNode);
  const [tab, setTab] = useState<NodeTab>(initialTab);

  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [nodeServers, setNodeServers] = useState<AppServer[]>([]);
  const [serversLoading, setServersLoading] = useState(false);
  const [health, setHealth] = useState<NodeHealthStatus | null>(null);

  // Settings form
  const [name, setName] = useState(node.name);
  const [description, setDescription] = useState(node.description || '');
  const [locationId, setLocationId] = useState(node.location_id);
  const [fqdn, setFqdn] = useState(node.fqdn);
  const [scheme, setScheme] = useState<'http' | 'https'>(node.scheme === 'http' ? 'http' : 'https');
  const [isPublic, setIsPublic] = useState(Boolean(node.public));
  const [behindProxy, setBehindProxy] = useState(Boolean(node.behind_proxy));
  const [maintenanceMode, setMaintenanceMode] = useState(Boolean(node.maintenance_mode));
  const [memory, setMemory] = useState(node.memory);
  const [memOver, setMemOver] = useState(node.memory_overallocate);
  const [disk, setDisk] = useState(node.disk);
  const [diskOver, setDiskOver] = useState(node.disk_overallocate);
  const [uploadSize, setUploadSize] = useState(node.upload_size);
  const [daemonListen, setDaemonListen] = useState(node.daemon_listen);
  const [daemonSftp, setDaemonSftp] = useState(node.daemon_sftp);
  const [daemonBase, setDaemonBase] = useState(node.daemon_base || '/var/lib/pterodactyl/volumes');
  const [savingSettings, setSavingSettings] = useState(false);

  // Configuration tab
  const [nodeConfig, setNodeConfig] = useState<NodeConfiguration | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [copiedYaml, setCopiedYaml] = useState(false);

  // Allocations tab
  const [allocations, setAllocations] = useState<NodeAllocation[]>([]);
  const [allocPagination, setAllocPagination] = useState<PaginationMeta>({
    total: 0,
    count: 0,
    per_page: 25,
    current_page: 1,
    total_pages: 1,
  });
  const [allocPage, setAllocPage] = useState(1);
  const [allocLoading, setAllocLoading] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [newPorts, setNewPorts] = useState('');
  const [creatingAlloc, setCreatingAlloc] = useState(false);

  // Confirmations
  const [deleteNodeOpen, setDeleteNodeOpen] = useState(false);
  const [deletingNode, setDeletingNode] = useState(false);
  const [deleteAllocTarget, setDeleteAllocTarget] = useState<NodeAllocation | null>(null);
  const [deletingAlloc, setDeletingAlloc] = useState(false);

  useEffect(() => {
    adminListLocations({ page: 1, perPage: 100 })
      .then((r) => setLocations(r?.items || []))
      .catch(() => {});

    setServersLoading(true);
    adminListServers({ page: 1, perPage: 100 })
      .then((r) => {
        const all = r?.items || [];
        setNodeServers(all.filter((s) => s.node === node.id));
      })
      .catch(() => {})
      .finally(() => setServersLoading(false));
    const refreshHealth = () => {
      adminCheckNodeHealth(node.id).then(setHealth).catch(() => {});
    };
    refreshHealth();
    const timer = setInterval(refreshHealth, 15000);
    const onReload = () => {
      refreshHealth();
      if (tab === 'allocation') loadAllocations(allocPage);
    };
    window.addEventListener('synora:reload', onReload);
    return () => {
      clearInterval(timer);
      window.removeEventListener('synora:reload', onReload);
    };
  }, [node.id]);

  useEffect(() => {
    if (tab === 'configuration' && !nodeConfig) {
      setConfigLoading(true);
      adminGetNodeConfiguration(node.id)
        .then(setNodeConfig)
        .catch((err) => {
          const parsed = parseBackendError(err);
          addNotification({ type: 'error', title: 'Configuration Error', message: parsed.permissionHint || parsed.message });
        })
        .finally(() => setConfigLoading(false));
    }
    if (tab === 'allocation') {
      loadAllocations(allocPage);
    }
  }, [tab, node.id]);

  const loadAllocations = async (targetPage = allocPage) => {
    setAllocLoading(true);
    try {
      const res = await adminListNodeAllocations(node.id, { page: targetPage, perPage: 25 });
      setAllocations(res?.items || []);
      if (res?.pagination) setAllocPagination(res.pagination);
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: 'Failed to load allocations', message: parsed.permissionHint || parsed.message });
    } finally {
      setAllocLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const updated = await adminUpdateNode(node.id, {
        name: name.trim(),
        description: description.trim(),
        location_id: Number(locationId),
        fqdn: fqdn.trim(),
        scheme,
        public: isPublic,
        behind_proxy: behindProxy,
        maintenance_mode: maintenanceMode,
        memory: Number(memory),
        memory_overallocate: Number(memOver),
        disk: Number(disk),
        disk_overallocate: Number(diskOver),
        upload_size: Number(uploadSize),
        daemon_listen: Number(daemonListen),
        daemon_sftp: Number(daemonSftp),
        daemon_base: daemonBase.trim(),
      });
      setNode(updated);
      addNotification({ type: 'success', title: 'Node Updated', message: `Saved settings for "${updated.name}".` });
      onChanged();
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: 'Update Node Failed', message: parsed.permissionHint || parsed.message });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateAllocations = async (e: React.FormEvent) => {
    e.preventDefault();
    const ports = newPorts.split(',').map((p) => p.trim()).filter(Boolean);
    if (!newIp.trim() || ports.length === 0) return;
    setCreatingAlloc(true);
    try {
      await adminCreateNodeAllocations(node.id, {
        ip: newIp.trim(),
        alias: newAlias.trim() || undefined,
        ports,
      });
      addNotification({ type: 'success', title: 'Allocations Added', message: `Added ports on ${newIp.trim()}.` });
      setNewPorts('');
      await loadAllocations(allocPage);
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: 'Create Allocation Failed', message: parsed.permissionHint || parsed.message });
    } finally {
      setCreatingAlloc(false);
    }
  };

  const handleDeleteAllocation = async () => {
    if (!deleteAllocTarget) return;
    setDeletingAlloc(true);
    try {
      await adminDeleteNodeAllocation(node.id, deleteAllocTarget.id);
      addNotification({ type: 'success', title: 'Allocation Deleted', message: `Removed ${deleteAllocTarget.ip}:${deleteAllocTarget.port}.` });
      setDeleteAllocTarget(null);
      await loadAllocations(allocPage);
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: 'Delete Failed', message: parsed.permissionHint || parsed.message });
    } finally {
      setDeletingAlloc(false);
    }
  };

  const handleDeleteNode = async () => {
    setDeletingNode(true);
    try {
      await adminDeleteNode(node.id);
      addNotification({ type: 'success', title: 'Node Deleted', message: `Deleted node "${node.name}".` });
      setDeleteNodeOpen(false);
      onChanged();
      onBack();
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: 'Delete Node Failed', message: parsed.permissionHint || parsed.message });
    } finally {
      setDeletingNode(false);
    }
  };

  const tabs: { key: NodeTab; label: string; icon: any }[] = [
    { key: 'about', label: t('admin.tabAbout'), icon: Info },
    { key: 'settings', label: t('admin.settings'), icon: Settings },
    { key: 'configuration', label: t('admin.tabConfig'), icon: FileCode },
    { key: 'allocation', label: t('admin.allocations'), icon: Network },
    { key: 'servers', label: t('admin.servers'), icon: ServerIcon },
  ];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '34px',
    padding: '0 10px',
    borderRadius: '4px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: '13px',
    boxSizing: 'border-box',
    outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12.5px',
    fontWeight: 600,
    color: 'var(--color-text)',
    marginBottom: '5px',
  };
  const boxStyle = (topColor = 'var(--color-primary)'): React.CSSProperties => ({
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderTop: `2px solid ${topColor}`,
    borderRadius: '4px',
    overflow: 'hidden',
  });

  const allocDisk = node.allocated_resources?.disk ?? 0;
  const allocMem = node.allocated_resources?.memory ?? 0;
  const diskPct = node.disk > 0 ? Math.min(100, Math.round((allocDisk / node.disk) * 100)) : 0;
  const memPct = node.memory > 0 ? Math.min(100, Math.round((allocMem / node.memory) * 100)) : 0;

  return (
    <div style={{ width: '100%', padding: '20px 24px', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box' }}>
      <AdminPageHeader
        title={node.name}
        subtitle={
          tab === 'about'
            ? t('admin.nodeAboutSubtitle')
            : tab === 'settings'
            ? t('admin.nodeSettingsSubtitle')
            : tab === 'configuration'
            ? t('admin.nodeConfigSubtitle')
            : tab === 'allocation'
            ? t('admin.nodeAllocSubtitle')
            : t('admin.nodeServersSubtitle')
        }
        icon={ServerIcon}
        breadcrumbs={[
          { label: t('admin.title'), onClick: onNavigateOverview },
          { label: t('admin.nodes'), onClick: onBack },
          { label: node.name },
          ...(tab !== 'about' ? [{ label: tabs.find((tItem) => tItem.key === tab)?.label || '' }] : []),
        ]}
        actions={
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 12px',
              borderRadius: '4px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={13} /> {t('admin.backToNodes')}
          </button>
        }
      />

      {/* Horizontal Tabs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          backgroundColor: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          marginBottom: '18px',
          overflow: 'hidden',
        }}
      >
        {tabs.map((tItem) => {
          const active = tab === tItem.key;
          const TabIcon = tItem.icon;
          return (
            <button
              key={tItem.key}
              type="button"
              onClick={() => setTab(tItem.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                border: 'none',
                borderTop: active ? '2px solid var(--color-primary)' : '2px solid transparent',
                backgroundColor: active ? 'var(--color-surface)' : 'transparent',
                color: active ? 'var(--color-text)' : 'var(--color-text-secondary)',
                fontSize: '13px',
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              <TabIcon size={14} />
              {tItem.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: ABOUT */}
      {tab === 'about' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '16px', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={boxStyle()}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={15} color="var(--color-primary-light)" />
                <span>{t('admin.information')}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <tbody>
                  {[
                    [t('admin.nodeId'), <code>{node.id}</code>],
                    ['UUID', <code>{node.uuid}</code>],
                    [
                      t('admin.healthLatency'),
                      health ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: health.reachable ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600 }}>
                          <HeartPulse size={14} />
                          {health.reachable ? `${t('admin.online')} (${health.latencyMs} ms)` : `${t('admin.offline')} (${health.error || 'Unreachable'})`}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>{t('admin.checking')}</span>
                      ),
                    ],
                    ['FQDN / Endpoint', <code>{node.scheme}://{node.fqdn}:{node.daemon_listen}</code>],
                    [t('admin.sftpPort'), <code>{node.daemon_sftp}</code>],
                    [t('admin.daemonBase'), <code>{node.daemon_base}</code>],
                    [t('admin.visibility'), node.public ? t('admin.public') : t('admin.private')],
                    [t('admin.maintenance'), node.maintenance_mode ? t('admin.enabled') : t('admin.disabled')],
                  ].map(([k, v], i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '9px 14px', width: '36%', color: 'var(--color-text-secondary)' }}>{k}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--color-text)' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={boxStyle('var(--color-border)')}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600 }}>
                {t('admin.description')}
              </div>
              <div style={{ padding: '14px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                {node.description || '—'}
              </div>
            </div>

            <div style={boxStyle('var(--color-error)')}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={15} color="var(--color-error)" />
                <span>{t('admin.deleteNode')}</span>
              </div>
              <div style={{ padding: '14px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                {t('admin.deleteNodeWarn')}
              </div>
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setDeleteNodeOpen(true)}
                  style={{ padding: '7px 14px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-error)', color: '#FFFFFF', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
                >
                  {t('admin.deleteNodeBtn')}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: At-a-Glance */}
          <div style={boxStyle()}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600 }}>
              {t('admin.atAGlance')}
            </div>
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ backgroundColor: '#00a65a', color: '#FFFFFF', borderRadius: '3px', padding: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <HardDrive size={30} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.9 }}>{t('admin.diskAllocated')}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>{allocDisk.toLocaleString()} / {node.disk.toLocaleString()} MiB</div>
                  <div style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.25)', marginTop: '6px', borderRadius: '2px' }}>
                    <div style={{ width: `${diskPct}%`, height: '100%', backgroundColor: '#FFFFFF', borderRadius: '2px' }} />
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: '#00a65a', color: '#FFFFFF', borderRadius: '3px', padding: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <Cpu size={30} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.9 }}>{t('admin.memoryAllocated')}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>{allocMem.toLocaleString()} / {node.memory.toLocaleString()} MiB</div>
                  <div style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.25)', marginTop: '6px', borderRadius: '2px' }}>
                    <div style={{ width: `${memPct}%`, height: '100%', backgroundColor: '#FFFFFF', borderRadius: '2px' }} />
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: '#0073b7', color: '#FFFFFF', borderRadius: '3px', padding: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <ServerIcon size={30} />
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.9 }}>{t('admin.totalServers')}</div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>{nodeServers.length}</div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: !health ? 'var(--color-surface-elevated)' : health.reachable ? '#00a65a' : '#DC2626',
                  color: !health ? 'var(--color-text)' : '#FFFFFF',
                  borderRadius: '3px',
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                <HeartPulse size={30} />
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.9 }}>{t('admin.daemonHealth')}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>
                    {!health ? t('admin.checking') : health.reachable ? `${t('admin.online')} · ${health.latencyMs} ms` : t('admin.offline')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SETTINGS */}
      {tab === 'settings' && (
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            <div style={boxStyle()}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={15} color="var(--color-primary-light)" />
                <span>{t('admin.settings')}</span>
              </div>
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div><label style={labelStyle}>{t('admin.nodeName')}</label><input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></div>
                <div><label style={labelStyle}>{t('admin.description')}</label><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, height: 'auto', padding: '8px 10px' }} /></div>
                <div>
                  <label style={labelStyle}>{t('admin.locations')}</label>
                  {locations.length > 0 ? (
                    <select value={locationId} onChange={(e) => setLocationId(Number(e.target.value))} style={inputStyle}>
                      {locations.map((l) => <option key={l.id} value={l.id}>{l.short} {l.long ? `— ${l.long}` : ''}</option>)}
                    </select>
                  ) : (
                    <input type="number" min={1} value={locationId} onChange={(e) => setLocationId(Number(e.target.value))} style={inputStyle} />
                  )}
                </div>
                <div><label style={labelStyle}>FQDN</label><input required value={fqdn} onChange={(e) => setFqdn(e.target.value)} style={inputStyle} /></div>
                <div>
                  <label style={labelStyle}>{t('admin.communicateOverSsl')}</label>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="radio" checked={scheme === 'https'} onChange={() => setScheme('https')} /> SSL (HTTPS)</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="radio" checked={scheme === 'http'} onChange={() => setScheme('http')} /> HTTP</label>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>{t('admin.behindProxy')}</label>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="radio" checked={!behindProxy} onChange={() => setBehindProxy(false)} /> {t('admin.no')}</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="radio" checked={behindProxy} onChange={() => setBehindProxy(true)} /> {t('admin.yes')}</label>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>{t('admin.maintenance')}</label>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="radio" checked={!maintenanceMode} onChange={() => setMaintenanceMode(false)} /> {t('admin.disabled')}</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="radio" checked={maintenanceMode} onChange={() => setMaintenanceMode(true)} /> {t('admin.enabled')}</label>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> {t('admin.public')}
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={boxStyle()}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600 }}>{t('admin.allocationLimits')}</div>
                <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('admin.memory')} (MiB)</label><input type="number" min={1} value={memory} onChange={(e) => setMemory(Number(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('admin.overallocate')} (%)</label><input type="number" value={memOver} onChange={(e) => setMemOver(Number(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('admin.diskSpace')} (MiB)</label><input type="number" min={1} value={disk} onChange={(e) => setDisk(Number(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('admin.overallocate')} (%)</label><input type="number" value={diskOver} onChange={(e) => setDiskOver(Number(e.target.value))} style={inputStyle} /></div>
                </div>
              </div>

              <div style={boxStyle()}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600 }}>{t('admin.generalConfig')}</div>
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('admin.maxUploadSize')} (MiB)</label><input type="number" min={1} value={uploadSize} onChange={(e) => setUploadSize(Number(e.target.value))} style={inputStyle} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div><label style={labelStyle}>{t('admin.daemonPort')}</label><input type="number" min={1} value={daemonListen} onChange={(e) => setDaemonListen(Number(e.target.value))} style={inputStyle} /></div>
                    <div><label style={labelStyle}>{t('admin.sftpPort')}</label><input type="number" min={1} value={daemonSftp} onChange={(e) => setDaemonSftp(Number(e.target.value))} style={inputStyle} /></div>
                  </div>
                  <div><label style={labelStyle}>{t('admin.daemonBase')}</label><input value={daemonBase} onChange={(e) => setDaemonBase(e.target.value)} style={inputStyle} /></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...boxStyle('var(--color-border)'), padding: '12px 14px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={savingSettings} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#FFFFFF', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              <Save size={14} /> {savingSettings ? t('admin.saving') : t('admin.saveChanges')}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: CONFIGURATION */}
      {tab === 'configuration' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: '16px', alignItems: 'start' }}>
          <div style={boxStyle()}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <FileCode size={15} color="var(--color-primary-light)" />
                {t('admin.configFile')}
              </span>
              {nodeConfig && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(formatConfigYaml(nodeConfig));
                    setCopiedYaml(true);
                    setTimeout(() => setCopiedYaml(false), 1500);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer' }}
                >
                  {copiedYaml ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
                  {copiedYaml ? t('admin.copied') : t('admin.copyYaml')}
                </button>
              )}
            </div>
            <div style={{ padding: '14px' }}>
              {configLoading ? (
                <TableSkeleton rows={5} />
              ) : nodeConfig ? (
                <>
                  <pre style={{ margin: 0, padding: '12px', borderRadius: '4px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', fontSize: '12px', fontFamily: 'var(--font-mono)', overflowX: 'auto' }}>
                    {formatConfigYaml(nodeConfig)}
                  </pre>
                  <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {t('admin.configFileHint')}
                  </p>
                </>
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{t('admin.unableToLoadConfig')}</div>
              )}
            </div>
          </div>

          <div style={boxStyle('var(--color-success)')}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={15} color="var(--color-success)" />
              <span>{t('admin.autoDeploy')}</span>
            </div>
            <div style={{ padding: '14px', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
              {nodeConfig ? (
                <>
                  <p style={{ marginTop: 0 }}>{t('admin.autoDeployHint')}</p>
                  <pre style={{ margin: 0, padding: '10px', borderRadius: '4px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', fontSize: '11.5px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {`cd /etc/pterodactyl && sudo wings configure --panel-url ${nodeConfig.remote} --token ${nodeConfig.token} --node ${node.id}`}
                  </pre>
                </>
              ) : (
                <div>{t('admin.unableToLoadConfig')}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ALLOCATION */}
      {tab === 'allocation' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px', alignItems: 'start' }}>
          <div style={boxStyle()}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Network size={15} color="var(--color-primary-light)" />
              <span>{t('admin.existingAllocations')}</span>
            </div>
            {allocLoading ? (
              <div style={{ padding: '16px' }}><TableSkeleton rows={4} /></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>{t('admin.ipAddress')}</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>{t('admin.alias')}</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>{t('admin.port')}</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px' }}>{t('admin.status')}</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px' }}>{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('admin.noAllocationsTitle')}</td></tr>
                  ) : allocations.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{a.ip}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>{a.alias || '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{a.port}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>{a.assigned ? t('admin.assigned') : t('admin.available')}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <button type="button" disabled={a.assigned} onClick={() => setDeleteAllocTarget(a)} style={{ padding: '4px 7px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.35)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', cursor: a.assigned ? 'not-allowed' : 'pointer', opacity: a.assigned ? 0.45 : 1 }}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <PaginationBar
              pagination={allocPagination}
              disabled={allocLoading}
              onPageChange={(p) => { setAllocPage(p); loadAllocations(p); }}
            />
          </div>

          <form onSubmit={handleCreateAllocations} style={boxStyle('var(--color-success)')}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={15} color="var(--color-success)" />
              <span>{t('admin.assignAllocations')}</span>
            </div>
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={labelStyle}>{t('admin.ipAddress')} *</label><input required value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder="0.0.0.0" style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.ipAliasOptional')}</label><input value={newAlias} onChange={(e) => setNewAlias(e.target.value)} placeholder="play.example.com" style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.portsRangesLabel')}</label><input required value={newPorts} onChange={(e) => setNewPorts(e.target.value)} placeholder="25565, 25570-25575" style={inputStyle} /></div>
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={creatingAlloc} style={{ padding: '7px 14px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-success)', color: '#FFFFFF', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                {creatingAlloc ? t('admin.adding') : t('admin.createAllocations')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 5: SERVERS */}
      {tab === 'servers' && (
        <div style={boxStyle()}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ServerIcon size={15} color="var(--color-primary-light)" />
            <span>{t('admin.serverList')}</span>
          </div>
          {serversLoading ? (
            <div style={{ padding: '16px' }}><TableSkeleton rows={4} /></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px' }}>{t('admin.serverName')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px' }}>{t('admin.serverOwner')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px' }}>{t('admin.limits')}</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px' }}>{t('admin.status')}</th>
                </tr>
              </thead>
              <tbody>
                {nodeServers.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('admin.noServersDesc')}</td></tr>
                ) : nodeServers.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}><code>{s.identifier}</code></td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>User #{s.user}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>{s.limits?.memory} MiB · {s.limits?.disk} MiB</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}><StatusBadge status={s.suspended ? 'suspended' : 'active'} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteNodeOpen}
        title={t('admin.deleteNode')}
        message={t('admin.confirmDeleteNodeMsg', { name: node.name, fqdn: node.fqdn })}
        confirmLabel={t('admin.deleteNode')}
        isDestructive
        isLoading={deletingNode}
        onConfirm={handleDeleteNode}
        onCancel={() => !deletingNode && setDeleteNodeOpen(false)}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteAllocTarget)}
        title={t('admin.deleteAllocation')}
        message={deleteAllocTarget ? t('admin.deleteAllocationMsg', { ip: deleteAllocTarget.ip, port: deleteAllocTarget.port }) : ''}
        confirmLabel={t('admin.delete')}
        isDestructive
        isLoading={deletingAlloc}
        onConfirm={handleDeleteAllocation}
        onCancel={() => !deletingAlloc && setDeleteAllocTarget(null)}
      />
    </div>
  );
};
