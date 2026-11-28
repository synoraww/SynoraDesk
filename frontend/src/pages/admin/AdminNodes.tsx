import React, { useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  FileCode,
  AlertCircle,
  Layers,
  Wrench,
  Lock,
  Unlock,
  HeartPulse,
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
import {
  adminCheckNodesHealth,
  adminCreateNode,
  adminDeleteNode,
  adminGetNode,
  adminGetNodeConfiguration,
  adminListLocations,
  adminListNodes,
  adminUpdateNode,
  parseBackendError,
} from '../../services/adminApi';
import { AdminLocation, AdminNode, CreateNodeInput, NodeConfiguration, NodeHealthStatus, PaginationMeta, ParsedAPIError } from '../../types/admin';
import { AdminNodeDetail } from './AdminNodeDetail';

interface AdminNodesProps {
  initialNodeId?: number;
  onNavigateOverview: () => void;
  onOpenPanelModal: () => void;
}

const emptyNodeForm: CreateNodeInput = {
  name: '',
  description: '',
  location_id: 1,
  fqdn: '',
  scheme: 'https',
  public: true,
  memory: 8192,
  memory_overallocate: 0,
  disk: 51200,
  disk_overallocate: 0,
  upload_size: 100,
  daemon_sftp: 2022,
  daemon_listen: 8080,
  daemon_base: '/var/lib/pterodactyl/volumes',
  behind_proxy: false,
  maintenance_mode: false,
};

export const AdminNodes: React.FC<AdminNodesProps> = ({
  initialNodeId,
  onNavigateOverview,
  onOpenPanelModal,
}) => {
  const { activePanel } = usePanelStore();
  const { addNotification } = useUIStore();
  const { t } = useI18n();

  const [nodes, setNodes] = useState<AdminNode[]>([]);
  const [locationsMap, setLocationsMap] = useState<Record<number, string>>({});
  const [healthMap, setHealthMap] = useState<Record<number, NodeHealthStatus>>({});
  const [managingNode, setManagingNode] = useState<{ node: AdminNode; tab?: 'about' | 'settings' | 'configuration' | 'allocation' | 'servers' } | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    count: 0,
    per_page: 25,
    current_page: 1,
    total_pages: 1,
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [searchField, setSearchField] = useState<'name' | 'fqdn' | 'uuid'>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<ParsedAPIError | null>(null);

  const [detailNode, setDetailNode] = useState<AdminNode | null>(null);
  const [configNode, setConfigNode] = useState<AdminNode | null>(null);
  const [nodeConfig, setNodeConfig] = useState<NodeConfiguration | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<AdminNode | null>(null);
  const [form, setForm] = useState<CreateNodeInput>(emptyNodeForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AdminNode | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadNodes = async (targetPage = page, targetPerPage = perPage) => {
    if (!activePanel?.hasAppKey) return;
    setLoading(true);
    setApiError(null);
    try {
      const filters: Record<string, string> = {};
      if (searchQuery.trim()) {
        filters[searchField] = searchQuery.trim();
      }
      const res = await adminListNodes({
        page: targetPage,
        perPage: targetPerPage,
        filters,
        sort: 'id',
      });
      setNodes(res?.items || []);
      if (res?.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      setApiError(parseBackendError(err));
    } finally {
      setLoading(false);
    }
  };

  const checkHealth = () => {
    if (!activePanel?.hasAppKey) return;
    adminCheckNodesHealth()
      .then((res) => {
        if (res) setHealthMap(res);
      })
      .catch(() => {});
  };

  useEffect(() => {
    setPage(1);
    loadNodes(1, perPage);
    checkHealth();
    if (activePanel?.hasAppKey) {
      adminListLocations({ page: 1, perPage: 100 })
        .then((r) => {
          const map: Record<number, string> = {};
          (r?.items || []).forEach((l: AdminLocation) => {
            map[l.id] = l.short;
          });
          setLocationsMap(map);
        })
        .catch(() => {});
    }
    const timer = setInterval(checkHealth, 30000);
    const onReload = () => {
      loadNodes(page, perPage);
      checkHealth();
    };
    window.addEventListener('synora:reload', onReload);
    return () => {
      clearInterval(timer);
      window.removeEventListener('synora:reload', onReload);
    };
  }, [activePanel?.id]);

  useEffect(() => {
    if (initialNodeId && activePanel?.hasAppKey) {
      adminGetNode(initialNodeId)
        .then((n) => setManagingNode({ node: n, tab: 'about' }))
        .catch(() => {});
    }
  }, [initialNodeId, activePanel?.id]);

  const openCreateModal = () => {
    setEditingNode(null);
    setForm(emptyNodeForm);
    setFormError(null);
    setFormModalOpen(true);
  };

  const openEditModal = (n: AdminNode) => {
    setEditingNode(n);
    setForm({
      name: n.name,
      description: n.description || '',
      location_id: n.location_id,
      fqdn: n.fqdn,
      scheme: n.scheme === 'http' ? 'http' : 'https',
      public: Boolean(n.public),
      memory: n.memory,
      memory_overallocate: n.memory_overallocate,
      disk: n.disk,
      disk_overallocate: n.disk_overallocate,
      upload_size: n.upload_size,
      daemon_sftp: n.daemon_sftp,
      daemon_listen: n.daemon_listen,
      daemon_base: n.daemon_base || '/var/lib/pterodactyl/volumes',
      behind_proxy: Boolean(n.behind_proxy),
      maintenance_mode: Boolean(n.maintenance_mode),
    });
    setFormError(null);
    setFormModalOpen(true);
  };

  const openConfigModal = async (n: AdminNode) => {
    setConfigNode(n);
    setNodeConfig(null);
    setConfigError(null);
    setConfigLoading(true);
    try {
      const cfg = await adminGetNodeConfiguration(n.id);
      setNodeConfig(cfg);
    } catch (err) {
      const parsed = parseBackendError(err);
      setConfigError(parsed.permissionHint ? `${parsed.message} — ${parsed.permissionHint}` : parsed.message);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSaveNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.fqdn.trim()) {
      setFormError('Node Name and FQDN are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingNode) {
        await adminUpdateNode(editingNode.id, form);
        addNotification({ type: 'success', title: 'Node Updated', message: `Updated node "${form.name}".` });
      } else {
        await adminCreateNode(form);
        addNotification({ type: 'success', title: 'Node Created', message: `Created node "${form.name}".` });
      }
      setFormModalOpen(false);
      await loadNodes(page, perPage);
    } catch (err) {
      const parsed = parseBackendError(err);
      setFormError(parsed.permissionHint ? `${parsed.message} — ${parsed.permissionHint}` : parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNode = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminDeleteNode(deleteTarget.id);
      addNotification({ type: 'success', title: 'Node Deleted', message: `Deleted node "${deleteTarget.name}".` });
      setDeleteTarget(null);
      await loadNodes(page, perPage);
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: 'Delete Node Failed', message: parsed.permissionHint || parsed.message });
    } finally {
      setDeleting(false);
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
      {managingNode ? (
        <AdminNodeDetail
          node={managingNode.node}
          initialTab={managingNode.tab}
          onBack={() => setManagingNode(null)}
          onNavigateOverview={onNavigateOverview}
          onChanged={() => loadNodes(page, perPage)}
        />
      ) : (
      <div style={{ width: '100%', padding: '20px 24px', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box' }}>
        <AdminPageHeader
          title={t('admin.nodes')}
          subtitle={t('admin.nodesSubtitle')}
          icon={Layers}
          breadcrumbs={[
            { label: t('admin.title'), onClick: onNavigateOverview },
            { label: t('admin.nodes') },
          ]}
          actions={
            <>
              <button
                type="button"
                onClick={() => loadNodes(page, perPage)}
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
                onClick={openCreateModal}
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              loadNodes(1, perPage);
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
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{t('admin.nodeList')}</div>
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
                <option value="fqdn">FQDN</option>
                <option value="uuid">UUID</option>
              </select>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t('admin.searchPlaceholder')}
                width="240px"
                onClear={() => {
                  setPage(1);
                  setTimeout(() => loadNodes(1, perPage), 0);
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
            <div style={{ margin: '14px', padding: '12px 14px', borderRadius: '4px', border: '1px solid var(--color-error)', backgroundColor: 'var(--color-error-bg)', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--color-error)' }}>
                <AlertCircle size={15} />
                <span>{apiError.statusCode ? `HTTP ${apiError.statusCode}` : 'Error'}: {apiError.message}</span>
              </div>
              {apiError.permissionHint && (
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>{apiError.permissionHint}</p>
              )}
            </div>
          )}

          {loading ? (
            <div style={{ padding: '16px' }}><TableSkeleton rows={5} /></div>
          ) : nodes.length === 0 ? (
            <div style={{ padding: '24px' }}>
              <EmptyState icon={Layers} title={t('admin.noNodesTitle')} description={t('admin.noNodesDesc')} />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ID</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.name')}</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.locations')}</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.memory')}</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.diskSpace')}</th>
                    <th style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SSL / Public</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((n) => (
                    <tr key={n.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {n.id}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {(() => {
                            const h = healthMap[n.id];
                            if (!h) {
                              return (
                                <span title={t('admin.checking')} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                  <HeartPulse size={14} color="var(--color-text-muted)" />
                                </span>
                              );
                            }
                            return (
                              <span
                                title={h.reachable ? `${t('admin.online')} (${h.latencyMs} ms)` : `${t('admin.offline')}: ${h.error || 'Unreachable'}`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <HeartPulse size={14} color={h.reachable ? 'var(--color-success)' : 'var(--color-error)'} />
                                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: h.reachable ? 'var(--color-success)' : 'var(--color-error)' }}>
                                  {h.reachable ? `${h.latencyMs}ms` : t('admin.offline')}
                                </span>
                              </span>
                            );
                          })()}
                          <button
                            type="button"
                            onClick={() => setManagingNode({ node: n, tab: 'about' })}
                            style={{ background: 'none', border: 'none', padding: 0, fontWeight: 600, color: 'var(--color-primary-light)', cursor: 'pointer', fontSize: '13px' }}
                          >
                            {n.name}
                          </button>
                          {n.maintenance_mode && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 6px', borderRadius: '3px', backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: '11px' }}>
                              <Wrench size={11} /> {t('admin.maintenance')}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          <code>{n.scheme}://{n.fqdn}:{n.daemon_listen}</code>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>
                        {locationsMap[n.location_id] || `#${n.location_id}`}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>
                        {n.memory} MiB
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>
                        {n.disk} MiB
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                          <span title={n.scheme === 'https' ? 'SSL Enabled' : 'HTTP (No SSL)'}>
                            {n.scheme === 'https' ? <Lock size={14} color="var(--color-success)" /> : <Unlock size={14} color="var(--color-error)" />}
                          </span>
                          <span title={n.public ? 'Public' : 'Private'}>
                            {n.public ? <Eye size={14} color="var(--color-text)" /> : <EyeOff size={14} color="var(--color-text-muted)" />}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '5px' }}>
                          <button type="button" onClick={() => setManagingNode({ node: n, tab: 'about' })} title="Manage node" style={{ padding: '4px 7px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                            <Eye size={13} />
                          </button>
                          <button type="button" onClick={() => setManagingNode({ node: n, tab: 'configuration' })} title="Wings Configuration" style={{ padding: '4px 7px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-primary-light)', cursor: 'pointer' }}>
                            <FileCode size={13} />
                          </button>
                          <button type="button" onClick={() => setManagingNode({ node: n, tab: 'settings' })} title="Edit node settings" style={{ padding: '4px 7px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}>
                            <Edit2 size={13} />
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(n)} title="Delete node" style={{ padding: '4px 7px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.35)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', cursor: 'pointer' }}>
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
              loadNodes(nextPage, perPage);
            }}
            onPerPageChange={(nextPerPage) => {
              setPerPage(nextPerPage);
              setPage(1);
              loadNodes(1, nextPerPage);
            }}
          />
        </div>

        {/* Node Detail Modal */}
        <AdminModal
          isOpen={Boolean(detailNode)}
          title={detailNode ? `Node: ${detailNode.name}` : 'Node Details'}
          subtitle={detailNode?.uuid}
          width="620px"
          onClose={() => setDetailNode(null)}
        >
          {detailNode && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
              <div><span style={{ color: 'var(--color-text-muted)' }}>ID:</span> <strong>{detailNode.id}</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Location ID:</span> {detailNode.location_id}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>FQDN:</span> <code>{detailNode.fqdn}</code></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Scheme:</span> {detailNode.scheme}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Daemon Listen:</span> {detailNode.daemon_listen}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Daemon SFTP:</span> {detailNode.daemon_sftp}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Memory:</span> {detailNode.memory} MB (Over: {detailNode.memory_overallocate}%)</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Disk:</span> {detailNode.disk} MB (Over: {detailNode.disk_overallocate}%)</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Upload Size:</span> {detailNode.upload_size} MB</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Behind Proxy:</span> {detailNode.behind_proxy ? 'Yes' : 'No'}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Maintenance:</span> {detailNode.maintenance_mode ? 'Enabled' : 'Disabled'}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Daemon Base:</span> <code>{detailNode.daemon_base}</code></div>
            </div>
          )}
        </AdminModal>

        {/* Node Configuration Modal */}
        <AdminModal
          isOpen={Boolean(configNode)}
          title={configNode ? `Configuration: ${configNode.name}` : 'Node Configuration'}
          subtitle="/api/application/nodes/{id}/configuration"
          width="660px"
          onClose={() => setConfigNode(null)}
        >
          {configLoading ? (
            <TableSkeleton rows={4} />
          ) : configError ? (
            <div style={{ padding: '12px', borderRadius: '4px', border: '1px solid var(--color-error)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: '12px' }}>
              {configError}
            </div>
          ) : nodeConfig ? (
            <pre style={{ margin: 0, padding: '12px', borderRadius: '4px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', fontSize: '12px', overflowX: 'auto' }}>
              {JSON.stringify(nodeConfig, null, 2)}
            </pre>
          ) : null}
        </AdminModal>

        {/* Create / Edit Node Modal */}
        <AdminModal
          isOpen={formModalOpen}
          title={editingNode ? `${t('admin.editNode')}: ${editingNode.name}` : t('admin.createNewNode')}
          width="680px"
          onClose={() => !saving && setFormModalOpen(false)}
          footer={
            <>
              <button type="button" disabled={saving} onClick={() => setFormModalOpen(false)} style={{ padding: '6px 14px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer' }}>
                {t('admin.cancel')}
              </button>
              <button type="submit" form="admin-node-form" disabled={saving} style={{ padding: '6px 14px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#FFFFFF', fontSize: '12px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? t('admin.saving') : editingNode ? t('admin.updateNode') : t('admin.createNode')}
              </button>
            </>
          }
        >
          <form id="admin-node-form" onSubmit={handleSaveNode} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {formError && (
              <div style={{ padding: '10px', borderRadius: '4px', border: '1px solid var(--color-error)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: '12px' }}>
                {formError}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
              <div><label style={labelStyle}>Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Location ID *</label><input type="number" min={1} required value={form.location_id} onChange={(e) => setForm({ ...form, location_id: Number(e.target.value) })} style={inputStyle} /></div>
            </div>
            <div><label style={labelStyle}>Description</label><input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
              <div><label style={labelStyle}>FQDN *</label><input required value={form.fqdn} onChange={(e) => setForm({ ...form, fqdn: e.target.value })} placeholder="node1.example.com" style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Scheme *</label>
                <select value={form.scheme} onChange={(e) => setForm({ ...form, scheme: e.target.value as 'http' | 'https' })} style={inputStyle}>
                  <option value="https">HTTPS (SSL)</option>
                  <option value="http">HTTP</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              <div><label style={labelStyle}>Memory (MB)</label><input type="number" min={1} value={form.memory} onChange={(e) => setForm({ ...form, memory: Number(e.target.value) })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Mem Overalloc (%)</label><input type="number" value={form.memory_overallocate} onChange={(e) => setForm({ ...form, memory_overallocate: Number(e.target.value) })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Disk (MB)</label><input type="number" min={1} value={form.disk} onChange={(e) => setForm({ ...form, disk: Number(e.target.value) })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Disk Overalloc (%)</label><input type="number" value={form.disk_overallocate} onChange={(e) => setForm({ ...form, disk_overallocate: Number(e.target.value) })} style={inputStyle} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <div><label style={labelStyle}>Daemon Listen Port</label><input type="number" min={1} value={form.daemon_listen} onChange={(e) => setForm({ ...form, daemon_listen: Number(e.target.value) })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Daemon SFTP Port</label><input type="number" min={1} value={form.daemon_sftp} onChange={(e) => setForm({ ...form, daemon_sftp: Number(e.target.value) })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Upload Size (MB)</label><input type="number" min={1} value={form.upload_size} onChange={(e) => setForm({ ...form, upload_size: Number(e.target.value) })} style={inputStyle} /></div>
            </div>
            <div><label style={labelStyle}>Daemon Base Directory</label><input value={form.daemon_base || ''} onChange={(e) => setForm({ ...form, daemon_base: e.target.value })} style={inputStyle} /></div>
            <div style={{ display: 'flex', gap: '18px', fontSize: '12.5px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={form.public} onChange={(e) => setForm({ ...form, public: e.target.checked })} /> Public
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={form.behind_proxy} onChange={(e) => setForm({ ...form, behind_proxy: e.target.checked })} /> Behind Proxy
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={form.maintenance_mode} onChange={(e) => setForm({ ...form, maintenance_mode: e.target.checked })} /> Maintenance Mode
              </label>
            </div>
          </form>
        </AdminModal>

        <ConfirmDialog
          isOpen={Boolean(deleteTarget)}
          title={t('admin.deleteNode')}
          message={deleteTarget ? t('admin.confirmDeleteNodeMsg', { name: deleteTarget.name, fqdn: deleteTarget.fqdn }) : ''}
          confirmLabel={t('admin.deleteNode')}
          isDestructive
          isLoading={deleting}
          onConfirm={handleDeleteNode}
          onCancel={() => !deleting && setDeleteTarget(null)}
        />
      </div>
      )}
    </AdminGuard>
  );
};
