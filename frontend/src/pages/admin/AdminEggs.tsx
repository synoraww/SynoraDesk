import React, { useEffect, useState } from 'react';
import { RefreshCw, Eye, AlertCircle, Cpu, Info } from 'lucide-react';
import { usePanelStore } from '../../stores/panelStore';
import { useI18n } from '../../i18n';
import { AdminGuard } from '../../components/admin/AdminGuard';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { PaginationBar } from '../../components/admin/PaginationBar';
import { AdminModal } from '../../components/admin/AdminModal';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { adminGetEgg, adminListEggs, adminListNests, parseBackendError } from '../../services/adminApi';
import { AdminEgg, AdminNest, PaginationMeta, ParsedAPIError } from '../../types/admin';

interface AdminEggsProps {
  onNavigateOverview: () => void;
  onOpenPanelModal: () => void;
}

export const AdminEggs: React.FC<AdminEggsProps> = ({
  onNavigateOverview,
  onOpenPanelModal,
}) => {
  const { activePanel } = usePanelStore();
  const { t } = useI18n();

  const [nests, setNests] = useState<AdminNest[]>([]);
  const [selectedNestId, setSelectedNestId] = useState<number>(0);
  const [eggs, setEggs] = useState<AdminEgg[]>([]);
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

  const [detailEgg, setDetailEgg] = useState<AdminEgg | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadNestsAndEggs = async () => {
    if (!activePanel?.hasAppKey) return;
    setLoading(true);
    setApiError(null);
    try {
      const nestRes = await adminListNests({ page: 1, perPage: 100 });
      const nestItems = nestRes?.items || [];
      setNests(nestItems);
      if (nestItems.length > 0) {
        const firstId = nestItems[0].id;
        setSelectedNestId(firstId);
        const eggRes = await adminListEggs(firstId, { page: 1, perPage });
        setEggs(eggRes?.items || []);
        if (eggRes?.pagination) setPagination(eggRes.pagination);
      } else {
        setEggs([]);
      }
    } catch (err) {
      setApiError(parseBackendError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadEggs = async (nestId: number, targetPage = page, targetPerPage = perPage) => {
    if (!activePanel?.hasAppKey || !nestId) return;
    setLoading(true);
    setApiError(null);
    try {
      const res = await adminListEggs(nestId, { page: targetPage, perPage: targetPerPage });
      setEggs(res?.items || []);
      if (res?.pagination) setPagination(res.pagination);
    } catch (err) {
      setApiError(parseBackendError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadNestsAndEggs();
    const onReload = () => loadEggs(selectedNestId, page, perPage);
    window.addEventListener('synora:reload', onReload);
    return () => window.removeEventListener('synora:reload', onReload);
  }, [activePanel?.id]);

  const openEggDetail = async (egg: AdminEgg) => {
    setDetailEgg(egg);
    setDetailLoading(true);
    try {
      const full = await adminGetEgg(egg.nest, egg.id);
      setDetailEgg(full);
    } catch {
      // Keep summary if include fails
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <AdminGuard onOpenPanelModal={onOpenPanelModal}>
      <div style={{ width: '100%', padding: '20px 24px', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box' }}>
        <AdminPageHeader
          title={t('admin.eggs')}
          subtitle={t('admin.eggsSubtitle')}
          icon={Cpu}
          breadcrumbs={[{ label: t('admin.title'), onClick: onNavigateOverview }, { label: t('admin.eggs') }]}
          actions={
            <button
              type="button"
              onClick={() => loadEggs(selectedNestId, page, perPage)}
              disabled={loading || !selectedNestId}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer' }}
            >
              <RefreshCw size={13} /> {t('admin.refresh')}
            </button>
          }
        />

        <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: '12.5px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={14} color="var(--color-info)" />
          <span>{t('admin.eggsReadOnlyNote')}</span>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: '2px solid var(--color-primary)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{t('admin.eggsByNest')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t('admin.nest')}:</span>
              <select
                value={selectedNestId}
                onChange={(e) => {
                  const nextId = Number(e.target.value);
                  setSelectedNestId(nextId);
                  setPage(1);
                  loadEggs(nextId, 1, perPage);
                }}
                style={{ height: '32px', padding: '0 10px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '12.5px' }}
              >
                {nests.map((n) => (
                  <option key={n.id} value={n.id}>
                    #{n.id} — {n.name}
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
          ) : eggs.length === 0 ? (
            <div style={{ padding: '24px' }}><EmptyState icon={Cpu} title={t('admin.noEggsTitle')} description={t('admin.noEggsDesc')} /></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.name')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.author')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.dockerImage')}</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {eggs.map((egg) => (
                  <tr key={egg.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>{egg.id}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text)' }}>{egg.name}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>{egg.author}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--color-text-secondary)' }}><code>{egg.docker_image}</code></td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <button type="button" onClick={() => openEggDetail(egg)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer' }}>
                        <Eye size={13} /> {t('admin.inspect')}
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
              loadEggs(selectedNestId, nextPage, perPage);
            }}
            onPerPageChange={(nextPerPage) => {
              setPerPage(nextPerPage);
              setPage(1);
              loadEggs(selectedNestId, 1, nextPerPage);
            }}
          />
        </div>

        <AdminModal isOpen={Boolean(detailEgg)} title={detailEgg ? `${t('admin.egg')}: ${detailEgg.name}` : t('admin.eggDetails')} subtitle={detailEgg?.uuid} width="720px" onClose={() => setDetailEgg(null)}>
          {detailLoading ? (
            <TableSkeleton rows={4} />
          ) : detailEgg ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div><span style={{ color: 'var(--color-text-muted)' }}>{t('admin.description')}:</span> {detailEgg.description || '—'}</div>
              <div>
                <div style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}>{t('admin.startupCommand')}</div>
                <code style={{ display: 'block', padding: '6px 8px', backgroundColor: 'var(--color-bg)', borderRadius: '4px', border: '1px solid var(--color-border)', wordBreak: 'break-all' }}>{detailEgg.startup}</code>
              </div>
              {detailEgg.docker_images && (
                <div>
                  <div style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}>{t('admin.dockerImages')}</div>
                  <pre style={{ margin: 0, padding: '8px', backgroundColor: 'var(--color-bg)', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '12px', overflowX: 'auto' }}>
                    {JSON.stringify(detailEgg.docker_images, null, 2)}
                  </pre>
                </div>
              )}
              {detailEgg.relationships?.variables?.data && detailEgg.relationships.variables.data.length > 0 && (
                <div>
                  <div style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}>{t('admin.envVariables')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {detailEgg.relationships.variables.data.map((v, i) => (
                      <div key={i} style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', fontSize: '12px' }}>
                        <strong>{v.attributes.name}</strong> (<code>{v.attributes.env_variable}</code>) · Default: <code>{v.attributes.default_value || '""'}</code> · Rules: <code>{v.attributes.rules}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detailEgg.config && (
                <div>
                  <div style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}>{t('admin.processConfig')}</div>
                  <pre style={{ margin: 0, padding: '8px', backgroundColor: 'var(--color-bg)', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '12px', overflowX: 'auto' }}>
                    {JSON.stringify(detailEgg.config, null, 2)}
                  </pre>
                </div>
              )}
              {detailEgg.script?.install && (
                <div>
                  <div style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}>{t('admin.installScriptReadOnly', { container: detailEgg.script.container })}</div>
                  <pre style={{ margin: 0, padding: '8px', backgroundColor: 'var(--color-bg)', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '11.5px', maxHeight: '200px', overflow: 'auto' }}>
                    {detailEgg.script.install}
                  </pre>
                </div>
              )}
            </div>
          ) : null}
        </AdminModal>
      </div>
    </AdminGuard>
  );
};
