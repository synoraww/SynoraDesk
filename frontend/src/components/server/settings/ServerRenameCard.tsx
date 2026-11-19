import React from 'react';
import { Save, Tag } from 'lucide-react';
import { useI18n } from '../../../i18n';

interface ServerRenameCardProps {
  name: string;
  description: string;
  saving: boolean;
  onNameChange: (val: string) => void;
  onDescChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ServerRenameCard: React.FC<ServerRenameCardProps> = ({
  name,
  description,
  saving,
  onNameChange,
  onDescChange,
  onSubmit,
}) => {
  const { t } = useI18n();

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={17} color="var(--color-primary-light)" /> {t('serverSettings.detailsTitle') || 'Server Details'}
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {t('serverSettings.detailsSubtitle') || 'Update server display name and description'}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
            {t('serverSettings.serverNameLabel') || 'Server Name'}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t('serverSettings.serverNamePlaceholder') || 'Enter server name'}
            required
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
            {t('serverSettings.descriptionLabel') || 'Server Description'}
          </label>
          <textarea
            value={description}
            onChange={(e) => onDescChange(e.target.value)}
            placeholder={t('serverSettings.descriptionPlaceholder') || 'Enter server description (optional)'}
            rows={3}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="submit"
            disabled={saving}
            className="btn-interactive"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-primary)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Save size={14} /> {saving ? (t('common.saving') || 'Saving...') : (t('serverSettings.saveNameBtn') || 'Save Changes')}
          </button>
        </div>
      </form>
    </div>
  );
};
