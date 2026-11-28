import React, { useState } from 'react';
import { ArrowLeft, User, KeyRound, ShieldCheck, Trash2, Save, UserPlus } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useUIStore } from '../../stores/uiStore';
import { useI18n } from '../../i18n';
import { adminCreateUser, adminDeleteUser, adminUpdateUser, parseBackendError } from '../../services/adminApi';
import { AdminUser } from '../../types/admin';

interface AdminUserEditorProps {
  user: AdminUser | null; // null = Create mode, non-null = Edit mode
  onBack: () => void;
  onNavigateOverview: () => void;
  onSaved: () => void;
}

export const AdminUserEditor: React.FC<AdminUserEditorProps> = ({
  user,
  onBack,
  onNavigateOverview,
  onSaved,
}) => {
  const { addNotification } = useUIStore();
  const { t } = useI18n();
  const isEdit = Boolean(user);

  const [email, setEmail] = useState(user?.email || '');
  const [username, setUsername] = useState(user?.username || '');
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [language, setLanguage] = useState(user?.language || 'en');
  const [externalId, setExternalId] = useState(user?.external_id || '');
  const [password, setPassword] = useState('');
  const [rootAdmin, setRootAdmin] = useState<boolean>(Boolean(user?.root_admin));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!username.trim() || !firstName.trim() || !lastName.trim()) {
      setError('Username, First Name, and Last Name are required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        email: email.trim(),
        username: username.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        language: language.trim() || 'en',
        root_admin: rootAdmin,
      };
      if (password.trim()) payload.password = password;
      if (externalId.trim()) payload.external_id = externalId.trim();

      if (user) {
        await adminUpdateUser(user.id, payload);
        addNotification({ type: 'success', title: 'User Updated', message: `Updated user "${payload.username}".` });
      } else {
        await adminCreateUser(payload);
        addNotification({ type: 'success', title: 'User Created', message: `Created user "${payload.username}".` });
      }
      onSaved();
    } catch (err) {
      const parsed = parseBackendError(err);
      setError(parsed.permissionHint ? `${parsed.message} — ${parsed.permissionHint}` : parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await adminDeleteUser(user.id);
      addNotification({ type: 'success', title: 'User Deleted', message: `Deleted user "${user.username}".` });
      setDeleteConfirmOpen(false);
      onSaved();
    } catch (err) {
      const parsed = parseBackendError(err);
      addNotification({ type: 'error', title: 'Delete User Failed', message: parsed.permissionHint || parsed.message });
    } finally {
      setDeleting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '36px',
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
    marginBottom: '6px',
  };

  const hintStyle: React.CSSProperties = {
    margin: '4px 0 0',
    fontSize: '11.5px',
    color: 'var(--color-text-muted)',
    lineHeight: 1.4,
  };

  return (
    <div style={{ width: '100%', padding: '20px 24px', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box' }}>
      <AdminPageHeader
        title={user ? `${user.first_name} ${user.last_name}` : t('admin.createUser')}
        subtitle={user ? user.username : t('admin.createUserSubtitle')}
        icon={user ? User : UserPlus}
        breadcrumbs={[
          { label: t('admin.title'), onClick: onNavigateOverview },
          { label: t('admin.users'), onClick: onBack },
          { label: user ? user.username : t('admin.createNew') },
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
            <ArrowLeft size={13} /> {t('admin.backToUsers')}
          </button>
        }
      />

      {error && (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '4px',
            border: '1px solid var(--color-error)',
            backgroundColor: 'var(--color-error-bg)',
            color: 'var(--color-error)',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(300px, 1fr)', gap: '16px', alignItems: 'start' }}>
          {/* Left Box: Identity */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderTop: '2px solid var(--color-primary)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={15} color="var(--color-primary-light)" />
              <span>{t('admin.identity')}</span>
            </div>
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>{t('admin.email')}</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t('admin.username')}</label>
                <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t('admin.firstName')}</label>
                <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t('admin.lastName')}</label>
                <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t('admin.defaultLanguage')}</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} style={inputStyle}>
                  <option value="en">English</option>
                  <option value="vi">Tiếng Việt</option>
                </select>
                <p style={hintStyle}>{t('admin.defaultLanguageHint')}</p>
              </div>
              <div>
                <label style={labelStyle}>{t('admin.externalId')} ({t('admin.optional')})</label>
                <input type="text" value={externalId} onChange={(e) => setExternalId(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div
              style={{
                padding: '10px 14px',
                borderTop: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface-elevated)',
              }}
            >
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: 'var(--color-primary)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                <Save size={14} />
                {saving ? t('admin.saving') : isEdit ? t('admin.updateUser') : t('admin.createUser')}
              </button>
            </div>
          </div>

          {/* Right Column: Password + Permissions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderTop: '2px solid var(--color-primary)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={15} color="var(--color-primary-light)" />
                <span>{t('admin.password')}</span>
              </div>
              <div style={{ padding: '14px' }}>
                <label style={labelStyle}>
                  {t('admin.password')} <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--color-text-muted)' }}>{t('admin.optional')}</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                />
                <p style={hintStyle}>
                  {isEdit ? t('admin.passwordEditHint') : t('admin.passwordCreateHint')}
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderTop: '2px solid var(--color-primary)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={15} color="var(--color-warning)" />
                <span>{t('admin.permissions')}</span>
              </div>
              <div style={{ padding: '14px' }}>
                <label style={labelStyle}>{t('admin.administrator')}</label>
                <select
                  value={rootAdmin ? '1' : '0'}
                  onChange={(e) => setRootAdmin(e.target.value === '1')}
                  style={inputStyle}
                >
                  <option value="0">{t('admin.no')}</option>
                  <option value="1">{t('admin.yes')}</option>
                </select>
                <p style={hintStyle}>{t('admin.adminPermHint')}</p>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Bottom Box: Delete User (Edit mode only) */}
      {user && (
        <div
          style={{
            marginTop: '18px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderTop: '2px solid var(--color-error)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trash2 size={15} color="var(--color-error)" />
            <span>{t('admin.deleteUser')}</span>
          </div>
          <div style={{ padding: '14px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {t('admin.deleteUserWarn')}
          </div>
          <div
            style={{
              padding: '10px 14px',
              borderTop: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface-elevated)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              style={{
                padding: '7px 14px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: 'var(--color-error)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {t('admin.deleteUser')}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title={t('admin.deleteUser')}
        message={
          user
            ? t('admin.deleteUserConfirm', { username: user.username, email: user.email })
            : ''
        }
        confirmLabel={t('admin.deleteUser')}
        isDestructive
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteConfirmOpen(false)}
      />
    </div>
  );
};
