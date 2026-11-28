import React, { useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  Shield,
  ShieldCheck,
  AlertCircle,
  Users as UsersIcon,
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
  adminDeleteUser,
  adminGetUser,
  adminListUsers,
  parseBackendError,
} from '../../services/adminApi';
import { AdminUser, PaginationMeta, ParsedAPIError } from '../../types/admin';
import { AdminUserEditor } from './AdminUserEditor';

interface AdminUsersProps {
  initialUserId?: number;
  onNavigateOverview: () => void;
  onOpenPanelModal: () => void;
}

const emptyForm = {
  email: '',
  username: '',
  first_name: '',
  last_name: '',
  password: '',
  language: 'en',
  root_admin: false,
  external_id: '',
};

export const AdminUsers: React.FC<AdminUsersProps> = ({
  initialUserId,
  onNavigateOverview,
  onOpenPanelModal,
}) => {
  const { activePanel } = usePanelStore();
  const { addNotification } = useUIStore();
  const { t } = useI18n();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    count: 0,
    per_page: 25,
    current_page: 1,
    total_pages: 1,
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [searchField, setSearchField] = useState<'username' | 'email' | 'uuid' | 'external_id'>('username');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<ParsedAPIError | null>(null);

  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const [editorState, setEditorState] = useState<{ mode: 'create' } | { mode: 'edit'; user: AdminUser } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = async (targetPage = page, targetPerPage = perPage) => {
    if (!activePanel?.hasAppKey) return;
    setLoading(true);
    setApiError(null);
    try {
      const filters: Record<string, string> = {};
      if (searchQuery.trim()) {
        filters[searchField] = searchQuery.trim();
      }
      const res = await adminListUsers({
        page: targetPage,
        perPage: targetPerPage,
        filters,
        sort: 'id',
      });
      setUsers(res?.items || []);
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
    loadUsers(1, perPage);
    const onReload = () => loadUsers(page, perPage);
    window.addEventListener('synora:reload', onReload);
    return () => window.removeEventListener('synora:reload', onReload);
  }, [activePanel?.id]);

  useEffect(() => {
    if (initialUserId && activePanel?.hasAppKey) {
      adminGetUser(initialUserId)
        .then((u) => setEditorState({ mode: 'edit', user: u }))
        .catch(() => {});
    }
  }, [initialUserId, activePanel?.id]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers(1, perPage);
  };

  const openCreateModal = () => {
    setEditorState({ mode: 'create' });
  };

  const openEditModal = (u: AdminUser) => {
    setEditorState({ mode: 'edit', user: u });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminDeleteUser(deleteTarget.id);
      addNotification({
        type: 'success',
        title: 'User Deleted',
        message: `Deleted user ${deleteTarget.username}.`,
      });
      setDeleteTarget(null);
      await loadUsers(page, perPage);
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({
        type: 'error',
        title: 'Delete User Failed',
        message: parsed.permissionHint || parsed.message,
      });
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
      {editorState ? (
        <AdminUserEditor
          user={editorState.mode === 'edit' ? editorState.user : null}
          onBack={() => setEditorState(null)}
          onNavigateOverview={onNavigateOverview}
          onSaved={() => {
            setEditorState(null);
            loadUsers(page, perPage);
          }}
        />
      ) : (
      <div style={{ width: '100%', padding: '20px 24px', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box' }}>
        <AdminPageHeader
          title={t('admin.users')}
          subtitle={t('admin.usersSubtitle')}
          icon={UsersIcon}
          breadcrumbs={[
            { label: t('admin.title'), onClick: onNavigateOverview },
            { label: t('admin.users') },
          ]}
          actions={
            <>
              <button
                type="button"
                onClick={() => loadUsers(page, perPage)}
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

        {/* Table Container */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderTop: '2px solid var(--color-primary)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          {/* Toolbar: Filter & Search */}
          <form
            onSubmit={handleSearchSubmit}
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
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
              {t('admin.userList')}
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
                <option value="username">Username</option>
                <option value="email">Email</option>
                <option value="uuid">UUID</option>
                <option value="external_id">External ID</option>
              </select>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={`Filter by ${searchField}...`}
                width="240px"
                onClear={() => {
                  setPage(1);
                  setTimeout(() => loadUsers(1, perPage), 0);
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

          {/* Error State */}
          {apiError && (
            <div
              style={{
                margin: '14px',
                padding: '12px 14px',
                borderRadius: '4px',
                border: '1px solid var(--color-error)',
                backgroundColor: 'var(--color-error-bg)',
                color: 'var(--color-text)',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--color-error)' }}>
                <AlertCircle size={15} />
                <span>
                  {apiError.statusCode ? `HTTP ${apiError.statusCode}` : 'Error'}: {apiError.message}
                </span>
              </div>
              {apiError.permissionHint && (
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {apiError.permissionHint}
                </p>
              )}
              {apiError.requestId && (
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Request ID: <code>{apiError.requestId}</code>
                </p>
              )}
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div style={{ padding: '16px' }}>
              <TableSkeleton rows={6} />
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: '24px' }}>
              <EmptyState
                icon={UsersIcon}
                title={t('admin.noUsersTitle')}
                description={
                  searchQuery
                    ? t('admin.noUsersFilter')
                    : t('admin.noUsersDesc')
                }
              />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-elevated)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ID</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Client Name</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Username</th>
                    <th style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>2FA</th>
                    <th style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Role</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {u.id}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text)' }}>{u.email}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>
                        {u.first_name} {u.last_name}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--color-text)' }}>
                        {u.username}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {u['2fa'] ? (
                          <span style={{ color: 'var(--color-success)', fontSize: '12px', fontWeight: 500 }}>Enabled</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Disabled</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {u.root_admin ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '3px',
                              backgroundColor: 'var(--color-warning-bg)',
                              color: 'var(--color-warning)',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            <ShieldCheck size={12} /> Admin
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>User</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setDetailUser(u)}
                            title="View details"
                            style={{
                              padding: '4px 8px',
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
                            onClick={() => openEditModal(u)}
                            title="Edit user"
                            style={{
                              padding: '4px 8px',
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
                            onClick={() => setDeleteTarget(u)}
                            title="Delete user"
                            style={{
                              padding: '4px 8px',
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
              loadUsers(nextPage, perPage);
            }}
            onPerPageChange={(nextPerPage) => {
              setPerPage(nextPerPage);
              setPage(1);
              loadUsers(1, nextPerPage);
            }}
          />
        </div>

        {/* User Detail Modal */}
        <AdminModal
          isOpen={Boolean(detailUser)}
          title={detailUser ? `User: ${detailUser.username}` : 'User Details'}
          subtitle={detailUser?.uuid}
          onClose={() => setDetailUser(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDetailUser(null)}
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
                Close
              </button>
              {detailUser && (
                <button
                  type="button"
                  onClick={() => {
                    const u = detailUser;
                    setDetailUser(null);
                    openEditModal(u);
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'var(--color-primary)',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Edit User
                </button>
              )}
            </>
          }
        >
          {detailUser && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div><span style={{ color: 'var(--color-text-muted)' }}>ID:</span> <strong>{detailUser.id}</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>External ID:</span> <code>{detailUser.external_id || '—'}</code></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Username:</span> <strong>{detailUser.username}</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Email:</span> {detailUser.email}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>First Name:</span> {detailUser.first_name}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Last Name:</span> {detailUser.last_name}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Language:</span> {detailUser.language}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Root Admin:</span> {detailUser.root_admin ? 'Yes' : 'No'}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>2FA:</span> {detailUser['2fa'] ? 'Enabled' : 'Disabled'}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Created:</span> {new Date(detailUser.created_at).toLocaleString()}</div>
            </div>
          )}
        </AdminModal>

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={Boolean(deleteTarget)}
          title="Delete User"
          message={
            deleteTarget
              ? `Are you sure you want to delete user "${deleteTarget.username}" (${deleteTarget.email})? This action cannot be undone and will fail if the user owns any servers.`
              : ''
          }
          confirmLabel="Delete User"
          isDestructive
          isLoading={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => !deleting && setDeleteTarget(null)}
        />
      </div>
      )}
    </AdminGuard>
  );
};
