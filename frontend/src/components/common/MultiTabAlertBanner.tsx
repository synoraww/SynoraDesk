import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { tabGuard } from '../../utils/multiTabGuard';
import { useI18n } from '../../i18n';

export const MultiTabAlertBanner: React.FC = () => {
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const unsubscribe = tabGuard.subscribe((dup) => {
      setIsDuplicate(dup);
      if (!dup) setDismissed(false);
    });
    return unsubscribe;
  }, []);

  if (!isDuplicate || dismissed) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: '36px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        backgroundColor: 'rgba(23, 20, 10, 0.95)',
        border: '1px solid #F59E0B',
        borderRadius: '12px',
        padding: '10px 18px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(245, 158, 11, 0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        maxWidth: '620px',
        width: '90%',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <AlertTriangle size={20} />
      </div>

      <div style={{ flex: 1, fontSize: '12px', color: '#FDF6B2', lineHeight: 1.4 }}>
        <strong>{t('common.multiTabTitle') || 'Phát hiện mở 2 tab:'}</strong>{' '}
        {t('common.multiTabDesc') ||
          'SynoraDesk đang được mở ở một tab khác. Để tránh xung đột dữ liệu phiên và bộ nhớ, bạn nên sử dụng tab trước đó.'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => tabGuard.claimPrimary()}
          className="btn-interactive"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 12px',
            borderRadius: '6px',
            backgroundColor: '#F59E0B',
            color: '#000000',
            fontSize: '11px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span>{t('common.useThisTab') || 'Sử dụng tab này'}</span>
          <ArrowRight size={12} />
        </button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#F59E0B',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
          title={t('common.dismiss') || 'Bỏ qua'}
        >
          <X size={15} />
        </button>
      </div>
    </div>,
    document.body
  );
};
