import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  AlertCircle,
  Server as ServerIcon,
} from 'lucide-react';
import { usePanelStore } from '../../stores/panelStore';
import { useUIStore } from '../../stores/uiStore';
import { useI18n } from '../../i18n';
import { AdminGuard } from '../../components/admin/AdminGuard';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { PaginationBar } from '../../components/admin/PaginationBar';
import { AdminModal } from '../../components/admin/AdminModal';
import { SearchInput } from '../../components/common/SearchInput';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  adminCreateServer,
  adminDeleteServer,
  adminListServers,
  adminReinstallServer,
  adminSuspendServer,
  adminUnsuspendServer,
  adminUpdateServerBuild,
  adminUpdateServerDetails,
  adminUpdateServerStartup,
  parseBackendError,
} from '../../services/adminApi';
import { AppServer, PaginationMeta, ParsedAPIError } from '../../types/admin';
import { AdminServerDetail } from './AdminServerDetail';

interface AdminServersProps {
  onNavigateOverview: () => void;
  onNavigateUser: (userId: number) => void;
  onNavigateNode: (nodeId: number) => void;
  onOpenPanelModal: () => void;
}

const defaultCreateForm = {
  name: '',
  external_id: '',
  description: '',
  user: 1,
  egg: 1,
  allocation_default: 1,
  docker_image: 'ghcr.io/pterodactyl/yolks:java_21',
  startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}',
  environmentJson: '{}',
  memory: 1024,
  swap: 0,
  disk: 5120,
  io: 500,
  cpu: 100,
  databases: 0,
  allocations: 0,
  backups: 1,
  oom_disabled: false,
  start_on_completion: true,
  skip_scripts: false,
};

