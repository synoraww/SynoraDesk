import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Cpu,
  Database,
  HardDrive,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  X,
  Bug,
  Activity,
  Server,
  Lock,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { useUIStore } from '../../stores/uiStore';
import { APP_CONFIG } from '../../config/version';

interface SystemDiagnostics {
  appVersion: string;
  os: string;
  arch: string;
  goVersion: string;
  appDataDir: string;
  databasePath: string;
  databaseSizeBytes: number;
  databaseWalMode: boolean;
  panelsCount: number;
  activePanelName: string;
  dpapiActive: boolean;
  dpapiTestPassed: boolean;
  dpapiLatencyMs: number;
  securityLockout: boolean;
  allocatedMemMb: number;
  totalAllocMemMb: number;
  goroutinesCount: number;
  timestamp: string;
}

interface SystemDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemDiagnosticsModal: React.FC<SystemDiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useI18n();
  const { addNotification } = useUIStore();
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app?.GetSystemDiagnostics) {
        const diag = await app.GetSystemDiagnostics();
        setDiagnostics(diag);
      }
    } catch (e) {
      console.error('Failed to load diagnostics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const handleCopyReport = () => {
    if (!diagnostics) return;

    const report = [
      `### SynoraDesk Diagnostic Report`,
      `- **Generated**: ${new Date().toISOString()}`,
      `- **App Version**: v${diagnostics.appVersion}`,
      `- **OS / Platform**: ${diagnostics.os} (${diagnostics.arch})`,
      `- **Go Runtime**: ${diagnostics.goVersion}`,
      `- **Goroutines**: ${diagnostics.goroutinesCount}`,
      `- **Allocated Heap**: ${diagnostics.allocatedMemMb.toFixed(2)} MB`,
      `- **Total Allocated**: ${diagnostics.totalAllocMemMb.toFixed(2)} MB`,
      ``,
      `#### Storage & Database`,
      `- **SQLite WAL Mode**: ${diagnostics.databaseWalMode ? 'Enabled' : 'Disabled'}`,
      `- **DB File Size**: ${formatBytes(diagnostics.databaseSizeBytes)}`,
      `- **DB Path**: \`${diagnostics.databasePath}\``,
      `- **Panels Configured**: ${diagnostics.panelsCount}`,
      `- **Active Panel**: ${diagnostics.activePanelName}`,
      ``,
      `#### Security & DPAPI`,
      `- **Windows DPAPI Subsystem**: ${diagnostics.dpapiActive ? 'Active' : 'Inactive'}`,
      `- **DPAPI Roundtrip Test**: ${diagnostics.dpapiTestPassed ? 'Passed' : 'Failed'}`,
      `- **DPAPI Latency**: ${diagnostics.dpapiLatencyMs.toFixed(3)} ms`,
      `- **Lockout Protected**: ${diagnostics.securityLockout ? 'Yes' : 'No'}`,
    ].join('\n');

    navigator.clipboard.writeText(report);
    setCopied(true);
    addNotification({
      type: 'success',
      title: t('common.copied') || 'Đã sao chép',
      message: t('diagnostics.reportCopied') || 'Đã sao chép báo cáo chẩn đoán hệ thống vào clipboard',
      duration: 2500,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenGitHubIssues = () => {
    const issueUrl = `${APP_CONFIG.issuesUrl}/new`;
    // @ts-ignore
    const runtime = window.runtime;
    if (runtime?.BrowserOpenURL) {
      runtime.BrowserOpenURL(issueUrl);
    } else {
      window.open(issueUrl, '_blank');
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
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="anim-modal-in"
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '88vh',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.55)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                {t('diagnostics.title') || 'Kiểm tra hệ thống & Chẩn đoán lỗi'}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                {t('diagnostics.subtitle') || 'Windows DPAPI, cơ sở dữ liệu, tài nguyên và cấu hình'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={fetchDiagnostics}
              disabled={loading}
              title={t('common.refresh') || 'Làm mới'}
              className="btn-interactive"
              style={{
                background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                color: 'var(--color-text-secondary)',
                cursor: loading ? 'not-allowed' : 'pointer',
                padding: '5px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
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
        </div>

        {/* Content */}
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
          {loading && !diagnostics ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <div>{t('diagnostics.scanning') || 'Đang phân tích cấu hình hệ thống...'}</div>
            </div>
          ) : diagnostics ? (
            <>
              {/* DPAPI Security Diagnostic Card */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface-hover)',
                  border: `1px solid ${diagnostics.dpapiTestPassed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  borderRadius: '10px',
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={16} color="var(--color-success)" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                      Windows Data Protection API (DPAPI)
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: diagnostics.dpapiTestPassed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: diagnostics.dpapiTestPassed ? 'var(--color-success)' : 'var(--color-error)',
                      border: `1px solid ${diagnostics.dpapiTestPassed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}
                  >
                    {diagnostics.dpapiTestPassed ? (t('diagnostics.statusHealthy') || 'Hoạt động tốt') : (t('diagnostics.statusError') || 'Gặp sự cố')}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                  Mã hóa cấp phần cứng Windows bảo vệ an toàn toàn bộ API Key, token và mật mã của bạn.
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  <span>Test Roundtrip: <strong style={{ color: 'var(--color-success)' }}>{diagnostics.dpapiTestPassed ? 'Passed' : 'Failed'}</strong></span>
                  <span>Độ trễ kiểm tra: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.dpapiLatencyMs.toFixed(3)} ms</strong></span>
                </div>
              </div>

              {/* Grid 2x2 for Details */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                  gap: '12px',
                }}
              >
                {/* SQLite WAL Storage */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                    <Database size={14} color="var(--color-primary-light)" /> SQLite WAL Engine
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>Dung lượng DB: <strong style={{ color: 'var(--color-text)' }}>{formatBytes(diagnostics.databaseSizeBytes)}</strong></div>
                    <div>Chế độ ghi: <strong style={{ color: 'var(--color-success)' }}>WAL (Write-Ahead-Log)</strong></div>
                    <div>Số Panel lưu trữ: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.panelsCount}</strong></div>
                  </div>
                </div>

                {/* System & Go Runtime */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                    <Cpu size={14} color="var(--color-warning)" /> Runtime & Shell
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>Hệ điều hành: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.os.toUpperCase()} ({diagnostics.arch})</strong></div>
                    <div>Trình biên dịch: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.goVersion}</strong></div>
                    <div>Bản dựng: <strong style={{ color: 'var(--color-primary-light)' }}>SynoraDesk v{diagnostics.appVersion}</strong></div>
                  </div>
                </div>

                {/* Memory Profile */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                    <Activity size={14} color="var(--color-primary-light)" /> Bộ nhớ & Luồng
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>Heap đang cấp phát: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.allocatedMemMb.toFixed(2)} MB</strong></div>
                    <div>Tổng Heap tích lũy: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.totalAllocMemMb.toFixed(2)} MB</strong></div>
                    <div>Số Goroutine: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.goroutinesCount}</strong></div>
                  </div>
                </div>

                {/* Workspace & Security Lockout */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                    <Lock size={14} color={diagnostics.securityLockout ? '#EF4444' : 'var(--color-success)'} /> Khóa bảo vệ
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>Panel hiện tại: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.activePanelName}</strong></div>
                    <div>Trạng thái khóa: <strong style={{ color: diagnostics.securityLockout ? '#EF4444' : 'var(--color-success)' }}>{diagnostics.securityLockout ? 'Đang kích hoạt' : 'An toàn (Mở)'}</strong></div>
                    <div>Thư mục dữ liệu: <strong style={{ color: 'var(--color-text)' }}>AppData/PteroDesk</strong></div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer Actions for Bug Reporting */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleCopyReport}
              disabled={!diagnostics}
              className="btn-interactive"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '6px',
                backgroundColor: copied ? 'rgba(34, 197, 94, 0.2)' : 'var(--color-surface-hover)',
                border: `1px solid ${copied ? 'var(--color-success)' : 'var(--color-border)'}`,
                color: copied ? 'var(--color-success)' : 'var(--color-text)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copied ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
              <span>{copied ? (t('diagnostics.copied') || 'Đã sao chép báo cáo') : (t('diagnostics.copyReport') || 'Sao chép báo cáo lỗi')}</span>
            </button>

            <button
              onClick={handleOpenGitHubIssues}
              className="btn-interactive"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Bug size={13} />
              <span>{t('diagnostics.reportOnGithub') || 'Báo lỗi trên GitHub'}</span>
              <ExternalLink size={11} />
            </button>
          </div>

          <button
            onClick={onClose}
            className="btn-interactive"
            style={{
              padding: '7px 16px',
              borderRadius: '6px',
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
    </div>,
    document.body
  );
};
