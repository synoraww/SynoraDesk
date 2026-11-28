import React, { useEffect, useState } from 'react';
import { RefreshCw, Eye, AlertCircle, Box, Info } from 'lucide-react';
import { usePanelStore } from '../../stores/panelStore';
import { useI18n } from '../../i18n';
import { AdminGuard } from '../../components/admin/AdminGuard';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { PaginationBar } from '../../components/admin/PaginationBar';
import { AdminModal } from '../../components/admin/AdminModal';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { adminListEggs, adminListNests, parseBackendError } from '../../services/adminApi';
import { AdminEgg, AdminNest, PaginationMeta, ParsedAPIError } from '../../types/admin';

interface AdminNestsProps {
  onNavigateOverview: () => void;
  onOpenPanelModal: () => void;
}

export const AdminNests: React.FC<AdminNestsProps> = ({
  onNavigateOverview,
  onOpenPanelModal,
}) => {
  const { activePanel } = usePanelStore();
  const { t } = useI18n();

  const [nests, setNests] = useState<AdminNest[]>([]);
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

  const [detailNest, setDetailNest] = useState<AdminNest | null>(null);
  const [nestEggs, setNestEggs] = useState<AdminEgg[]>([]);
  const [eggsLoading, setEggsLoading] = useState(false);

  const loadNests = async (targetPage = page, targetPerPage = perPage) => {
    if (!activePanel?.hasAppKey) return;
    setLoading(true);
    setApiError(null);
    try {
      const res = await adminListNests({ page: targetPage, perPage: targetPerPage, sort: 'id' });
      setNests(res?.items || []);
      if (res?.pagination) setPagination(res.pagination);
    } catch (err) {
      setApiError(parseBackendError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadNests(1, perPage);
    const onReload = () => loadNests(page, perPage);
    window.addEventListener('synora:reload', onReload);
    return () => window.removeEventListener('synora:reload', onReload);
  }, [activePanel?.id]);

  const openNestDetail = async (n: AdminNest) => {
    setDetailNest(n);
    setNestEggs([]);
    setEggsLoading(true);
    try {
      const res = await adminListEggs(n.id, { page: 1, perPage: 100 });
      setNestEggs(res?.items || []);
    } catch {
      setNestEggs([]);
    } finally {
      setEggsLoading(false);
    }
  };

  return (
    <AdminGuard onOpenPanelModal={onOpenPanelModal}>
      <div style={{ width: '100%', padding: '20px 24px', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box' }}>
        <AdminPageHeader
          title={t('admin.nests')}
          subtitle={t('admin.nestsSubtitle')}
          icon={Box}
          breadcrumbs={[{ label: t('admin.title'), onClick: onNavigateOverview }, { label: t('admin.nests') }]}
          actions={
            <button
              type="button"
              onClick={() => loadNests(page, perPage)}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer' }}
            >
              <RefreshCw size={13} /> {t('admin.refresh')}
            </button>
          }
        />

        <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: '12.5px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={14} color="var(--color-info)" />
          <span>{t('admin.nestsReadOnlyNote')} (<code>GET /api/application/nests</code>).</span>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: '2px solid var(--color-primary)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
            {t('admin.configuredNests')}
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
          ) : nests.length === 0 ? (
            <div style={{ padding: '24px' }}><EmptyState icon={Box} title={t('admin.noNestsTitle')} description={t('admin.noNestsDesc')} /></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.name')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.author')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.description')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {nests.map((n) => (
                  <tr key={n.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{n.id}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text)' }}>{n.name}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>{n.author}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>{n.description || '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <button type="button" onClick={() => openNestDetail(n)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer' }}>
                        <Eye size={13} /> {t('admin.viewEggs')}
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
              loadNests(nextPage, perPage);
            }}
            onPerPageChange={(nextPerPage) => {
              setPerPage(nextPerPage);
              setPage(1);
              loadNests(1, nextPerPage);
            }}
          />
        </div>

        <AdminModal isOpen={Boolean(detailNest)} title={detailNest ? `${t('admin.nest')}: ${detailNest.name}` : t('admin.nestDetails')} subtitle={detailNest?.uuid} width="640px" onClose={() => setDetailNest(null)}>
          {detailNest && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div><span style={{ color: 'var(--color-text-muted)' }}>{t('admin.author')}:</span> {detailNest.author}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>{t('admin.description')}:</span> {detailNest.description || '—'}</div>
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '10px' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px' }}>{t('admin.eggsInNest')}</div>
                {eggsLoading ? (
                  <TableSkeleton rows={3} />
                ) : nestEggs.length === 0 ? (
                  <div style={{ color: 'var(--color-text-muted)' }}>{t('admin.noEggsInNest')}</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {nestEggs.map((e) => (
                      <li key={e.id}>
                        <strong>{e.name}</strong> (ID: {e.id}) — <code>{e.docker_image}</code>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </AdminModal>
      </div>
    </AdminGuard>
  );
};
