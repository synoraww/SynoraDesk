import React, { useState } from 'react';
import { Sparkles, CheckCircle2, Download, ExternalLink, X, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n';

interface UpdateCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateCheckerModal: React.FC<UpdateCheckerModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(true);

  if (!isOpen) return null;

  const currentVersion = '1.02A';
  const latestVersion = '1.02A';
  const isUpToDate = currentVersion === latestVersion;

  const handleCheckAgain = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      setChecked(true);
    }, 800);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'var(--color-modal-overlay)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="glass-panel anim-modal-in"
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-primary-muted)',
                color: 'var(--color-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
                {t('updates.title') || 'Kiểm tra bản cập nhật'}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                SynoraDesk Auto-updater
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-hover)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          {isUpToDate ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={36} color="var(--color-success)" />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                {t('updates.upToDate') || 'Bạn đang sử dụng phiên bản mới nhất!'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                {t('updates.currentVersion') || 'Phiên bản hiện tại'}: <strong>{currentVersion}</strong>
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Download size={36} color="var(--color-primary-light)" />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                {t('updates.newVersionAvailable') || 'Đã có phiên bản mới!'} ({latestVersion})
              </span>
            </div>
          )}
        </div>

        {/* Release notes summary */}
        <div style={{ marginBottom: '20px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('updates.recentImprovements') || 'Tính năng mới nổi bật (v1.02A)'}:
          </span>
          <ul style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: '1.6', marginTop: '6px', paddingLeft: '16px' }}>
            <li>Khóa mật mã đa dạng (PIN 4/6/8 số, Password) & Auto-lock.</li>
            <li>Custom Titlebar kính mờ thay thế thanh Windows.</li>
            <li>Hiển thị Primary Allocation (alias + port) & Full Resource Usage.</li>
            <li>Terminal thông minh: Tự cân bằng độ tương phản ANSI & Toolbar.</li>
            <li>Font Inter chuẩn mực & Tối ưu hóa 100% Light Mode.</li>
          </ul>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={handleCheckAgain}
            disabled={checking}
            className="btn-interactive"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: checking ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={13} className={checking ? 'spin' : ''} />
            <span>{checking ? (t('updates.checking') || 'Đang kiểm tra...') : (t('updates.checkAgain') || 'Kiểm tra lại')}</span>
          </button>
          <button
            onClick={onClose}
            className="btn-interactive"
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-primary)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('common.close') || 'Đóng'}
          </button>
        </div>
      </div>
    </div>
  );
};
