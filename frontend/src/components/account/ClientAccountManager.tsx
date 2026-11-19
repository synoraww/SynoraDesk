import React, { useEffect, useState } from 'react';
import {
  User,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  Lock,
  Mail,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Trash2,
  Globe,
  Terminal,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Laptop,
  QrCode,
  Server,
} from 'lucide-react';
import { usePanelStore, Panel, Account } from '../../stores/panelStore';
import { useUIStore } from '../../stores/uiStore';
import { useI18n } from '../../i18n';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EmptyState } from '../common/EmptyState';
import { PanelFavicon } from '../common/PanelFavicon';
import { TwoFactorQRCode } from '../common/TwoFactorQRCode';
import {
  GetCurrentAccount,
  UpdateAccountEmail,
  UpdateAccountPassword,
  GetTwoFactorDetails,
  EnableTwoFactor,
  DisableTwoFactor,
  ListAccountAPIKeys,
  CreateAccountAPIKey,
  DeleteAccountAPIKey,
  ListAccountSSHKeys,
  CreateAccountSSHKey,
  RemoveAccountSSHKey,
  GetAccountActivity,
} from '../../../wailsjs/go/main/App';
import { api } from '../../../wailsjs/go/models';

export type AccountSubTab = 'profile' | 'apikeys' | 'sshkeys' | 'twoFactor' | 'activity';

interface ClientAccountManagerProps {
  activeSubTab: AccountSubTab;
  onOpenPanelModal: () => void;
  onSwitchToPanelsTab: () => void;
}

