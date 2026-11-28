import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  CheckCircle2,
  Download,
  ExternalLink,
  X,
  RefreshCw,
  GitBranch,
  Calendar,
  FileDown,
  AlertCircle,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { APP_CONFIG } from '../../config/version';

interface ReleaseAsset {
  name: string;
  size: number;
  downloadUrl: string;
  downloadCount: number;
}

interface ReleaseInfo {
  tagName: string;
  name: string;
  body: string;
  prerelease: boolean;
  publishedAt: string;
  htmlUrl: string;
  hasUpdate: boolean;
  currentVersion: string;
  assets: ReleaseAsset[];
}

interface UpdateCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateCheckerModal: React.FC<UpdateCheckerModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const [channel, setChannel] = useState<'stable' | 'prerelease'>('stable');
  const [checking, setChecking] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRelease = async (ch: 'stable' | 'prerelease') => {
    setChecking(true);
    setErrorMsg(null);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app?.CheckGitHubUpdates) {
        const info = await app.CheckGitHubUpdates(ch === 'prerelease');
        setReleaseInfo(info);
      } else {
        throw new Error('Chức năng kiểm tra cập nhật chỉ hoạt động trong ứng dụng máy tính Wails.');
      }
    } catch (e: any) {
      console.error('Failed to check updates:', e);
      setReleaseInfo(null);
      setErrorMsg(e?.message || 'Không thể lấy thông tin phiên bản từ máy chủ GitHub.');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRelease(channel);
    }
  }, [isOpen, channel]);

  if (!isOpen) return null;

  const currentVersion = releaseInfo?.currentVersion || APP_CONFIG.version;
  const hasUpdate = releaseInfo?.hasUpdate || false;

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const handleOpenReleaseUrl = (url?: string) => {
    const targetUrl = url || releaseInfo?.htmlUrl || `${APP_CONFIG.githubUrl}/releases`;
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return;
    } catch {
      return;
    }
    // @ts-ignore
    const runtime = window.runtime;
    if (runtime?.BrowserOpenURL) {
      runtime.BrowserOpenURL(targetUrl);
    } else {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel anim-modal-in"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-primary-muted)',
                color: 'var(--color-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                {t('updates.title') || 'Kiểm tra bản cập nhật'}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                GitHub Release Auto-updater (synoraww/SynoraDesk)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-interactive"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Channel Selector: Stable vs Pre-release */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--color-surface-hover)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            <GitBranch size={13} />
            <span>Kênh cập nhật:</span>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setChannel('stable')}
              className="btn-interactive"
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: channel === 'stable' ? 600 : 400,
                backgroundColor: channel === 'stable' ? 'var(--color-primary-muted)' : 'transparent',
                border: `1px solid ${channel === 'stable' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                color: channel === 'stable' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
            >
              Chính thức (Stable)
            </button>
            <button
              type="button"
              onClick={() => setChannel('prerelease')}
              className="btn-interactive"
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: channel === 'prerelease' ? 600 : 400,
                backgroundColor: channel === 'prerelease' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                border: `1px solid ${channel === 'prerelease' ? 'var(--color-warning)' : 'var(--color-border)'}`,
                color: channel === 'prerelease' ? 'var(--color-warning)' : 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
            >
              Thử nghiệm (Beta / Pre-release)
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div
          className="custom-scrollbar"
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Status Banner */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-hover)',
              border: `1px solid ${hasUpdate ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: '10px',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            {checking ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={28} className="animate-spin" color="var(--color-primary-light)" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                  {t('updates.checking') || 'Đang kết nối GitHub và kiểm tra phiên bản mới...'}
                </span>
              </div>
            ) : errorMsg ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={28} color="var(--color-warning)" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                  {errorMsg}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Bạn vẫn có thể tiếp tục sử dụng phiên bản <strong>v{currentVersion}</strong> bình thường.
                </span>
              </div>
            ) : hasUpdate ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Download size={32} color="var(--color-primary-light)" />
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
                  {t('updates.newVersionAvailable') || 'Đã có phiên bản mới!'} ({releaseInfo?.tagName})
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Phiên bản hiện tại: <strong>v{currentVersion}</strong>
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={32} color="var(--color-success)" />
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                  {t('updates.upToDate') || 'Bạn đang ở phiên bản mới nhất!'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Phiên bản hiện hành: <strong>v{currentVersion}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Release Information Card */}
          {releaseInfo && !checking && (
            <div
              style={{
                backgroundColor: 'rgba(11, 15, 25, 0.4)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
                    {releaseInfo.name || releaseInfo.tagName}
                  </div>
                  {releaseInfo.publishedAt && (
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Calendar size={11} /> {new Date(releaseInfo.publishedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: releaseInfo.prerelease ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    color: releaseInfo.prerelease ? 'var(--color-warning)' : 'var(--color-success)',
                    border: `1px solid ${releaseInfo.prerelease ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                  }}
                >
                  {releaseInfo.prerelease ? 'Thử nghiệm (Pre-release)' : 'Chính thức (Stable)'}
                </span>
              </div>

              {/* Release Notes Body */}
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Thông tin phát hành & Nhật ký cập nhật:
                </div>
                <div
                  className="custom-scrollbar"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    lineHeight: '1.6',
                    maxHeight: '140px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-line',
                    wordBreak: 'break-word',
                  }}
                >
                  {releaseInfo.body || 'Không có mô tả chi tiết cho bản phát hành này.'}
                </div>
              </div>

              {/* Download Assets list if any */}
              {releaseInfo.assets && releaseInfo.assets.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Tệp tải về ({releaseInfo.assets.length}):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {releaseInfo.assets.map((as, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleOpenReleaseUrl(as.downloadUrl)}
                        className="btn-interactive"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--color-surface-hover)',
                          border: '1px solid var(--color-border)',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                          <FileDown size={13} color="var(--color-primary-light)" />
                          <span style={{ color: 'var(--color-text)', fontWeight: 500, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {as.name}
                          </span>
                        </div>
                        <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
                          {formatFileSize(as.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <button
            onClick={() => fetchRelease(channel)}
            disabled={checking}
            className="btn-interactive"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: checking ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
            <span>{checking ? (t('updates.checking') || 'Đang kiểm tra...') : (t('updates.checkAgain') || 'Kiểm tra lại')}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => handleOpenReleaseUrl()}
              className="btn-interactive"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: hasUpdate ? 'var(--color-primary)' : 'transparent',
                border: hasUpdate ? 'none' : '1px solid var(--color-border)',
                color: hasUpdate ? '#FFFFFF' : 'var(--color-text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>{hasUpdate ? 'Tải bản cập nhật' : 'Xem trên GitHub'}</span>
              <ExternalLink size={12} />
            </button>
            <button
              onClick={onClose}
              className="btn-interactive"
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {t('common.close') || 'Đóng'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
