import React from 'react';
import { createPortal } from 'react-dom';
import logo from '../../assets/images/logo-universal.png';
import { APP_CONFIG } from '../../config/version';

interface SplashScreenProps {
  visible: boolean;
  progress: number;
  statusText: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  visible,
  progress,
  statusText,
}) => {
  if (!visible) return null;

  const clamped = Math.max(0, Math.min(100, Math.round(progress)));

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: 'var(--color-console-bg)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        userSelect: 'none',
        transition: 'opacity 0.25s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '340px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '18px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-lg), 0 0 24px var(--color-primary-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px',
          }}
        >
          <img src={logo} alt="SynoraDesk" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.02em' }}>
              SynoraDesk
            </h1>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '9999px',
                backgroundColor: 'var(--color-primary-muted)',
                color: 'var(--color-primary-light)',
                border: '1px solid var(--color-primary-glow)',
              }}
            >
              v{APP_CONFIG.version}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
            {statusText}
          </p>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%' }}>
          <div
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${clamped}%`,
                height: '100%',
                borderRadius: '9999px',
                background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary-light))',
                transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '6px',
              fontSize: '10.5px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-muted)',
            }}
          >
            <span>Đang khởi động...</span>
            <span>{clamped}%</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
