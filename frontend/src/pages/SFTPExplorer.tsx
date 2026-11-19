import React, { useState } from 'react';
import {
  FileCode2,
  FolderTree,
  FileText,
  Upload,
  Download,
  Trash2,
  Edit2,
  Plus,
  RefreshCw,
  FolderPlus,
  FilePlus,
  ArrowLeft,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { useServerStore } from '../stores/serverStore';
import { usePanelStore } from '../stores/panelStore';
import { useI18n } from '../i18n';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';

interface FileItem {
  name: string;
  size: number;
  mode: string;
  modifiedTime: string;
  isDir: boolean;
}

export const SFTPExplorerPage: React.FC = () => {
  const { servers } = useServerStore();
  const { activePanel } = usePanelStore();
  const { addNotification } = useUIStore();
  const { t } = useI18n();

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState(2022);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // File editor modal
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [savingFile, setSavingFile] = useState(false);

  // New folder / file modal
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!host || !username || !password) {
      addNotification({ type: 'warning', title: t('sftpExplorer.inputRequired'), message: t('sftpExplorer.hostRequired') });
      return;
    }

    setConnecting(true);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app) {
        await app.ConnectSFTP({
          host,
          port: Number(port),
          username,
          password,
        });
        setConnected(true);
        addNotification({ type: 'success', title: t('sftpExplorer.connected'), message: t('sftpExplorer.connectedMessage', { host, port }) });
        loadDirectory('/');
      }
    } catch (err: any) {
      addNotification({ type: 'error', title: t('sftpExplorer.connectionFailed'), message: err.message || t('sftpExplorer.unableToConnect') });
    } finally {
      setConnecting(false);
    }
  };

  const loadDirectory = async (dirPath: string) => {
    setLoadingFiles(true);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app) {
        const list = await app.ListSFTPFiles(dirPath);
        setFiles(list || []);
        setCurrentPath(dirPath);
      }
    } catch (err: any) {
      addNotification({ type: 'error', title: t('sftpExplorer.directoryReadFailed'), message: err.message });
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleOpenFile = async (fileName: string) => {
    const fullPath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app) {
        const content = await app.ReadSFTPFile(fullPath);
        setFileContent(content || '');
        setEditingFile(fullPath);
      }
    } catch (err: any) {
      addNotification({ type: 'error', title: t('sftpExplorer.readFailed'), message: err.message });
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    setSavingFile(true);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app) {
        await app.WriteSFTPFile(editingFile, fileContent);
        addNotification({ type: 'success', title: t('sftpExplorer.fileSaved'), message: t('sftpExplorer.savedMessage', { path: editingFile }) });
        setEditingFile(null);
      }
    } catch (err: any) {
      addNotification({ type: 'error', title: t('sftpExplorer.saveFailed'), message: err.message });
    } finally {
      setSavingFile(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app) {
        await app.CloseSFTP();
      }
    } finally {
      setConnected(false);
      setFiles([]);
    }
  };

  return (
    <div style={{ width: '100%', padding: '24px 28px', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
          {t('sftpExplorer.title')}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
          {t('sftpExplorer.subtitle')}
        </p>
      </div>

      {!connected ? (
        <div
          style={{
            maxWidth: '520px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '24px',
            margin: '20px auto 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <FileCode2 size={20} color="var(--color-primary-light)" />
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
              {t('sftpExplorer.connectionProfile')}
            </h2>
          </div>

          <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                  {t('sftpExplorer.serverHost')}
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="node1.example.com"
                  required
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                  {t('sftpExplorer.port')}
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                {t('sftpExplorer.username')}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="user.serveruuid"
                required
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                {t('sftpExplorer.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={connecting}
              style={{
                marginTop: '10px',
                padding: '10px 16px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-primary)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: connecting ? 'not-allowed' : 'pointer',
              }}
            >
              {connecting ? t('sftpExplorer.connecting') : t('sftpExplorer.connectAction')}
            </button>
          </form>
        </div>
      ) : (
        <div>
          {/* File Browser Toolbar */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px 8px 0 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => {
                  const parts = currentPath.split('/').filter(Boolean);
                  parts.pop();
                  loadDirectory('/' + parts.join('/'));
                }}
                disabled={currentPath === '/'}
                style={{
                  padding: '5px 10px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  cursor: currentPath === '/' ? 'not-allowed' : 'pointer',
                }}
              >
                {t('sftpExplorer.up')}
              </button>
              <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>
                {currentPath}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => loadDirectory(currentPath)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={12} />
              </button>
              <button
                onClick={handleDisconnect}
                style={{
                  padding: '5px 12px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--color-error)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {t('sftpExplorer.disconnect')}
              </button>
            </div>
          </div>

          {/* File List */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              overflow: 'hidden',
            }}
          >
            {loadingFiles ? (
              <div style={{ padding: '16px' }}>
                <LoadingSkeleton lines={6} height={28} />
              </div>
            ) : files.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                {t('sftpExplorer.emptyDirectory')}
              </div>
            ) : (
              files.map((file) => (
                <div
                  key={file.name}
                  onClick={() => {
                    if (file.isDir) {
                      loadDirectory(currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`);
                    } else {
                      handleOpenFile(file.name);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {file.isDir ? (
                      <FolderTree size={16} color="var(--color-primary-light)" />
                    ) : (
                      <FileText size={16} color="var(--color-text-secondary)" />
                    )}
                    <span style={{ color: 'var(--color-text)', fontWeight: file.isDir ? 600 : 400 }}>
                      {file.name}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {file.isDir ? t('sftpExplorer.folder') : `${(file.size / 1024).toFixed(1)} KB`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Text File Editor Modal */}
      {editingFile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '90%',
              maxWidth: '900px',
              height: '80%',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>
                {editingFile}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleSaveFile}
                  disabled={savingFile}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Save size={13} /> {savingFile ? t('sftpExplorer.saving') : t('sftpExplorer.saveFile')}
                </button>
                <button
                  onClick={() => setEditingFile(null)}
                  style={{
                    padding: '6px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              style={{
                flex: 1,
                padding: '16px',
                backgroundColor: '#070A10',
                color: '#F1F5F9',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                lineHeight: 1.5,
                border: 'none',
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
