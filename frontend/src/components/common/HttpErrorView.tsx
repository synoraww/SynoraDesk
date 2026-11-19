import React from 'react';
import { ShieldAlert, FileQuestion, ServerCrash, AlertCircle, ArrowLeft, RotateCw } from 'lucide-react';
import { useI18n } from '../../i18n';

export interface HttpErrorViewProps {
  code: 403 | 404 | 500 | number;
  title?: string;
  message?: string;
  requiredPermission?: string;
  onRetry?: () => void;
  onBack?: () => void;
}

export const HttpErrorView: React.FC<HttpErrorViewProps> = ({
  code,
  title,
  message,
  requiredPermission,
  onRetry,
  onBack,
}) => {
  const { t } = useI18n();
  const is403 = code === 403;
  const is404 = code === 404;
  const is500 = code >= 500;

  const defaultTitle = is403
    ? t('errors.forbiddenTitle')
    : is404
    ? t('errors.notFoundTitle')
    : is500
    ? t('errors.serverErrorTitle')
    : `${code} - ${t('common.error')}`;

  const defaultMessage = is403
    ? t('errors.forbiddenDesc')
    : is404
    ? t('errors.notFoundDesc')
    : is500
    ? t('errors.serverErrorDesc')
    : t('common.error');

  const IconComponent = is403 ? ShieldAlert : is404 ? FileQuestion : is500 ? ServerCrash : AlertCircle;
  const accentColor = is403 ? '#F59E0B' : is404 ? '#60A5FA' : '#EF4444';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        minHeight: '380px',
        width: '100%',
        maxWidth: '680px',
        margin: '40px auto',
        borderRadius: '12px',
        backgroundColor: 'rgba(23, 23, 31, 0.7)',
        border: `1px solid ${is403 ? 'rgba(245, 158, 11, 0.25)' : 'var(--color-border)'}`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Glowing Icon Badge */}
      <div
        style={{
          width: '68px',
          height: '68px',
          borderRadius: '50%',
          backgroundColor: `${accentColor}18`,
          border: `1px solid ${accentColor}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          boxShadow: `0 0 24px ${accentColor}25`,
        }}
      >
        <IconComponent size={34} color={accentColor} />
      </div>

      <div
        style={{
          display: 'inline-block',
          padding: '3px 10px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          backgroundColor: `${accentColor}22`,
          color: accentColor,
          marginBottom: '10px',
          border: `1px solid ${accentColor}44`,
        }}
      >
        HTTP {code} ERROR
      </div>

      <h2
        style={{
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--color-text)',
          marginBottom: '10px',
          letterSpacing: '-0.02em',
        }}
      >
        {title || defaultTitle}
      </h2>

      <p
        style={{
          fontSize: '13px',
          color: 'var(--color-text-muted)',
          maxWidth: '520px',
          lineHeight: '1.6',
          marginBottom: '20px',
        }}
      >
        {message || defaultMessage}
      </p>

      {requiredPermission && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: 'var(--color-text-secondary)',
            fontSize: '12px',
            marginBottom: '24px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span style={{ color: '#F59E0B', fontWeight: 600 }}>{t('errors.missingPermission')}:</span>
          <code style={{ color: '#FCD34D' }}>{requiredPermission}</code>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <ArrowLeft size={14} /> {t('common.back')}
          </button>
        )}

        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-primary)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <RotateCw size={14} /> {t('common.retry')}
          </button>
        )}
      </div>
    </div>
  );
};
