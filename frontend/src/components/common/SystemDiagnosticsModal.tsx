import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Database,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  X,
  Bug,
  Activity,
  Lock,
  Monitor,
  Layers,
  Globe,
  CheckCircle2,
  XCircle,
  FileWarning,
  Wifi,
  Terminal,
  Play,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { useUIStore } from '../../stores/uiStore';
import { usePanelStore } from '../../stores/panelStore';
import { useServerStore } from '../../stores/serverStore';
import { useSecurityStore } from '../../stores/securityStore';
import { APP_CONFIG } from '../../config/version';
import { openSafeExternalUrl } from '../../utils/safeUrl';

interface DiagnosticCheck {
  id: string;
  category: string;
  title: string;
  status: 'pass' | 'warn' | 'fail';
  summary: string;
  detail: string;
  remediation?: string;
}

interface ActivityRecord {
  id: number;
  panelId: string;
  panelName: string;
  serverId: string;
  action: string;
  result: string;
  error: string;
  timestamp: string;
}

interface PanelConnectivityDiagnostics {
  panelId: string;
  panelName: string;
  panelUrl: string;
  scheme: string;
  dnsResolvedIps: string;
  dnsLatencyMs: number;
  dnsError?: string;
  tlsVersion?: string;
  tlsCipherSuite?: string;
  tlsCertExpiry?: string;
  tlsCertIssuer?: string;
  tlsValid: boolean;
  tlsError?: string;
  clientApiStatus: string;
  clientApiLatencyMs: number;
  clientApiError?: string;
  appApiStatus: string;
  appApiLatencyMs: number;
  appApiError?: string;
  checkedAt: string;
}

interface SystemDiagnostics {
  appVersion: string;
  wailsVersion?: string;
  os: string;
  osName?: string;
  osDisplayVersion?: string;
  osBuild?: string;
  webView2Version?: string;
  arch: string;
  cpuCores?: number;
  hostname?: string;
  goVersion: string;
  uptimeSeconds?: number;
  sqliteVersion?: string;
  appDataDir: string;
  databasePath: string;
  databaseSizeBytes: number;
  databaseWalBytes?: number;
  databaseWalMode: boolean;
  databaseJournalMode?: string;
  databaseIntegrity?: string;
  logFilesCount?: number;
  logsTotalBytes?: number;
  diskFreeBytes?: number;
  panelsCount: number;
  activePanelName: string;
  activePanelUrl?: string;
  activePanelScheme?: string;
  activeHasClientKey?: boolean;
  activeHasAppKey?: boolean;
  consoleWsConnected?: boolean;
  consoleWsServer?: string;
  dpapiActive: boolean;
  dpapiTestPassed: boolean;
  dpapiLatencyMs: number;
  tpmHardwareBacked?: boolean;
  sessionLockEnabled?: boolean;
  sessionLockType?: string;
  securityLockout: boolean;
  autoWipeEnabled?: boolean;
  failedAttempts?: number;
  allocatedMemMb: number;
  totalAllocMemMb: number;
  gcPauseTotalMs?: number;
  numGc?: number;
  goroutinesCount: number;
  detachedCount?: number;
  recentLogErrors?: string[];
  recentFailedActions?: ActivityRecord[];
  healthChecks?: DiagnosticCheck[];
  timestamp: string;
}

interface SystemDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DebugStatus {
  tpmAvailable: boolean;
  tpmEnabled: boolean;
  dbConnected: boolean;
  debugLogging: boolean;
}

type DiagTab = 'overview' | 'security' | 'network' | 'system' | 'debug';

