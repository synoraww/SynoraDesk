import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Delete, Shield, AlertCircle, ArrowRight, ShieldAlert, Timer, RotateCcw, Minus, Square, X } from 'lucide-react';
import { useSecurityStore } from '../../stores/securityStore';
import { useI18n } from '../../i18n';
import { WindowMinimise, WindowToggleMaximise, Quit } from '../../../wailsjs/runtime/runtime';
import logo from '../../assets/images/logo-universal.png';

export const AppLockScreen: React.FC = () => {
  const {
    isLocked,
    lockType,
    unlock,
    failedAttempts,
    isLockedOut,
    remainingLockoutSeconds,
    maxAttempts,
    isDataWiped,
  } = useSecurityStore();
  const { t } = useI18n();

  const [enteredPin, setEnteredPin] = useState('');
  const [enteredPassword, setEnteredPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const targetLength = lockType === 'pin4' ? 4 : lockType === 'pin6' ? 6 : lockType === 'pin8' ? 8 : 0;
  const isPinMode = targetLength > 0;

  const formatLockoutTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!isLocked) {
      setEnteredPin('');
      setEnteredPassword('');
      setIsError(false);
      setErrorMessage('');
    }
  }, [isLocked]);

  // Physical Keyboard Listener
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (isLockedOut) return;

      if (isPinMode) {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          handleNumberClick(e.key);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleBackspace();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleClear();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, isLockedOut, enteredPin, targetLength, isPinMode]);

  const handleNumberClick = async (digit: string) => {
    if (isLockedOut || !isPinMode || enteredPin.length >= targetLength) return;

    const newPin = enteredPin + digit;
    setEnteredPin(newPin);
    setIsError(false);

    if (newPin.length === targetLength) {
      // Auto-submit when length reached
      const success = await unlock(newPin);
      if (!success) {
        triggerError(t('security.incorrectPasscode') || 'Mật mã không chính xác');
        setTimeout(() => setEnteredPin(''), 500);
      }
    }
  };

  const handleBackspace = () => {
    if (isLockedOut) return;
    if (enteredPin.length > 0) {
      setEnteredPin(enteredPin.slice(0, -1));
      setIsError(false);
    }
  };

  const handleClear = () => {
    if (isLockedOut) return;
    setEnteredPin('');
    setIsError(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut || !enteredPassword) return;

    const success = await unlock(enteredPassword);
    if (!success) {
      triggerError(t('security.incorrectPassword') || 'Mật khẩu không chính xác');
    }
  };

  const triggerError = (msg: string) => {
    setIsError(true);
    setErrorMessage(msg);
    setTimeout(() => setIsError(false), 800);
  };

  if (!isLocked || lockType === 'none') {
    return null;
  }

  // Self-Destruct Wipe Screen
  if (isDataWiped) {
    return (
      <div
        className="wails-drag"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          backgroundColor: '#090D16',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          userSelect: 'none',
        }}
      >
        {/* Top Header Bar for Dragging & Window Controls */}
        <div
          className="wails-drag"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px 0 14px',
            zIndex: 10,
          }}
        >
          <div
            className="wails-drag"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <img
              src={logo}
              alt="SynoraDesk"
              style={{ width: '18px', height: '18px', objectFit: 'cover', borderRadius: '4px' }}
            />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)' }}>
              SynoraDesk
            </span>
            <span
              style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: 'var(--color-error)',
                fontWeight: 600,
              }}
            >
              Cảnh báo bảo mật
            </span>
          </div>

          <div
            className="wails-no-drag"
            style={{
              display: 'flex',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <button
              onClick={() => WindowMinimise()}
              className="wails-no-drag"
              title="Thu nhỏ"
              style={{
                width: '44px',
                height: '36px',
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Minus size={13} />
            </button>
            <button
              onClick={() => WindowToggleMaximise()}
              className="wails-no-drag"
              title="Phóng to"
              style={{
                width: '44px',
                height: '36px',
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Square size={11} />
            </button>
            <button
              onClick={() => Quit()}
              className="wails-no-drag"
              title="Đóng"
              style={{
                width: '46px',
                height: '36px',
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#E81123';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div
          className="glass-panel wails-no-drag anim-fade-in"
          style={{
            maxWidth: '440px',
            width: '100%',
            backgroundColor: '#111827',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '20px',
            padding: '40px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: 'var(--color-error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <ShieldAlert size={32} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-error)', marginBottom: '8px' }}>
            DỮ LIỆU ĐÃ BỊ XÓA AN TOÀN
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '28px' }}>
            Cơ chế bảo vệ chống xâm nhập đã được kích hoạt vì đã vượt quá số lần nhập sai cho phép. Toàn bộ cơ sở dữ liệu SQLite, thông tin tài khoản và khóa bảo mật trên thiết bị này đã được xóa sạch.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-interactive wails-no-drag"
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              backgroundColor: 'var(--color-primary)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={16} />
            <span>Khởi động lại ứng dụng</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="wails-drag"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'var(--color-bg)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        padding: '24px',
        overflow: 'hidden',
      }}
    >
      {/* Top Header Bar for Dragging & Window Controls */}
      <div
        className="wails-drag"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px 0 14px',
          zIndex: 10,
        }}
      >
        {/* Brand / Lock indicator */}
        <div
          className="wails-drag"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <img
            src={logo}
            alt="SynoraDesk"
            style={{ width: '18px', height: '18px', objectFit: 'cover', borderRadius: '4px' }}
          />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
            SynoraDesk
          </span>
          <span
            style={{
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: 'var(--color-error)',
              fontWeight: 600,
            }}
          >
            {t('security.lockedBadge') || 'Đã khóa'}
          </span>
        </div>

        {/* Window controls */}
        <div
          className="wails-no-drag"
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <button
            onClick={() => WindowMinimise()}
            className="wails-no-drag"
            title={t('titlebar.minimize') || 'Thu nhỏ'}
            style={{
              width: '44px',
              height: '36px',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Minus size={13} />
          </button>
          <button
            onClick={() => WindowToggleMaximise()}
            className="wails-no-drag"
            title={t('titlebar.maximize') || 'Phóng to'}
            style={{
              width: '44px',
              height: '36px',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Square size={11} />
          </button>
          <button
            onClick={() => Quit()}
            className="wails-no-drag"
            title={t('titlebar.close') || 'Đóng'}
            style={{
              width: '46px',
              height: '36px',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.12s ease, color 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#E81123';
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Container Card */}
      <div
        className={`glass-panel wails-no-drag ${isError ? 'anim-shake' : 'anim-fade-in'}`}
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '20px',
          padding: '36px 30px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px var(--color-primary-glow)',
        }}
      >
        {/* App Logo & Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <img
            src={logo}
            alt="SynoraDesk"
            style={{ width: '44px', height: '44px', objectFit: 'cover' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
              SynoraDesk
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {t('security.appLockedTitle') || 'Ứng dụng đã bị khóa'}
            </span>
          </div>
        </div>

        {/* Lock Icon Indicator */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: isLockedOut || isError ? 'rgba(239, 68, 68, 0.15)' : 'var(--color-primary-muted)',
            color: isLockedOut || isError ? 'var(--color-error)' : 'var(--color-primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            transition: 'all 0.2s ease',
          }}
        >
          {isLockedOut ? <Timer size={24} /> : <Lock size={22} />}
        </div>

        {/* Lockout Countdown Card */}
        {isLockedOut && (
          <div
            style={{
              width: '100%',
              padding: '16px 14px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-error)', marginBottom: '6px' }}>
              <ShieldAlert size={16} />
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('security.lockedOutTitle') || 'Tạm khóa an toàn'}
              </span>
            </div>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--color-error)',
                letterSpacing: '0.08em',
                marginBottom: '6px',
              }}
            >
              {formatLockoutTime(remainingLockoutSeconds)}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
              {t('security.lockedOutDesc', { max: maxAttempts }) ||
                `Đã nhập sai quá ${maxAttempts} lần. Bộ nhớ bảo vệ cục bộ chống can thiệp. Vui lòng đợi đếm ngược kết thúc để thử lại.`}
            </p>
          </div>
        )}

        {/* Prompt Text */}
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px', textAlign: 'center' }}>
          {isLockedOut
            ? (t('security.lockedOutInputBlocked') || 'Đang tạm dừng tiếp nhận thao tác')
            : isPinMode
            ? (t('security.enterPinPrompt') || `Nhập mã PIN (${targetLength} chữ số)`)
            : (t('security.enterPasswordPrompt') || 'Nhập mật khẩu mở khóa')}
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '24px', textAlign: 'center' }}>
          {isLockedOut
            ? (t('security.lockedOutInputBlockedDesc') || `Vui lòng đợi đồng hồ đếm ngược kết thúc (${formatLockoutTime(remainingLockoutSeconds)})`)
            : (t('security.unlockInstructions') || 'Nhập mã bảo mật để tiếp tục làm việc')}
        </p>

        {/* PIN MODE: Dot Indicators + Virtual Keypad */}
        {isPinMode ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Dots Indicator */}
            <div
              style={{
                display: 'flex',
                gap: '14px',
                marginBottom: '28px',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {Array.from({ length: targetLength }).map((_, idx) => {
                const filled = idx < enteredPin.length;
                return (
                  <div
                    key={idx}
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: filled
                        ? isError
                          ? 'var(--color-error)'
                          : 'var(--color-primary-light)'
                        : 'transparent',
                      border: `2px solid ${
                        filled
                          ? isError
                            ? 'var(--color-error)'
                            : 'var(--color-primary-light)'
                          : 'var(--color-border)'
                      }`,
                      boxShadow: filled
                        ? `0 0 10px ${isError ? 'rgba(239, 68, 68, 0.5)' : 'var(--color-primary-glow)'}`
                        : 'none',
                      transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                      transform: filled ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                );
              })}
            </div>

            {/* Numeric Keypad Grid (3x4) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                width: '100%',
                maxWidth: '260px',
                opacity: isLockedOut ? 0.3 : 1,
                pointerEvents: isLockedOut ? 'none' : 'auto',
                transition: 'opacity 0.2s ease',
              }}
            >
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  disabled={isLockedOut}
                  onClick={() => handleNumberClick(digit)}
                  className="btn-interactive"
                  style={{
                    height: '52px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '18px',
                    fontWeight: 600,
                    cursor: isLockedOut ? 'not-allowed' : 'pointer',
                    outline: 'none',
                  }}
                >
                  {digit}
                </button>
              ))}

              {/* Clear button */}
              <button
                disabled={isLockedOut}
                onClick={handleClear}
                className="btn-interactive"
                style={{
                  height: '52px',
                  borderRadius: '12px',
                  backgroundColor: 'transparent',
                  border: '1px solid transparent',
                  color: 'var(--color-text-muted)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isLockedOut ? 'not-allowed' : 'pointer',
                  outline: 'none',
                }}
              >
                C
              </button>

              {/* Zero */}
              <button
                disabled={isLockedOut}
                onClick={() => handleNumberClick('0')}
                className="btn-interactive"
                style={{
                  height: '52px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '18px',
                  fontWeight: 600,
                  cursor: isLockedOut ? 'not-allowed' : 'pointer',
                  outline: 'none',
                }}
              >
                0
              </button>

              {/* Backspace button */}
              <button
                disabled={isLockedOut}
                onClick={handleBackspace}
                className="btn-interactive"
                style={{
                  height: '52px',
                  borderRadius: '12px',
                  backgroundColor: 'transparent',
                  border: '1px solid transparent',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isLockedOut ? 'not-allowed' : 'pointer',
                  outline: 'none',
                }}
              >
                <Delete size={20} />
              </button>
            </div>
          </div>
        ) : (
          /* PASSWORD MODE */
          <form onSubmit={handlePasswordSubmit} style={{ width: '100%', maxWidth: '300px' }}>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                disabled={isLockedOut}
                value={enteredPassword}
                onChange={(e) => {
                  setEnteredPassword(e.target.value);
                  setIsError(false);
                }}
                placeholder={isLockedOut ? 'Đang tạm khóa an toàn...' : (t('security.passwordPlaceholder') || 'Nhập mật khẩu...')}
                autoFocus={!isLockedOut}
                style={{
                  width: '100%',
                  padding: '12px 42px 12px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--color-surface-hover)',
                  border: `1px solid ${isError ? 'var(--color-error)' : 'var(--color-border)'}`,
                  color: 'var(--color-text)',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  opacity: isLockedOut ? 0.4 : 1,
                  cursor: isLockedOut ? 'not-allowed' : 'text',
                }}
              />
              <button
                type="button"
                disabled={isLockedOut}
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: isLockedOut ? 'not-allowed' : 'pointer',
                  padding: '2px',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLockedOut}
              className="btn-interactive"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                backgroundColor: isLockedOut ? 'var(--color-surface-hover)' : 'var(--color-primary)',
                border: 'none',
                color: isLockedOut ? 'var(--color-text-muted)' : '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: isLockedOut ? 'not-allowed' : 'pointer',
              }}
            >
              <span>{isLockedOut ? 'Đang tạm khóa...' : (t('security.unlockButton') || 'Mở khóa ứng dụng')}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* Error message */}
        {isError && (
          <div
            style={{
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--color-error)',
              fontSize: '12px',
            }}
          >
            <AlertCircle size={14} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Attempt warning */}
        {failedAttempts > 2 && (
          <span style={{ marginTop: '12px', fontSize: '11px', color: 'var(--color-warning)' }}>
            {t('security.failedAttemptsWarning', { count: failedAttempts }) || `Đã nhập sai ${failedAttempts} lần`}
          </span>
        )}
      </div>
    </div>
  );
};
