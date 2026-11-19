import React, { useEffect, useState } from 'react';
import {
  Layers,
  Network,
  Server,
  HardDrive,
  Cpu,
  RefreshCw,
  Plus,
  Trash2,
  AlertTriangle,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { usePanelStore } from '../stores/panelStore';
import { useUIStore } from '../stores/uiStore';
import { useI18n } from '../i18n';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

interface Node {
  id: number;
  uuid: string;
  name: string;
  description: string;
  location_id: number;
  fqdn: string;
  scheme: string;
  behind_proxy: boolean;
  maintenance_mode: boolean;
  memory: number;
  memory_overallocate: number;
  disk: number;
  disk_overallocate: number;
  upload_size: number;
  daemon_listen: number;
  daemon_sftp: number;
  allocated_resources?: {
    memory: number;
    disk: number;
  };
}

export const NodesPage: React.FC<{ onOpenPanelModal: () => void }> = ({ onOpenPanelModal }) => {
  const { activePanel } = usePanelStore();
  const { addNotification } = useUIStore();
  const { t } = useI18n();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<Node | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (activePanel?.hasAppKey) {
      loadNodes();
    }
  }, [activePanel?.id]);

  const loadNodes = async () => {
    setLoading(true);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app) {
        const nodeList = await app.ListNodes();
        setNodes(nodeList || []);
      }
    } catch (e: any) {
      addNotification({
        type: 'error',
        title: t('nodes.loadFailed'),
        message: e.message || t('nodes.appPermissionRequired'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNode = async () => {
    if (!nodeToDelete) return;
    setDeleteLoading(true);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app) {
        await app.DeleteNode(nodeToDelete.id);
        addNotification({
          type: 'success',
          title: t('nodes.deleted'),
          message: t('nodes.deletedMessage', { name: nodeToDelete.name }),
        });
        await loadNodes();
      }
    } catch (e: any) {
      addNotification({
        type: 'error',
        title: t('nodes.deleteFailed'),
        message: e.message || t('nodes.deleteError'),
      });
    } finally {
      setDeleteLoading(false);
      setNodeToDelete(null);
    }
  };

  if (!activePanel) {
    return (
      <div style={{ width: '100%', padding: '32px', maxWidth: '800px', margin: '0 auto', boxSizing: 'border-box' }}>
        <EmptyState
          icon={Layers}
          title={t('nodes.noPanelTitle')}
          description={t('nodes.noPanelDesc')}
          action={{
            label: t('nodes.openPanelManager'),
            onClick: onOpenPanelModal,
          }}
        />
      </div>
    );
  }

  if (!activePanel.hasAppKey) {
    return (
      <div style={{ width: '100%', padding: '40px 24px', maxWidth: '640px', margin: '0 auto', textAlign: 'center', boxSizing: 'border-box' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--color-warning)',
          }}
        >
          <Lock size={26} />
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>
          {t('nodes.apiKeyTitle')}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
          {t('nodes.apiKeyDesc')} (<code>/api/application/nodes</code>)
        </p>
        <button
          onClick={onOpenPanelModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: 'var(--color-primary)',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {t('nodes.configureApi')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', padding: '24px 28px', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            {t('nodes.title')}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {t('nodes.subtitle', { panel: activePanel.name })}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={loadNodes}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} /> {t('nodes.refresh')}
          </button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={4} />
      ) : nodes.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={t('nodes.emptyTitle')}
          description={t('nodes.emptyDesc')}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
          {nodes.map((node) => (
            <div
              key={node.id}
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-primary-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-primary-light)',
                    }}
                  >
                    <Layers size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
                      {node.name}
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {node.scheme}://{node.fqdn}:{node.daemon_listen}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setNodeToDelete(node)}
                  title={t('nodes.deleteNode')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-error)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Stats */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-surface-hover)',
                  fontSize: '12px',
                }}
              >
                <div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{t('nodes.ramAllocation')}</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                    {node.memory} MB
                  </div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                    +{node.memory_overallocate}% {t('nodes.over')}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{t('nodes.diskAllocation')}</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                    {node.disk} MB
                  </div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                    +{node.disk_overallocate}% {t('nodes.over')}
                  </div>
                </div>
              </div>

              {/* Ports */}
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'flex', gap: '14px' }}>
                <span>{t('nodes.daemon')}: {node.daemon_listen}</span>
                <span>SFTP: {node.daemon_sftp}</span>
                {node.maintenance_mode && (
                  <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{t('nodes.maintenance')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={nodeToDelete !== null}
        title={t('nodes.deleteNode')}
        message={t('nodes.deleteConfirm', { name: nodeToDelete?.name || '' })}
        confirmLabel={t('nodes.deleteNode')}
        isDestructive={true}
        isLoading={deleteLoading}
        onConfirm={handleDeleteNode}
        onCancel={() => setNodeToDelete(null)}
      />
    </div>
  );
};
