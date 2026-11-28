import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  breadcrumbs: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  breadcrumbs,
  actions,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '18px',
        paddingBottom: '14px',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {Icon && <Icon size={20} color="var(--color-primary-light)" style={{ flexShrink: 0 }} />}
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: 'var(--color-text)',
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {subtitle}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
          }}
        >
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight size={12} style={{ opacity: 0.6 }} />}
                {crumb.onClick && !isLast ? (
                  <button
                    onClick={crumb.onClick}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--color-text-secondary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span
                    style={{
                      color: isLast ? 'var(--color-text)' : 'var(--color-text-muted)',
                      fontWeight: isLast ? 500 : 400,
                    }}
                  >
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{actions}</div>}
      </div>
    </div>
  );
};
