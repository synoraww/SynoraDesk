import React from 'react';

export type StatusType = 'running' | 'starting' | 'stopping' | 'offline' | 'suspended' | 'installing' | 'error' | 'success';

interface StatusBadgeProps {
  status: StatusType | string;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showDot = true,
}) => {
  const normalized = (status || 'offline').toLowerCase();

  const getStatusStyles = () => {
    switch (normalized) {
      case 'running':
      case 'success':
      case 'active':
        return {
          bg: 'rgba(34, 197, 94, 0.12)',
          text: '#4ADE80',
          border: 'rgba(34, 197, 94, 0.3)',
          dot: '#22C55E',
          label: 'Running',
        };
      case 'starting':
        return {
          bg: 'rgba(234, 179, 8, 0.12)',
          text: '#FACC15',
          border: 'rgba(234, 179, 8, 0.3)',
          dot: '#EAB308',
          label: 'Starting',
        };
      case 'stopping':
        return {
          bg: 'rgba(249, 115, 22, 0.12)',
          text: '#FB923C',
          border: 'rgba(249, 115, 22, 0.3)',
          dot: '#F97316',
          label: 'Stopping',
        };
      case 'suspended':
        return {
          bg: 'rgba(239, 68, 68, 0.12)',
          text: '#F87171',
          border: 'rgba(239, 68, 68, 0.3)',
          dot: '#EF4444',
          label: 'Suspended',
        };
      case 'installing':
        return {
          bg: 'var(--color-primary-muted)',
          text: 'var(--color-primary-light)',
          border: 'var(--color-primary-glow)',
          dot: 'var(--color-primary)',
          label: 'Installing',
        };
      case 'error':
      case 'failed':
        return {
          bg: 'rgba(239, 68, 68, 0.12)',
          text: '#F87171',
          border: 'rgba(239, 68, 68, 0.3)',
          dot: '#EF4444',
          label: 'Error',
        };
      case 'offline':
      default:
        return {
          bg: 'rgba(148, 163, 184, 0.1)',
          text: '#94A3B8',
          border: 'rgba(148, 163, 184, 0.2)',
          dot: '#64748B',
          label: normalized === 'offline' ? 'Offline' : status,
        };
    }
  };

  const style = getStatusStyles();
  const isSm = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? '4px' : '6px',
        padding: isSm ? '2px 6px' : '3px 8px',
        borderRadius: '9999px',
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        fontSize: isSm ? '11px' : '12px',
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {showDot && (
        <span
          style={{
            width: isSm ? '5px' : '6px',
            height: isSm ? '5px' : '6px',
            borderRadius: '50%',
            backgroundColor: style.dot,
            boxShadow: `0 0 6px ${style.dot}`,
          }}
        />
      )}
      {style.label}
    </span>
  );
};
