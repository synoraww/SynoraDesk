import React, { useState } from 'react';
import { ExternalLink, Info, KeyRound, Settings, Mail, Sliders } from 'lucide-react';
import { usePanelStore } from '../../stores/panelStore';
import { useI18n } from '../../i18n';
import { AdminGuard } from '../../components/admin/AdminGuard';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { openSafeExternalUrl } from '../../utils/safeUrl';

interface AdminPanelSettingsProps {
  onNavigateOverview: () => void;
  onNavigateApiSettings: () => void;
  onOpenPanelModal: () => void;
}

export const AdminPanelSettings: React.FC<AdminPanelSettingsProps> = ({
  onNavigateOverview,
  onNavigateApiSettings,
  onOpenPanelModal,
}) => {
  const { activePanel } = usePanelStore();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'general' | 'mail' | 'advanced'>('general');

  const openInBrowser = (suffix: string) => {
    if (!activePanel?.url) return;
    const base = activePanel.url.replace(/\/+$/, '');
    openSafeExternalUrl(`${base}${suffix}`);
  };

  const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '9px 16px',
    border: 'none',
    borderTop: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
    backgroundColor: isActive ? 'var(--color-surface)' : 'transparent',
    color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)',
    fontSize: '13px',
    fontWeight: isActive ? 600 : 500,
    cursor: 'pointer',
  });

  const fieldCardStyle: React.CSSProperties = {
    padding: '12px 14px',
    borderRadius: '4px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg)',
  };

  return (
    <AdminGuard onOpenPanelModal={onOpenPanelModal}>
      <div style={{ width: '100%', padding: '20px 24px', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box' }}>
        <AdminPageHeader
          title={
            activeTab === 'general'
              ? t('admin.panelSettingsTitle')
              : activeTab === 'mail'
              ? t('admin.mailSettingsTitle')
              : t('admin.advancedSettingsTitle')
          }
          icon={activeTab === 'general' ? Settings : activeTab === 'mail' ? Mail : Sliders}
          subtitle={
            activeTab === 'general'
              ? t('admin.panelSettingsSubtitle')
              : activeTab === 'mail'
              ? t('admin.mailSettingsSubtitle')
              : t('admin.advancedSettingsSubtitle')
          }
          breadcrumbs={[{ label: t('admin.title'), onClick: onNavigateOverview }, { label: t('admin.panelSettings') }]}
          actions={
            <>
              <button
                type="button"
                onClick={onNavigateApiSettings}
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
                <KeyRound size={13} /> {t('admin.panelApiKeys')}
              </button>
              {activePanel?.url && (
                <button
                  type="button"
                  onClick={() =>
                    openInBrowser(
                      activeTab === 'general'
                        ? '/admin/settings'
                        : activeTab === 'mail'
                        ? '/admin/settings/mail'
                        : '/admin/settings/advanced'
                    )
                  }
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
                  <ExternalLink size={13} /> {t('admin.openInWebAdmin')}
                </button>
              )}
            </>
          }
        />

        {/* Honest API Compatibility Notice */}
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 14px',
            borderRadius: '4px',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            backgroundColor: 'var(--color-warning-bg)',
            color: 'var(--color-text)',
            fontSize: '12.5px',
            lineHeight: 1.55,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <Info size={16} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{t('admin.panelSettingsApiNote')}</div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border)',
            borderBottom: 'none',
            borderRadius: '4px 4px 0 0',
          }}
        >
          <button type="button" onClick={() => setActiveTab('general')} style={{ ...tabButtonStyle(activeTab === 'general'), display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Settings size={14} /> {t('admin.tabGeneral')}
          </button>
          <button type="button" onClick={() => setActiveTab('mail')} style={{ ...tabButtonStyle(activeTab === 'mail'), display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Mail size={14} /> {t('admin.tabMail')}
          </button>
          <button type="button" onClick={() => setActiveTab('advanced')} style={{ ...tabButtonStyle(activeTab === 'advanced'), display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={14} /> {t('admin.tabAdvanced')}
          </button>
        </div>

        {/* Tab Content */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '0 0 4px 4px',
            padding: '16px',
          }}
        >
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                <Settings size={15} color="var(--color-primary-light)" />
                <span>Panel Settings (Web Admin Route: <code>/admin/settings</code>)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', fontSize: '13px' }}>
                <div style={fieldCardStyle}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Company Name</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                    Configured Panel Name in SynoraDesk: <strong>{activePanel?.name}</strong>. Used throughout the panel and in emails sent to clients.
                  </div>
                </div>
                <div style={fieldCardStyle}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Require 2-Factor Authentication</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                    Controls whether 2FA is <em>Not Required</em>, <em>Admin Only</em>, or required for <em>All Users</em>. Managed in Web Admin.
                  </div>
                </div>
                <div style={fieldCardStyle}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Default Language</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                    Default UI rendering language for panel accounts. Managed in Web Admin.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'mail' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                <Mail size={15} color="var(--color-primary-light)" />
                <span>Email Settings (Web Admin Route: <code>/admin/settings/mail</code>)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '13px' }}>
                <div style={fieldCardStyle}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>SMTP Host &amp; Port</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                    SMTP server address, port, and encryption mode (TLS / SSL / None).
                  </div>
                </div>
                <div style={fieldCardStyle}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>SMTP Credentials</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                    Optional SMTP username and password (stored in panel environment/database).
                  </div>
                </div>
                <div style={fieldCardStyle}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Mail From &amp; Test</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                    Sender address, sender name, and test email dispatch via Web Admin.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                <Sliders size={15} color="var(--color-primary-light)" />
                <span>Advanced Settings (Web Admin Route: <code>/admin/settings/advanced</code>)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', fontSize: '13px' }}>
                <div style={fieldCardStyle}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>reCAPTCHA</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                    Enable/disable invisible reCAPTCHA, Site Key, and Secret Key for login and password reset forms.
                  </div>
                </div>
                <div style={fieldCardStyle}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>HTTP Connections</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                    Connection Timeout and Request Timeout (in seconds) for Panel-to-Wings HTTP requests.
                  </div>
                </div>
                <div style={fieldCardStyle}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Automatic Allocation Creation</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                    Enable/disable user-initiated allocation creation and configure Starting/Ending Port range.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminGuard>
  );
};