export const AdminServers: React.FC<AdminServersProps> = ({
  onNavigateOverview,
  onNavigateUser,
  onNavigateNode,
  onOpenPanelModal,
}) => {
  const { activePanel } = usePanelStore();
  const { addNotification } = useUIStore();
  const { t } = useI18n();

  const [servers, setServers] = useState<AppServer[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    count: 0,
    per_page: 25,
    current_page: 1,
    total_pages: 1,
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [searchField, setSearchField] = useState<'name' | 'uuid' | 'external_id' | 'image'>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<ParsedAPIError | null>(null);

  const [detailServer, setDetailServer] = useState<AppServer | null>(null);
  const [managingServer, setManagingServer] = useState<AppServer | null>(null);

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Edit Modal
  const [editServer, setEditServer] = useState<AppServer | null>(null);
  const [editTab, setEditTab] = useState<'details' | 'build' | 'startup'>('details');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [detailsForm, setDetailsForm] = useState({ name: '', user: 1, external_id: '', description: '' });
  const [buildForm, setBuildForm] = useState({
    allocation: 1,
    memory: 1024,
    swap: 0,
    disk: 5120,
    io: 500,
    cpu: 100,
    threads: '',
    oom_disabled: false,
    databases: 0,
    allocations: 0,
    backups: 0,
  });
  const [startupForm, setStartupForm] = useState({
    startup: '',
    egg: 1,
    image: '',
    environmentJson: '{}',
    skip_scripts: false,
  });

  // Confirmation dialogs for disruptive / destructive actions
  const [actionConfirm, setActionConfirm] = useState<{
    type: 'suspend' | 'unsuspend' | 'reinstall' | 'delete' | 'force-delete';
    server: AppServer;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadServers = async (targetPage = page, targetPerPage = perPage) => {
    if (!activePanel?.hasAppKey) return;
    setLoading(true);
    setApiError(null);
    try {
      const filters: Record<string, string> = {};
      if (searchQuery.trim()) {
        filters[searchField] = searchQuery.trim();
      }
      const res = await adminListServers({
        page: targetPage,
        perPage: targetPerPage,
        filters,
        sort: 'id',
      });
      setServers(res?.items || []);
      if (res?.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      setApiError(parseBackendError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadServers(1, perPage);
    const onReload = () => loadServers(page, perPage);
    window.addEventListener('synora:reload', onReload);
    return () => window.removeEventListener('synora:reload', onReload);
  }, [activePanel?.id]);

  const filteredServers = useMemo(() => {
    if (statusFilter === 'all') return servers;
    if (statusFilter === 'suspended') return servers.filter((s) => s.suspended);
    return servers.filter((s) => !s.suspended);
  }, [servers, statusFilter]);

  const openEditModal = (s: AppServer) => {
    setManagingServer(s);
  };

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      setCreateError('Server name is required.');
      return;
    }
    let parsedEnv: Record<string, unknown> = {};
    try {
      parsedEnv = JSON.parse(createForm.environmentJson || '{}');
    } catch {
      setCreateError('Environment must be valid JSON.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      await adminCreateServer({
        name: createForm.name.trim(),
        external_id: createForm.external_id.trim() || undefined,
        description: createForm.description.trim() || undefined,
        user: Number(createForm.user),
        egg: Number(createForm.egg),
        docker_image: createForm.docker_image.trim(),
        startup: createForm.startup.trim(),
        environment: parsedEnv,
        limits: {
          memory: Number(createForm.memory),
          swap: Number(createForm.swap),
          disk: Number(createForm.disk),
          io: Number(createForm.io),
          cpu: Number(createForm.cpu),
          oom_disabled: createForm.oom_disabled,
        },
        feature_limits: {
          databases: Number(createForm.databases),
          allocations: Number(createForm.allocations),
          backups: Number(createForm.backups),
        },
        allocation: {
          default: Number(createForm.allocation_default),
        },
        oom_disabled: createForm.oom_disabled,
        start_on_completion: createForm.start_on_completion,
        skip_scripts: createForm.skip_scripts,
      });
      addNotification({
        type: 'success',
        title: 'Server Created',
        message: `Provisioned server "${createForm.name}".`,
      });
      setCreateOpen(false);
      setCreateForm(defaultCreateForm);
      await loadServers(page, perPage);
    } catch (err) {
      const parsed = parseBackendError(err);
      setCreateError(parsed.permissionHint ? `${parsed.message} — ${parsed.permissionHint}` : parsed.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editServer) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      if (editTab === 'details') {
        await adminUpdateServerDetails(editServer.id, {
          name: detailsForm.name.trim(),
          user: Number(detailsForm.user),
          external_id: detailsForm.external_id.trim() || null,
          description: detailsForm.description,
        });
      } else if (editTab === 'build') {
        await adminUpdateServerBuild(editServer.id, {
          allocation: Number(buildForm.allocation),
          oom_disabled: buildForm.oom_disabled,
          memory: Number(buildForm.memory),
          swap: Number(buildForm.swap),
          disk: Number(buildForm.disk),
          io: Number(buildForm.io),
          cpu: Number(buildForm.cpu),
          threads: buildForm.threads.trim() || null,
          feature_limits: {
            databases: Number(buildForm.databases),
            allocations: Number(buildForm.allocations),
            backups: Number(buildForm.backups),
          },
        });
      } else {
        let envObj: Record<string, unknown> = {};
        try {
          envObj = JSON.parse(startupForm.environmentJson || '{}');
        } catch {
          setEditError('Environment must be valid JSON.');
          setSavingEdit(false);
          return;
        }
        await adminUpdateServerStartup(editServer.id, {
          startup: startupForm.startup.trim(),
          egg: Number(startupForm.egg),
          image: startupForm.image.trim(),
          environment: envObj,
          skip_scripts: startupForm.skip_scripts,
        });
      }
      addNotification({
        type: 'success',
        title: 'Server Updated',
        message: `Saved ${editTab} configuration for "${editServer.name}".`,
      });
      setEditServer(null);
      await loadServers(page, perPage);
    } catch (err) {
      const parsed = parseBackendError(err);
      setEditError(parsed.permissionHint ? `${parsed.message} — ${parsed.permissionHint}` : parsed.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!actionConfirm) return;
    setActionLoading(true);
    const { type, server } = actionConfirm;
    try {
      if (type === 'suspend') {
        await adminSuspendServer(server.id);
        addNotification({ type: 'success', title: 'Server Suspended', message: `Suspended "${server.name}".` });
      } else if (type === 'unsuspend') {
        await adminUnsuspendServer(server.id);
        addNotification({ type: 'success', title: 'Server Unsuspended', message: `Unsuspended "${server.name}".` });
      } else if (type === 'reinstall') {
        await adminReinstallServer(server.id);
        addNotification({ type: 'success', title: 'Reinstall Triggered', message: `Started reinstall for "${server.name}".` });
      } else if (type === 'delete') {
        await adminDeleteServer(server.id, false);
        addNotification({ type: 'success', title: 'Server Deleted', message: `Deleted "${server.name}".` });
      } else if (type === 'force-delete') {
        await adminDeleteServer(server.id, true);
        addNotification({ type: 'success', title: 'Server Force Deleted', message: `Force deleted "${server.name}".` });
      }
      setActionConfirm(null);
      await loadServers(page, perPage);
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({
        type: 'error',
        title: 'Action Failed',
        message: parsed.permissionHint || parsed.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

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
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    marginBottom: '4px',
  };

  return (
    <AdminGuard onOpenPanelModal={onOpenPanelModal}>
      {managingServer ? (
        <AdminServerDetail
          server={managingServer}
          onBack={() => setManagingServer(null)}
          onNavigateOverview={onNavigateOverview}
          onNavigateUser={onNavigateUser}
          onNavigateNode={onNavigateNode}
          onChanged={() => loadServers(page, perPage)}
        />
      ) : (
      <div style={{ width: '100%', padding: '20px 24px', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box' }}>
        <AdminPageHeader
          title={t('admin.servers')}
          subtitle={t('admin.serversSubtitle')}
          icon={ServerIcon}
          breadcrumbs={[
            { label: t('admin.title'), onClick: onNavigateOverview },
            { label: t('admin.servers') },
          ]}
          actions={
            <>
              <button
                type="button"
                onClick={() => loadServers(page, perPage)}
                disabled={loading}
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
                <RefreshCw size={13} /> {t('admin.refresh')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateError(null);
                  setCreateOpen(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: 'var(--color-primary)',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> {t('admin.createNew')}
              </button>
            </>
          }
        />

        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderTop: '2px solid var(--color-primary)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          {/* Toolbar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              loadServers(1, perPage);
            }}
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{t('admin.serverList')}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={{
                  height: '28px',
                  padding: '0 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                }}
              >
                <option value="all">{t('admin.allStatuses')}</option>
                <option value="active">{t('admin.activeOnly')}</option>
                <option value="suspended">{t('admin.suspendedOnly')}</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <select
                value={searchField}
                onChange={(e) => setSearchField(e.target.value as any)}
                style={{
                  height: '32px',
                  padding: '0 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                }}
              >
                <option value="name">{t('admin.name')}</option>
                <option value="uuid">UUID</option>
                <option value="external_id">{t('admin.externalId')}</option>
                <option value="image">{t('admin.dockerImage')}</option>
              </select>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t('admin.searchPlaceholder')}
                width="240px"
                onClear={() => {
                  setPage(1);
                  setTimeout(() => loadServers(1, perPage), 0);
                }}
              />
              <button
                type="submit"
                style={{
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-hover)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {t('admin.search')}
              </button>
            </div>
          </form>

          {apiError && (
            <div
              style={{
                margin: '14px',
                padding: '12px 14px',
                borderRadius: '4px',
                border: '1px solid var(--color-error)',
                backgroundColor: 'var(--color-error-bg)',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--color-error)' }}>
                <AlertCircle size={15} />
                <span>{apiError.statusCode ? `HTTP ${apiError.statusCode}` : 'Error'}: {apiError.message}</span>
              </div>
              {apiError.permissionHint && (
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>{apiError.permissionHint}</p>
              )}
              {apiError.requestId && (
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Request ID: <code>{apiError.requestId}</code>
                </p>
              )}
            </div>
          )}

          {loading ? (
            <div style={{ padding: '16px' }}>
              <TableSkeleton rows={6} />
            </div>
          ) : filteredServers.length === 0 ? (
            <div style={{ padding: '24px' }}>
              <EmptyState
                icon={ServerIcon}
                title={t('admin.noServersTitle')}
                description={t('admin.noServersDesc')}
              />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ID</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.serverName')}</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>UUID</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.ownerNode')}</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.limits')}</th>
                    <th style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.status')}</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServers.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {s.id}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{s.name}</div>
                        {s.external_id && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Ext: <code>{s.external_id}</code></div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        {s.identifier}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        User #{s.user} · Node #{s.node}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {s.limits?.memory} MB · {s.limits?.disk} MB · {s.limits?.cpu}%
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <StatusBadge status={s.suspended ? 'suspended' : 'active'} size="sm" />
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '5px' }}>
                          <button
                            type="button"
                            onClick={() => setDetailServer(s)}
                            title="View details"
                            style={{
                              padding: '4px 7px',
                              borderRadius: '4px',
                              border: '1px solid var(--color-border)',
                              backgroundColor: 'var(--color-surface)',
                              color: 'var(--color-text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(s)}
                            title="Edit server"
                            style={{
                              padding: '4px 7px',
                              borderRadius: '4px',
                              border: '1px solid var(--color-border)',
                              backgroundColor: 'var(--color-surface)',
                              color: 'var(--color-text)',
                              cursor: 'pointer',
                            }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActionConfirm({ type: s.suspended ? 'unsuspend' : 'suspend', server: s })}
                            title={s.suspended ? 'Unsuspend server' : 'Suspend server'}
                            style={{
                              padding: '4px 7px',
                              borderRadius: '4px',
                              border: '1px solid var(--color-border)',
                              backgroundColor: 'var(--color-surface)',
                              color: s.suspended ? 'var(--color-success)' : 'var(--color-warning)',
                              cursor: 'pointer',
                            }}
                          >
                            {s.suspended ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setActionConfirm({ type: 'reinstall', server: s })}
                            title="Reinstall server"
                            style={{
                              padding: '4px 7px',
                              borderRadius: '4px',
                              border: '1px solid var(--color-border)',
                              backgroundColor: 'var(--color-surface)',
                              color: 'var(--color-text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            <RotateCcw size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActionConfirm({ type: 'delete', server: s })}
                            title="Delete server"
                            style={{
                              padding: '4px 7px',
                              borderRadius: '4px',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              backgroundColor: 'var(--color-error-bg)',
                              color: 'var(--color-error)',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <PaginationBar
            pagination={pagination}
            disabled={loading}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              loadServers(nextPage, perPage);
            }}
            onPerPageChange={(nextPerPage) => {
              setPerPage(nextPerPage);
              setPage(1);
              loadServers(1, nextPerPage);
            }}
          />
        </div>

        {/* Server Detail Modal */}
        <AdminModal
          isOpen={Boolean(detailServer)}
          title={detailServer ? `${t('admin.server')}: ${detailServer.name}` : t('admin.serverDetails')}
          subtitle={detailServer?.uuid}
          width="680px"
          onClose={() => setDetailServer(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  if (detailServer) {
                    const s = detailServer;
                    setDetailServer(null);
                    setActionConfirm({ type: 'force-delete', server: s });
                  }
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid rgba(239,68,68,0.4)',
                  backgroundColor: 'var(--color-error-bg)',
                  color: 'var(--color-error)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginRight: 'auto',
                }}
              >
                {t('admin.forceDeleteServer')}
              </button>
              <button
                type="button"
                onClick={() => setDetailServer(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {t('admin.close')}
              </button>
            </>
          }
        >
          {detailServer && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><span style={{ color: 'var(--color-text-muted)' }}>Internal ID:</span> <strong>{detailServer.id}</strong></div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>{t('admin.externalId')}:</span> <code>{detailServer.external_id || '—'}</code></div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>Identifier:</span> <code>{detailServer.identifier}</code></div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>User ID:</span> {detailServer.user}</div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>Node ID:</span> {detailServer.node}</div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>Allocation ID:</span> {detailServer.allocation}</div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>Nest / Egg:</span> {detailServer.nest} / {detailServer.egg}</div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>{t('admin.statusSuspended')}:</span> {detailServer.suspended ? t('admin.yes') : t('admin.no')}</div>
              </div>
              <div>
                <div style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}>{t('admin.dockerImage')}</div>
                <code style={{ display: 'block', padding: '6px 8px', backgroundColor: 'var(--color-bg)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                  {detailServer.container?.image || '—'}
                </code>
              </div>
              <div>
                <div style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}>{t('admin.startupCommand')}</div>
                <code style={{ display: 'block', padding: '6px 8px', backgroundColor: 'var(--color-bg)', borderRadius: '4px', border: '1px solid var(--color-border)', wordBreak: 'break-all' }}>
                  {detailServer.container?.startup_command || '—'}
                </code>
              </div>
              <div>
                <div style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}>{t('admin.envVariables')}</div>
                <pre style={{ margin: 0, padding: '8px', backgroundColor: 'var(--color-bg)', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '12px', overflowX: 'auto' }}>
                  {JSON.stringify(detailServer.container?.environment || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </AdminModal>

        {/* Create Server Modal */}
        <AdminModal
          isOpen={createOpen}
          title={t('admin.createNewServer')}
          width="700px"
          onClose={() => !creating && setCreateOpen(false)}
          footer={
            <>
              <button
                type="button"
                disabled={creating}
                onClick={() => setCreateOpen(false)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {t('admin.cancel')}
              </button>
              <button
                type="submit"
                form="admin-create-server-form"
                disabled={creating}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: 'var(--color-primary)',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: creating ? 'not-allowed' : 'pointer',
                }}
              >
                {creating ? t('admin.creating') : t('admin.createServer')}
              </button>
            </>
          }
        >
          <form id="admin-create-server-form" onSubmit={handleCreateServer} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {createError && (
              <div style={{ padding: '10px', borderRadius: '4px', border: '1px solid var(--color-error)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: '12px' }}>
                {createError}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>{t('admin.serverName')} *</label>
                <input required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t('admin.externalId')}</label>
                <input value={createForm.external_id} onChange={(e) => setCreateForm({ ...createForm, external_id: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t('admin.description')}</label>
              <input value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>{t('admin.ownerUserId')} *</label>
                <input type="number" min={1} required value={createForm.user} onChange={(e) => setCreateForm({ ...createForm, user: Number(e.target.value) })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t('admin.eggId')} *</label>
                <input type="number" min={1} required value={createForm.egg} onChange={(e) => setCreateForm({ ...createForm, egg: Number(e.target.value) })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t('admin.defaultAllocationId')} *</label>
                <input type="number" min={1} required value={createForm.allocation_default} onChange={(e) => setCreateForm({ ...createForm, allocation_default: Number(e.target.value) })} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>{t('admin.dockerImage')} *</label>
                <input required value={createForm.docker_image} onChange={(e) => setCreateForm({ ...createForm, docker_image: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t('admin.startupCommand')} *</label>
                <input required value={createForm.startup} onChange={(e) => setCreateForm({ ...createForm, startup: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              <div><label style={labelStyle}>{t('admin.allocatedMemory')} (MB)</label><input type="number" value={createForm.memory} onChange={(e) => setCreateForm({ ...createForm, memory: Number(e.target.value) })} style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.allocatedSwap')} (MB)</label><input type="number" value={createForm.swap} onChange={(e) => setCreateForm({ ...createForm, swap: Number(e.target.value) })} style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.diskSpaceLimit')} (MB)</label><input type="number" value={createForm.disk} onChange={(e) => setCreateForm({ ...createForm, disk: Number(e.target.value) })} style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.blockIo')}</label><input type="number" value={createForm.io} onChange={(e) => setCreateForm({ ...createForm, io: Number(e.target.value) })} style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.cpuLimit')} (%)</label><input type="number" value={createForm.cpu} onChange={(e) => setCreateForm({ ...createForm, cpu: Number(e.target.value) })} style={inputStyle} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <div><label style={labelStyle}>{t('admin.databaseLimit')}</label><input type="number" value={createForm.databases} onChange={(e) => setCreateForm({ ...createForm, databases: Number(e.target.value) })} style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.allocationLimit')}</label><input type="number" value={createForm.allocations} onChange={(e) => setCreateForm({ ...createForm, allocations: Number(e.target.value) })} style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('admin.backupLimit')}</label><input type="number" value={createForm.backups} onChange={(e) => setCreateForm({ ...createForm, backups: Number(e.target.value) })} style={inputStyle} /></div>
            </div>
            <div>
              <label style={labelStyle}>Environment JSON</label>
              <textarea
                rows={3}
                value={createForm.environmentJson}
                onChange={(e) => setCreateForm({ ...createForm, environmentJson: e.target.value })}
                style={{ ...inputStyle, height: 'auto', padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '18px', fontSize: '12.5px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={createForm.start_on_completion} onChange={(e) => setCreateForm({ ...createForm, start_on_completion: e.target.checked })} />
                {t('admin.startOnCompletion')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={createForm.oom_disabled} onChange={(e) => setCreateForm({ ...createForm, oom_disabled: e.target.checked })} />
                {t('admin.disableOomKiller')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={createForm.skip_scripts} onChange={(e) => setCreateForm({ ...createForm, skip_scripts: e.target.checked })} />
                {t('admin.skipEggScripts')}
              </label>
            </div>
          </form>
        </AdminModal>

        {/* Edit Server Modal */}
        <AdminModal
          isOpen={Boolean(editServer)}
          title={editServer ? `Edit Server: ${editServer.name}` : 'Edit Server'}
          width="660px"
          onClose={() => !savingEdit && setEditServer(null)}
          footer={
            <>
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setEditServer(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="admin-edit-server-form"
                disabled={savingEdit}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: 'var(--color-primary)',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: savingEdit ? 'not-allowed' : 'pointer',
                }}
              >
                {savingEdit ? 'Saving...' : `Save ${editTab.charAt(0).toUpperCase() + editTab.slice(1)}`}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>
            {(['details', 'build', 'startup'] as const).map((tKey) => (
              <button
                key={tKey}
                type="button"
                onClick={() => {
                  setEditTab(tKey);
                  setEditError(null);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: editTab === tKey ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
                  color: editTab === tKey ? '#FFFFFF' : 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {tKey}
              </button>
            ))}
          </div>

          <form id="admin-edit-server-form" onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {editError && (
              <div style={{ padding: '10px', borderRadius: '4px', border: '1px solid var(--color-error)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: '12px' }}>
                {editError}
              </div>
            )}

            {editTab === 'details' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                  <div><label style={labelStyle}>Server Name *</label><input required value={detailsForm.name} onChange={(e) => setDetailsForm({ ...detailsForm, name: e.target.value })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Owner User ID *</label><input type="number" min={1} required value={detailsForm.user} onChange={(e) => setDetailsForm({ ...detailsForm, user: Number(e.target.value) })} style={inputStyle} /></div>
                </div>
                <div><label style={labelStyle}>External ID</label><input value={detailsForm.external_id} onChange={(e) => setDetailsForm({ ...detailsForm, external_id: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Description</label><input value={detailsForm.description} onChange={(e) => setDetailsForm({ ...detailsForm, description: e.target.value })} style={inputStyle} /></div>
              </>
            )}

            {editTab === 'build' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div><label style={labelStyle}>Primary Allocation ID *</label><input type="number" min={1} required value={buildForm.allocation} onChange={(e) => setBuildForm({ ...buildForm, allocation: Number(e.target.value) })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Memory (MB)</label><input type="number" value={buildForm.memory} onChange={(e) => setBuildForm({ ...buildForm, memory: Number(e.target.value) })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Swap (MB)</label><input type="number" value={buildForm.swap} onChange={(e) => setBuildForm({ ...buildForm, swap: Number(e.target.value) })} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div><label style={labelStyle}>Disk (MB)</label><input type="number" value={buildForm.disk} onChange={(e) => setBuildForm({ ...buildForm, disk: Number(e.target.value) })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Block IO</label><input type="number" value={buildForm.io} onChange={(e) => setBuildForm({ ...buildForm, io: Number(e.target.value) })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>CPU (%)</label><input type="number" value={buildForm.cpu} onChange={(e) => setBuildForm({ ...buildForm, cpu: Number(e.target.value) })} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div><label style={labelStyle}>Databases</label><input type="number" value={buildForm.databases} onChange={(e) => setBuildForm({ ...buildForm, databases: Number(e.target.value) })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Allocations</label><input type="number" value={buildForm.allocations} onChange={(e) => setBuildForm({ ...buildForm, allocations: Number(e.target.value) })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Backups</label><input type="number" value={buildForm.backups} onChange={(e) => setBuildForm({ ...buildForm, backups: Number(e.target.value) })} style={inputStyle} /></div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}>
                  <input type="checkbox" checked={buildForm.oom_disabled} onChange={(e) => setBuildForm({ ...buildForm, oom_disabled: e.target.checked })} />
                  Disable OOM Killer
                </label>
              </>
            )}

            {editTab === 'startup' && (
              <>
                <div><label style={labelStyle}>Startup Command *</label><input required value={startupForm.startup} onChange={(e) => setStartupForm({ ...startupForm, startup: e.target.value })} style={inputStyle} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                  <div><label style={labelStyle}>Egg ID *</label><input type="number" min={1} required value={startupForm.egg} onChange={(e) => setStartupForm({ ...startupForm, egg: Number(e.target.value) })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Docker Image *</label><input required value={startupForm.image} onChange={(e) => setStartupForm({ ...startupForm, image: e.target.value })} style={inputStyle} /></div>
                </div>
                <div>
                  <label style={labelStyle}>Environment JSON</label>
                  <textarea
                    rows={5}
                    value={startupForm.environmentJson}
                    onChange={(e) => setStartupForm({ ...startupForm, environmentJson: e.target.value })}
                    style={{ ...inputStyle, height: 'auto', padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}>
                  <input type="checkbox" checked={startupForm.skip_scripts} onChange={(e) => setStartupForm({ ...startupForm, skip_scripts: e.target.checked })} />
                  Skip Egg Install Scripts
                </label>
              </>
            )}
          </form>
        </AdminModal>

        {/* Disruptive / Destructive Action Confirmation */}
        <ConfirmDialog
          isOpen={Boolean(actionConfirm)}
          title={
            actionConfirm?.type === 'suspend'
              ? t('admin.suspendServer')
              : actionConfirm?.type === 'unsuspend'
              ? t('admin.unsuspendServer')
              : actionConfirm?.type === 'reinstall'
              ? t('admin.reinstallServer')
              : actionConfirm?.type === 'force-delete'
              ? t('admin.forceDeleteServer')
              : t('admin.deleteServer')
          }
          message={
            actionConfirm?.type === 'suspend'
              ? t('admin.confirmSuspendServerMsg', { name: actionConfirm.server.name })
              : actionConfirm?.type === 'unsuspend'
              ? t('admin.confirmUnsuspendServerMsg', { name: actionConfirm.server.name })
              : actionConfirm?.type === 'reinstall'
              ? t('admin.confirmReinstallServerMsg', { name: actionConfirm.server.name })
              : actionConfirm?.type === 'force-delete'
              ? t('admin.confirmForceDeleteServerMsg', { name: actionConfirm.server.name })
              : actionConfirm
              ? t('admin.confirmDeleteServerMsg', { name: actionConfirm.server.name })
              : ''
          }
          confirmLabel={actionConfirm?.type === 'unsuspend' ? t('admin.unsuspendServer') : t('admin.confirm')}
          isDestructive={actionConfirm?.type !== 'unsuspend'}
          isLoading={actionLoading}
          onConfirm={handleConfirmAction}
          onCancel={() => !actionLoading && setActionConfirm(null)}
        />
      </div>
      )}
    </AdminGuard>
  );
};
