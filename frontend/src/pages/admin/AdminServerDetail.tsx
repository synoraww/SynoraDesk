import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  User as UserIcon,
  Layers,
  KeyRound,
  Trash2,
  Server as ServerIcon,
  Info,
  FileText,
  Cpu,
  Terminal,
  Database,
  Wrench,
  Sliders,
  Network,
  Box,
  Container,
  RotateCcw,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  PlusCircle,
  ArrowRightCircle,
} from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import { useUIStore } from '../../stores/uiStore';
import { useI18n } from '../../i18n';
import {
  adminCreateServerDatabase,
  adminDeleteServer,
  adminDeleteServerDatabase,
  adminGetEgg,
  adminGetNode,
  adminGetUser,
  adminListEggs,
  adminListNests,
  adminListNodeAllocations,
  adminListServerDatabases,
  adminReinstallServer,
  adminResetServerDatabasePassword,
  adminSuspendServer,
  adminUnsuspendServer,
  adminUpdateServerBuild,
  adminUpdateServerDetails,
  adminUpdateServerStartup,
  parseBackendError,
} from '../../services/adminApi';
import {
  AdminEgg,
  AdminNest,
  AdminNode,
  AdminUser,
  AppDatabase,
  AppServer,
  NodeAllocation,
} from '../../types/admin';

type ServerAdminTab = 'about' | 'details' | 'build' | 'startup' | 'database' | 'manage' | 'delete';

interface AdminServerDetailProps {
  server: AppServer;
  onBack: () => void;
  onNavigateOverview: () => void;
  onNavigateUser: (userId: number) => void;
  onNavigateNode: (nodeId: number) => void;
  onChanged: () => void;
}

