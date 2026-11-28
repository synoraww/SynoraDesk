import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { PaginationMeta } from '../../types/admin';
import { useI18n } from '../../i18n';

interface PaginationBarProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  disabled?: boolean;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  pagination,
  onPageChange,
  onPerPageChange,
  disabled = false,
}) => {
  const { t } = useI18n();
  const { current_page, total_pages, total, per_page, count } = pagination;
  const safeTotalPages = Math.max(1, total_pages || 1);
  const safeCurrentPage = Math.max(1, Math.min(current_page || 1, safeTotalPages));
  const startRecord = total === 0 ? 0 : (safeCurrentPage - 1) * (per_page || 15) + 1;
  const endRecord = total === 0 ? 0 : startRecord + (count || 0) - 1;

  const btnStyle = (isDisabled: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '28px',
    height: '28px',
    padding: '0 8px',
    borderRadius: '4px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface)',
    color: isDisabled ? 'var(--color-text-muted)' : 'var(--color-text)',
    fontSize: '12px',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
  });

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '10px 14px',
        borderTop: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        fontSize: '12px',
        color: 'var(--color-text-secondary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span>
          {t('admin.showingRecords', {
            start: startRecord,
            end: Math.max(startRecord, endRecord),
            total,
            page: safeCurrentPage,
            totalPages: safeTotalPages,
          })}
        </span>

        {onPerPageChange && (
          <select
            value={per_page || 25}
            disabled={disabled}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            style={{
              height: '28px',
              padding: '0 8px',
              borderRadius: '4px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontSize: '12px',
              outline: 'none',
            }}
          >
            <option value={15}>{t('admin.perPage', { count: 15 })}</option>
            <option value={25}>{t('admin.perPage', { count: 25 })}</option>
            <option value={50}>{t('admin.perPage', { count: 50 })}</option>
            <option value={100}>{t('admin.perPage', { count: 100 })}</option>
          </select>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          type="button"
          disabled={disabled || safeCurrentPage <= 1}
          onClick={() => onPageChange(1)}
          style={btnStyle(disabled || safeCurrentPage <= 1)}
          title="First page"
        >
          <ChevronsLeft size={14} />
        </button>
        <button
          type="button"
          disabled={disabled || safeCurrentPage <= 1}
          onClick={() => onPageChange(safeCurrentPage - 1)}
          style={btnStyle(disabled || safeCurrentPage <= 1)}
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        <span style={{ padding: '0 8px', fontWeight: 500, color: 'var(--color-text)' }}>
          {safeCurrentPage} / {safeTotalPages}
        </span>
        <button
          type="button"
          disabled={disabled || safeCurrentPage >= safeTotalPages}
          onClick={() => onPageChange(safeCurrentPage + 1)}
          style={btnStyle(disabled || safeCurrentPage >= safeTotalPages)}
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          disabled={disabled || safeCurrentPage >= safeTotalPages}
          onClick={() => onPageChange(safeTotalPages)}
          style={btnStyle(disabled || safeCurrentPage >= safeTotalPages)}
          title="Last page"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
};
