import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Layers,
  Wrench,
  Trash2,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { APP_CONFIG } from '../../config/version';
import logo from '../../assets/images/logo-universal.png';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  canDismissWithoutAccept?: boolean;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  canDismissWithoutAccept = false,
}) => {
  const { t } = useI18n();
  const [agreed, setAgreed] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [wiping, setWiping] = useState(false);

  if (!isOpen) return null;

  const handleAcceptAndStart = () => {
    if (!agreed && !canDismissWithoutAccept) return;
    localStorage.setItem('pterodesk_terms_accepted', 'true');
    localStorage.setItem('pterodesk_terms_version', APP_CONFIG.termsVersion);
    localStorage.setItem('pterodesk_terms_accepted_at', new Date().toISOString());
    onClose();
  };

  const handleWipeData = async () => {
    setWiping(true);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app?.WipeAllData) {
        await app.WipeAllData();
      }
      localStorage.clear();
      window.location.reload();
    } catch (e) {
      console.error('Failed to wipe data:', e);
      setWiping(false);
      setShowWipeConfirm(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="anim-modal-in"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 30px rgba(99, 102, 241, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header with App Branding */}
        <div
          style={{
            padding: '24px 28px 20px',
            borderBottom: '1px solid var(--color-border)',
            background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <img
            src={logo}
            alt="SynoraDesk"
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              objectFit: 'cover',
              boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.02em' }}>
                {t('welcome.title') || 'Chào mừng đến với SynoraDesk'}
              </h2>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-primary-muted)',
                  color: 'var(--color-primary-light)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-primary-glow)',
                }}
              >
                v{APP_CONFIG.version}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
              {t('welcome.subtitle') || 'Ứng dụng máy tính nguồn mở hiện đại dành cho Pterodactyl Panel'}
            </p>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div
          className="custom-scrollbar"
          style={{
            padding: '24px 28px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Trust Badges Bar */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#22C55E',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={13} />
              {t('welcome.badgeOpenSource') || 'Mã nguồn mở'}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: 'var(--color-primary-light)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              <Lock size={13} />
              {t('welcome.badgeLocalFirst') || 'Lưu trữ cục bộ'}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38BDF8',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              <ShieldCheck size={13} />
              {t('welcome.badgeZeroTelemetry') || 'Không Telemetry'}
            </span>
          </div>

          {/* Core Feature Highlights */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ color: 'var(--color-primary-light)', marginBottom: '8px' }}>
                <Layers size={20} />
              </div>
              <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px' }}>
                {t('welcome.featPanelsTitle') || 'Đa Panel & Tài khoản'}
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                {t('welcome.featPanelsDesc') || 'Kết nối đồng thời nhiều Panel Pterodactyl không giới hạn.'}
              </p>
            </div>

            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ color: '#F59E0B', marginBottom: '8px' }}>
                <Wrench size={20} />
              </div>
              <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px' }}>
                {t('welcome.featToolsTitle') || 'Bộ công cụ Quản trị'}
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                {t('welcome.featToolsDesc') || 'SFTP kéo thả, Monaco Editor, Quản lý SQL & Console.'}
              </p>
            </div>

            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ color: '#22C55E', marginBottom: '8px' }}>
                <ShieldCheck size={20} />
              </div>
              <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px' }}>
                {t('welcome.featSecurityTitle') || 'Bảo mật Phần cứng'}
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                {t('welcome.featSecurityDesc') || 'Mã hóa DPAPI + AES-256-GCM, kết hợp khóa App Lock.'}
              </p>
            </div>
          </div>

          {/* Privacy & Zero-Data-Collection Commitment Box */}
          <div
            style={{
              padding: '18px 20px',
              borderRadius: '12px',
              backgroundColor: 'rgba(34, 197, 94, 0.05)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#22C55E" />
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                {t('welcome.termsTitle') || 'Điều khoản Dịch vụ & Cam kết Bảo mật Dữ liệu'}
              </h3>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {t('welcome.termsP1') ||
                'SynoraDesk được xây dựng hoàn toàn phi lợi nhuận và mã nguồn mở. Chúng tôi tôn trọng tuyệt đối quyền riêng tư và quyền kiểm soát dữ liệu của bạn.'}
            </p>

            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontWeight: 700, color: '#22C55E' }}>
                {t('welcome.termsCommitmentHeading') || 'Cam kết KHÔNG thu thập dữ liệu nhạy cảm:'}
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>{t('welcome.termsCommitment1') || 'Tuyệt đối không lưu trữ API Key, mật khẩu, cơ sở dữ liệu hay token ra ngoài máy tính cá nhân của bạn.'}</li>
                <li>{t('welcome.termsCommitment2') || 'Mọi thông tin kết nối và cấu hình được mã hóa cục bộ bằng Windows DPAPI và lưu trong SQLite trên máy bạn.'}</li>
                <li>{t('welcome.termsCommitment3') || 'Không gửi dữ liệu người dùng, không theo dõi hành vi ẩn danh, không có telemetry hoặc quảng cáo của bên thứ ba.'}</li>
                <li>{t('welcome.termsCommitment4') || 'Toàn bộ lưu lượng mạng chỉ diễn ra trực tiếp giữa máy bạn và địa chỉ Pterodactyl Panel do chính bạn thiết lập.'}</li>
              </ul>
            </div>
          </div>

          {/* Mandatory Agreement Checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-surface-hover)',
              border: `1px solid ${agreed ? 'var(--color-primary)' : 'var(--color-border)'}`,
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'border-color 0.15s ease',
            }}
          >
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{
                marginTop: '3px',
                width: '16px',
                height: '16px',
                accentColor: 'var(--color-primary)',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: '12px', fontWeight: 600, color: agreed ? 'var(--color-text)' : 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              {t('welcome.checkboxLabel') ||
                'Tôi đã đọc, hiểu rõ và đồng ý với Điều khoản dịch vụ và Cam kết không thu thập dữ liệu nhạy cảm của SynoraDesk.'}
            </span>
          </label>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Wipe Storage Button */}
          <button
            type="button"
            onClick={() => setShowWipeConfirm(true)}
            className="btn-interactive"
            title="Xóa toàn bộ dữ liệu SQLite, panels và cấu hình cục bộ"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#EF4444',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={13} />
            <span>{t('welcome.resetDataBtn') || 'Xóa dữ liệu lưu trữ'}</span>
          </button>

          {/* Right: Close or Start Button */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {canDismissWithoutAccept && (
              <button
                type="button"
                onClick={onClose}
                className="btn-interactive"
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {t('common.close') || 'Đóng'}
              </button>
            )}

            <button
              type="button"
              onClick={handleAcceptAndStart}
              disabled={!agreed && !canDismissWithoutAccept}
              className="btn-interactive"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 24px',
                borderRadius: '8px',
                backgroundColor: agreed || canDismissWithoutAccept ? 'var(--color-primary)' : 'var(--color-border)',
                border: 'none',
                color: agreed || canDismissWithoutAccept ? '#FFFFFF' : 'var(--color-text-muted)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: agreed || canDismissWithoutAccept ? 'pointer' : 'not-allowed',
                boxShadow: agreed ? '0 4px 14px rgba(99, 102, 241, 0.4)' : 'none',
              }}
            >
              <span>{t('welcome.getStartedBtn') || 'Bắt đầu sử dụng SynoraDesk'}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Wiping Data */}
      {showWipeConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000000,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="anim-modal-in"
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <AlertTriangle size={24} color="#EF4444" />
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#EF4444', margin: 0 }}>
                {t('welcome.resetConfirmTitle') || 'Xác nhận xóa sạch toàn bộ dữ liệu'}
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
              {t('welcome.resetConfirmDesc') ||
                'Thao tác này sẽ xóa sạch toàn bộ cấu hình, Panels, cơ sở dữ liệu SQLite và khóa mã hóa trên máy tính này. Ứng dụng sẽ được làm mới hoàn toàn. Bạn có chắc chắn không?'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowWipeConfirm(false)}
                disabled={wiping}
                className="btn-interactive"
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {t('common.cancel') || 'Hủy'}
              </button>
              <button
                type="button"
                onClick={handleWipeData}
                disabled={wiping}
                className="btn-interactive"
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: '#EF4444',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: wiping ? 'not-allowed' : 'pointer',
                }}
              >
                {wiping ? (t('common.processing') || 'Đang xóa...') : (t('welcome.resetDataBtn') || 'Xóa toàn bộ')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
