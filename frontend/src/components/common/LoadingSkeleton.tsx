import React from 'react';

interface LoadingSkeletonProps {
  lines?: number;
  height?: string | number;
  width?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  lines = 1,
  height = '16px',
  width = '100%',
  style,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', ...style }}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="skeleton"
          style={{
            height: typeof height === 'number' ? `${height}px` : height,
            width: typeof width === 'number' ? `${width}px` : width,
            borderRadius: '6px',
          }}
        />
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC = () => (
  <div
    style={{
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <LoadingSkeleton width="40%" height={18} />
      <LoadingSkeleton width="60px" height={20} />
    </div>
    <LoadingSkeleton lines={2} height={14} />
    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
      <LoadingSkeleton width="30%" height={12} />
      <LoadingSkeleton width="30%" height={12} />
    </div>
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div
    style={{
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '8px',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '12px',
      }}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <LoadingSkeleton key={i} height={14} width="80%" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div
        key={r}
        style={{
          padding: '14px 16px',
          borderBottom: r < rows - 1 ? '1px solid var(--color-border-subtle)' : 'none',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '12px',
        }}
      >
        {Array.from({ length: 5 }).map((_, c) => (
          <LoadingSkeleton key={c} height={14} width={`${50 + (c * 10)}%`} />
        ))}
      </div>
    ))}
  </div>
);
