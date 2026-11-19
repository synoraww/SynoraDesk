import React from 'react';
import { Server as ServerIcon, Copy } from 'lucide-react';
import { Server } from '../../../stores/serverStore';
import { useI18n } from '../../../i18n';

interface ServerInfoCardProps {
  server: Server | null;
  identifier: string;
  onCopyText: (text: string, label: string) => void;
}

export const ServerInfoCard: React.FC<ServerInfoCardProps> = ({
  server,
  identifier,
  onCopyText,
}) => {
  const { t } = useI18n();

  const uuid = server?.uuid || identifier;
  const node = server?.node || 'N/A';
  const egg = server?.egg_name || 'Generic / Custom Egg';
  const internalId = server?.internal_id !== undefined ? `#${server.internal_id}` : null;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ServerIcon size={18} color="var(--color-primary-light)" /> {t('serverSettings.serverInfoTitle') || 'Server Information'}
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {t('serverSettings.serverInfoSubtitle') || 'Internal IDs, daemon node, and container specifications'}
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* UUID */}
        <div
          style={{
            backgroundColor: 'rgba(11, 15, 25, 0.4)',
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            {t('serverSettings.uuidLabel') || 'Server UUID'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--color-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={uuid}
            >
              {uuid}
            </span>
            <button
              type="button"
              onClick={() => onCopyText(uuid, 'UUID')}
              title={t('serverSettings.copyUuid') || 'Copy UUID'}
              className="btn-interactive"
              style={{
                padding: '3px 6px',
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <Copy size={12} />
            </button>
          </div>
        </div>

        {/* Node */}
        <div
          style={{
            backgroundColor: 'rgba(11, 15, 25, 0.4)',
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            {t('serverSettings.nodeLabel') || 'Wings Node'}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
            {node}
          </div>
        </div>

        {/* Egg */}
        <div
          style={{
            backgroundColor: 'rgba(11, 15, 25, 0.4)',
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            {t('serverSettings.eggLabel') || 'Egg / Blueprint'}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary-light)' }}>
            {egg}
          </div>
        </div>

        {/* Internal ID */}
        {internalId && (
          <div
            style={{
              backgroundColor: 'rgba(11, 15, 25, 0.4)',
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              {t('serverSettings.internalIdLabel') || 'Internal ID'}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
              {internalId}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
