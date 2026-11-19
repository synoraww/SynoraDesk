import React from 'react';
import { AlertOctagon, RotateCw, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../../i18n';

interface ServerDangerZoneCardProps {
  onOpenReinstallModal: () => void;
  reinstallModalOpen: boolean;
  onCloseReinstallModal: () => void;
  reinstalling: boolean;
  confirmInput: string;
  onConfirmInputChange: (val: string) => void;
  onConfirmReinstall: () => void;
}

export const ServerDangerZoneCard: React.FC<ServerDangerZoneCardProps> = ({
  onOpenReinstallModal,
  reinstallModalOpen,
  onCloseReinstallModal,
  reinstalling,
  confirmInput,
  onConfirmInputChange,
  onConfirmReinstall,
}) => {
  const { t } = useI18n();

  return (
    <>
      <div
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.04)',
          borderRadius: '10px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertOctagon size={20} color="#EF4444" />
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#EF4444' }}>
                {t('serverSettings.reinstallTitle') || 'Reinstall Server'}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {t('serverSettings.dangerZone') || 'Danger Zone'}
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
            lineHeight: '1.6',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            padding: '12px 16px',
            borderRadius: '6px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            marginBottom: '16px',
          }}
        >
          {t('serverSettings.reinstallDesc') || 'Reinstalling your server will stop it and re-run the initial installation scripts. Files may be overwritten or deleted.'}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onOpenReinstallModal}
            className="btn-interactive"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#EF4444',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RotateCw size={14} /> {t('serverSettings.reinstallBtn') || 'Reinstall Server'}
          </button>
        </div>
      </div>

      {/* Reinstall Confirmation Modal */}
      {reinstallModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            className="anim-modal-in"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: '12px',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              padding: '24px',
              maxWidth: '480px',
              width: '90%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <AlertTriangle size={22} color="#EF4444" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
                {t('serverSettings.reinstallModalTitle') || 'Confirm Server Reinstallation'}
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
              {t('serverSettings.reinstallDesc') || 'Reinstalling your server will stop it and re-run installation scripts. Files may be overwritten or deleted.'}
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                {t('serverSettings.reinstallConfirmPrompt') || 'Type "reinstall" to confirm:'}
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => onConfirmInputChange(e.target.value)}
                placeholder="reinstall"
                style={{
                  width: '100%',
                  padding: '9px 12px',
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={onCloseReinstallModal}
                disabled={reinstalling}
                className="btn-interactive"
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={onConfirmReinstall}
                disabled={reinstalling || confirmInput.toLowerCase().trim() !== 'reinstall'}
                className="btn-interactive"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  backgroundColor: '#EF4444',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: reinstalling || confirmInput.toLowerCase().trim() !== 'reinstall' ? 'not-allowed' : 'pointer',
                  opacity: reinstalling || confirmInput.toLowerCase().trim() !== 'reinstall' ? 0.5 : 1,
                }}
              >
                {reinstalling ? <RotateCw size={14} className="animate-spin" /> : <RotateCw size={14} />}
                <span>{reinstalling ? (t('common.processing') || 'Processing...') : (t('serverSettings.confirmReinstall') || 'Confirm Reinstall')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