export const ClientAccountManager: React.FC<ClientAccountManagerProps> = ({
  activeSubTab,
  onOpenPanelModal,
  onSwitchToPanelsTab,
}) => {
  const { activePanel, panels, switchPanel, currentAccount, fetchCurrentAccount } = usePanelStore();
  const { addNotification } = useUIStore();
  const { t } = useI18n();

  const [account, setAccount] = useState<Account | null>(currentAccount);
  const [loadingAccount, setLoadingAccount] = useState(false);

  // Email update state
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [updatingEmail, setUpdatingEmail] = useState(false);

  // Password update state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // 2FA state
  const [twoFactorDetails, setTwoFactorDetails] = useState<api.TwoFactorDetails | null>(null);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [enabling2FA, setEnabling2FA] = useState(false);
  const [recoveryTokens, setRecoveryTokens] = useState<string[] | null>(null);
  const [isDisable2FAModalOpen, setIsDisable2FAModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disabling2FA, setDisabling2FA] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<api.AccountApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [isCreateKeyModalOpen, setIsCreateKeyModalOpen] = useState(false);
  const [keyDesc, setKeyDesc] = useState('');
  const [keyAllowedIps, setKeyAllowedIps] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<api.AccountApiKey | null>(null);
  const [keyToDelete, setKeyToDelete] = useState<api.AccountApiKey | null>(null);

  // SSH Keys state
  const [sshKeys, setSshKeys] = useState<api.AccountSSHKey[]>([]);
  const [loadingSsh, setLoadingSsh] = useState(false);
  const [isAddSshModalOpen, setIsAddSshModalOpen] = useState(false);
  const [sshName, setSshName] = useState('');
  const [sshPublicKey, setSshPublicKey] = useState('');
  const [addingSsh, setAddingSsh] = useState(false);
  const [sshToDelete, setSshToDelete] = useState<api.AccountSSHKey | null>(null);

  // Account Activity state
  const [activities, setActivities] = useState<api.AccountActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Copied state helper
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Load account info
  const loadAccountInfo = async () => {
    if (!activePanel || !activePanel.hasClientKey) return;
    setLoadingAccount(true);
    try {
      const acc = await GetCurrentAccount();
      if (acc) {
        setAccount(acc as unknown as Account);
        setNewEmail(acc.email || '');
      }
    } catch (err: any) {
      console.error('Failed to get account details:', err);
    } finally {
      setLoadingAccount(false);
    }
  };

  // Load API keys
  const loadApiKeys = async () => {
    if (!activePanel || !activePanel.hasClientKey) return;
    setLoadingKeys(true);
    try {
      const keys = await ListAccountAPIKeys();
      setApiKeys(keys || []);
    } catch (err: any) {
      console.error('Failed to list API keys:', err);
    } finally {
      setLoadingKeys(false);
    }
  };

  // Load SSH keys
  const loadSshKeys = async () => {
    if (!activePanel || !activePanel.hasClientKey) return;
    setLoadingSsh(true);
    try {
      const keys = await ListAccountSSHKeys();
      setSshKeys(keys || []);
    } catch (err: any) {
      console.error('Failed to list SSH keys:', err);
    } finally {
      setLoadingSsh(false);
    }
  };

  // Load activities
  const loadActivities = async () => {
    if (!activePanel || !activePanel.hasClientKey) return;
    setLoadingActivities(true);
    try {
      const logs = await GetAccountActivity();
      setActivities(logs || []);
    } catch (err: any) {
      console.error('Failed to get account activity:', err);
    } finally {
      setLoadingActivities(false);
    }
  };

  useEffect(() => {
    if (activePanel && activePanel.hasClientKey) {
      loadAccountInfo();
      loadApiKeys();
      loadSshKeys();
      loadActivities();
    }
  }, [activePanel?.id, activePanel?.hasClientKey]);

  // Handle Update Email
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !emailPassword) return;

    setUpdatingEmail(true);
    try {
      await UpdateAccountEmail(newEmail.trim(), emailPassword);
      addNotification({
        type: 'success',
        title: t('account.emailSection.title'),
        message: t('account.emailSection.success'),
      });
      setEmailPassword('');
      await loadAccountInfo();
      await fetchCurrentAccount();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('account.emailSection.title'),
        message: err.message || t('account.emailSection.error'),
      });
    } finally {
      setUpdatingEmail(false);
    }
  };

  // Handle Update Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;

    if (newPassword !== confirmPassword) {
      addNotification({
        type: 'error',
        title: t('account.passwordSection.title'),
        message: t('account.passwordSection.mismatch'),
      });
      return;
    }

    if (newPassword.length < 8) {
      addNotification({
        type: 'error',
        title: t('account.passwordSection.title'),
        message: t('account.passwordSection.minLen'),
      });
      return;
    }

    setUpdatingPassword(true);
    try {
      await UpdateAccountPassword(currentPassword, newPassword, confirmPassword);
      addNotification({
        type: 'success',
        title: t('account.passwordSection.title'),
        message: t('account.passwordSection.success'),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('account.passwordSection.title'),
        message: err.message || t('account.passwordSection.error'),
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Start 2FA Setup
  const handleStart2FASetup = async () => {
    try {
      const details = await GetTwoFactorDetails();
      setTwoFactorDetails(details);
      setTotpCode('');
      setRecoveryTokens(null);
      setIs2FAModalOpen(true);
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('account.twoFactor.title'),
        message: err.message || t('account.twoFactor.retrieveFailed'),
      });
    }
  };

  // Submit 2FA Verification
  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim()) return;

    setEnabling2FA(true);
    try {
      const tokens = await EnableTwoFactor(totpCode.trim());
      setRecoveryTokens(tokens || []);
      addNotification({
        type: 'success',
        title: t('account.twoFactor.title'),
        message: t('account.twoFactor.successEnable'),
      });
      await loadAccountInfo();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('account.twoFactor.title'),
        message: err.message || t('account.twoFactor.invalidCode'),
      });
    } finally {
      setEnabling2FA(false);
    }
  };

  // Submit Disable 2FA
  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword) return;

    setDisabling2FA(true);
    try {
      await DisableTwoFactor(disablePassword);
      addNotification({
        type: 'success',
        title: t('account.twoFactor.title'),
        message: t('account.twoFactor.successDisable'),
      });
      setIsDisable2FAModalOpen(false);
      setDisablePassword('');
      await loadAccountInfo();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('account.twoFactor.title'),
        message: err.message || t('account.twoFactor.disableFailed'),
      });
    } finally {
      setDisabling2FA(false);
    }
  };

  // Create API Key
  const handleCreateAPIKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyDesc.trim()) return;

    setCreatingKey(true);
    try {
      const ips = keyAllowedIps
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const created = await CreateAccountAPIKey(keyDesc.trim(), ips);
      setIsCreateKeyModalOpen(false);
      setKeyDesc('');
      setKeyAllowedIps('');
      setNewlyCreatedKey(created);
      addNotification({
        type: 'success',
        title: t('account.apiKeys.title'),
        message: t('account.apiKeys.createSuccess'),
      });
      await loadApiKeys();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('account.apiKeys.title'),
        message: err.message || t('account.apiKeys.createFailed'),
      });
    } finally {
      setCreatingKey(false);
    }
  };

  // Delete API Key
  const handleDeleteAPIKey = async () => {
    if (!keyToDelete) return;
    try {
      await DeleteAccountAPIKey(keyToDelete.identifier);
      addNotification({
        type: 'success',
        title: t('account.apiKeys.title'),
        message: t('account.apiKeys.deleteSuccess'),
      });
      setKeyToDelete(null);
      await loadApiKeys();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('account.apiKeys.title'),
        message: err.message || t('account.apiKeys.deleteFailed'),
      });
    }
  };

  // Add SSH Key
  const handleAddSSHKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sshName.trim() || !sshPublicKey.trim()) return;

    setAddingSsh(true);
    try {
      await CreateAccountSSHKey(sshName.trim(), sshPublicKey.trim());
      addNotification({
        type: 'success',
        title: t('account.sshKeys.title'),
        message: t('account.sshKeys.addSuccess'),
      });
      setIsAddSshModalOpen(false);
      setSshName('');
      setSshPublicKey('');
      await loadSshKeys();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('account.sshKeys.title'),
        message: err.message || t('account.sshKeys.addFailed'),
      });
    } finally {
      setAddingSsh(false);
    }
  };

  // Delete SSH Key
  const handleDeleteSSHKey = async () => {
    if (!sshToDelete) return;
    try {
      await RemoveAccountSSHKey(sshToDelete.fingerprint);
      addNotification({
        type: 'success',
        title: t('account.sshKeys.title'),
        message: t('account.sshKeys.deleteSuccess'),
      });
      setSshToDelete(null);
      await loadSshKeys();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('account.sshKeys.title'),
        message: err.message || t('account.sshKeys.removeFailed'),
      });
    }
  };

  // If no active panel
  if (!activePanel) {
    return (
      <EmptyState
        icon={Server}
        title={t('account.noPanelTitle')}
        description={t('account.noPanelDesc')}
        action={{
          label: t('account.switchPanel'),
          onClick: onSwitchToPanelsTab,
        }}
      />
    );
  }

  // If active panel has no client key configured
  if (!activePanel.hasClientKey) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '10px',
          padding: '32px 24px',
          textAlign: 'center',
          maxWidth: '560px',
          margin: '40px auto',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            borderRadius: '20px',
            background: 'var(--color-surface-hover)',
            marginBottom: '16px',
            border: '1px solid var(--color-border)',
          }}
        >
          <PanelFavicon url={activePanel.url} name={activePanel.name} size={16} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{activePanel.name}</span>
        </div>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: 'rgba(234, 179, 8, 0.12)',
            color: 'var(--color-warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
          }}
        >
          <Key size={24} />
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>
          {t('account.noClientKeyTitle')}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.6', marginBottom: '20px' }}>
          {t('account.noClientKeyDesc', { name: activePanel.name })}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={onOpenPanelModal}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-primary)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t('account.editPanel')}
          </button>
          <button
            onClick={onSwitchToPanelsTab}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t('account.switchPanel')}
          </button>
        </div>
      </div>
    );
  }

  const is2FA = Boolean(account?.['2fa'] || account?.['2fa_enabled']);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Account Overview Header Card */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '12px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary-light)',
              fontSize: '22px',
              fontWeight: 700,
            }}
          >
            {account?.username ? account.username.slice(0, 2).toUpperCase() : <User size={26} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                {account?.first_name || account?.last_name
                  ? `${account?.first_name || ''} ${account?.last_name || ''}`.trim()
                  : account?.username || t('account.clientUser')}
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: account?.admin ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-surface-hover)',
                  color: account?.admin ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
                  border: `1px solid ${account?.admin ? 'rgba(99, 102, 241, 0.3)' : 'var(--color-border)'}`,
                }}
              >
                {account?.admin ? t('account.profileInfo.admin') : t('account.profileInfo.standardUser')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Mail size={13} /> {account?.email || t('common.noEmailConfigured')}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PanelFavicon url={activePanel.url} name={activePanel.name} size={15} />
                <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{activePanel.name}</span>
                <span>({activePanel.url.replace(/^https?:\/\//, '')})</span>
              </span>
              <span
                style={{
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: is2FA ? 'var(--color-success)' : 'var(--color-warning)',
                  fontWeight: 500,
                }}
              >
                {is2FA ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                {is2FA ? t('account.profileInfo.twoFactorEnabled') : t('account.profileInfo.twoFactorDisabled')}
              </span>
            </div>
          </div>
        </div>

        {/* Panel Switcher Fast Dropdown */}
        {panels.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t('layout.panelLabel')}</span>
            <select
              value={activePanel.id}
              onChange={(e) => switchPanel(e.target.value)}
              style={{
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: 'var(--color-text)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {panels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.hasClientKey ? '' : '(No Client Key)'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB CONTENT 1: PROFILE & SECURITY */}
      {activeSubTab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Full Account Details Grid */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '20px',
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
                {t('account.profileInfo.title')}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {t('account.profileInfo.desc')}
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px',
              }}
            >
              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('account.profileInfo.userId')}
                </span>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginTop: '4px' }}>
                  #{account?.id || '--'}
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('account.profileInfo.username')}
                </span>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginTop: '4px' }}>
                  @{account?.username || '--'}
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('account.profileInfo.fullName')}
                </span>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginTop: '4px' }}>
                  {account?.first_name || account?.last_name
                    ? `${account?.first_name || ''} ${account?.last_name || ''}`.trim()
                    : '--'}
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('account.profileInfo.email')}
                </span>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginTop: '4px' }}>
                  {account?.email || '--'}
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('account.profileInfo.role')}
                </span>
                <div style={{ fontSize: '14px', fontWeight: 600, color: account?.admin ? 'var(--color-primary-light)' : 'var(--color-text)', marginTop: '4px' }}>
                  {account?.admin ? t('account.profileInfo.admin') : t('account.profileInfo.standardUser')}
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('account.profileInfo.language')}
                </span>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginTop: '4px' }}>
                  {account?.language ? account.language.toUpperCase() : 'EN'}
                </div>
              </div>
            </div>
          </div>

          {/* Forms Grid: Update Email & Update Password */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {/* Update Email Form */}
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
                  {t('account.emailSection.title')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {t('account.emailSection.desc')}
                </p>
              </div>

              <form onSubmit={handleUpdateEmail} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    {t('account.emailSection.newEmail')}
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    {t('account.emailSection.currentPassword')}
                  </label>
                  <input
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={updatingEmail || !newEmail.trim() || !emailPassword}
                  style={{
                    marginTop: '6px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: updatingEmail || !newEmail.trim() || !emailPassword ? 'not-allowed' : 'pointer',
                    opacity: updatingEmail || !newEmail.trim() || !emailPassword ? 0.6 : 1,
                  }}
                >
                  {updatingEmail ? t('common.updating') : t('account.emailSection.submit')}
                </button>
              </form>
            </div>

            {/* Update Password Form */}
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
                  {t('account.passwordSection.title')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {t('account.passwordSection.desc')}
                </p>
              </div>

              <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    {t('account.passwordSection.currentPassword')}
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                      {t('account.passwordSection.newPassword')}
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-surface-hover)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                      {t('account.passwordSection.confirmPassword')}
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-surface-hover)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={updatingPassword || !currentPassword || !newPassword}
                  style={{
                    marginTop: '6px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: updatingPassword || !currentPassword || !newPassword ? 'not-allowed' : 'pointer',
                    opacity: updatingPassword || !currentPassword || !newPassword ? 0.6 : 1,
                  }}
                >
                  {updatingPassword ? t('common.updating') : t('account.passwordSection.submit')}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: API KEYS */}
      {activeSubTab === 'apikeys' && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
                {t('account.apiKeys.title')}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {t('account.apiKeys.desc')}
              </p>
            </div>

            <button
              onClick={() => setIsCreateKeyModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-primary)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              {t('account.apiKeys.createBtn')}
            </button>
          </div>

          {loadingKeys ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              Loading API keys...
            </div>
          ) : apiKeys.length === 0 ? (
            <EmptyState
              icon={Key}
              title={t('account.apiKeys.emptyTitle')}
              description={t('account.apiKeys.emptyDesc')}
              action={{
                label: t('account.apiKeys.createBtn'),
                onClick: () => setIsCreateKeyModalOpen(true),
              }}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px' }}>{t('account.apiKeys.description')}</th>
                    <th style={{ padding: '10px 12px' }}>{t('account.apiKeys.identifier')}</th>
                    <th style={{ padding: '10px 12px' }}>{t('account.apiKeys.allowedIps')}</th>
                    <th style={{ padding: '10px 12px' }}>{t('account.apiKeys.lastUsed')}</th>
                    <th style={{ padding: '10px 12px' }}>{t('account.apiKeys.createdAt')}</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((k) => (
                    <tr
                      key={k.identifier}
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px', fontWeight: 500, color: 'var(--color-text)' }}>
                        {k.description || 'API Key'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <code style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--color-surface-hover)', fontFamily: 'var(--font-mono)' }}>
                          {k.identifier}
                        </code>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                        {k.allowed_ips && k.allowed_ips.length > 0 ? k.allowed_ips.join(', ') : t('account.apiKeys.anyIp')}
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                        {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : t('account.apiKeys.neverUsed')}
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                        {k.created_at ? new Date(k.created_at).toLocaleDateString() : '--'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button
                          onClick={() => setKeyToDelete(k)}
                          title={t('account.apiKeys.deleteBtn')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-error)',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: SSH KEYS */}
      {activeSubTab === 'sshkeys' && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
                {t('account.sshKeys.title')}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {t('account.sshKeys.desc')}
              </p>
            </div>

            <button
              onClick={() => setIsAddSshModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-primary)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              {t('account.sshKeys.addBtn')}
            </button>
          </div>

          {loadingSsh ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              Loading SSH keys...
            </div>
          ) : sshKeys.length === 0 ? (
            <EmptyState
              icon={Terminal}
              title={t('account.sshKeys.emptyTitle')}
              description={t('account.sshKeys.emptyDesc')}
              action={{
                label: t('account.sshKeys.addBtn'),
                onClick: () => setIsAddSshModalOpen(true),
              }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sshKeys.map((s) => (
                <div
                  key={s.fingerprint}
                  style={{
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(99, 102, 241, 0.12)',
                        color: 'var(--color-primary-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Laptop size={18} />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                          {s.name}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          • Added {s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--color-text-muted)',
                          fontFamily: 'var(--font-mono)',
                          marginTop: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.fingerprint}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSshToDelete(s)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-error)',
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '6px',
                      flexShrink: 0,
                    }}
                    title={t('account.sshKeys.deleteBtn')}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 4: 2FA SECURITY */}
      {activeSubTab === 'twoFactor' && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ maxWidth: '600px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Shield size={20} color={is2FA ? 'var(--color-success)' : 'var(--color-warning)'} />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
                  {t('account.twoFactor.title')}
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
                {t('account.twoFactor.desc')}
              </p>

              <div
                style={{
                  marginTop: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: is2FA ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                  border: `1px solid ${is2FA ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: is2FA ? 'var(--color-success)' : 'var(--color-warning)',
                }}
              >
                {is2FA ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                {is2FA ? t('account.twoFactor.enabled') : t('account.twoFactor.disabled')}
              </div>
            </div>

            <div>
              {is2FA ? (
                <button
                  onClick={() => setIsDisable2FAModalOpen(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--color-error)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {t('account.twoFactor.disableBtn')}
                </button>
              ) : (
                <button
                  onClick={handleStart2FASetup}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <QrCode size={15} />
                  {t('account.twoFactor.enableBtn')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: ACCOUNT ACTIVITY */}
      {activeSubTab === 'activity' && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
                {t('account.activity.title')}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {t('account.activity.desc')}
              </p>
            </div>

            <button
              onClick={loadActivities}
              disabled={loadingActivities}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: loadingActivities ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={13} className={loadingActivities ? 'spin' : ''} />
              {t('account.activity.refresh')}
            </button>
          </div>

          {loadingActivities ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              Loading activities...
            </div>
          ) : activities.length === 0 ? (
            <EmptyState
              icon={Activity}
              title={t('account.activity.emptyTitle')}
              description={t('account.activity.emptyDesc')}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px' }}>{t('account.activity.event')}</th>
                    <th style={{ padding: '10px 12px' }}>{t('account.activity.source')}</th>
                    <th style={{ padding: '10px 12px' }}>{t('account.activity.ip')}</th>
                    <th style={{ padding: '10px 12px' }}>{t('account.activity.time')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((act) => (
                    <tr
                      key={act.id}
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px', fontWeight: 500, color: 'var(--color-text)' }}>
                        <code style={{ fontSize: '11px', color: 'var(--color-primary-light)' }}>{act.event}</code>
                        {act.description && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            {act.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: act.is_api ? 'rgba(99, 102, 241, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                            color: act.is_api ? 'var(--color-primary-light)' : 'var(--color-success)',
                          }}
                        >
                          {act.is_api ? t('account.activity.sourceApi') : t('account.activity.sourceWeb')}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                        {act.ip || '--'}
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>
                        {act.timestamp ? new Date(act.timestamp).toLocaleString() : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: 2FA SETUP MODAL */}
      {is2FAModalOpen && twoFactorDetails && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            {recoveryTokens ? (
              // Display Recovery Tokens upon success
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: 'var(--color-success)' }}>
                  <CheckCircle2 size={24} />
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text)' }}>
                    {t('account.twoFactor.backupTokensTitle')}
                  </h3>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5', marginBottom: '16px' }}>
                  {t('account.twoFactor.backupTokensDesc')}
                </p>

                <div
                  style={{
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    marginBottom: '16px',
                  }}
                >
                  {recoveryTokens.map((tok, idx) => (
                    <div key={idx} style={{ color: 'var(--color-text)', letterSpacing: '0.05em' }}>
                      {tok}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => handleCopy(recoveryTokens.join('\n'), 'tokens')}
                    style={{
                      flex: 1,
                      padding: '8px 14px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {copiedField === 'tokens' ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                    {copiedField === 'tokens' ? t('common.copied') : t('account.twoFactor.copyTokens')}
                  </button>
                  <button
                    onClick={() => {
                      setIs2FAModalOpen(false);
                      setRecoveryTokens(null);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-primary)',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {t('account.twoFactor.doneBtn')}
                  </button>
                </div>
              </div>
            ) : (
              // Setup Flow: QR Code + Secret + Verify Code
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '6px' }}>
                  {t('account.twoFactor.modalTitle')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                  {t('account.twoFactor.modalDesc')}
                </p>

                {/* QR Code Container */}
                <TwoFactorQRCode
                  imageUrlData={twoFactorDetails.image_url_data}
                  secret={twoFactorDetails.secret}
                  accountEmail={account?.email}
                  accountUsername={account?.username}
                  panelName={activePanel?.name}
                  size={160}
                />

                {/* Manual Secret Key */}
                {twoFactorDetails.secret && (
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                      {t('account.twoFactor.secretKey')}:
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-surface-hover)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <code style={{ fontSize: '12px', color: 'var(--color-text)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                        {twoFactorDetails.secret}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(twoFactorDetails.secret, 'secret')}
                        style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '2px' }}
                      >
                        {copiedField === 'secret' ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Verification Form */}
                <form onSubmit={handleVerify2FA}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                      {t('account.twoFactor.scanPrompt')}
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      autoFocus
                      required
                      style={{
                        width: '100%',
                        padding: '10px',
                        textAlign: 'center',
                        letterSpacing: '0.25em',
                        fontSize: '18px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-surface-hover)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setIs2FAModalOpen(false)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-surface-hover)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={enabling2FA || totpCode.length < 6}
                      style={{
                        padding: '7px 16px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-primary)',
                        border: 'none',
                        color: '#FFFFFF',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: enabling2FA || totpCode.length < 6 ? 'not-allowed' : 'pointer',
                        opacity: enabling2FA || totpCode.length < 6 ? 0.6 : 1,
                      }}
                    >
                      {enabling2FA ? 'Verifying...' : t('account.twoFactor.verifyBtn')}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: DISABLE 2FA MODAL */}
      {isDisable2FAModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>
              {t('account.twoFactor.disableTitle')}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5', marginBottom: '16px' }}>
              {t('account.twoFactor.disableDesc')}
            </p>

            <form onSubmit={handleDisable2FA}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  {t('account.emailSection.currentPassword')}
                </label>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsDisable2FAModalOpen(false);
                    setDisablePassword('');
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={disabling2FA || !disablePassword}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-error)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: disabling2FA || !disablePassword ? 'not-allowed' : 'pointer',
                    opacity: disabling2FA || !disablePassword ? 0.6 : 1,
                  }}
                >
                  {disabling2FA ? 'Disabling...' : t('account.twoFactor.disableConfirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE API KEY MODAL */}
      {isCreateKeyModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '6px' }}>
              {t('account.apiKeys.createModalTitle')}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '18px' }}>
              {t('account.apiKeys.createModalDesc')}
            </p>

            <form onSubmit={handleCreateAPIKey}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  {t('account.apiKeys.descLabel')} *
                </label>
                <input
                  type="text"
                  value={keyDesc}
                  onChange={(e) => setKeyDesc(e.target.value)}
                  placeholder={t('account.apiKeys.descPlaceholder')}
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  {t('account.apiKeys.ipsLabel')}
                </label>
                <textarea
                  rows={3}
                  value={keyAllowedIps}
                  onChange={(e) => setKeyAllowedIps(e.target.value)}
                  placeholder={t('account.apiKeys.ipsPlaceholder')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    fontFamily: 'var(--font-mono)',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateKeyModalOpen(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creatingKey || !keyDesc.trim()}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: creatingKey || !keyDesc.trim() ? 'not-allowed' : 'pointer',
                    opacity: creatingKey || !keyDesc.trim() ? 0.6 : 1,
                  }}
                >
                  {creatingKey ? 'Creating...' : t('account.apiKeys.createSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: NEWLY CREATED SECRET TOKEN DIALOG */}
      {newlyCreatedKey && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: 'var(--color-success)' }}>
              <CheckCircle2 size={24} />
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text)' }}>
                {t('account.apiKeys.createdTitle')}
              </h3>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '12px',
                color: 'var(--color-warning)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{t('account.apiKeys.createdWarning')}</span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>
                {t('account.apiKeys.secretLabel')}:
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <code
                  style={{
                    flex: 1,
                    fontSize: '12px',
                    color: 'var(--color-primary-light)',
                    fontFamily: 'var(--font-mono)',
                    wordBreak: 'break-all',
                  }}
                >
                  {newlyCreatedKey.secret_token || newlyCreatedKey.identifier}
                </code>
                <button
                  onClick={() => handleCopy(newlyCreatedKey.secret_token || newlyCreatedKey.identifier, 'new_secret')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                  }}
                >
                  {copiedField === 'new_secret' ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setNewlyCreatedKey(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-primary)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ADD SSH KEY MODAL */}
      {isAddSshModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '6px' }}>
              {t('account.sshKeys.addModalTitle')}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '18px' }}>
              {t('account.sshKeys.addModalDesc')}
            </p>

            <form onSubmit={handleAddSSHKey}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  {t('account.sshKeys.nameLabel')} *
                </label>
                <input
                  type="text"
                  value={sshName}
                  onChange={(e) => setSshName(e.target.value)}
                  placeholder={t('account.sshKeys.namePlaceholder')}
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  {t('account.sshKeys.keyLabel')} *
                </label>
                <textarea
                  rows={4}
                  value={sshPublicKey}
                  onChange={(e) => setSshPublicKey(e.target.value)}
                  placeholder={t('account.sshKeys.keyPlaceholder')}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                    fontFamily: 'var(--font-mono)',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddSshModalOpen(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={addingSsh || !sshName.trim() || !sshPublicKey.trim()}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: addingSsh || !sshName.trim() || !sshPublicKey.trim() ? 'not-allowed' : 'pointer',
                    opacity: addingSsh || !sshName.trim() || !sshPublicKey.trim() ? 0.6 : 1,
                  }}
                >
                  {addingSsh ? 'Adding...' : t('account.sshKeys.addSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION: DELETE API KEY */}
      <ConfirmDialog
        isOpen={keyToDelete !== null}
        title={t('account.apiKeys.deleteConfirmTitle')}
        message={t('account.apiKeys.deleteConfirmMsg', { id: keyToDelete?.identifier || '' })}
        confirmLabel={t('account.apiKeys.deleteBtn')}
        isDestructive={true}
        onConfirm={handleDeleteAPIKey}
        onCancel={() => setKeyToDelete(null)}
      />

      {/* CONFIRMATION: DELETE SSH KEY */}
      <ConfirmDialog
        isOpen={sshToDelete !== null}
        title={t('account.sshKeys.deleteConfirmTitle')}
        message={t('account.sshKeys.deleteConfirmMsg', { name: sshToDelete?.name || '' })}
        confirmLabel={t('account.sshKeys.deleteBtn')}
        isDestructive={true}
        onConfirm={handleDeleteSSHKey}
        onCancel={() => setSshToDelete(null)}
      />
    </div>
  );
};