export const AdminServerDetail: React.FC<AdminServerDetailProps> = ({
  server: initialServer,
  onBack,
  onNavigateOverview,
  onNavigateUser,
  onNavigateNode,
  onChanged,
}) => {
  const { addNotification } = useUIStore();
  const { t } = useI18n();
  const [server, setServer] = useState<AppServer>(initialServer);
  const [tab, setTab] = useState<ServerAdminTab>('about');

  const [owner, setOwner] = useState<AdminUser | null>(null);
  const [node, setNode] = useState<AdminNode | null>(null);
  const [allocations, setAllocations] = useState<NodeAllocation[]>([]);
  const [nests, setNests] = useState<AdminNest[]>([]);
  const [eggs, setEggs] = useState<AdminEgg[]>([]);
  const [selectedEgg, setSelectedEgg] = useState<AdminEgg | null>(null);

  // Details form
  const [detailsName, setDetailsName] = useState(server.name);
  const [detailsExtId, setDetailsExtId] = useState(server.external_id || '');
  const [detailsUser, setDetailsUser] = useState(server.user);
  const [detailsDesc, setDetailsDesc] = useState(server.description || '');
  const [savingDetails, setSavingDetails] = useState(false);

  // Build form
  const [buildCpu, setBuildCpu] = useState(server.limits?.cpu ?? 0);
  const [buildThreads, setBuildThreads] = useState(server.limits?.threads || '');
  const [buildMemory, setBuildMemory] = useState(server.limits?.memory ?? 0);
  const [buildSwap, setBuildSwap] = useState(server.limits?.swap ?? 0);
  const [buildDisk, setBuildDisk] = useState(server.limits?.disk ?? 0);
  const [buildIo, setBuildIo] = useState(server.limits?.io ?? 500);
  const [buildOomDisabled, setBuildOomDisabled] = useState(Boolean(server.limits?.oom_disabled));
  const [buildDbLimit, setBuildDbLimit] = useState(server.feature_limits?.databases ?? 0);
  const [buildAllocLimit, setBuildAllocLimit] = useState(server.feature_limits?.allocations ?? 0);
  const [buildBackupLimit, setBuildBackupLimit] = useState(server.feature_limits?.backups ?? 0);
  const [buildAllocation, setBuildAllocation] = useState(server.allocation);
  const [buildAddAllocs, setBuildAddAllocs] = useState('');
  const [buildRemoveAllocs, setBuildRemoveAllocs] = useState('');
  const [savingBuild, setSavingBuild] = useState(false);

  // Startup form
  const [startupCmd, setStartupCmd] = useState(server.container?.startup_command || '');
  const [startupNest, setStartupNest] = useState(server.nest);
  const [startupEgg, setStartupEgg] = useState(server.egg);
  const [startupImage, setStartupImage] = useState(server.container?.image || '');
  const [startupSkipScripts, setStartupSkipScripts] = useState(false);
  const [startupEnv, setStartupEnv] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    Object.entries(server.container?.environment || {}).forEach(([k, v]) => {
      out[k] = v === null || v === undefined ? '' : String(v);
    });
    return out;
  });
  const [savingStartup, setSavingStartup] = useState(false);

  // Databases tab
  const [databases, setDatabases] = useState<AppDatabase[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [newDbRemote, setNewDbRemote] = useState('%');
  const [newDbHost, setNewDbHost] = useState(1);
  const [newDbMaxConn, setNewDbMaxConn] = useState('');
  const [creatingDb, setCreatingDb] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);

  // Manage / Delete confirmations
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'reinstall' | 'suspend' | 'unsuspend' | 'delete' | 'force-delete' }
    | { type: 'db-reset' | 'db-delete'; db: AppDatabase }
    | null
  >(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // Load related owner, node, allocations, nests/eggs for rich Pterodactyl UI
    adminGetUser(server.user).then(setOwner).catch(() => {});
    adminGetNode(server.node).then(setNode).catch(() => {});
    adminListNodeAllocations(server.node, { page: 1, perPage: 100 })
      .then((r) => setAllocations(r?.items || []))
      .catch(() => {});
    adminListNests({ page: 1, perPage: 100 })
      .then((r) => setNests(r?.items || []))
      .catch(() => {});
    adminListEggs(server.nest, { page: 1, perPage: 100 })
      .then((r) => setEggs(r?.items || []))
      .catch(() => {});
    adminGetEgg(server.nest, server.egg)
      .then(setSelectedEgg)
      .catch(() => {});
  }, [server.id]);

  const loadDatabases = async () => {
    setDbLoading(true);
    try {
      const res = await adminListServerDatabases(server.id, { page: 1, perPage: 50, include: ['host'] });
      setDatabases(res?.items || []);
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: 'Failed to load databases', message: parsed.permissionHint || parsed.message });
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'database') {
      loadDatabases();
    }
  }, [tab, server.id]);

  const parseIdList = (raw: string): number[] | undefined => {
    const nums = raw
      .split(',')
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
    return nums.length > 0 ? nums : undefined;
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDetails(true);
    try {
      const updated = await adminUpdateServerDetails(server.id, {
        name: detailsName.trim(),
        user: Number(detailsUser),
        external_id: detailsExtId.trim() || null,
        description: detailsDesc,
      });
      setServer(updated);
      addNotification({ type: 'success', title: 'Details Updated', message: `Saved details for "${updated.name}".` });
      onChanged();
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: 'Update Details Failed', message: parsed.permissionHint || parsed.message });
    } finally {
      setSavingDetails(false);
    }
  };

  const handleSaveBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBuild(true);
    try {
      const updated = await adminUpdateServerBuild(server.id, {
        allocation: Number(buildAllocation),
        oom_disabled: buildOomDisabled,
        memory: Number(buildMemory),
        swap: Number(buildSwap),
        disk: Number(buildDisk),
        io: Number(buildIo),
        cpu: Number(buildCpu),
        threads: buildThreads.trim() || null,
        feature_limits: {
          databases: Number(buildDbLimit),
          allocations: Number(buildAllocLimit),
          backups: Number(buildBackupLimit),
        },
        add_allocations: parseIdList(buildAddAllocs),
        remove_allocations: parseIdList(buildRemoveAllocs),
      });
      setServer(updated);
      addNotification({ type: 'success', title: 'Build Updated', message: 'Server build configuration updated.' });
      onChanged();
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: 'Update Build Failed', message: parsed.permissionHint || parsed.message });
    } finally {
      setSavingBuild(false);
    }
  };

  const handleSaveStartup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStartup(true);
    try {
      const updated = await adminUpdateServerStartup(server.id, {
        startup: startupCmd.trim(),
        egg: Number(startupEgg),
        image: startupImage.trim(),
        environment: startupEnv,
        skip_scripts: startupSkipScripts,
      });
      setServer(updated);
      addNotification({ type: 'success', title: 'Startup Updated', message: 'Server startup configuration saved.' });
      onChanged();
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: 'Update Startup Failed', message: parsed.permissionHint || parsed.message });
    } finally {
      setSavingStartup(false);
    }
  };

  const handleCreateDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDbName.trim()) return;
    setCreatingDb(true);
    try {
      const created = await adminCreateServerDatabase(server.id, {
        database: newDbName.trim(),
        remote: newDbRemote.trim() || '%',
        host: Number(newDbHost),
        max_connections: newDbMaxConn.trim() ? Number(newDbMaxConn) : 0,
      });
      setNewDbName('');
      setRevealedPassword(created.relationships?.password?.attributes?.password || null);
      addNotification({ type: 'success', title: 'Database Created', message: `Created "${created.database}".` });
      await loadDatabases();
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: 'Create Database Failed', message: parsed.permissionHint || parsed.message });
    } finally {
      setCreatingDb(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.type === 'reinstall') {
        await adminReinstallServer(server.id);
        addNotification({ type: 'success', title: 'Reinstall Triggered', message: `Reinstalling "${server.name}".` });
      } else if (confirmAction.type === 'suspend') {
        await adminSuspendServer(server.id);
        setServer({ ...server, suspended: true });
        addNotification({ type: 'success', title: 'Server Suspended', message: `Suspended "${server.name}".` });
        onChanged();
      } else if (confirmAction.type === 'unsuspend') {
        await adminUnsuspendServer(server.id);
        setServer({ ...server, suspended: false });
        addNotification({ type: 'success', title: 'Server Unsuspended', message: `Unsuspended "${server.name}".` });
        onChanged();
      } else if (confirmAction.type === 'delete' || confirmAction.type === 'force-delete') {
        await adminDeleteServer(server.id, confirmAction.type === 'force-delete');
        addNotification({ type: 'success', title: 'Server Deleted', message: `Deleted "${server.name}".` });
        setConfirmAction(null);
        onChanged();
        onBack();
        return;
      } else if (confirmAction.type === 'db-reset') {
        await adminResetServerDatabasePassword(server.id, confirmAction.db.id);
        addNotification({ type: 'success', title: 'Password Rotated', message: `Rotated password for "${confirmAction.db.database}".` });
      } else if (confirmAction.type === 'db-delete') {
        await adminDeleteServerDatabase(server.id, confirmAction.db.id);
        addNotification({ type: 'success', title: 'Database Deleted', message: `Deleted "${confirmAction.db.database}".` });
        await loadDatabases();
      }
      setConfirmAction(null);
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: 'Action Failed', message: parsed.permissionHint || parsed.message });
    } finally {
      setActionLoading(false);
    }
  };

  const defaultAlloc = allocations.find((a) => a.id === server.allocation);
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

  const tabs: { key: ServerAdminTab; label: string; icon: any }[] = [
    { key: 'about', label: t('admin.tabAbout'), icon: Info },
    { key: 'details', label: t('admin.tabDetails'), icon: FileText },
    { key: 'build', label: t('admin.tabBuild'), icon: Cpu },
    { key: 'startup', label: t('admin.tabStartup'), icon: Terminal },
    { key: 'database', label: t('admin.tabDatabase'), icon: Database },
    { key: 'manage', label: t('admin.tabManage'), icon: Wrench },
    { key: 'delete', label: t('admin.tabDelete'), icon: Trash2 },
  ];

  return (
    <div style={{ width: '100%', padding: '20px 24px', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box' }}>
      <AdminPageHeader
        title={server.name}
        icon={ServerIcon}
        subtitle={
          tab === 'about'
            ? t('admin.aboutSubtitle')
            : tab === 'details'
            ? t('admin.detailsSubtitle')
            : tab === 'build'
            ? t('admin.buildSubtitle')
            : tab === 'startup'
            ? t('admin.startupSubtitle')
            : tab === 'database'
            ? t('admin.databaseSubtitle')
            : tab === 'manage'
            ? t('admin.manageSubtitle')
            : t('admin.deleteSubtitle')
        }
        breadcrumbs={[
          { label: t('admin.title'), onClick: onNavigateOverview },
          { label: t('admin.servers'), onClick: onBack },
          { label: server.name },
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
            <ArrowLeft size={13} /> {t('admin.backToServers')}
          </button>
        }
      />

      {/* Horizontal Pterodactyl Server Tabs */}
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
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', alignItems: 'start' }}>
          <div style={boxStyle()}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={15} color="var(--color-primary-light)" />
              <span>{t('admin.information')}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <tbody>
                {[
                  [t('admin.internalIdentifier'), <code>{server.id}</code>],
                  [t('admin.externalIdentifier'), server.external_id ? <code>{server.external_id}</code> : <em>{t('admin.notSet')}</em>],
                  ['UUID / Docker Container ID', <code>{server.uuid}</code>],
                  [t('admin.currentNestEgg'), `Nest #${server.nest} :: ${selectedEgg ? selectedEgg.name : `Egg #${server.egg}`}`],
                  [t('admin.serverName'), server.name],
                  [t('admin.cpuLimit'), <code>{server.limits?.cpu ?? 0}%</code>],
                  [t('admin.cpuPinning'), server.limits?.threads ? <code>{server.limits.threads}</code> : <em>{t('admin.notSet')}</em>],
                  [t('admin.memory'), <code>{server.limits?.memory ?? 0} MiB / {server.limits?.swap ?? 0} MiB Swap</code>],
                  [t('admin.diskSpace'), <code>{server.limits?.disk ?? 0} MiB</code>],
                  [t('admin.blockIoWeight'), <code>{server.limits?.io ?? 500}</code>],
                  [
                    t('admin.defaultConnection'),
                    defaultAlloc ? <code>{defaultAlloc.ip}:{defaultAlloc.port}</code> : <code>Allocation #{server.allocation}</code>,
                  ],
                  [t('admin.connectionAlias'), defaultAlloc?.alias ? <code>{defaultAlloc.alias}</code> : <em>{t('admin.noAliasAssigned')}</em>],
                ].map(([label, val], idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '9px 14px', width: '36%', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{label}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--color-text)' }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Server Status Banner */}
            {(() => {
              let statusLabel = t('admin.statusInstalled');
              let bgColor = 'var(--color-success)';
              if (server.suspended) {
                statusLabel = t('admin.statusSuspended');
                bgColor = '#DC2626';
              } else if (server.status === 'installing' || server.container?.installed === 0) {
                statusLabel = t('admin.statusInstalling');
                bgColor = '#0284C7';
              } else if (server.status === 'transferring') {
                statusLabel = t('admin.statusTransferring');
                bgColor = '#D97706';
              } else if (server.status === 'restoring_backup') {
                statusLabel = t('admin.statusRestoring');
                bgColor = '#D97706';
              }
              return (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    padding: '10px',
                  }}
                >
                  <div
                    style={{
                      backgroundColor: bgColor,
                      color: '#FFFFFF',
                      borderRadius: '3px',
                      padding: '12px 16px',
                      fontSize: '26px',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {statusLabel}
                  </div>
                </div>
              );
            })()}

            {/* Server Owner Card with More Info */}
            <div style={boxStyle('var(--color-border)')}>
              <div style={{ padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>{owner ? owner.username : `User #${server.user}`}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t('admin.serverOwner')} {owner ? `(${owner.email})` : ''}</div>
                </div>
                <UserIcon size={36} color="var(--color-text-muted)" />
              </div>
              <button
                type="button"
                onClick={() => onNavigateUser(server.user)}
                style={{
                  width: '100%',
                  padding: '7px 14px',
                  border: 'none',
                  borderTop: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-elevated)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <span>{t('admin.moreInfo')}</span>
                <ArrowRightCircle size={13} />
              </button>
            </div>

            {/* Server Node Card with More Info */}
            <div style={boxStyle('var(--color-border)')}>
              <div style={{ padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>{node ? node.name : `Node #${server.node}`}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t('admin.serverNode')} {node ? `(${node.fqdn})` : ''}</div>
                </div>
                <Layers size={36} color="var(--color-text-muted)" />
              </div>
              <button
                type="button"
                onClick={() => onNavigateNode(server.node)}
                style={{
                  width: '100%',
                  padding: '7px 14px',
                  border: 'none',
                  borderTop: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-elevated)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <span>{t('admin.moreInfo')}</span>
                <ArrowRightCircle size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DETAILS */}
      {tab === 'details' && (
        <form onSubmit={handleSaveDetails} style={boxStyle()}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={15} color="var(--color-primary-light)" />
            <span>{t('admin.baseInfo')}</span>
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>{t('admin.serverName')} <span style={{ color: 'var(--color-error)', fontWeight: 400 }}>{t('admin.required')}</span></label>
              <input required value={detailsName} onChange={(e) => setDetailsName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t('admin.externalIdentifier')}</label>
              <input value={detailsExtId} onChange={(e) => setDetailsExtId(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t('admin.serverOwner')} (User ID) <span style={{ color: 'var(--color-error)', fontWeight: 400 }}>{t('admin.required')}</span></label>
              <input type="number" min={1} required value={detailsUser} onChange={(e) => setDetailsUser(Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t('admin.serverDesc')}</label>
              <textarea rows={3} value={detailsDesc} onChange={(e) => setDetailsDesc(e.target.value)} style={{ ...inputStyle, height: 'auto', padding: '8px 10px' }} />
            </div>
          </div>
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
            <button type="submit" disabled={savingDetails} style={{ padding: '7px 14px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#FFFFFF', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              {savingDetails ? t('admin.saving') : t('admin.updateDetails')}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: BUILD CONFIGURATION */}
      {tab === 'build' && (
        <form onSubmit={handleSaveBuild} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
          <div style={boxStyle()}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={15} color="var(--color-primary-light)" />
              <span>{t('admin.resourceManagement')}</span>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={labelStyle}>{t('admin.cpuLimit')} (%)</label><input type="number" value={buildCpu} onChange={(e) => setBuildCpu(Number(e.target.value))} style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.cpuPinning')}</label><input value={buildThreads} onChange={(e) => setBuildThreads(e.target.value)} placeholder="e.g. 0, 0-1,3" style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.allocatedMemory')} (MiB)</label><input type="number" value={buildMemory} onChange={(e) => setBuildMemory(Number(e.target.value))} style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.allocatedSwap')} (MiB)</label><input type="number" value={buildSwap} onChange={(e) => setBuildSwap(Number(e.target.value))} style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.diskSpaceLimit')} (MiB)</label><input type="number" value={buildDisk} onChange={(e) => setBuildDisk(Number(e.target.value))} style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.blockIo')}</label><input type="number" value={buildIo} onChange={(e) => setBuildIo(Number(e.target.value))} style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>{t('admin.oomKiller')}</label>
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="radio" checked={!buildOomDisabled} onChange={() => setBuildOomDisabled(false)} /> {t('admin.enabled')}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="radio" checked={buildOomDisabled} onChange={() => setBuildOomDisabled(true)} /> {t('admin.disabled')}
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={boxStyle()}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={15} color="var(--color-primary-light)" />
                <span>{t('admin.featureLimits')}</span>
              </div>
              <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={labelStyle}>{t('admin.databaseLimit')}</label><input type="number" value={buildDbLimit} onChange={(e) => setBuildDbLimit(Number(e.target.value))} style={inputStyle} /></div>
                <div><label style={labelStyle}>{t('admin.allocationLimit')}</label><input type="number" value={buildAllocLimit} onChange={(e) => setBuildAllocLimit(Number(e.target.value))} style={inputStyle} /></div>
                <div><label style={labelStyle}>{t('admin.backupLimit')}</label><input type="number" value={buildBackupLimit} onChange={(e) => setBuildBackupLimit(Number(e.target.value))} style={inputStyle} /></div>
              </div>
            </div>

            <div style={boxStyle()}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Network size={15} color="var(--color-primary-light)" />
                <span>{t('admin.allocationManagement')}</span>
              </div>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>{t('admin.gamePort')}</label>
                  {allocations.length > 0 ? (
                    <select value={buildAllocation} onChange={(e) => setBuildAllocation(Number(e.target.value))} style={inputStyle}>
                      {allocations.map((a) => (
                        <option key={a.id} value={a.id}>
                          #{a.id} — {a.ip}:{a.port} {a.alias ? `(${a.alias})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="number" min={1} value={buildAllocation} onChange={(e) => setBuildAllocation(Number(e.target.value))} style={inputStyle} />
                  )}
                </div>
                <div><label style={labelStyle}>{t('admin.addAdditionalAllocs')}</label><input value={buildAddAllocs} onChange={(e) => setBuildAddAllocs(e.target.value)} placeholder="e.g. 12, 13" style={inputStyle} /></div>
                <div><label style={labelStyle}>{t('admin.removeAdditionalAllocs')}</label><input value={buildRemoveAllocs} onChange={(e) => setBuildRemoveAllocs(e.target.value)} placeholder="e.g. 14" style={inputStyle} /></div>
              </div>
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={savingBuild} style={{ padding: '7px 14px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#FFFFFF', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                  {savingBuild ? t('admin.saving') : t('admin.updateBuildConfig')}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: STARTUP */}
      {tab === 'startup' && (
        <form onSubmit={handleSaveStartup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={boxStyle()}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={15} color="var(--color-primary-light)" />
              <span>{t('admin.startupCmdMod')}</span>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={labelStyle}>{t('admin.startupCmd')}</label><input required value={startupCmd} onChange={(e) => setStartupCmd(e.target.value)} style={inputStyle} /></div>
              {selectedEgg?.startup && (
                <div>
                  <label style={labelStyle}>{t('admin.defaultStartupCmd')}</label>
                  <input readOnly value={selectedEgg.startup} style={{ ...inputStyle, opacity: 0.7 }} />
                </div>
              )}
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={savingStartup} style={{ padding: '7px 14px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#FFFFFF', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                {savingStartup ? t('admin.saving') : t('admin.saveModifications')}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={boxStyle()}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Box size={15} color="var(--color-primary-light)" />
                  <span>{t('admin.serviceConfig')}</span>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>{t('admin.nest')}</label>
                    <select
                      value={startupNest}
                      onChange={async (e) => {
                        const nid = Number(e.target.value);
                        setStartupNest(nid);
                        const res = await adminListEggs(nid, { page: 1, perPage: 100 }).catch(() => null);
                        const items = res?.items || [];
                        setEggs(items);
                        if (items.length > 0) {
                          const nextEggId = items[0].id;
                          setStartupEgg(nextEggId);
                          const eggDetail = await adminGetEgg(nid, nextEggId).catch(() => items[0]);
                          setSelectedEgg(eggDetail);
                        } else {
                          setSelectedEgg(null);
                        }
                      }}
                      style={inputStyle}
                    >
                      {nests.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>{t('admin.egg')}</label>
                    <select
                      value={startupEgg}
                      onChange={async (e) => {
                        const eid = Number(e.target.value);
                        setStartupEgg(eid);
                        const eggDetail = await adminGetEgg(startupNest, eid).catch(() => eggs.find((x) => x.id === eid) || null);
                        setSelectedEgg(eggDetail);
                      }}
                      style={inputStyle}
                    >
                      {eggs.map((eg) => <option key={eg.id} value={eg.id}>{eg.name}</option>)}
                    </select>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
                    <input type="checkbox" checked={startupSkipScripts} onChange={(e) => setStartupSkipScripts(e.target.checked)} />
                    {t('admin.skipEggScripts')}
                  </label>
                </div>
              </div>

              <div style={boxStyle()}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Container size={15} color="var(--color-primary-light)" />
                  <span>{t('admin.dockerImageConfig')}</span>
                </div>
                <div style={{ padding: '16px' }}>
                  <label style={labelStyle}>{t('admin.image')}</label>
                  {(() => {
                    const eggImages: [string, string][] = Object.entries(selectedEgg?.docker_images || {});
                    if (selectedEgg?.docker_image && !eggImages.some(([, img]) => img === selectedEgg.docker_image)) {
                      eggImages.unshift(['Default', selectedEgg.docker_image]);
                    }
                    const isPreset = eggImages.some(([, img]) => img === startupImage);
                    return (
                      <>
                        <select
                          value={isPreset ? startupImage : '__custom__'}
                          onChange={(e) => {
                            if (e.target.value !== '__custom__') {
                              setStartupImage(e.target.value);
                            } else if (isPreset) {
                              setStartupImage('');
                            }
                          }}
                          style={inputStyle}
                        >
                          {eggImages.map(([label, img]) => (
                            <option key={img} value={img}>
                              {label} ({img})
                            </option>
                          ))}
                          <option value="__custom__">{t('admin.customImageOption')}</option>
                        </select>
                        <input
                          type="text"
                          value={isPreset ? '' : startupImage}
                          placeholder={t('admin.customImagePlaceholder')}
                          onChange={(e) => setStartupImage(e.target.value)}
                          style={{ ...inputStyle, marginTop: '8px' }}
                        />
                        <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                          {t('admin.dockerImageHint')}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(startupEnv).map(([k, v]) => (
                <div key={k} style={boxStyle()}>
                  <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '13px', fontWeight: 600 }}>
                    <code>{k}</code>
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <input
                      value={v}
                      onChange={(e) => setStartupEnv({ ...startupEnv, [k]: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      )}

      {/* TAB 5: DATABASE */}
      {tab === 'database' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '16px', alignItems: 'start' }}>
          <div style={boxStyle()}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={15} color="var(--color-primary-light)" />
              <span>{t('admin.activeDatabases')}</span>
            </div>
            {revealedPassword && (
              <div style={{ margin: '12px', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-warning)', backgroundColor: 'var(--color-warning-bg)', fontSize: '12px' }}>
                {t('admin.oneTimePasswordNote')} <code style={{ userSelect: 'all' }}>{revealedPassword}</code>
              </div>
            )}
            {dbLoading ? (
              <div style={{ padding: '16px' }}><TableSkeleton rows={3} /></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>{t('admin.database')}</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>{t('admin.username')}</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>{t('admin.connectionsFrom')}</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>{t('admin.host')}</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px' }}>{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {databases.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('admin.noDatabasesDesc')}</td></tr>
                  ) : databases.map((db) => (
                    <tr key={db.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '8px 12px' }}><code>{db.database}</code></td>
                      <td style={{ padding: '8px 12px' }}><code>{db.username}</code></td>
                      <td style={{ padding: '8px 12px' }}><code>{db.remote}</code></td>
                      <td style={{ padding: '8px 12px' }}>{db.relationships?.host?.attributes ? `${db.relationships.host.attributes.host}:${db.relationships.host.attributes.port}` : `#${db.host}`}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" onClick={() => setConfirmAction({ type: 'db-reset', db })} title={t('admin.rotatePassword')} style={{ padding: '4px 7px', marginRight: '4px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-warning)', cursor: 'pointer' }}><KeyRound size={12} /></button>
                        <button type="button" onClick={() => setConfirmAction({ type: 'db-delete', db })} title={t('admin.delete')} style={{ padding: '4px 7px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.35)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', cursor: 'pointer' }}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <form onSubmit={handleCreateDatabase} style={boxStyle('var(--color-success)')}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlusCircle size={15} color="var(--color-success)" />
              <span>{t('admin.createNewDatabase')}</span>
            </div>
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={labelStyle}>{t('admin.databaseHostIdRequired')}</label><input type="number" min={1} required value={newDbHost} onChange={(e) => setNewDbHost(Number(e.target.value))} style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.database')}</label><input required value={newDbName} onChange={(e) => setNewDbName(e.target.value)} placeholder="database" style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.connectionsFrom')}</label><input value={newDbRemote} onChange={(e) => setNewDbRemote(e.target.value)} placeholder="%" style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.maxConnections')}</label><input type="number" value={newDbMaxConn} onChange={(e) => setNewDbMaxConn(e.target.value)} placeholder={t('admin.unlimited')} style={inputStyle} /></div>
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={creatingDb} style={{ padding: '7px 14px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-success)', color: '#FFFFFF', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                {creatingDb ? t('admin.creating') : t('admin.createDatabase')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 6: MANAGE */}
      {tab === 'manage' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={boxStyle('var(--color-error)')}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RotateCcw size={15} color="var(--color-error)" />
              <span>{t('admin.reinstallServer')}</span>
            </div>
            <div style={{ padding: '14px', fontSize: '13px', color: 'var(--color-text-secondary)', minHeight: '64px' }}>
              {t('admin.reinstallWarn')}
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
              <button type="button" onClick={() => setConfirmAction({ type: 'reinstall' })} style={{ padding: '7px 14px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-error)', color: '#FFFFFF', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                {t('admin.reinstallServer')}
              </button>
            </div>
          </div>

          <div style={boxStyle('var(--color-warning)')}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {server.suspended ? <PlayCircle size={15} color="var(--color-success)" /> : <PauseCircle size={15} color="var(--color-warning)" />}
              <span>{server.suspended ? t('admin.unsuspendServer') : t('admin.suspendServer')}</span>
            </div>
            <div style={{ padding: '14px', fontSize: '13px', color: 'var(--color-text-secondary)', minHeight: '64px' }}>
              {server.suspended ? t('admin.unsuspendWarn') : t('admin.suspendWarn')}
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
              <button
                type="button"
                onClick={() => setConfirmAction({ type: server.suspended ? 'unsuspend' : 'suspend' })}
                style={{ padding: '7px 14px', borderRadius: '4px', border: 'none', backgroundColor: server.suspended ? 'var(--color-success)' : 'var(--color-warning)', color: '#FFFFFF', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
              >
                {server.suspended ? t('admin.unsuspendServer') : t('admin.suspendServer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: DELETE */}
      {tab === 'delete' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={boxStyle('var(--color-border)')}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trash2 size={15} color="var(--color-text-secondary)" />
              <span>{t('admin.safelyDeleteServer')}</span>
            </div>
            <div style={{ padding: '14px', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
              {t('admin.safelyDeleteDesc')}
              <p style={{ color: 'var(--color-error)', marginTop: '8px', marginBottom: 0 }}>
                {t('admin.safelyDeleteIrreversible')}
              </p>
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
              <button type="button" onClick={() => setConfirmAction({ type: 'delete' })} style={{ padding: '7px 14px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-error)', color: '#FFFFFF', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                {t('admin.safelyDeleteBtn')}
              </button>
            </div>
          </div>

          <div style={boxStyle('var(--color-error)')}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={15} color="var(--color-error)" />
              <span>{t('admin.forceDeleteServer')}</span>
            </div>
            <div style={{ padding: '14px', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
              {t('admin.forceDeleteDesc')}
              <p style={{ color: 'var(--color-error)', marginTop: '8px', marginBottom: 0 }}>
                {t('admin.forceDeleteIrreversible')}
              </p>
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
              <button type="button" onClick={() => setConfirmAction({ type: 'force-delete' })} style={{ padding: '7px 14px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-error)', color: '#FFFFFF', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                {t('admin.forceDeleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        title={t('admin.confirmAction')}
        message={
          confirmAction?.type === 'reinstall'
            ? t('admin.confirmReinstallServerMsg', { name: server.name })
            : confirmAction?.type === 'suspend'
            ? t('admin.confirmSuspendServerMsg', { name: server.name })
            : confirmAction?.type === 'unsuspend'
            ? t('admin.confirmUnsuspendServerMsg', { name: server.name })
            : confirmAction?.type === 'force-delete'
            ? t('admin.confirmForceDeleteServerMsg', { name: server.name })
            : confirmAction?.type === 'delete'
            ? t('admin.confirmDeleteServerMsg', { name: server.name })
            : confirmAction?.type === 'db-reset'
            ? t('admin.rotateDatabasePasswordMsg', { db: confirmAction.db.database })
            : confirmAction?.type === 'db-delete'
            ? t('admin.deleteDatabaseMsg', { db: confirmAction.db.database })
            : ''
        }
        confirmLabel={t('admin.confirm')}
        isDestructive={confirmAction?.type !== 'unsuspend'}
        isLoading={actionLoading}
        onConfirm={handleConfirm}
        onCancel={() => !actionLoading && setConfirmAction(null)}
      />
    </div>
  );
};
