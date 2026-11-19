import React, { useState } from 'react';
import {
  Server,
  Plus,
  Trash2,
  Edit2,
  Radio,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Key,
  Globe,
  Activity,
  Layers,
  User,
  Terminal,
} from 'lucide-react';
import { usePanelStore, Panel, PanelInput } from '../stores/panelStore';
import { useUIStore } from '../stores/uiStore';
import { useI18n } from '../i18n';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { PanelFavicon } from '../components/common/PanelFavicon';
import { ClientAccountManager, AccountSubTab } from '../components/account/ClientAccountManager';

interface PanelModalProps {
  isOpen: boolean;
  panelToEdit?: Panel | null;
  onClose: () => void;
  onSaved: () => void;
}

export const PanelModal: React.FC<PanelModalProps> = ({
  isOpen,
  panelToEdit,
  onClose,
  onSaved,
}) => {
  const { addPanel, updatePanel } = usePanelStore();
  const { addNotification } = useUIStore();
  const { t } = useI18n();

  const [name, setName] = useState(panelToEdit?.name || '');
  const [url, setUrl] = useState(panelToEdit?.url || '');
  const [clientKey, setClientKey] = useState('');
  const [appKey, setAppKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (panelToEdit) {
      setName(panelToEdit.name);
      setUrl(panelToEdit.url);
      setClientKey('');
      setAppKey('');
    } else {
      setName('');
      setUrl('');
      setClientKey('');
      setAppKey('');
    }
    setError(null);
  }, [panelToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      setError(t('account.requiredNameUrl'));
      return;
    }

    setLoading(true);
    setError(null);

    const input: PanelInput = {
      name: name.trim(),
      url: url.trim(),
      clientApiKey: clientKey.trim() || undefined,
      appApiKey: appKey.trim() || undefined,
    };

    try {
      if (panelToEdit) {
        await updatePanel(panelToEdit.id, input);
        addNotification({
          type: 'success',
          title: t('account.editAccount'),
          message: `${name}: ${t('account.editAccount')}`,
        });
      } else {
        await addPanel(input);
        addNotification({
          type: 'success',
          title: t('account.addAccount'),
          message: `${name}: ${t('account.addAccount')}`,
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || t('account.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PanelFavicon url={panelToEdit?.url} name={panelToEdit?.name} size={18} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
              {panelToEdit ? t('account.editAccount') : t('account.addAccount')}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {error && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--color-error)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Panel Name */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                {t('account.accountNameLabel')} <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('account.accountNamePlaceholder')}
                required
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Panel URL */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                {t('account.panelUrlLabel')} <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('account.panelUrlPlaceholder')}
                required
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>
                {t('account.panelUrlHelp')}
              </span>
            </div>

            {/* Client API Key */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  Client API Key (User API)
                </label>
                {panelToEdit?.hasClientKey && (
                  <span style={{ fontSize: '11px', color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
                    Saved: {panelToEdit.maskedClientKey}
                  </span>
                )}
              </div>
              <input
                type="password"
                value={clientKey}
                onChange={(e) => setClientKey(e.target.value)}
                placeholder={panelToEdit?.hasClientKey ? t('account.keepExistingKey') : 'ptlc_...'}
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>
                From Account → API Credentials. Used for managing servers, files, console, databases.
              </span>
            </div>

            {/* Application API Key */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  Application API Key (Admin API)
                </label>
                {panelToEdit?.hasAppKey && (
                  <span style={{ fontSize: '11px', color: 'var(--color-primary-light)', fontFamily: 'var(--font-mono)' }}>
                    Saved: {panelToEdit.maskedAppKey}
                  </span>
                )}
              </div>
              <input
                type="password"
                value={appKey}
                onChange={(e) => setAppKey(e.target.value)}
                placeholder={panelToEdit?.hasAppKey ? t('account.keepExistingKey') : 'ptla_...'}
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>
                Optional. From Admin → Application API. Used for nodes, nests, allocations, server creation.
              </span>
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-primary-muted)',
                border: '1px solid var(--color-primary-glow)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                color: 'var(--color-text-secondary)',
              }}
            >
              <Shield size={14} color="var(--color-primary-light)" style={{ flexShrink: 0 }} />
              <span>{t('account.encryptedKeys')}</span>
            </div>
          </div>

          <div
            style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                fontSize: '13px',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '7px 16px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-primary)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? t('common.loading') : panelToEdit ? t('common.save') : t('account.addAccount')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export type AccountManagerTab = 'profile' | 'apikeys' | 'sshkeys' | 'twoFactor' | 'activity' | 'panels';

export const PanelManager: React.FC<{ onOpenModal: () => void }> = ({ onOpenModal }) => {
  const { panels, activePanel, panelAccounts, switchPanel, deletePanel, testConnection } = usePanelStore();
  const { addNotification } = useUIStore();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<AccountManagerTab>(activePanel?.hasClientKey ? 'profile' : 'panels');
  const [panelToEdit, setPanelToEdit] = useState<Panel | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [panelToDelete, setPanelToDelete] = useState<Panel | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await testConnection(id);
      setTestResults((prev) => ({ ...prev, [id]: res }));
      if (res.clientApi || res.appApi) {
        addNotification({
          type: 'success',
          title: t('account.testConnection'),
          message: res.accountName
            ? `OK (${res.accountName})`
            : 'API connection verified successfully.',
        });
      } else {
        addNotification({
          type: 'error',
          title: t('account.testConnection'),
          message: res.clientError || res.appError || t('account.testFailed'),
        });
      }
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('account.testConnection'),
        message: err.message || t('account.testError'),
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async () => {
    if (!panelToDelete) return;
    try {
      await deletePanel(panelToDelete.id);
      addNotification({
        type: 'success',
        title: t('account.deleteAccount'),
        message: `${panelToDelete.name}: ${t('account.deleteAccount')}`,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('account.deleteAccount'),
        message: err.message || t('account.deleteFailed'),
      });
    } finally {
      setPanelToDelete(null);
    }
  };

  return (
    <div style={{ width: '100%', padding: '24px 28px', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            {t('account.title')}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {t('account.subtitle')}
          </p>
        </div>

        <button
          onClick={() => {
            setPanelToEdit(null);
            setModalOpen(true);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '6px',
            backgroundColor: 'var(--color-primary)',
            border: 'none',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Plus size={15} />
          {t('account.addAccount')}
        </button>
      </div>

      {/* Unified Tab Navigation: Profile, API Keys, SSH Keys, 2FA, Activity, Accounts List */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          backgroundColor: 'var(--color-surface)',
          padding: '4px',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
          width: 'fit-content',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        {[
          { id: 'profile' as const, label: t('account.tabs.profile'), icon: User },
          { id: 'apikeys' as const, label: t('account.tabs.apikeys'), icon: Key },
          { id: 'sshkeys' as const, label: t('account.tabs.sshkeys'), icon: Terminal },
          { id: 'twoFactor' as const, label: t('account.tabs.twoFactor'), icon: Shield },
          { id: 'activity' as const, label: t('account.tabs.activity'), icon: Activity },
          { id: 'panels' as const, label: t('account.tabs.panels'), icon: Server, badge: panels.length },
        ].map((tabItem) => {
          const isSelected = activeTab === tabItem.id;
          const TabIcon = tabItem.icon;
          return (
            <button
              key={tabItem.id}
              onClick={() => setActiveTab(tabItem.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '13px',
                fontWeight: isSelected ? 600 : 500,
                cursor: 'pointer',
                backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                color: isSelected ? '#FFFFFF' : 'var(--color-text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              <TabIcon size={14} />
              {tabItem.label}
              {tabItem.badge !== undefined && tabItem.badge > 0 && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-surface-hover)',
                    color: isSelected ? '#FFFFFF' : 'var(--color-text-muted)',
                  }}
                >
                  {tabItem.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab !== 'panels' ? (
        <ClientAccountManager
          activeSubTab={activeTab}
          onOpenPanelModal={() => {
            setPanelToEdit(activePanel);
            setModalOpen(true);
          }}
          onSwitchToPanelsTab={() => setActiveTab('panels')}
        />
      ) : panels.length === 0 ? (
        <EmptyState
          icon={Server}
          title={t('account.noPanelTitle')}
          description={t('account.noPanelDesc')}
          action={{
            label: t('account.addAccount'),
            onClick: () => {
              setPanelToEdit(null);
              setModalOpen(true);
            },
          }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
          {panels.map((p) => {
            const isActive = p.id === activePanel?.id;
            const isTesting = testingId === p.id;
            const result = testResults[p.id];

            return (
              <div
                key={p.id}
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: '10px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  position: 'relative',
                  boxShadow: isActive ? '0 0 0 1px var(--color-primary)' : 'none',
                }}
              >
                {/* Panel Card Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: isActive ? 'var(--color-primary-muted)' : 'var(--color-surface-hover)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isActive ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
                      }}
                    >
                      <PanelFavicon url={p.url} name={p.name} size={22} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
                          {p.name}
                        </h3>
                        {isActive && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: '9999px',
                              backgroundColor: 'rgba(34, 197, 94, 0.15)',
                              color: 'var(--color-success)',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                            }}
                          >
                            {t('account.activeBadge')}
                          </span>
                        )}
                      </div>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '12px',
                          color: 'var(--color-text-muted)',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '2px',
                        }}
                      >
                        {p.url.replace(/^https?:\/\//, '')}
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => {
                        setPanelToEdit(p);
                        setModalOpen(true);
                      }}
                      title={t('account.editAccount')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '4px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setPanelToDelete(p)}
                      title={t('account.deleteAccount')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '4px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-error)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Credential Status Badges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-surface-hover)',
                      fontSize: '12px',
                    }}
                  >
                    <span style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Key size={13} /> Client API:
                    </span>
                    {p.hasClientKey ? (
                      <span
                        title={p.maskedClientKey}
                        style={{
                          color: 'var(--color-success)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          maxWidth: '180px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.maskedClientKey && p.maskedClientKey.length > 16
                          ? `${p.maskedClientKey.slice(0, 5)}••••••••${p.maskedClientKey.slice(-4)}`
                          : p.maskedClientKey}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{t('account.notConfigured')}</span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-surface-hover)',
                      fontSize: '12px',
                    }}
                  >
                    <span style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={13} /> Application API:
                    </span>
                    {p.hasAppKey ? (
                      <span
                        title={p.maskedAppKey}
                        style={{
                          color: 'var(--color-primary-light)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          maxWidth: '180px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.maskedAppKey && p.maskedAppKey.length > 16
                          ? `${p.maskedAppKey.slice(0, 5)}••••••••${p.maskedAppKey.slice(-4)}`
                          : p.maskedAppKey}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{t('account.notConfigured')}</span>
                    )}
                  </div>
                </div>

                {/* Authenticated Account Info */}
                {panelAccounts[p.id] ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <User size={13} color="var(--color-primary-light)" />
                      <div style={{ overflow: 'hidden' }}>
                        <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{panelAccounts[p.id].username}</span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>
                          ({panelAccounts[p.id].email})
                        </span>
                      </div>
                    </div>
                    {panelAccounts[p.id].admin && (
                      <span
                        style={{
                          fontSize: '9px',
                          padding: '2px 5px',
                          borderRadius: '3px',
                          backgroundColor: 'var(--color-primary)',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        ADMIN
                      </span>
                    )}
                  </div>
                ) : p.hasClientKey ? (
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 4px' }}>
                    <User size={12} style={{ opacity: 0.5 }} />
                    <span>{t('account.testApiHelp')}</span>
                  </div>
                ) : null}

                {/* Test Result Message */}
                {result && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: result.clientApi || result.appApi ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      border: `1px solid ${result.clientApi || result.appApi ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                      fontSize: '11px',
                    }}
                  >
                    {result.clientApi && (
                      <div style={{ color: 'var(--color-success)' }}>
                        ✓ Client API OK {result.accountName && `(User: ${result.accountName})`}
                      </div>
                    )}
                    {result.appApi && (
                      <div style={{ color: 'var(--color-success)' }}>
                        ✓ Application API OK
                      </div>
                    )}
                    {result.clientError && (
                      <div style={{ color: 'var(--color-error)' }}>
                        ✕ Client: {result.clientError}
                      </div>
                    )}
                    {result.appError && (
                      <div style={{ color: 'var(--color-error)' }}>
                        ✕ App: {result.appError}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
                  <button
                    onClick={() => handleTest(p.id)}
                    disabled={isTesting}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: isTesting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isTesting ? t('common.loading') : t('account.testConnection')}
                  </button>

                  {!isActive && (
                    <button
                      onClick={() => switchPanel(p.id)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-primary)',
                        border: 'none',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      {t('account.switchAccount')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit/Add Modal */}
      <PanelModal
        isOpen={modalOpen}
        panelToEdit={panelToEdit}
        onClose={() => {
          setModalOpen(false);
          setPanelToEdit(null);
        }}
        onSaved={() => {}}
      />

      {/* Confirmation Dialog for Deletion */}
      <ConfirmDialog
        isOpen={panelToDelete !== null}
        title={t('account.deleteConfirmTitle')}
        message={t('account.deleteConfirmMsg', { name: panelToDelete?.name || '' })}
        confirmLabel={t('account.deleteAccount')}
        isDestructive={true}
        onConfirm={handleDelete}
        onCancel={() => setPanelToDelete(null)}
      />
    </div>
  );
};
