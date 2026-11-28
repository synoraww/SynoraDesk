import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Eye, KeyRound, Trash2, AlertCircle, Database } from 'lucide-react';
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
  adminCreateServerDatabase,
  adminDeleteServerDatabase,
  adminGetServerDatabase,
  adminListServerDatabases,
  adminListServers,
  adminResetServerDatabasePassword,
  parseBackendError,
} from '../../services/adminApi';
import { AppDatabase, AppServer, PaginationMeta, ParsedAPIError } from '../../types/admin';

interface AdminDatabasesProps {
  onNavigateOverview: () => void;
  onOpenPanelModal: () => void;
}

export const AdminDatabases: React.FC<AdminDatabasesProps> = ({
  onNavigateOverview,
  onOpenPanelModal,
}) => {
  const { activePanel } = usePanelStore();
  const { addNotification } = useUIStore();
  const { t } = useI18n();

  const [servers, setServers] = useState<AppServer[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<number>(0);
  const [databases, setDatabases] = useState<AppDatabase[]>([]);
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

  const [detailDb, setDetailDb] = useState<AppDatabase | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [dbName, setDbName] = useState('');
  const [remote, setRemote] = useState('%');
  const [hostId, setHostId] = useState(1);
  const [maxConn, setMaxConn] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{ type: 'reset' | 'delete'; db: AppDatabase } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadServersAndDatabases = async () => {
    if (!activePanel?.hasAppKey) return;
    setLoading(true);
    setApiError(null);
    try {
      const srvRes = await adminListServers({ page: 1, perPage: 100 });
      const srvItems = srvRes?.items || [];
      setServers(srvItems);
      if (srvItems.length > 0) {
        const firstId = srvItems[0].id;
        setSelectedServerId(firstId);
        const dbRes = await adminListServerDatabases(firstId, { page: 1, perPage, include: ['host'] });
        setDatabases(dbRes?.items || []);
        if (dbRes?.pagination) setPagination(dbRes.pagination);
      } else {
        setDatabases([]);
      }
    } catch (err) {
      setApiError(parseBackendError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadDatabases = async (serverId: number, targetPage = page, targetPerPage = perPage) => {
    if (!activePanel?.hasAppKey || !serverId) return;
    setLoading(true);
    setApiError(null);
    try {
      const res = await adminListServerDatabases(serverId, {
        page: targetPage,
        perPage: targetPerPage,
        include: ['host'],
      });
      setDatabases(res?.items || []);
      if (res?.pagination) setPagination(res.pagination);
    } catch (err) {
      setApiError(parseBackendError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadServersAndDatabases();
    const onReload = () => loadDatabases(selectedServerId, page, perPage);
    window.addEventListener('synora:reload', onReload);
    return () => window.removeEventListener('synora:reload', onReload);
  }, [activePanel?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbName.trim() || hostId <= 0) {
      setFormError(t('admin.dbHostRequiredErr'));
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const created = await adminCreateServerDatabase(selectedServerId, {
        database: dbName.trim(),
        remote: remote.trim() || '%',
        host: Number(hostId),
        max_connections: Number(maxConn) || 0,
      });
      addNotification({ type: 'success', title: t('admin.databaseCreated'), message: created.database });
      setCreateOpen(false);
      setDbName('');
      if (created.relationships?.password?.attributes?.password) {
        setDetailDb(created);
        setRevealedPassword(created.relationships.password.attributes.password);
      }
      await loadDatabases(selectedServerId, page, perPage);
    } catch (err) {
      const parsed = parseBackendError(err);
      setFormError(parsed.permissionHint ? `${parsed.message} — ${parsed.permissionHint}` : parsed.message);
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.type === 'reset') {
        await adminResetServerDatabasePassword(selectedServerId, confirmAction.db.id);
        addNotification({ type: 'success', title: t('admin.passwordRotated'), message: confirmAction.db.database });
        const fresh = await adminGetServerDatabase(selectedServerId, confirmAction.db.id, true);
        setDetailDb(fresh);
        setRevealedPassword(fresh.relationships?.password?.attributes?.password || null);
      } else {
        await adminDeleteServerDatabase(selectedServerId, confirmAction.db.id);
        addNotification({ type: 'success', title: t('admin.databaseDeleted'), message: confirmAction.db.database });
      }
      setConfirmAction(null);
      await loadDatabases(selectedServerId, page, perPage);
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: t('admin.actionFailed'), message: parsed.permissionHint || parsed.message });
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

  return (
    <AdminGuard onOpenPanelModal={onOpenPanelModal}>
      <div style={{ width: '100%', padding: '20px 24px', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box' }}>
        <AdminPageHeader
          title={t('admin.databases')}
          subtitle={t('admin.databasesSubtitle')}
          icon={Database}
          breadcrumbs={[{ label: t('admin.title'), onClick: onNavigateOverview }, { label: t('admin.databases') }]}
          actions={
            <>
              <button type="button" onClick={() => loadDatabases(selectedServerId, page, perPage)} disabled={loading || !selectedServerId} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer' }}>
                <RefreshCw size={13} /> {t('admin.refresh')}
              </button>
              <button type="button" disabled={!selectedServerId} onClick={() => { setFormError(null); setCreateOpen(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#FFFFFF', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                <Plus size={14} /> {t('admin.createNew')}
              </button>
            </>
          }
        />

        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: '2px solid var(--color-primary)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{t('admin.serverDatabases')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t('admin.server')}:</span>
              <select
                value={selectedServerId}
                onChange={(e) => {
                  const nextId = Number(e.target.value);
                  setSelectedServerId(nextId);
                  setPage(1);
                  loadDatabases(nextId, 1, perPage);
                }}
                style={{ height: '32px', padding: '0 10px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '12.5px' }}
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.id} — {s.name} ({s.identifier})
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
            <div style={{ padding: '16px' }}><TableSkeleton rows={4} /></div>
          ) : databases.length === 0 ? (
            <div style={{ padding: '24px' }}><EmptyState icon={Database} title={t('admin.noDatabasesTitle')} description={t('admin.noDatabasesDesc')} /></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.database')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.username')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.remote')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.host')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {databases.map((db) => (
                  <tr key={db.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{db.id}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}><code>{db.database}</code></td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{db.username}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{db.remote}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {db.relationships?.host?.attributes
                        ? `${db.relationships.host.attributes.host}:${db.relationships.host.attributes.port}`
                        : `Host #${db.host}`}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button type="button" onClick={() => { setRevealedPassword(null); setDetailDb(db); }} title={t('admin.viewDetails')} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                          <Eye size={13} />
                        </button>
                        <button type="button" onClick={() => setConfirmAction({ type: 'reset', db })} title={t('admin.rotatePassword')} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-warning)', cursor: 'pointer' }}>
                          <KeyRound size={13} />
                        </button>
                        <button type="button" onClick={() => setConfirmAction({ type: 'delete', db })} title={t('admin.deleteDatabase')} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.35)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', cursor: 'pointer' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
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
              loadDatabases(selectedServerId, nextPage, perPage);
            }}
            onPerPageChange={(nextPerPage) => {
              setPerPage(nextPerPage);
              setPage(1);
              loadDatabases(selectedServerId, 1, nextPerPage);
            }}
          />
        </div>

        <AdminModal
          isOpen={Boolean(detailDb)}
          title={detailDb ? `${t('admin.database')}: ${detailDb.database}` : t('admin.databaseDetails')}
          onClose={() => {
            setRevealedPassword(null);
            setDetailDb(null);
          }}
        >
          {detailDb && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div><span style={{ color: 'var(--color-text-muted)' }}>ID:</span> <strong>{detailDb.id}</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>{t('admin.database')}:</span> <code>{detailDb.database}</code></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>{t('admin.username')}:</span> <code>{detailDb.username}</code></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>{t('admin.remote')}:</span> <code>{detailDb.remote}</code></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>{t('admin.maxConnections')}:</span> {detailDb.max_connections || t('admin.unlimited')}</div>
              {revealedPassword && (
                <div style={{ padding: '10px', borderRadius: '4px', border: '1px solid var(--color-warning)', backgroundColor: 'var(--color-warning-bg)' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-warning)', marginBottom: '4px' }}>
                    {t('admin.oneTimePasswordNote')}
                  </div>
                  <code style={{ fontSize: '13px', userSelect: 'all' }}>{revealedPassword}</code>
                </div>
              )}
            </div>
          )}
        </AdminModal>

        <AdminModal
          isOpen={createOpen}
          title={t('admin.createServerDatabase')}
          onClose={() => !creating && setCreateOpen(false)}
          footer={
            <>
              <button type="button" disabled={creating} onClick={() => setCreateOpen(false)} style={{ padding: '6px 14px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer' }}>{t('admin.cancel')}</button>
              <button type="submit" form="admin-db-form" disabled={creating} style={{ padding: '6px 14px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#FFFFFF', fontSize: '12px', fontWeight: 500, cursor: creating ? 'not-allowed' : 'pointer' }}>{creating ? t('admin.creating') : t('admin.createDatabase')}</button>
            </>
          }
        >
          <form id="admin-db-form" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {formError && <div style={{ padding: '10px', borderRadius: '4px', border: '1px solid var(--color-error)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: '12px' }}>{formError}</div>}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('admin.databaseNameRequired')}</label>
              <input required value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="plugin_data" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('admin.databaseHostIdRequired')}</label>
                <input type="number" min={1} required value={hostId} onChange={(e) => setHostId(Number(e.target.value))} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('admin.connectionsFrom')}</label>
                <input value={remote} onChange={(e) => setRemote(e.target.value)} placeholder="%" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('admin.maxConnections')}</label>
                <input type="number" min={0} value={maxConn} onChange={(e) => setMaxConn(Number(e.target.value))} style={inputStyle} />
              </div>
            </div>
          </form>
        </AdminModal>

        <ConfirmDialog
          isOpen={Boolean(confirmAction)}
          title={confirmAction?.type === 'reset' ? t('admin.rotateDatabasePassword') : t('admin.deleteDatabase')}
          message={
            confirmAction?.type === 'reset'
              ? t('admin.rotateDatabasePasswordMsg', { db: confirmAction.db.database })
              : t('admin.deleteDatabaseMsg', { db: confirmAction?.db.database || '' })
          }
          confirmLabel={confirmAction?.type === 'reset' ? t('admin.rotatePassword') : t('admin.deleteDatabase')}
          isDestructive={confirmAction?.type === 'delete'}
          isLoading={actionLoading}
          onConfirm={handleConfirmAction}
          onCancel={() => !actionLoading && setConfirmAction(null)}
        />
      </div>
    </AdminGuard>
  );
};
