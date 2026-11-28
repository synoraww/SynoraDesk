import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, AlertCircle, Network } from 'lucide-react';
import { usePanelStore } from '../../stores/panelStore';
import { useUIStore } from '../../stores/uiStore';
import { useI18n } from '../../i18n';
import { AdminGuard } from '../../components/admin/AdminGuard';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { PaginationBar } from '../../components/admin/PaginationBar';
import { AdminModal } from '../../components/admin/AdminModal';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import {
  adminCreateNodeAllocations,
  adminDeleteNodeAllocation,
  adminListNodeAllocations,
  adminListNodes,
  parseBackendError,
} from '../../services/adminApi';
import { AdminNode, NodeAllocation, PaginationMeta, ParsedAPIError } from '../../types/admin';

interface AdminAllocationsProps {
  onNavigateOverview: () => void;
  onOpenPanelModal: () => void;
}

export const AdminAllocations: React.FC<AdminAllocationsProps> = ({
  onNavigateOverview,
  onOpenPanelModal,
}) => {
  const { activePanel } = usePanelStore();
  const { addNotification } = useUIStore();
  const { t } = useI18n();

  const [nodes, setNodes] = useState<AdminNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number>(0);
  const [allocations, setAllocations] = useState<NodeAllocation[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    count: 0,
    per_page: 25,
    current_page: 1,
    total_pages: 1,
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<ParsedAPIError | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [ip, setIp] = useState('');
  const [alias, setAlias] = useState('');
  const [portsInput, setPortsInput] = useState('25565');
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<NodeAllocation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadNodesAndAllocations = async () => {
    if (!activePanel?.hasAppKey) return;
    setLoading(true);
    setApiError(null);
    try {
      const nodeRes = await adminListNodes({ page: 1, perPage: 100 });
      const nodeItems = nodeRes?.items || [];
      setNodes(nodeItems);
      if (nodeItems.length > 0) {
        const firstId = nodeItems[0].id;
        setSelectedNodeId(firstId);
        const allocRes = await adminListNodeAllocations(firstId, { page: 1, perPage });
        setAllocations(allocRes?.items || []);
        if (allocRes?.pagination) setPagination(allocRes.pagination);
      } else {
        setAllocations([]);
      }
    } catch (err) {
      setApiError(parseBackendError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadAllocations = async (nodeId: number, targetPage = page, targetPerPage = perPage) => {
    if (!activePanel?.hasAppKey || !nodeId) return;
    setLoading(true);
    setApiError(null);
    try {
      const res = await adminListNodeAllocations(nodeId, { page: targetPage, perPage: targetPerPage });
      setAllocations(res?.items || []);
      if (res?.pagination) setPagination(res.pagination);
    } catch (err) {
      setApiError(parseBackendError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadNodesAndAllocations();
    const onReload = () => loadAllocations(selectedNodeId, page, perPage);
    window.addEventListener('synora:reload', onReload);
    return () => window.removeEventListener('synora:reload', onReload);
  }, [activePanel?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const ports = portsInput
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (!ip.trim() || ports.length === 0) {
      setFormError(t('admin.ipAndPortRequired'));
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      await adminCreateNodeAllocations(selectedNodeId, {
        ip: ip.trim(),
        alias: alias.trim() || undefined,
        ports,
      });
      addNotification({ type: 'success', title: t('admin.allocationsCreated'), message: ip.trim() });
      setCreateOpen(false);
      await loadAllocations(selectedNodeId, page, perPage);
    } catch (err) {
      const parsed = parseBackendError(err);
      setFormError(parsed.permissionHint ? `${parsed.message} — ${parsed.permissionHint}` : parsed.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminDeleteNodeAllocation(selectedNodeId, deleteTarget.id);
      addNotification({ type: 'success', title: t('admin.allocationDeleted'), message: `${deleteTarget.ip}:${deleteTarget.port}` });
      setDeleteTarget(null);
      await loadAllocations(selectedNodeId, page, perPage);
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: t('admin.deleteFailed'), message: parsed.permissionHint || parsed.message });
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

  return (
    <AdminGuard onOpenPanelModal={onOpenPanelModal}>
      <div style={{ width: '100%', padding: '20px 24px', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box' }}>
        <AdminPageHeader
          title={t('admin.allocations')}
          subtitle={t('admin.allocationsSubtitle')}
          icon={Network}
          breadcrumbs={[{ label: t('admin.title'), onClick: onNavigateOverview }, { label: t('admin.allocations') }]}
          actions={
            <>
              <button type="button" onClick={() => loadAllocations(selectedNodeId, page, perPage)} disabled={loading || !selectedNodeId} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer' }}>
                <RefreshCw size={13} /> {t('admin.refresh')}
              </button>
              <button type="button" disabled={!selectedNodeId} onClick={() => { setFormError(null); setCreateOpen(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#FFFFFF', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                <Plus size={14} /> {t('admin.addAllocations')}
              </button>
            </>
          }
        />

        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: '2px solid var(--color-primary)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{t('admin.nodeAllocations')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Node:</span>
              <select
                value={selectedNodeId}
                onChange={(e) => {
                  const nextId = Number(e.target.value);
                  setSelectedNodeId(nextId);
                  setPage(1);
                  loadAllocations(nextId, 1, perPage);
                }}
                style={{ height: '32px', padding: '0 10px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '12.5px' }}
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    #{n.id} — {n.name} ({n.fqdn})
                  </option>
                ))}
              </select>
            </div>
          </div>

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
          ) : allocations.length === 0 ? (
            <div style={{ padding: '24px' }}><EmptyState icon={Network} title={t('admin.noAllocationsTitle')} description={t('admin.noAllocationsDesc')} /></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.ipAddress')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.alias')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.port')}</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.assigned')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{a.id}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }}>{a.ip}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>{a.alias || '—'}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{a.port}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {a.assigned ? (
                        <span style={{ padding: '2px 8px', borderRadius: '3px', backgroundColor: 'var(--color-primary-muted)', color: 'var(--color-primary-light)', fontSize: '11px', fontWeight: 600 }}>{t('admin.assigned')}</span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t('admin.available')}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <button
                        type="button"
                        disabled={a.assigned}
                        onClick={() => setDeleteTarget(a)}
                        title={a.assigned ? t('admin.cannotDeleteAssigned') : t('admin.deleteAllocation')}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(239,68,68,0.35)',
                          backgroundColor: 'var(--color-error-bg)',
                          color: 'var(--color-error)',
                          cursor: a.assigned ? 'not-allowed' : 'pointer',
                          opacity: a.assigned ? 0.45 : 1,
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <PaginationBar
            pagination={pagination}
            disabled={loading}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              loadAllocations(selectedNodeId, nextPage, perPage);
            }}
            onPerPageChange={(nextPerPage) => {
              setPerPage(nextPerPage);
              setPage(1);
              loadAllocations(selectedNodeId, 1, nextPerPage);
            }}
          />
        </div>

        <AdminModal
          isOpen={createOpen}
          title={t('admin.addNodeAllocations')}
          onClose={() => !creating && setCreateOpen(false)}
          footer={
            <>
              <button type="button" disabled={creating} onClick={() => setCreateOpen(false)} style={{ padding: '6px 14px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer' }}>{t('admin.cancel')}</button>
              <button type="submit" form="admin-alloc-form" disabled={creating} style={{ padding: '6px 14px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#FFFFFF', fontSize: '12px', fontWeight: 500, cursor: creating ? 'not-allowed' : 'pointer' }}>{creating ? t('admin.adding') : t('admin.createAllocations')}</button>
            </>
          }
        >
          <form id="admin-alloc-form" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {formError && <div style={{ padding: '10px', borderRadius: '4px', border: '1px solid var(--color-error)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: '12px' }}>{formError}</div>}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('admin.ipAddress')} *</label>
              <input required value={ip} onChange={(e) => setIp(e.target.value)} placeholder="0.0.0.0" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('admin.ipAliasOptional')}</label>
              <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="play.example.com" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('admin.portsRangesLabel')}</label>
              <input required value={portsInput} onChange={(e) => setPortsInput(e.target.value)} placeholder="25565, 25570-25575" style={inputStyle} />
            </div>
          </form>
        </AdminModal>

        <ConfirmDialog
          isOpen={Boolean(deleteTarget)}
          title={t('admin.deleteAllocation')}
          message={deleteTarget ? t('admin.deleteAllocationMsg', { ip: deleteTarget.ip, port: deleteTarget.port }) : ''}
          confirmLabel={t('admin.delete')}
          isDestructive
          isLoading={deleting}
          onConfirm={handleDelete}
          onCancel={() => !deleting && setDeleteTarget(null)}
        />
      </div>
    </AdminGuard>
  );
};