export const SystemDiagnosticsModal: React.FC<SystemDiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useI18n();
  const { addNotification } = useUIStore();
  const [activeTab, setActiveTab] = useState<DiagTab>('overview');
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [connectivity, setConnectivity] = useState<PanelConnectivityDiagnostics | null>(null);
  const [debugStatus, setDebugStatus] = useState<DebugStatus | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingNet, setCheckingNet] = useState(false);
  const [copiedMode, setCopiedMode] = useState<'none' | 'anon' | 'full'>('none');

  const appendDebugLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 50));
  };

  const fetchDebugStatus = async () => {
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app?.GetDebugStatus) {
        const st = await app.GetDebugStatus();
        setDebugStatus(st);
      }
    } catch (e: any) {
      appendDebugLog(`GetDebugStatus error: ${e?.message || e}`);
    }
  };

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

  const runConnectivityCheck = async () => {
    setCheckingNet(true);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app?.RunPanelConnectivityCheck) {
        const res = await app.RunPanelConnectivityCheck();
        setConnectivity(res);
      }
    } catch (e: any) {
      addNotification({
        type: 'error',
        title: 'Kiểm tra kết nối thất bại',
        message: e?.message || 'Không thể kiểm tra kết nối tới Panel',
      });
    } finally {
      setCheckingNet(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
      setConnectivity(null);
      fetchDiagnostics();
      fetchDebugStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds || seconds < 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const maskUserPath = (p: string) =>
    p.replace(/([A-Za-z]:\\Users\\)([^\\]+)/gi, '$1<USER>');

  const buildReport = (anonymize: boolean) => {
    if (!diagnostics) return '';
    const checksSummary = (diagnostics.healthChecks || [])
      .map((c) => `- [${c.status.toUpperCase()}] **${c.title}**: ${c.summary}`)
      .join('\n');

    const lines = [
      `### SynoraDesk Diagnostic & Environment Report (${anonymize ? 'Anonymized' : 'Full'})`,
      `- **Generated**: ${new Date().toISOString()}`,
      `- **App Version**: v${diagnostics.appVersion} (Uptime: ${formatUptime(diagnostics.uptimeSeconds)})`,
      `- **Windows OS**: ${diagnostics.osName || diagnostics.os} ${diagnostics.osDisplayVersion ? `(${diagnostics.osDisplayVersion})` : ''} | Build ${diagnostics.osBuild || 'N/A'}`,
      `- **Hardware / Host**: ${diagnostics.arch}, ${diagnostics.cpuCores || 1} cores | Hostname: ${anonymize ? '<REDACTED>' : diagnostics.hostname || 'Localhost'}`,
      `- **Edge WebView2**: ${diagnostics.webView2Version || 'Installed'} | **Go**: ${diagnostics.goVersion} | **Wails**: ${diagnostics.wailsVersion || 'v2.17.1'}`,
      ``,
      `#### Health Checks`,
      checksSummary || '- No checks recorded',
      ``,
      `#### Security & Hardware Crypto`,
      `- **TPM 2.0 Hardware-Backed**: ${diagnostics.tpmHardwareBacked ? 'Yes (Microsoft Platform Crypto Provider)' : 'No (DPAPI Fallback)'}`,
      `- **Windows DPAPI**: ${diagnostics.dpapiActive ? 'Active' : 'Inactive'} | Roundtrip: ${diagnostics.dpapiTestPassed ? 'Passed' : 'Failed'} (${diagnostics.dpapiLatencyMs.toFixed(3)} ms)`,
      `- **Session Lock**: ${diagnostics.sessionLockEnabled ? `Enabled (${diagnostics.sessionLockType})` : 'Disabled'} | Lockout Active: ${diagnostics.securityLockout ? 'Yes' : 'No'} | Auto-Wipe: ${diagnostics.autoWipeEnabled ? 'Enabled' : 'Disabled'}`,
      ``,
      `#### Storage & Memory`,
      `- **SQLite Engine**: v${diagnostics.sqliteVersion || '3.x'} | Integrity: ${diagnostics.databaseIntegrity || 'unknown'} | Journal: ${diagnostics.databaseJournalMode || 'wal'}`,
      `- **DB Size**: ${formatBytes(diagnostics.databaseSizeBytes)} (WAL: ${formatBytes(diagnostics.databaseWalBytes || 0)})`,
      `- **Disk Free**: ${formatBytes(diagnostics.diskFreeBytes || 0)} | Logs: ${diagnostics.logFilesCount || 0} files (${formatBytes(diagnostics.logsTotalBytes || 0)})`,
      `- **DB Path**: \`${anonymize ? maskUserPath(diagnostics.databasePath) : diagnostics.databasePath}\``,
      `- **Memory / Runtime**: Heap ${diagnostics.allocatedMemMb.toFixed(2)} MB | TotalAlloc ${diagnostics.totalAllocMemMb.toFixed(2)} MB | GC ${diagnostics.numGc || 0} (${(diagnostics.gcPauseTotalMs || 0).toFixed(2)} ms) | Goroutines: ${diagnostics.goroutinesCount}`,
      ``,
      `#### Panel & Network`,
      `- **Panels Configured**: ${diagnostics.panelsCount} | **Active Panel**: ${anonymize ? `<PANEL:${diagnostics.activePanelScheme || 'none'}>` : diagnostics.activePanelName}`,
      `- **Wings Console WS**: ${diagnostics.consoleWsConnected ? `Connected (${anonymize ? '<SERVER>' : diagnostics.consoleWsServer})` : 'Disconnected'}`,
    ];

    if (connectivity) {
      lines.push(
        `- **Live Connectivity**: DNS ${connectivity.dnsError ? `Error (${connectivity.dnsError})` : `${connectivity.dnsLatencyMs} ms`} | TLS ${connectivity.scheme === 'https' ? (connectivity.tlsValid ? `${connectivity.tlsVersion} (Exp: ${connectivity.tlsCertExpiry})` : `Error (${connectivity.tlsError})`) : 'N/A (HTTP)'} | Client API: ${connectivity.clientApiStatus} (${connectivity.clientApiLatencyMs} ms) | App API: ${connectivity.appApiStatus} (${connectivity.appApiLatencyMs} ms)`
      );
    }

    if (diagnostics.recentLogErrors && diagnostics.recentLogErrors.length > 0) {
      lines.push('', `#### Recent Log Warnings/Errors (${diagnostics.recentLogErrors.length})`);
      diagnostics.recentLogErrors.slice(-10).forEach((l) => {
        lines.push(`\`${anonymize ? maskUserPath(l) : l}\``);
      });
    }

    return lines.join('\n');
  };

  const handleCopyReport = (anonymize: boolean) => {
    const report = buildReport(anonymize);
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopiedMode(anonymize ? 'anon' : 'full');
    addNotification({
      type: 'success',
      title: t('common.copied') || 'Đã sao chép',
      message: anonymize
        ? 'Đã sao chép báo cáo ẩn danh an toàn để chia sẻ công khai'
        : 'Đã sao chép báo cáo chẩn đoán đầy đủ vào clipboard',
      duration: 2500,
    });
    setTimeout(() => setCopiedMode('none'), 2200);
  };

  const handleOpenGitHubIssues = () => {
    openSafeExternalUrl(`${APP_CONFIG.issuesUrl}/new`);
  };

  const checks = diagnostics?.healthChecks || [];
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const passCount = checks.filter((c) => c.status === 'pass').length;

  const overallStatus = failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass';
  const overallColor =
    overallStatus === 'fail' ? 'var(--color-error)' : overallStatus === 'warn' ? 'var(--color-warning)' : 'var(--color-success)';

  const renderStatusBadge = (status: 'pass' | 'warn' | 'fail') => {
    const map = {
      pass: { bg: 'rgba(34, 197, 94, 0.14)', color: 'var(--color-success)', label: 'Đạt', icon: CheckCircle2 },
      warn: { bg: 'rgba(245, 158, 11, 0.14)', color: 'var(--color-warning)', label: 'Cảnh báo', icon: AlertTriangle },
      fail: { bg: 'rgba(239, 68, 68, 0.14)', color: 'var(--color-error)', label: 'Lỗi', icon: XCircle },
    }[status];
    const Icon = map.icon;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '11px',
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: '12px',
          backgroundColor: map.bg,
          color: map.color,
        }}
      >
        <Icon size={12} /> {map.label}
      </span>
    );
  };

  const tabBtnStyle = (tab: DiagTab): React.CSSProperties => ({
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: activeTab === tab ? 600 : 500,
    color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text-muted)',
    backgroundColor: activeTab === tab ? 'var(--color-surface-hover)' : 'transparent',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

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
          maxWidth: '780px',
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
            backgroundColor: 'var(--color-surface-elevated)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: overallColor,
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
                TPM 2.0 + Windows DPAPI, SQLite Integrity, Kết nối Panel/TLS & Nhật ký lỗi
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
                padding: '5px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
              }}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>Quét lại</span>
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

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: '2px',
            padding: '0 16px',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg)',
            overflowX: 'auto',
          }}
        >
          <button type="button" style={tabBtnStyle('overview')} onClick={() => setActiveTab('overview')}>
            Tổng quan ({passCount}/{checks.length} Đạt)
          </button>
          <button type="button" style={tabBtnStyle('security')} onClick={() => setActiveTab('security')}>
            Bảo mật & TPM 2.0
          </button>
          <button type="button" style={tabBtnStyle('network')} onClick={() => setActiveTab('network')}>
            Mạng & Panel API
          </button>
          <button type="button" style={tabBtnStyle('system')} onClick={() => setActiveTab('system')}>
            Hệ thống, DB & Nhật ký ({(diagnostics?.recentLogErrors?.length || 0) + (diagnostics?.recentFailedActions?.length || 0)})
          </button>
          <button type="button" style={tabBtnStyle('debug')} onClick={() => { setActiveTab('debug'); fetchDebugStatus(); }}>
            Debug Manager
          </button>
        </div>

        {/* Content */}
        <div
          className="custom-scrollbar"
          style={{
            padding: '18px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            flex: 1,
          }}
        >
          {loading && !diagnostics ? (
            <div style={{ textAlign: 'center', padding: '42px 0', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <div>{t('diagnostics.scanning') || 'Đang phân tích cấu hình hệ thống...'}</div>
            </div>
          ) : diagnostics ? (
            <>
              {/* TAB 1: OVERVIEW & HEALTH CHECKS */}
              {activeTab === 'overview' && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--color-surface-hover)',
                      border: `1px solid ${overallColor}`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: overallColor }}>
                        {failCount > 0
                          ? `Phát hiện ${failCount} lỗi nghiêm trọng và ${warnCount} cảnh báo`
                          : warnCount > 0
                          ? `Hệ thống ổn định (${warnCount} khuyến nghị cần lưu ý)`
                          : 'Tất cả kiểm tra hệ thống đều đạt'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        SynoraDesk v{diagnostics.appVersion} • Uptime {formatUptime(diagnostics.uptimeSeconds)} • {diagnostics.osName || diagnostics.os} {diagnostics.osDisplayVersion || ''}
                      </div>
                    </div>
                    {renderStatusBadge(overallStatus)}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {checks.map((chk) => (
                      <div
                        key={chk.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--color-surface-hover)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text)' }}>
                            {chk.title}
                          </span>
                          {renderStatusBadge(chk.status)}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                          <strong>{chk.summary}</strong> — {chk.detail}
                        </div>
                        {chk.remediation && (
                          <div
                            style={{
                              marginTop: '6px',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(245, 158, 11, 0.08)',
                              border: '1px solid rgba(245, 158, 11, 0.2)',
                              fontSize: '11px',
                              color: 'var(--color-warning)',
                            }}
                          >
                            Gợi ý khắc phục: {chk.remediation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* TAB 2: SECURITY & HARDWARE CRYPTO */}
              {activeTab === 'security' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      backgroundColor: 'var(--color-surface-hover)',
                      border: `1px solid ${diagnostics.dpapiTestPassed ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                      borderRadius: '10px',
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                        <ShieldCheck size={16} color={diagnostics.dpapiTestPassed ? 'var(--color-success)' : 'var(--color-error)'} />
                        <span>TPM 2.0 + Windows DPAPI Envelope</span>
                      </div>
                      {renderStatusBadge(diagnostics.dpapiTestPassed ? (diagnostics.tpmHardwareBacked ? 'pass' : 'warn') : 'fail')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      {diagnostics.tpmHardwareBacked
                        ? 'Đang kích hoạt bảo vệ phần cứng 2 lớp: Windows DPAPI (Current User) + AES-256-GCM với khóa RSA-2048 lưu trên chip TPM 2.0.'
                        : 'Đang sử dụng Windows DPAPI thuần (không phát hiện Microsoft Platform Crypto Provider / TPM 2.0).'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '10px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      <span>TPM 2.0 Provider: <strong style={{ color: diagnostics.tpmHardwareBacked ? 'var(--color-success)' : 'var(--color-warning)' }}>{diagnostics.tpmHardwareBacked ? 'Active' : 'Unavailable'}</strong></span>
                      <span>DPAPI Roundtrip: <strong style={{ color: diagnostics.dpapiTestPassed ? 'var(--color-success)' : 'var(--color-error)' }}>{diagnostics.dpapiTestPassed ? 'Passed' : 'Failed'}</strong></span>
                      <span>Độ trễ: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.dpapiLatencyMs.toFixed(3)} ms</strong></span>
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '10px',
                      fontSize: '11.5px',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', gridColumn: '1 / -1', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text)' }}>
                      <Lock size={14} color="var(--color-primary-light)" /> Khóa phiên & Chống dò mật khẩu
                    </div>
                    <div>Session Lock (Argon2id): <strong style={{ color: diagnostics.sessionLockEnabled ? 'var(--color-success)' : 'var(--color-warning)' }}>{diagnostics.sessionLockEnabled ? `Bật (${diagnostics.sessionLockType})` : 'Chưa bật'}</strong></div>
                    <div>Trạng thái Lockout: <strong style={{ color: diagnostics.securityLockout ? 'var(--color-error)' : 'var(--color-success)' }}>{diagnostics.securityLockout ? 'Đang khóa' : 'Bình thường'}</strong></div>
                    <div>Số lần nhập sai gần đây: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.failedAttempts || 0}</strong></div>
                    <div>Auto-Wipe khi sai quá nhiều: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.autoWipeEnabled ? 'Đang bật' : 'Tắt'}</strong></div>
                  </div>
                </div>
              )}

              {/* TAB 3: NETWORK & PANEL API */}
              {activeTab === 'network' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Globe size={14} color="#38BDF8" /> Panel đang hoạt động: {diagnostics.activePanelName}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                        URL: <code>{diagnostics.activePanelUrl || 'Chưa cấu hình'}</code> • Wings Console WS:{' '}
                        <strong style={{ color: diagnostics.consoleWsConnected ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                          {diagnostics.consoleWsConnected ? `Đã kết nối (${diagnostics.consoleWsServer})` : 'Chưa kết nối'}
                        </strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={runConnectivityCheck}
                      disabled={checkingNet || !diagnostics.activePanelUrl}
                      className="btn-interactive"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 14px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-primary)',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: checkingNet || !diagnostics.activePanelUrl ? 'not-allowed' : 'pointer',
                        opacity: checkingNet || !diagnostics.activePanelUrl ? 0.6 : 1,
                      }}
                    >
                      <Wifi size={13} />
                      <span>{checkingNet ? 'Đang kiểm tra...' : 'Chạy kiểm tra kết nối'}</span>
                    </button>
                  </div>

                  {connectivity ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '10px',
                      }}
                    >
                      <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', fontSize: '11px' }}>
                        <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-text)', marginBottom: '6px' }}>DNS & Định tuyến</div>
                        <div style={{ color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div>Trạng thái: <strong style={{ color: connectivity.dnsError ? 'var(--color-error)' : 'var(--color-success)' }}>{connectivity.dnsError ? 'Lỗi DNS' : `Thành công (${connectivity.dnsLatencyMs} ms)`}</strong></div>
                          <div>IP phân giải: <strong style={{ color: 'var(--color-text)' }}>{connectivity.dnsResolvedIps || connectivity.dnsError || 'N/A'}</strong></div>
                        </div>
                      </div>

                      <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', fontSize: '11px' }}>
                        <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-text)', marginBottom: '6px' }}>TLS / Chứng chỉ SSL</div>
                        <div style={{ color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {connectivity.scheme !== 'https' ? (
                            <div style={{ color: 'var(--color-warning)' }}>Panel đang dùng HTTP (không có TLS)</div>
                          ) : connectivity.tlsValid ? (
                            <>
                              <div>Giao thức: <strong style={{ color: 'var(--color-success)' }}>{connectivity.tlsVersion}</strong></div>
                              <div>Issuer: <strong style={{ color: 'var(--color-text)' }}>{connectivity.tlsCertIssuer || 'N/A'}</strong></div>
                              <div>Hết hạn: <strong style={{ color: 'var(--color-text)' }}>{connectivity.tlsCertExpiry}</strong></div>
                            </>
                          ) : (
                            <div style={{ color: 'var(--color-error)' }}>Lỗi TLS: {connectivity.tlsError}</div>
                          )}
                        </div>
                      </div>

                      <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', fontSize: '11px' }}>
                        <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-text)', marginBottom: '6px' }}>Pterodactyl Client API</div>
                        <div style={{ color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div>Trạng thái: <strong style={{ color: connectivity.clientApiStatus === 'ok' ? 'var(--color-success)' : connectivity.clientApiStatus === 'unconfigured' ? 'var(--color-warning)' : 'var(--color-error)' }}>{connectivity.clientApiStatus}</strong></div>
                          <div>Độ trễ: <strong style={{ color: 'var(--color-text)' }}>{connectivity.clientApiLatencyMs} ms</strong></div>
                          {connectivity.clientApiError && <div style={{ color: 'var(--color-error)', wordBreak: 'break-word' }}>{connectivity.clientApiError}</div>}
                        </div>
                      </div>

                      <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', fontSize: '11px' }}>
                        <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-text)', marginBottom: '6px' }}>Pterodactyl Application API</div>
                        <div style={{ color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div>Trạng thái: <strong style={{ color: connectivity.appApiStatus === 'ok' ? 'var(--color-success)' : connectivity.appApiStatus === 'unconfigured' ? 'var(--color-warning)' : 'var(--color-error)' }}>{connectivity.appApiStatus}</strong></div>
                          <div>Độ trễ: <strong style={{ color: 'var(--color-text)' }}>{connectivity.appApiLatencyMs} ms</strong></div>
                          {connectivity.appApiError && <div style={{ color: 'var(--color-error)', wordBreak: 'break-word' }}>{connectivity.appApiError}</div>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontSize: '12px', border: '1px dashed var(--color-border)', borderRadius: '8px' }}>
                      Nhấn <strong>"Chạy kiểm tra kết nối"</strong> để kiểm tra trực tiếp DNS, chứng chỉ TLS và độ trễ API tới Panel.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: SYSTEM, DB & RECENT ERRORS */}
              {activeTab === 'system' && (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    <div style={{ backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                        <Monitor size={14} color="#38BDF8" /> Hệ điều hành Windows
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>Phiên bản: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.osName || diagnostics.os.toUpperCase()} {diagnostics.osDisplayVersion ? `(${diagnostics.osDisplayVersion})` : ''}</strong></div>
                        <div>Build: <strong style={{ color: 'var(--color-primary-light)' }}>{diagnostics.osBuild || 'N/A'}</strong></div>
                        <div>CPU / Kiến trúc: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.arch} ({diagnostics.cpuCores || 1} cores)</strong></div>
                        <div>Hostname: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.hostname || 'Localhost'}</strong></div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                        <Layers size={14} color="var(--color-warning)" /> Runtimes & Tài nguyên
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>WebView2: <strong style={{ color: 'var(--color-text)' }}>v{diagnostics.webView2Version || 'Installed'}</strong></div>
                        <div>Go / Wails: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.goVersion} / {diagnostics.wailsVersion || 'v2.17.1'}</strong></div>
                        <div>Heap / GC: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.allocatedMemMb.toFixed(2)} MB ({diagnostics.numGc || 0} GC)</strong></div>
                        <div>Goroutines / Detached: <strong style={{ color: 'var(--color-text)' }}>{diagnostics.goroutinesCount} / {diagnostics.detachedCount || 0}</strong></div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                        <Database size={14} color="var(--color-primary-light)" /> SQLite & Lưu trữ
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>SQLite / Quick Check: <strong style={{ color: diagnostics.databaseIntegrity === 'ok' ? 'var(--color-success)' : 'var(--color-error)' }}>v{diagnostics.sqliteVersion} ({diagnostics.databaseIntegrity || 'unknown'})</strong></div>
                        <div>DB / WAL Size: <strong style={{ color: 'var(--color-text)' }}>{formatBytes(diagnostics.databaseSizeBytes)} / {formatBytes(diagnostics.databaseWalBytes || 0)}</strong></div>
                        <div>Logs ({diagnostics.logFilesCount || 0} tệp): <strong style={{ color: 'var(--color-text)' }}>{formatBytes(diagnostics.logsTotalBytes || 0)}</strong></div>
                        <div>Ổ đĩa trống: <strong style={{ color: 'var(--color-text)' }}>{formatBytes(diagnostics.diskFreeBytes || 0)}</strong></div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Log Errors */}
                  <div style={{ backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>
                      <FileWarning size={14} color="var(--color-warning)" /> Nhật ký cảnh báo/lỗi hôm nay (đã che thông tin nhạy cảm)
                    </div>
                    {diagnostics.recentLogErrors && diagnostics.recentLogErrors.length > 0 ? (
                      <div
                        className="custom-scrollbar"
                        style={{
                          maxHeight: '150px',
                          overflowY: 'auto',
                          backgroundColor: 'rgba(0,0,0,0.28)',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10.5px',
                          color: 'var(--color-text-secondary)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        {diagnostics.recentLogErrors.map((line, i) => (
                          <div key={i} style={{ wordBreak: 'break-all' }}>{line}</div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Không ghi nhận lỗi/cảnh báo nào trong nhật ký hôm nay.</div>
                    )}
                  </div>
                </>
              )}

              {/* TAB 5: DEBUG MANAGER */}
              {activeTab === 'debug' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      fontSize: '11.5px',
                      color: 'var(--color-warning)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      <strong>Debug Manager (An toàn):</strong> Chạy các tác vụ chẩn đoán & giả lập lỗi có sẵn trong mã nguồn (không sử dụng <code>eval</code>).
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      F12 DevTools: dùng <code>wails build -devtools</code> hoặc <code>wails dev</code>
                    </span>
                  </div>

                  {/* Backend Hardware/DB Toggles */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {/* TPM 2.0 Toggle */}
                    <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', fontSize: '11.5px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>Mã hóa phần cứng TPM 2.0</div>
                      <div style={{ color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                        Trạng thái: <strong style={{ color: debugStatus?.tpmEnabled ? 'var(--color-success)' : 'var(--color-warning)' }}>{debugStatus?.tpmEnabled ? 'Đang bật (TPM+DPAPI)' : 'Đang tắt (DPAPI Fallback)'}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={async () => {
                            // @ts-ignore
                            const app = window.go?.main?.App;
                            const next = !debugStatus?.tpmEnabled;
                            await app?.DebugSetTPMEnabled?.(next);
                            appendDebugLog(`TPM 2.0 envelope ${next ? 'ENABLED' : 'DISABLED'}`);
                            await fetchDebugStatus();
                            await fetchDiagnostics();
                          }}
                          style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '11px', cursor: 'pointer' }}
                        >
                          {debugStatus?.tpmEnabled ? 'Thử tắt TPM' : 'Bật lại TPM'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            // @ts-ignore
                            const res = await window.go?.main?.App?.DebugTestCryptoRoundtrip?.();
                            appendDebugLog(`Crypto Roundtrip -> ${res}`);
                          }}
                          style={{ padding: '5px 10px', borderRadius: '5px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#FFFFFF', fontSize: '11px', cursor: 'pointer' }}
                        >
                          Test Roundtrip
                        </button>
                      </div>
                    </div>

                    {/* SQLite DB Toggle */}
                    <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', fontSize: '11.5px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>Kết nối SQLite Database</div>
                      <div style={{ color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                        Trạng thái: <strong style={{ color: debugStatus?.dbConnected ? 'var(--color-success)' : 'var(--color-error)' }}>{debugStatus?.dbConnected ? 'Đang kết nối' : 'Đã ngắt kết nối'}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              // @ts-ignore
                              const res = await window.go?.main?.App?.DebugToggleDBConnection?.(Boolean(debugStatus?.dbConnected));
                              appendDebugLog(res);
                            } catch (e: any) {
                              appendDebugLog(`DB Toggle error: ${e?.message || e}`);
                            }
                            await fetchDebugStatus();
                          }}
                          style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: debugStatus?.dbConnected ? 'var(--color-error)' : 'var(--color-success)', fontSize: '11px', cursor: 'pointer' }}
                        >
                          {debugStatus?.dbConnected ? 'Ngắt kết nối DB' : 'Kết nối lại DB'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              // @ts-ignore
                              const res = await window.go?.main?.App?.DebugRunWALCheckpoint?.();
                              appendDebugLog(res);
                            } catch (e: any) {
                              appendDebugLog(`WAL Checkpoint error: ${e?.message || e}`);
                            }
                          }}
                          style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '11px', cursor: 'pointer' }}
                        >
                          WAL Checkpoint
                        </button>
                      </div>
                    </div>

                    {/* Logging & GC */}
                    <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', fontSize: '11.5px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>Logger & Go Runtime</div>
                      <div style={{ color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                        Log Level: <strong style={{ color: 'var(--color-text)' }}>{debugStatus?.debugLogging ? 'DEBUG' : 'INFO'}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={async () => {
                            // @ts-ignore
                            await window.go?.main?.App?.DebugSetLogLevel?.(!debugStatus?.debugLogging);
                            appendDebugLog(`Log level -> ${!debugStatus?.debugLogging ? 'DEBUG' : 'INFO'}`);
                            await fetchDebugStatus();
                          }}
                          style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '11px', cursor: 'pointer' }}
                        >
                          {debugStatus?.debugLogging ? 'Chuyển INFO' : 'Bật DEBUG Log'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            // @ts-ignore
                            const res = await window.go?.main?.App?.DebugRunGC?.();
                            appendDebugLog(res);
                            await fetchDiagnostics();
                          }}
                          style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '11px', cursor: 'pointer' }}
                        >
                          Force GC
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Built-in Frontend JS Presets */}
                  <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>
                      <Terminal size={14} color="var(--color-primary-light)" /> Kịch bản kiểm thử Frontend có sẵn
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          usePanelStore.getState().markDisconnected('Debug Manager: Giả lập mất kết nối máy chủ');
                          appendDebugLog('JS Preset: markDisconnected() applied to panelStore');
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-error)', fontSize: '11px', cursor: 'pointer' }}
                      >
                        <Play size={10} /> Giả lập mất kết nối Panel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ms = await usePanelStore.getState().checkPanelPing();
                          appendDebugLog(`JS Preset: checkPanelPing() -> ${ms !== null ? `${ms} ms` : 'disconnected'}`);
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-success)', fontSize: '11px', cursor: 'pointer' }}
                      >
                        <Play size={10} /> Ping lại Panel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          useServerStore.getState().resetPanelData();
                          appendDebugLog('JS Preset: serverStore.resetPanelData() cleared');
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '11px', cursor: 'pointer' }}
                      >
                        <Play size={10} /> Xóa Cache ServerStore
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('synora:reload'));
                          appendDebugLog('JS Preset: dispatched synora:reload event');
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '11px', cursor: 'pointer' }}
                      >
                        <Play size={10} /> Trigger synora:reload
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const p = usePanelStore.getState();
                          const s = useServerStore.getState();
                          const sec = useSecurityStore.getState();
                          appendDebugLog(
                            `Store Snapshot: activePanel=${p.activePanel?.name || 'none'} status=${p.connectionStatus} ping=${p.panelPingMs}ms servers=${s.servers.length} lock=${sec.lockType}`
                          );
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-primary-light)', fontSize: '11px', cursor: 'pointer' }}
                      >
                        <Play size={10} /> Snapshot Stores
                      </button>
                    </div>
                  </div>

                  {/* Debug Console Output */}
                  <div
                    className="custom-scrollbar"
                    style={{
                      minHeight: '110px',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      backgroundColor: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--color-text-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    {debugLogs.length === 0 ? (
                      <span style={{ color: 'var(--color-text-muted)' }}>// Kết quả các lệnh Debug Manager sẽ hiển thị tại đây...</span>
                    ) : (
                      debugLogs.map((l, idx) => <div key={idx}>{l}</div>)
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer Actions for Bug Reporting */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleCopyReport(true)}
              disabled={!diagnostics}
              className="btn-interactive"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '6px',
                backgroundColor: copiedMode === 'anon' ? 'rgba(34, 197, 94, 0.2)' : 'var(--color-primary)',
                border: 'none',
                color: copiedMode === 'anon' ? 'var(--color-success)' : '#FFFFFF',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copiedMode === 'anon' ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedMode === 'anon' ? 'Đã sao chép (Ẩn danh)' : 'Sao chép báo cáo ẩn danh'}</span>
            </button>

            <button
              onClick={() => handleCopyReport(false)}
              disabled={!diagnostics}
              className="btn-interactive"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '6px',
                backgroundColor: copiedMode === 'full' ? 'rgba(34, 197, 94, 0.2)' : 'var(--color-surface-hover)',
                border: `1px solid ${copiedMode === 'full' ? 'var(--color-success)' : 'var(--color-border)'}`,
                color: copiedMode === 'full' ? 'var(--color-success)' : 'var(--color-text)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {copiedMode === 'full' ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedMode === 'full' ? 'Đã sao chép đầy đủ' : 'Sao chép đầy đủ'}</span>
            </button>

            <button
              onClick={handleOpenGitHubIssues}
              className="btn-interactive"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
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
