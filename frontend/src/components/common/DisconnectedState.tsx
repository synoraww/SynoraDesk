import React from 'react';
import { WifiOff, RefreshCw, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useI18n } from '../../i18n';

interface DisconnectedStateProps {
  status: 'connecting' | 'reconnecting' | 'disconnected' | 'offline' | 'suspended';
  onRetry?: () => void;
  isRetrying?: boolean;
  errorMessage?: string | null;
}

export const DisconnectedState: React.FC<DisconnectedStateProps> = ({
  status,
  onRetry,
  isRetrying = false,
  errorMessage,
}) => {
  const { t } = useI18n();

  if (status === 'suspended') {
    return (
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: 'var(--color-error)',
          fontSize: '13px',
          fontWeight: 500,
        }}
      >
        <ShieldAlert size={18} color="var(--color-error)" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{t('server.suspendedWarning')}</span>
      </div>
    );
  }

  const getStatusText = () => {
    switch (status) {
      case 'connecting':
        return t('server.connection.connecting');
      case 'reconnecting':
        return t('server.connection.reconnecting');
      case 'offline':
        return t('server.connection.offlineNotice');
      case 'disconnected':
      default:
        return t('server.connection.disconnected');
    }
  };

  return (
    <div
      style={{
        padding: '10px 16px',
        backgroundColor:
          status === 'disconnected'
            ? 'rgba(239, 68, 68, 0.1)'
            : 'rgba(245, 158, 11, 0.1)',
        borderBottom: `1px solid ${
          status === 'disconnected'
            ? 'rgba(239, 68, 68, 0.25)'
            : 'rgba(245, 158, 11, 0.25)'
        }`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        {status === 'disconnected' ? (
          <WifiOff size={15} color="var(--color-error)" style={{ flexShrink: 0 }} />
        ) : (
          <AlertTriangle size={15} color="var(--color-warning)" style={{ flexShrink: 0 }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontWeight: 600,
              color:
                status === 'disconnected'
                  ? 'var(--color-error)'
                  : 'var(--color-warning)',
            }}
          >
            {getStatusText()}
          </span>
          {errorMessage && (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                marginTop: '1px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {errorMessage}
            </span>
          )}
        </div>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            borderRadius: '5px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: isRetrying ? 'not-allowed' : 'pointer',
            opacity: isRetrying ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          <RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />
          {t('server.connection.retry')}
        </button>
      )}
    </div>
  );
};
