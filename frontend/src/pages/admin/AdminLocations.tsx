import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Eye, Edit2, Trash2, AlertCircle, MapPin } from 'lucide-react';
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
  adminCreateLocation,
  adminDeleteLocation,
  adminListLocations,
  adminUpdateLocation,
  parseBackendError,
} from '../../services/adminApi';
import { AdminLocation, PaginationMeta, ParsedAPIError } from '../../types/admin';

interface AdminLocationsProps {
  onNavigateOverview: () => void;
  onOpenPanelModal: () => void;
}

export const AdminLocations: React.FC<AdminLocationsProps> = ({
  onNavigateOverview,
  onOpenPanelModal,
}) => {
  const { activePanel } = usePanelStore();
  const { addNotification } = useUIStore();
  const { t } = useI18n();

  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    count: 0,
    per_page: 25,
    current_page: 1,
    total_pages: 1,
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<ParsedAPIError | null>(null);

  const [detailLoc, setDetailLoc] = useState<AdminLocation | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<AdminLocation | null>(null);
  const [form, setForm] = useState({ short: '', long: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AdminLocation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadLocations = async (targetPage = page, targetPerPage = perPage) => {
    if (!activePanel?.hasAppKey) return;
    setLoading(true);
    setApiError(null);
    try {
      const filters: Record<string, string> = {};
      if (searchQuery.trim()) {
        filters.short = searchQuery.trim();
      }
      const res = await adminListLocations({ page: targetPage, perPage: targetPerPage, filters, sort: 'id' });
      setLocations(res?.items || []);
      if (res?.pagination) setPagination(res.pagination);
    } catch (err) {
      setApiError(parseBackendError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadLocations(1, perPage);
    const onReload = () => loadLocations(page, perPage);
    window.addEventListener('synora:reload', onReload);
    return () => window.removeEventListener('synora:reload', onReload);
  }, [activePanel?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.short.trim()) {
      setFormError(t('admin.shortCodeRequired'));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = { short: form.short.trim(), long: form.long.trim() };
      if (editingLoc) {
        await adminUpdateLocation(editingLoc.id, payload);
        addNotification({ type: 'success', title: t('admin.locationUpdated'), message: payload.short });
      } else {
        await adminCreateLocation(payload);
        addNotification({ type: 'success', title: t('admin.locationCreated'), message: payload.short });
      }
      setFormOpen(false);
      await loadLocations(page, perPage);
    } catch (err) {
      const parsed = parseBackendError(err);
      setFormError(parsed.permissionHint ? `${parsed.message} — ${parsed.permissionHint}` : parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminDeleteLocation(deleteTarget.id);
      addNotification({ type: 'success', title: t('admin.locationDeleted'), message: deleteTarget.short });
      setDeleteTarget(null);
      await loadLocations(page, perPage);
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: t('admin.deleteLocationFailed'), message: parsed.permissionHint || parsed.message });
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
          title={t('admin.locations')}
          subtitle={t('admin.locationsSubtitle')}
          icon={MapPin}
          breadcrumbs={[{ label: t('admin.title'), onClick: onNavigateOverview }, { label: t('admin.locations') }]}
          actions={
            <>
              <button
                type="button"
                onClick={() => loadLocations(page, perPage)}
                disabled={loading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer' }}
              >
                <RefreshCw size={13} /> {t('admin.refresh')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingLoc(null);
                  setForm({ short: '', long: '' });
                  setFormError(null);
                  setFormOpen(true);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#FFFFFF', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
              >
                <Plus size={14} /> {t('admin.createNew')}
              </button>
            </>
          }
        />

        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: '2px solid var(--color-primary)', borderRadius: '4px', overflow: 'hidden' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              loadLocations(1, perPage);
            }}
            style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{t('admin.locationList')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t('admin.filterByShortCode')}
                width="220px"
                onClear={() => {
                  setPage(1);
                  setTimeout(() => loadLocations(1, perPage), 0);
                }}
              />
              <button type="submit" style={{ height: '32px', padding: '0 12px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer' }}>
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
            <div style={{ padding: '16px' }}><TableSkeleton rows={4} /></div>
          ) : locations.length === 0 ? (
            <div style={{ padding: '24px' }}><EmptyState icon={MapPin} title={t('admin.noLocationsTitle')} description={t('admin.noLocationsDesc')} /></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.shortCode')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.description')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{loc.id}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text)' }}><code>{loc.short}</code></td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>{loc.long || '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button type="button" onClick={() => setDetailLoc(loc)} title={t('admin.viewDetails')} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLoc(loc);
                            setForm({ short: loc.short, long: loc.long || '' });
                            setFormError(null);
                            setFormOpen(true);
                          }}
                          title={t('admin.editLocation')}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(loc)} title={t('admin.deleteLocation')} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.35)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', cursor: 'pointer' }}>
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
              loadLocations(nextPage, perPage);
            }}
            onPerPageChange={(nextPerPage) => {
              setPerPage(nextPerPage);
              setPage(1);
              loadLocations(1, nextPerPage);
            }}
          />
        </div>

        <AdminModal isOpen={Boolean(detailLoc)} title={detailLoc ? `${t('admin.locations')}: ${detailLoc.short}` : t('admin.locations')} onClose={() => setDetailLoc(null)}>
          {detailLoc && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div><span style={{ color: 'var(--color-text-muted)' }}>ID:</span> <strong>{detailLoc.id}</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>{t('admin.shortCode')}:</span> <code>{detailLoc.short}</code></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>{t('admin.description')}:</span> {detailLoc.long || '—'}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>{t('admin.created')}:</span> {new Date(detailLoc.created_at).toLocaleString()}</div>
            </div>
          )}
        </AdminModal>

        <AdminModal
          isOpen={formOpen}
          title={editingLoc ? t('admin.editLocationTitle', { short: editingLoc.short }) : t('admin.createLocation')}
          onClose={() => !saving && setFormOpen(false)}
          footer={
            <>
              <button type="button" disabled={saving} onClick={() => setFormOpen(false)} style={{ padding: '6px 14px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer' }}>
                {t('admin.cancel')}
              </button>
              <button type="submit" form="admin-location-form" disabled={saving} style={{ padding: '6px 14px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#FFFFFF', fontSize: '12px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? t('admin.saving') : editingLoc ? t('admin.update') : t('admin.create')}
              </button>
            </>
          }
        >
          <form id="admin-location-form" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {formError && (
              <div style={{ padding: '10px', borderRadius: '4px', border: '1px solid var(--color-error)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: '12px' }}>
                {formError}
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('admin.shortCode')} *</label>
              <input required value={form.short} onChange={(e) => setForm({ ...form, short: e.target.value })} placeholder="us.nyc" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('admin.description')}</label>
              <input value={form.long} onChange={(e) => setForm({ ...form, long: e.target.value })} placeholder="New York Datacenter" style={inputStyle} />
            </div>
          </form>
        </AdminModal>

        <ConfirmDialog
          isOpen={Boolean(deleteTarget)}
          title={t('admin.deleteLocation')}
          message={deleteTarget ? t('admin.deleteLocationMsg', { short: deleteTarget.short }) : ''}
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
