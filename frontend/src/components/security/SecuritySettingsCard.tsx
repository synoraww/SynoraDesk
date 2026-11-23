import React, { useState } from 'react';
import {
  Lock,
  Shield,
  Key,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  Database,
  Power,
  Timer,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { useSecurityStore, LockType } from '../../stores/securityStore';
import { useI18n } from '../../i18n';

export const SecuritySettingsCard: React.FC = () => {
  const {
    lockType,
    autoLockMinutes,
    lockOnLaunch,
    encryptDatabase,
    setupLock,
    disableLock,
    setAutoLockMinutes,
    setLockOnLaunch,
    setEncryptDatabase,
    lockApp,
    enableLockout,
    maxAttempts,
    lockoutDurationMinutes,
    enableAutoWipe,
    wipeAttempts,
    setLockoutConfig,
  } = useSecurityStore();
  const { t } = useI18n();

  // Setup modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'enable' | 'disable' | 'change'>('enable');
  const [selectedType, setSelectedType] = useState<LockType>('pin4');
  const [inputPasscode, setInputPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const targetLength =
    selectedType === 'pin4' ? 4 : selectedType === 'pin6' ? 6 : selectedType === 'pin8' ? 8 : 0;

  const handleOpenEnable = (type: LockType) => {
    setSelectedType(type);
    setModalMode('enable');
    setInputPasscode('');
    setConfirmPasscode('');
    setCurrentPasscode('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenDisable = () => {
    setModalMode('disable');
    setCurrentPasscode('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (modalMode === 'disable') {
      const ok = await disableLock(currentPasscode);
      if (ok) {
        setIsModalOpen(false);
        setSuccessMsg(t('security.lockDisabledSuccess') || 'Đã tắt khóa ứng dụng thành công');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(t('security.incorrectCurrentPasscode') || 'Mật mã hiện tại không đúng');
      }
      return;
    }

    if (targetLength > 0 && inputPasscode.length !== targetLength) {
      setErrorMsg(`Mã PIN phải đủ ${targetLength} chữ số`);
      return;
    }

    if (inputPasscode.length < 4) {
      setErrorMsg('Mật khẩu phải có ít nhất 4 ký tự');
      return;
    }

    if (inputPasscode !== confirmPasscode) {
      setErrorMsg(t('security.passcodeMismatch') || 'Mật mã xác nhận không khớp');
      return;
    }

    const ok = await setupLock(selectedType, inputPasscode, currentPasscode);
    if (!ok) {
      setErrorMsg('Không thể thay đổi khóa. Kiểm tra mật mã hiện tại hoặc trạng thái khóa.');
      return;
    }
    setIsModalOpen(false);
    setSuccessMsg(t('security.lockEnabledSuccess') || 'Đã cài đặt mã khóa thành công');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        padding: '20px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={16} color="var(--color-primary-light)" />
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
            {t('security.title') || 'Bảo Mật & Khóa Ứng Dụng (App Lock)'}
          </h2>
        </div>
        {lockType !== 'none' && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              color: 'var(--color-success)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Check size={11} />
            {t('security.statusEnabled') || 'Đang bảo vệ'}
          </span>
        )}
      </div>

      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
        {t('security.desc') || 'Bảo vệ thông tin tài khoản, máy chủ và API key bằng mật mã cá nhân khi không sử dụng.'}
      </p>

      {successMsg && (
        <div
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            color: 'var(--color-success)',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Check size={14} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Lock Mode Selector Cards */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
          {t('security.lockModeLabel') || 'Chế độ khóa ứng dụng'}:
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
          {[
            { id: 'none', label: t('security.modeNone') || 'Tắt', desc: 'Không bảo vệ' },
            { id: 'pin4', label: 'PIN 4 số', desc: '4 chữ số' },
            { id: 'pin6', label: 'PIN 6 số', desc: '6 chữ số' },
            { id: 'pin8', label: 'PIN 8 số', desc: '8 chữ số' },
            { id: 'password', label: t('security.modePassword') || 'Mật khẩu', desc: 'Ký tự văn bản' },
          ].map((mode) => {
            const active = lockType === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => {
                  if (mode.id === 'none') {
                    if (lockType !== 'none') handleOpenDisable();
                  } else {
                    handleOpenEnable(mode.id as LockType);
                  }
                }}
                className="btn-interactive"
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: active ? 'var(--color-primary-muted)' : 'var(--color-surface-hover)',
                  border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{mode.label}</span>
                  {active && <Check size={13} color="var(--color-primary-light)" />}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{mode.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Additional Security Options (When Lock is Enabled) */}
      {lockType !== 'none' && (
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            paddingTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Auto-lock Idle Timeout */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={15} color="var(--color-primary-light)" />
              <div>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', display: 'block' }}>
                  {t('security.autoLockTimeout') || 'Tự động khóa khi không sử dụng'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {t('security.autoLockDesc') || 'Tự khóa màn hình khi không có thao tác chuột hoặc bàn phím'}
                </span>
              </div>
            </div>
            <select
              value={autoLockMinutes}
              onChange={(e) => setAutoLockMinutes(parseInt(e.target.value, 10))}
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
              <option value={0}>{t('security.never') || 'Không bao giờ'}</option>
              <option value={1}>{t('security.oneMinute') || 'Sau 1 phút'}</option>
              <option value={5}>{t('security.fiveMinutes') || 'Sau 5 phút'}</option>
              <option value={15}>{t('security.fifteenMinutes') || 'Sau 15 phút'}</option>
              <option value={30}>{t('security.thirtyMinutes') || 'Sau 30 phút'}</option>
            </select>
          </div>

          {/* Lock on launch */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Power size={15} color="var(--color-warning)" />
              <div>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', display: 'block' }}>
                  {t('security.lockOnLaunch') || 'Tự khóa khi khởi động lại ứng dụng'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {t('security.lockOnLaunchDesc') || 'Yêu cầu mở khóa ngay khi khởi chạy app'}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={lockOnLaunch}
              onChange={(e) => setLockOnLaunch(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            />
          </div>

          {/* Encrypt sensitive database */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={15} color="var(--color-success)" />
              <div>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', display: 'block' }}>
                  {t('security.encryptDb') || 'Mã hóa dữ liệu nhạy cảm (AES-256-GCM)'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {t('security.encryptDbDesc') || 'Mã hóa API keys và mật khẩu lưu trữ trong SQLite'}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={encryptDatabase}
              onChange={(e) => setEncryptDatabase(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            />
          </div>

          {/* Anti-Brute-Force Lockout (Configurable attempts & duration) */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Timer size={16} color="var(--color-warning)" />
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>
                    {t('security.lockoutTitle') || 'Tự động khóa tạm thời khi nhập sai'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {t('security.lockoutDesc') || 'Có bộ nhớ bảo vệ cục bộ chống chỉnh sửa (DPAPI + HMAC). Thời gian tắt máy không làm giảm án phạt.'}
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableLockout}
                onChange={(e) => setLockoutConfig({ enableLockout: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
            </div>

            {enableLockout && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', paddingTop: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Số lần sai tối đa:</span>
                  <select
                    value={maxAttempts}
                    onChange={(e) => setLockoutConfig({ maxAttempts: parseInt(e.target.value, 10) })}
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      color: 'var(--color-text)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <option value={3}>3 lần sai</option>
                    <option value={5}>5 lần sai (Mặc định)</option>
                    <option value={10}>10 lần sai</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Thời gian tạm khóa:</span>
                  <select
                    value={lockoutDurationMinutes}
                    onChange={(e) => setLockoutConfig({ lockoutDurationMinutes: parseInt(e.target.value, 10) })}
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      color: 'var(--color-text)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <option value={1}>1 phút</option>
                    <option value={5}>5 phút</option>
                    <option value={15}>15 phút (Mặc định)</option>
                    <option value={30}>30 phút</option>
                    <option value={60}>60 phút (1 giờ)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Emergency Self-Destruct Auto-Wipe Option */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: enableAutoWipe ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-surface-hover)',
              border: `1px solid ${enableAutoWipe ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-border)'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} color="var(--color-error)" />
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', display: 'block' }}>
                    {t('security.autoWipeTitle') || 'Tự động xóa sạch dữ liệu ứng dụng (Tùy chọn)'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {t('security.autoWipeDesc') || 'Xóa sạch cơ sở dữ liệu và khóa API nếu có người cố ý nhập sai liên tiếp nhiều lần'}
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableAutoWipe}
                onChange={(e) => setLockoutConfig({ enableAutoWipe: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: 'var(--color-error)', cursor: 'pointer' }}
              />
            </div>

            {enableAutoWipe && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Xóa dữ liệu sau:</span>
                  <select
                    value={wipeAttempts}
                    onChange={(e) => setLockoutConfig({ wipeAttempts: parseInt(e.target.value, 10) })}
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      color: 'var(--color-error)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <option value={10}>10 lần sai liên tiếp</option>
                    <option value={15}>15 lần sai liên tiếp</option>
                    <option value={20}>20 lần sai liên tiếp</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-error)', fontSize: '11px' }}>
                  <AlertTriangle size={13} />
                  <span>Cảnh báo: Toàn bộ dữ liệu SQLite, panels và credentials sẽ bị xóa sạch vĩnh viễn không thể khôi phục!</span>
                </div>
              </div>
            )}
          </div>

          {/* Test Lock Now button */}
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={lockApp}
              className="btn-interactive"
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--color-error)',
                fontSize: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Lock size={13} />
              <span>{t('security.testLockNow') || 'Khóa thử ngay bây giờ'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Setup / Disable Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'var(--color-modal-overlay)',
            backdropFilter: 'blur(10px)',
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
              maxWidth: '380px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '14px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>
              {modalMode === 'disable'
                ? (t('security.disableLockTitle') || 'Tắt khóa ứng dụng')
                : (t('security.setupLockTitle') || `Thiết lập ${selectedType.toUpperCase()}`)}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              {modalMode === 'disable'
                ? 'Nhập mật mã hiện tại để tắt chế độ bảo vệ.'
                : lockType !== 'none' ? 'Nhập mật mã mới và mật mã hiện tại để thay đổi khóa.' : 'Nhập mật mã mới và xác nhận để bắt đầu bảo vệ ứng dụng.'}
            </p>

            {errorMsg && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--color-error)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {modalMode === 'disable' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Mật mã hiện tại:
                  </label>
                  <input
                    type="password"
                    value={currentPasscode}
                    onChange={(e) => setCurrentPasscode(e.target.value)}
                    autoFocus
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              ) : (
                <>
                  {lockType !== 'none' && (
                    <div>
                      <label>Mật mã hiện tại:</label>
                      <input type="password" value={currentPasscode} onChange={(e) => setCurrentPasscode(e.target.value)} required />
                    </div>
                  )}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      {targetLength > 0 ? `Mã PIN (${targetLength} số):` : 'Mật khẩu mới:'}
                    </label>
                    <input
                      type={showPass ? 'text' : 'password'}
                      maxLength={targetLength > 0 ? targetLength : 32}
                      value={inputPasscode}
                      onChange={(e) => {
                        const val = targetLength > 0 ? e.target.value.replace(/\D/g, '') : e.target.value;
                        setInputPasscode(val);
                      }}
                      autoFocus
                      required
                      placeholder={targetLength > 0 ? '•'.repeat(targetLength) : 'Nhập mật khẩu'}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-surface-hover)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        letterSpacing: targetLength > 0 ? '0.2em' : 'normal',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Xác nhận lại:
                    </label>
                    <input
                      type={showPass ? 'text' : 'password'}
                      maxLength={targetLength > 0 ? targetLength : 32}
                      value={confirmPasscode}
                      onChange={(e) => {
                        const val = targetLength > 0 ? e.target.value.replace(/\D/g, '') : e.target.value;
                        setConfirmPasscode(val);
                      }}
                      required
                      placeholder={targetLength > 0 ? '•'.repeat(targetLength) : 'Nhập lại mật khẩu'}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-surface-hover)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        letterSpacing: targetLength > 0 ? '0.2em' : 'normal',
                      }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-interactive"
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-interactive"
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    backgroundColor: modalMode === 'disable' ? 'var(--color-error)' : 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {modalMode === 'disable' ? 'Tắt Khóa' : 'Lưu Cài Đặt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
