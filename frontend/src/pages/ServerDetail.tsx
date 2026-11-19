import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Play,
  Square,
  RotateCw,
  Power,
  Terminal,
  Cpu,
  HardDrive,
  FolderTree,
  Database,
  Network,
  Settings,
  FileText,
  Clock,
  Wifi,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Activity,
  FolderPlus,
  FilePlus,
  Upload,
  Download,
  Trash2,
  Edit2,
  Save,
  Send,
  X,
  Radio,
  FileCode2,
  Code2,
  Shield,
  ChevronRight,
  Archive,
  Users,
  Lock,
  Unlock,
  DownloadCloud,
  Plus,
  ArrowDown,
  Bookmark,
  Copy,
  Globe,
  FileArchive,
  Key,
  Star,
  Tag,
  Check,
  ArrowUp,
  Sliders,
  Server as ServerIcon,
  HelpCircle,
  CheckCheck,
  Search,
  Code,
  Container,
  Info,
  ExternalLink,
  Layers,
  Lightbulb,
  Zap,
  Eye,
  EyeOff,
  RotateCcw,
  LayoutGrid,
  List,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { ColorizedLine, ConsoleToolbar } from '../components/common/ConsoleViewer';
import { ServerSectionHeader } from '../components/server/ServerSectionHeader';
import { ServerSettingsTab } from '../components/server/settings/ServerSettingsTab';
import { PteroMonacoEditor } from '../components/common/PteroMonacoEditor';
import { ServerIDE } from '../components/common/ServerIDE';
import { ResourceChart } from '../components/common/ResourceChart';
import { DisconnectedState } from '../components/common/DisconnectedState';
import { CommandPresetsBar } from '../components/common/CommandPresetsBar';
import { SubuserPermissionsModal } from '../components/common/SubuserPermissionsModal';
import { HttpErrorView } from '../components/common/HttpErrorView';
import { useServerStore, Server, ResourceUsage } from '../stores/serverStore';
import { useUIStore } from '../stores/uiStore';
import { usePanelStore } from '../stores/panelStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useI18n } from '../i18n';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { OpenDetachedWindow } from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';

interface ServerDetailProps {
  identifier: string;
  onBack: () => void;
  initialTab?: string;
  isDetachedWindow?: boolean;
}

type TabType = 'console' | 'files' | 'ide' | 'databases' | 'network' | 'startup' | 'backups' | 'subusers' | 'settings';

interface UnifiedFile {
  name: string;
  size: number;
  mode?: string;
  isDir: boolean;
  modifiedTime?: string;
}

export const ServerDetail: React.FC<ServerDetailProps> = ({
  identifier,
  onBack,
  initialTab,
  isDetachedWindow,
}) => {
  const {
    selectedServer,
    fetchServer,
    fetchResources,
    resources,
    sendPowerAction,
  } = useServerStore();

  const { activePanel } = usePanelStore();
  const { addNotification } = useUIStore();

  const [activeTab, setActiveTab] = useState<TabType>((initialTab as TabType) || 'console');
  const [loading, setLoading] = useState(true);
  const [serverLoadError, setServerLoadError] = useState<string | null>(null);
  const [serverNotFound, setServerNotFound] = useState(false);

  // Metrics banner collapsed state (persisted)
  const [metricsCollapsed, setMetricsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('pterodesk_metrics_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('pterodesk_metrics_collapsed', String(metricsCollapsed));
  }, [metricsCollapsed]);

  const handleOpenDetachedWindow = async () => {
    try {
      await OpenDetachedWindow(new main.DetachedWindowConfig({
        isDetached: true,
        type: 'server',
        server: identifier,
        subtab: activeTab,
        filePath: '',
        isSftp: false,
        title: `${server?.name || identifier} - ${activeTab.toUpperCase()}`,
      }));
      addNotification({
        type: 'success',
        title: t('serverDetail.openWindow'),
        message: t('serverDetail.windowOpened', { server: server?.name || identifier }),
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('serverDetail.openWindowError'),
        message: err.message || t('serverDetail.openWindowFailed'),
      });
    }
  };

  // Sync initialTab when changed
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as TabType);
    }
  }, [initialTab]);

  // File Manager View Mode with localStorage persistence
  const [fileViewMode, setFileViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('pterodesk_files_view_mode') as 'list' | 'grid') || 'list';
  });

  useEffect(() => {
    localStorage.setItem('pterodesk_files_view_mode', fileViewMode);
  }, [fileViewMode]);

  // Server Settings State
  const [settingServerName, setSettingServerName] = useState('');
  const [settingServerDesc, setSettingServerDesc] = useState('');
  const [settingDockerImage, setSettingDockerImage] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [reinstallModalOpen, setReinstallModalOpen] = useState(false);
  const [reinstallConfirmInput, setReinstallConfirmInput] = useState('');
  const [reinstalling, setReinstalling] = useState(false);

  const [consoleLines, setConsoleLines] = useState<string[]>([
    'Connected to daemon WebSocket...',
    'Loading server state...',
  ]);
  const [commandInput, setCommandInput] = useState('');
  const [optimisticState, setOptimisticState] = useState<string | null>(null);
  const [powerDialog, setPowerDialog] = useState<'start' | 'stop' | 'restart' | 'kill' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Command history per server (ArrowUp / ArrowDown navigation)
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [tempDraft, setTempDraft] = useState<string>('');
  const [lastExecutedCommand, setLastExecutedCommand] = useState<string>('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`pterodesk_cmd_history_${identifier}`);
      if (saved) {
        setCmdHistory(JSON.parse(saved));
      } else {
        setCmdHistory([]);
      }
    } catch {}
    setHistoryIndex(-1);
    setTempDraft('');
  }, [identifier]);

  // Console auto-scroll & scrolling state
  const [autoScroll, setAutoScroll] = useState(true);
  const consoleContainerRef = useRef<HTMLDivElement>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    setAutoScroll(true);
  };

  const handleConsoleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  // Files & SFTP State
  const [useSftpMode, setUseSftpMode] = useState(true);
  const [sftpConnected, setSftpConnected] = useState(false);
  const [sftpConnecting, setSftpConnecting] = useState(false);
  const [sftpHost, setSftpHost] = useState('');
  const [sftpPort, setSftpPort] = useState(2022);
  const [sftpUsername, setSftpUsername] = useState('');
  const [sftpPassword, setSftpPassword] = useState('');

  const [currentDir, setCurrentDir] = useState('/');
  const [fileList, setFileList] = useState<UnifiedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Text File Editor Modal
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [savingFile, setSavingFile] = useState(false);

  // File Deletion Dialog
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // New Folder / File Modal
  const [newModalType, setNewModalType] = useState<'folder' | 'file' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Advanced File Operations State
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [fileSearch, setFileSearch] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; oldName: string; newName: string }>({
    isOpen: false,
    oldName: '',
    newName: '',
  });
  const [chmodModal, setChmodModal] = useState<{ isOpen: boolean; fileName: string; mode: string }>({
    isOpen: false,
    fileName: '',
    mode: '0755',
  });
  const [pullRemoteModal, setPullRemoteModal] = useState<{ isOpen: boolean; url: string; filename: string }>({
    isOpen: false,
    url: '',
    filename: '',
  });

  // Pterodactyl-Style File Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    file: UnifiedFile | null;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    file: null,
  });

  // Databases state
  const [databases, setDatabases] = useState<any[]>([]);
  const [loadingDbs, setLoadingDbs] = useState(false);

  // Backups state
  const [backups, setBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [backupLocked, setBackupLocked] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Subusers state
  const [subusers, setSubusers] = useState<any[]>([]);
  const [loadingSubusers, setLoadingSubusers] = useState(false);
  const [showSubuserModal, setShowSubuserModal] = useState(false);
  const [subuserToEdit, setSubuserToEdit] = useState<any | null>(null);

  // Network / Allocations state
  const [allocations, setAllocations] = useState<any[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [assigningAlloc, setAssigningAlloc] = useState(false);
  const [settingPrimaryId, setSettingPrimaryId] = useState<number | null>(null);
  const [copiedIp, setCopiedIp] = useState(false);
  const [noteModal, setNoteModal] = useState<{ isOpen: boolean; allocId: number; ipPort: string; notes: string }>({
    isOpen: false,
    allocId: 0,
    ipPort: '',
    notes: '',
  });
  const [savingNote, setSavingNote] = useState(false);
  const [unassignDialog, setUnassignDialog] = useState<{ isOpen: boolean; allocId: number | null; ipPort: string }>({
    isOpen: false,
    allocId: null,
    ipPort: '',
  });
  const [unassigning, setUnassigning] = useState(false);

  // Real-time metric history buffers
  const [cpuHistory, setCpuHistory] = useState<number[]>([0, 0, 0, 0, 0]);
  const [memHistory, setMemHistory] = useState<number[]>([0, 0, 0, 0, 0]);
  const [diskHistory, setDiskHistory] = useState<number[]>([0, 0, 0, 0, 0]);
  const [netRxHistory, setNetRxHistory] = useState<number[]>([0, 0, 0, 0, 0]);
  const [netTxHistory, setNetTxHistory] = useState<number[]>([0, 0, 0, 0, 0]);

  // WebSocket status & error handling
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('connecting');
  const [wsError, setWsError] = useState<string | null>(null);
  const [isRetryingWS, setIsRetryingWS] = useState(false);

  // Workspace & i18n
  const { editorOpenInNewTab, openFileInTab } = useWorkspaceStore();
  const { t } = useI18n();
  const [consoleSearch, setConsoleSearch] = useState('');

  // Startup & Environment state
  const [startupConfig, setStartupConfig] = useState<{
    startup_command: string;
    raw_startup_command: string;
    docker_images: Record<string, string>;
    variables: any[];
  } | null>(null);
  const [loadingStartup, setLoadingStartup] = useState(false);
  const [varDrafts, setVarDrafts] = useState<Record<string, string>>({});
  const [savingVarKey, setSavingVarKey] = useState<string | null>(null);
  const [selectedDockerImage, setSelectedDockerImage] = useState<string>('');
  const [customDockerImage, setCustomDockerImage] = useState<string>('');
  const [useCustomDocker, setUseCustomDocker] = useState(false);
  const [savingDockerImage, setSavingDockerImage] = useState(false);
  const [startupSearch, setStartupSearch] = useState('');
  const [startupFilter, setStartupFilter] = useState<'all' | 'editable' | 'custom'>('all');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [showRawCommand, setShowRawCommand] = useState(false);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  const loadAllocations = async () => {
    setLoadingAllocations(true);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app?.ListServerAllocations) {
      try {
        const list = await app.ListServerAllocations(identifier);
        setAllocations(list || []);
      } catch (err: any) {
        addNotification({
          type: 'error',
          title: t('serverDetail.networkError'),
          message: err.message || t('serverDetail.allocationsLoadFailed'),
        });
      } finally {
        setLoadingAllocations(false);
      }
    } else if (selectedServer?.allocations) {
      setAllocations(selectedServer.allocations);
      setLoadingAllocations(false);
    } else {
      setLoadingAllocations(false);
    }
  };

  const handleRetryWS = async () => {
    setIsRetryingWS(true);
    setWsStatus('reconnecting');
    setWsError(null);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        await app.ConnectServerConsole(identifier);
        setWsStatus('connected');
        await Promise.all([fetchServer(identifier), fetchResources(identifier), loadAllocations()]);
      } catch (err: any) {
        setWsStatus('disconnected');
        setWsError(err.message || t('serverDetail.retryConsoleFailed'));
      } finally {
        setIsRetryingWS(false);
      }
    }
  };

  useEffect(() => {
    loadServerData();
    const interval = setInterval(() => {
      fetchResources(identifier);
    }, 5000);

    // Connect to real-time console WebSocket
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      setWsStatus('connecting');
      app.ConnectServerConsole(identifier)
        .then(() => {
          setWsStatus('connected');
          setWsError(null);
        })
        .catch((err: any) => {
          console.warn('Live console WebSocket notice:', err);
          setWsStatus('disconnected');
          setWsError(err.message || t('serverDetail.consoleWsError'));
        });
    }

    // @ts-ignore
    const runtime = window.runtime;
    let cancelConsole: any;
    let cancelStats: any;
    let cancelStatus: any;
    let cancelError: any;

    if (runtime?.EventsOn) {
      cancelConsole = runtime.EventsOn(`server:console:${identifier}`, (line: string) => {
        setConsoleLines((prev) => [...prev.slice(-400), line]);
      });

      cancelStats = runtime.EventsOn(`server:stats:${identifier}`, (statsData: any) => {
        setWsStatus('connected');
        try {
          const raw = typeof statsData === 'string' ? JSON.parse(statsData) : statsData;
          if (raw && (raw.memory_bytes !== undefined || raw.cpu_absolute !== undefined)) {
            const updatedUsage: ResourceUsage = {
              current_state: raw.state || 'running',
              is_suspended: false,
              resources: {
                memory_bytes: raw.memory_bytes || 0,
                cpu_absolute: raw.cpu_absolute || 0,
                disk_bytes: raw.disk_bytes || 0,
                network_rx_bytes: raw.network?.rx_bytes || raw.network_rx_bytes || 0,
                network_tx_bytes: raw.network?.tx_bytes || raw.network_tx_bytes || 0,
                uptime: raw.uptime || 0,
              },
            };
            useServerStore.setState((prev) => ({
              resources: { ...prev.resources, [identifier]: updatedUsage },
            }));
          }
        } catch (e) {
          fetchResources(identifier);
        }
      });

      cancelStatus = runtime.EventsOn(`server:status:${identifier}`, (status: string) => {
        if (status) {
          useServerStore.setState((prev) => {
            const cur = prev.resources[identifier];
            if (cur) {
              return {
                resources: {
                  ...prev.resources,
                  [identifier]: { ...cur, current_state: status },
                },
              };
            }
            return prev;
          });
        }
      });

      cancelError = runtime.EventsOn('console:error', (data: any) => {
        if (data?.server_id === identifier) {
          setWsStatus('disconnected');
          setWsError(data.error || t('serverDetail.consoleConnectionError'));
        }
      });
    }

    return () => {
      clearInterval(interval);
      if (typeof cancelConsole === 'function') cancelConsole();
      if (typeof cancelStats === 'function') cancelStats();
      if (typeof cancelStatus === 'function') cancelStatus();
      if (typeof cancelError === 'function') cancelError();
      if (app) {
        app.DisconnectServerConsole();
      }
    };
  }, [identifier]);

  // Auto-scroll console to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && activeTab === 'console') {
      scrollToBottom();
    }
  }, [consoleLines.length, autoScroll, activeTab]);

  // Close context menu on global click or Escape
  useEffect(() => {
    const handleCloseMenu = () => {
      if (contextMenu.isOpen) {
        setContextMenu({ isOpen: false, x: 0, y: 0, file: null });
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseMenu();
    };
    window.addEventListener('click', handleCloseMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleCloseMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu.isOpen]);

  const getZoomFactor = (): number => {
    try {
      const docZoom = (document.documentElement.style as any).zoom;
      if (docZoom) {
        const parsed = parseFloat(docZoom);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed > 5 ? parsed / 100 : parsed;
        }
      }
      const saved = localStorage.getItem('pterodesk_zoom_level');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed / 100;
        }
      }
    } catch {
      // ignore
    }
    return 1;
  };

  const handleContextMenu = (e: React.MouseEvent, file: UnifiedFile) => {
    e.preventDefault();
    e.stopPropagation();

    const zoom = getZoomFactor();
    const clickX = e.clientX / zoom;
    const clickY = e.clientY / zoom;

    const viewportW = window.innerWidth / zoom;
    const viewportH = window.innerHeight / zoom;

    const menuW = 200;
    const menuH = 340;

    let x = clickX;
    let y = clickY;

    if (x + menuW > viewportW) {
      x = Math.max(10, viewportW - menuW - 10);
    }
    if (y + menuH > viewportH) {
      y = Math.max(10, viewportH - menuH - 10);
    }

    setContextMenu({
      isOpen: true,
      x,
      y,
      file,
    });
  };

  // Pre-fill SFTP credentials from server info when loaded
  useEffect(() => {
    if (selectedServer) {
      const sftpDet = selectedServer.sftp_details;
      if (sftpDet?.ip) {
        setSftpHost(sftpDet.ip);
      } else if (selectedServer.node) {
        setSftpHost(selectedServer.node);
      }
      if (sftpDet?.port) {
        setSftpPort(sftpDet.port);
      }
      // Pterodactyl SFTP username pattern: <panel_user>.<server_short_id>
      setSftpUsername(`${identifier}`);

      // Check if already connected in Go backend
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app?.IsServerSFTPConnected) {
        app.IsServerSFTPConnected(identifier).then((connected: boolean) => {
          setSftpConnected(connected);
          if (connected && activeTab === 'files') {
            loadFiles(currentDir, true);
          }
        });
      }
    }
  }, [selectedServer?.identifier]);

  useEffect(() => {
    if (selectedServer) {
      setSettingServerName(selectedServer.name || '');
      setSettingServerDesc(selectedServer.description || '');
      setSettingDockerImage(selectedServer.docker_image || '');
    }
  }, [selectedServer?.name, selectedServer?.description, selectedServer?.docker_image]);

  const hasServerPermission = (serverObj: Server | null, perm: string): boolean => {
    if (!serverObj) return true;
    if (serverObj.server_owner) return true;
    if (!serverObj.user_permissions || serverObj.user_permissions.length === 0) return true;
    if (serverObj.user_permissions.includes('*')) return true;
    if (serverObj.user_permissions.includes(perm)) return true;
    const category = perm.split('.')[0];
    if (serverObj.user_permissions.includes(`${category}.*`)) return true;
    return false;
  };

  const getTabRequiredPermission = (tab: TabType): string => {
    switch (tab) {
      case 'console': return 'control.console';
      case 'files': return 'file.read';
      case 'databases': return 'database.read';
      case 'backups': return 'backup.read';
      case 'subusers': return 'user.read';
      case 'network': return 'allocation.read';
      case 'startup': return 'startup.read';
      case 'settings': return 'settings.rename';
      default: return '';
    }
  };

  const loadServerData = async () => {
    setLoading(true);
    setServerLoadError(null);
    setServerNotFound(false);
    try {
      await Promise.all([
        fetchServer(identifier),
        fetchResources(identifier),
        loadAllocations(),
      ]);
      setConsoleLines((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Authenticated session established for ${identifier}`,
        `[${new Date().toLocaleTimeString()}] Server container status: sync completed`,
      ]);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
        setServerNotFound(true);
      } else {
        setServerLoadError(msg || t('serverDetail.loadServerFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRenameServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingServerName.trim()) {
      addNotification({ type: 'warning', title: t('serverDetail.requiredInfo'), message: t('serverDetail.serverNameRequired') });
      return;
    }
    setSavingSettings(true);
    try {
      // @ts-ignore
      await window.go.main.App.RenameServer(identifier, settingServerName.trim(), settingServerDesc.trim());
      addNotification({
        type: 'success',
        title: t('serverDetail.renameSuccess'),
        message: t('serverDetail.renamedMessage', { name: settingServerName.trim() }),
      });
      fetchServer(identifier);
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('serverDetail.renameFailed'),
        message: err.message || t('serverDetail.renameError'),
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateDockerImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingDockerImage.trim()) {
      addNotification({ type: 'warning', title: t('serverDetail.requiredInfo'), message: t('serverDetail.dockerImageRequired') });
      return;
    }
    setSavingSettings(true);
    try {
      // @ts-ignore
      await window.go.main.App.UpdateServerDockerImage(identifier, settingDockerImage.trim());
      addNotification({
        type: 'success',
        title: t('serverDetail.dockerUpdated'),
        message: t('serverDetail.dockerUpdatedMessage', { image: settingDockerImage.trim() }),
      });
      fetchServer(identifier);
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('serverDetail.dockerUpdateFailed'),
        message: err.message || t('serverDetail.dockerUpdateError'),
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleReinstallServer = async () => {
    setReinstalling(true);
    try {
      // @ts-ignore
      await window.go.main.App.ReinstallServer(identifier);
      addNotification({
        type: 'success',
        title: t('serverDetail.reinstallStarted'),
        message: t('serverDetail.reinstallSent'),
      });
      setReinstallModalOpen(false);
      setReinstallConfirmInput('');
      fetchServer(identifier);
      fetchResources(identifier);
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('serverDetail.reinstallFailed'),
        message: err.message || t('serverDetail.reinstallError'),
      });
    } finally {
      setReinstalling(false);
    }
  };

  const handleDownloadWithExplorer = async (filePath: string, fileName: string) => {
    try {
      // @ts-ignore
      const savedPath = await window.go.main.App.DownloadServerFileWithDialog(identifier, filePath, fileName);
      if (savedPath) {
        addNotification({
          type: 'success',
          title: t('serverDetail.downloadSuccess'),
          message: t('serverDetail.savedPath', { path: savedPath }),
        });
      }
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('serverDetail.downloadFailed'),
        message: err.message || t('serverDetail.downloadError'),
      });
    }
  };

  const handleTabChange = async (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'files') {
      loadFiles(currentDir, sftpConnected);
    } else if (tab === 'databases') {
      loadDatabases();
    } else if (tab === 'backups') {
      loadBackups();
    } else if (tab === 'subusers') {
      loadSubusers();
    } else if (tab === 'network') {
      loadAllocations();
    } else if (tab === 'startup') {
      loadStartupConfig();
    }
  };

  const loadBackups = async () => {
    setLoadingBackups(true);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        const list = await app.ListBackups(identifier);
        setBackups(list || []);
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.backupLoadFailed'), message: err.message });
      } finally {
        setLoadingBackups(false);
      }
    }
  };

  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingBackup(true);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        await app.CreateBackup(identifier, backupName.trim(), backupLocked, '');
        addNotification({ type: 'success', title: t('serverDetail.backupStarted'), message: t('serverDetail.backupInitiated') });
        setShowBackupModal(false);
        setBackupName('');
        setBackupLocked(false);
        loadBackups();
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.createBackupFailed'), message: err.message });
      } finally {
        setCreatingBackup(false);
      }
    }
  };

  const handleDownloadBackup = async (backupUUID: string) => {
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        const url = await app.GetBackupDownloadURL(identifier, backupUUID);
        window.open(url, '_blank');
        addNotification({ type: 'success', title: t('serverDetail.downloadInitialized'), message: t('serverDetail.signedUrlOpened') });
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.downloadUrlFailed'), message: err.message });
      }
    }
  };

  const handleToggleBackupLock = async (backupUUID: string) => {
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        await app.ToggleBackupLock(identifier, backupUUID);
        addNotification({ type: 'success', title: t('serverDetail.lockUpdated'), message: t('serverDetail.backupLockChanged') });
        loadBackups();
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.lockFailed'), message: err.message });
      }
    }
  };

  const handleDeleteBackup = async (backupUUID: string) => {
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        await app.DeleteBackup(identifier, backupUUID);
        addNotification({ type: 'success', title: t('serverDetail.backupDeleted'), message: t('serverDetail.backupRemoved') });
        loadBackups();
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.deleteFailed'), message: err.message });
      }
    }
  };

  const handleRestoreBackup = async (backupUUID: string) => {
    if (!confirm(t('serverDetail.restoreConfirm'))) return;
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        await app.RestoreBackup(identifier, backupUUID, true);
        addNotification({ type: 'success', title: t('serverDetail.restoreQueued'), message: t('serverDetail.restoreStarted') });
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.restoreFailed'), message: err.message });
      }
    }
  };

  const loadSubusers = async () => {
    setLoadingSubusers(true);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        const list = await app.ListSubusers(identifier);
        setSubusers(list || []);
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.subusersLoadFailed'), message: err.message });
      } finally {
        setLoadingSubusers(false);
      }
    }
  };

  const handleDeleteSubuser = async (subuserUUID: string) => {
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        await app.DeleteSubuser(identifier, subuserUUID);
        addNotification({ type: 'success', title: t('serverDetail.subuserRemoved'), message: t('serverDetail.userAccessRevoked') });
        loadSubusers();
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.revokeFailed'), message: err.message });
      }
    }
  };

  // --- Network / Allocations Handlers ---
  const handleAssignAllocation = async () => {
    setAssigningAlloc(true);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app?.AssignServerAllocation) {
      try {
        const alloc = await app.AssignServerAllocation(identifier);
        addNotification({
          type: 'success',
          title: t('serverDetail.allocationAssigned'),
          message: t('serverDetail.allocationAssignedMessage', { port: alloc?.port || '' }),
        });
        loadAllocations();
      } catch (err: any) {
        addNotification({
          type: 'error',
          title: t('serverDetail.assignFailed'),
          message: err.message || t('serverDetail.assignError'),
        });
      } finally {
        setAssigningAlloc(false);
      }
    }
  };

  const handleSetPrimary = async (allocId: number) => {
    setSettingPrimaryId(allocId);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app?.SetServerPrimaryAllocation) {
      try {
        await app.SetServerPrimaryAllocation(identifier, allocId);
        addNotification({
          type: 'success',
          title: t('serverDetail.primaryUpdated'),
          message: t('serverDetail.primarySet'),
        });
        loadAllocations();
      } catch (err: any) {
        addNotification({
          type: 'error',
          title: t('serverDetail.setPrimaryFailed'),
          message: err.message || t('serverDetail.setPrimaryFailed'),
        });
      } finally {
        setSettingPrimaryId(null);
      }
    }
  };

  const handleSaveAllocationNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNote(true);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app?.SetServerAllocationNote) {
      try {
        await app.SetServerAllocationNote(identifier, noteModal.allocId, noteModal.notes);
        addNotification({
          type: 'success',
          title: t('serverDetail.noteSaved'),
          message: t('serverDetail.noteSavedMessage'),
        });
        setNoteModal({ isOpen: false, allocId: 0, ipPort: '', notes: '' });
        loadAllocations();
      } catch (err: any) {
        addNotification({
          type: 'error',
          title: t('serverDetail.updateFailed'),
          message: err.message || t('serverDetail.noteUpdateFailed'),
        });
      } finally {
        setSavingNote(false);
      }
    }
  };

  const handleUnassignAllocation = async () => {
    if (!unassignDialog.allocId) return;
    setUnassigning(true);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app?.UnassignServerAllocation) {
      try {
        await app.UnassignServerAllocation(identifier, unassignDialog.allocId);
        addNotification({
          type: 'success',
          title: t('serverDetail.allocationUnassigned'),
          message: t('serverDetail.allocationUnassignedMessage', { address: unassignDialog.ipPort }),
        });
        setUnassignDialog({ isOpen: false, allocId: null, ipPort: '' });
        loadAllocations();
      } catch (err: any) {
        addNotification({
          type: 'error',
          title: t('serverDetail.unassignFailed'),
          message: err.message || t('serverDetail.unassignFailed'),
        });
      } finally {
        setUnassigning(false);
      }
    }
  };

  // --- Startup & Environment Handlers ---
  const loadStartupConfig = async () => {
    setLoadingStartup(true);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app?.GetServerStartup) {
      try {
        const config = await app.GetServerStartup(identifier);
        setStartupConfig(config);
        const currentImg = server?.docker_image || '';
        setSelectedDockerImage(currentImg);

        const hasMatchingTag =
          config?.docker_images &&
          Object.values(config.docker_images).some((val) => val === currentImg);
        if (!hasMatchingTag && currentImg) {
          setUseCustomDocker(true);
          setCustomDockerImage(currentImg);
        } else {
          setUseCustomDocker(false);
          setCustomDockerImage('');
        }

        const drafts: Record<string, string> = {};
        if (config?.variables) {
          config.variables.forEach((v: any) => {
            drafts[v.env_variable] = v.server_value ?? v.default_value ?? '';
          });
        }
        setVarDrafts(drafts);
      } catch (err: any) {
        addNotification({
          type: 'error',
          title: t('serverDetail.startupError'),
          message: err.message || t('serverDetail.startupLoadFailed'),
        });
      } finally {
        setLoadingStartup(false);
      }
    } else {
      setLoadingStartup(false);
    }
  };

  const handleSaveVariable = async (key: string) => {
    setSavingVarKey(key);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app?.UpdateServerStartupVariable) {
      try {
        const val = varDrafts[key] ?? '';
        await app.UpdateServerStartupVariable(identifier, key, val);
        addNotification({
          type: 'success',
          title: t('serverDetail.variableSaved'),
          message: t('serverDetail.variableSavedMessage', { key }),
        });
        setStartupConfig((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            variables: prev.variables.map((v) =>
              v.env_variable === key ? { ...v, server_value: val } : v
            ),
          };
        });
      } catch (err: any) {
        addNotification({
          type: 'error',
          title: t('serverDetail.updateFailed'),
          message: err.message || t('serverDetail.keyUpdateFailed', { key }),
        });
      } finally {
        setSavingVarKey(null);
      }
    }
  };

  const handleResetVariable = (key: string, defaultValue: string) => {
    setVarDrafts((prev) => ({
      ...prev,
      [key]: defaultValue,
    }));
  };

  const handleSaveDockerImage = async (imgToSave: string) => {
    if (!imgToSave.trim()) {
      addNotification({ type: 'warning', title: t('serverDetail.requiredInfo'), message: t('serverDetail.dockerImageRequired') });
      return;
    }
    setSavingDockerImage(true);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app?.UpdateServerDockerImage) {
      try {
        await app.UpdateServerDockerImage(identifier, imgToSave.trim());
        addNotification({
          type: 'success',
          title: t('serverDetail.dockerUpdated'),
          message: t('serverDetail.dockerApplyMessage', { image: imgToSave }),
        });
        if (server) {
          server.docker_image = imgToSave.trim();
        }
        setSelectedDockerImage(imgToSave.trim());
      } catch (err: any) {
        addNotification({
          type: 'error',
          title: t('serverDetail.dockerUpdateFailed'),
          message: err.message || t('serverDetail.dockerUpdateError'),
        });
      } finally {
        setSavingDockerImage(false);
      }
    }
  };

  const handleCopyStartupCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
    addNotification({ type: 'info', title: t('serverDetail.copied'), message: t('serverDetail.startupCopied') });
  };

  const loadFiles = async (dir: string, isSftp: boolean) => {
    setLoadingFiles(true);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (!app) {
      setLoadingFiles(false);
      return;
    }

    try {
      if (isSftp) {
        const entries = await app.ListServerSFTPFiles(identifier, dir);
        const unified: UnifiedFile[] = (entries || []).map((e: any) => ({
          name: e.name,
          size: e.size,
          mode: e.mode,
          isDir: e.isDir,
          modifiedTime: e.modifiedTime,
        }));
        setFileList(unified);
        setCurrentDir(dir);
      } else {
        const files = await app.ListFiles(identifier, dir);
        const unified: UnifiedFile[] = (files || []).map((f: any) => ({
          name: f.name,
          size: f.size,
          mode: f.mode,
          isDir: !f.is_file,
          modifiedTime: f.modified_at,
        }));
        setFileList(unified);
        setCurrentDir(dir);
      }
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('serverDetail.directoryLoadFailed'),
        message: err.message || t('serverDetail.listFilesError'),
      });
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleConnectSFTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sftpHost || !sftpUsername || !sftpPassword) {
      addNotification({ type: 'warning', title: t('serverDetail.requiredInfo'), message: t('sftpExplorer.hostRequired') });
      return;
    }

    setSftpConnecting(true);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app) {
        await app.ConnectServerSFTP(identifier, sftpHost, Number(sftpPort), sftpUsername, sftpPassword);
        setSftpConnected(true);
        addNotification({
          type: 'success',
          title: t('sftpExplorer.connected'),
          message: t('serverDetail.sftpConnectedMessage', { host: sftpHost, port: sftpPort }),
        });
        loadFiles('/', true);
      }
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('serverDetail.sftpFailed'),
        message: err.message || t('serverDetail.sftpConnectionError'),
      });
    } finally {
      setSftpConnecting(false);
    }
  };

  const handleDisconnectSFTP = async () => {
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      await app.DisconnectServerSFTP(identifier);
    }
    setSftpConnected(false);
    addNotification({ type: 'info', title: t('serverDetail.sftpDisconnected'), message: t('serverDetail.panelApiMode') });
    loadFiles(currentDir, false);
  };

  const handleOpenFile = async (fileName: string) => {
    const fullPath = currentDir === '/' ? `/${fileName}` : `${currentDir}/${fileName}`;
    if (editorOpenInNewTab) {
      openFileInTab(identifier, fullPath, sftpConnected);
      return;
    }

    // @ts-ignore
    const app = window.go?.main?.App;
    if (!app) return;

    try {
      let content = '';
      if (sftpConnected) {
        content = await app.ReadServerSFTPFile(identifier, fullPath);
      } else {
        content = await app.GetFileContents(identifier, fullPath);
      }
      setFileContent(content || '');
      setEditingFile(fullPath);
    } catch (err: any) {
      addNotification({ type: 'error', title: t('serverDetail.readFileFailed'), message: err.message });
    }
  };

  const handleGoBackDir = () => {
    if (currentDir === '/') return;
    const parts = currentDir.split('/').filter(Boolean);
    parts.pop();
    const parent = parts.length === 0 ? '/' : '/' + parts.join('/');
    setSelectedFileNames([]);
    loadFiles(parent, sftpConnected);
  };

  const handleSaveFileContent = async (newContent: string) => {
    if (!editingFile) return;
    setSavingFile(true);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (!app) return;

    try {
      if (sftpConnected) {
        await app.WriteServerSFTPFile(identifier, editingFile, newContent);
      } else {
        await app.WriteFile(identifier, editingFile, newContent);
      }
      setFileContent(newContent);
      addNotification({
        type: 'success',
        title: t('serverDetail.fileSaved'),
        message: t('serverDetail.fileSavedMessage', { path: editingFile }),
      });
      loadFiles(currentDir, sftpConnected);
    } catch (err: any) {
      addNotification({ type: 'error', title: t('serverDetail.saveFailed'), message: err.message });
      throw err;
    } finally {
      setSavingFile(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    setDeleteLoading(true);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (!app) return;

    try {
      if (sftpConnected) {
        await app.DeleteServerSFTPFile(identifier, fileToDelete);
      } else {
        await app.DeleteFiles(identifier, currentDir, [fileToDelete]);
      }
      addNotification({ type: 'success', title: t('serverDetail.deleted'), message: t('serverDetail.deletedMessage', { name: fileToDelete }) });
      setFileToDelete(null);
      loadFiles(currentDir, sftpConnected);
    } catch (err: any) {
      addNotification({ type: 'error', title: t('serverDetail.deleteFailed'), message: err.message });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCreateNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newModalType) return;

    const path = currentDir === '/' ? `/${newItemName.trim()}` : `${currentDir}/${newItemName.trim()}`;
    // @ts-ignore
    const app = window.go?.main?.App;
    if (!app) return;

    try {
      if (newModalType === 'folder') {
        if (sftpConnected) {
          await app.CreateServerSFTPFolder(identifier, path);
        } else {
          await app.CreateFile(identifier, currentDir, newItemName.trim());
        }
        addNotification({ type: 'success', title: t('serverDetail.folderCreated'), message: newItemName });
      } else {
        if (sftpConnected) {
          await app.WriteServerSFTPFile(identifier, path, '');
        } else {
          await app.WriteFile(identifier, path, '');
        }
        addNotification({ type: 'success', title: t('serverDetail.fileCreated'), message: newItemName });
      }
      setNewModalType(null);
      setNewItemName('');
      loadFiles(currentDir, sftpConnected);
    } catch (err: any) {
      addNotification({ type: 'error', title: t('serverDetail.createFailed'), message: err.message });
    }
  };

  const uploadSingleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      const targetPath = currentDir === '/' ? `/${file.name}` : `${currentDir}/${file.name}`;

      // @ts-ignore
      const app = window.go?.main?.App;
      if (app) {
        try {
          if (sftpConnected) {
            await app.UploadServerSFTPFile(identifier, targetPath, base64);
          } else {
            await app.UploadServerFileDirect(identifier, currentDir, file.name, base64);
          }
          addNotification({ type: 'success', title: t('serverDetail.uploadFinished'), message: t('serverDetail.uploadMessage', { name: file.name }) });
          loadFiles(currentDir, sftpConnected);
        } catch (err: any) {
          addNotification({ type: 'error', title: t('serverDetail.uploadFailed'), message: err.message });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      uploadSingleFile(files[i]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadFile = async (fileName: string) => {
    const fullPath = currentDir === '/' ? `/${fileName}` : `${currentDir}/${fileName}`;
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        const url = await app.GetFileDownloadURL(identifier, fullPath);
        window.open(url, '_blank');
        addNotification({ type: 'success', title: t('serverDetail.downloadStarted'), message: t('serverDetail.downloadingFile', { name: fileName }) });
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.downloadFailedGeneric'), message: err.message });
      }
    }
  };

  const handleCopyFile = async (fileName: string) => {
    const fullPath = currentDir === '/' ? `/${fileName}` : `${currentDir}/${fileName}`;
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        await app.CopyFile(identifier, fullPath);
        addNotification({ type: 'success', title: t('serverDetail.duplicateSuccess'), message: t('serverDetail.duplicateMessage', { name: fileName }) });
        loadFiles(currentDir, sftpConnected);
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.copyFailed'), message: err.message });
      }
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameModal.newName.trim()) return;
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        if (sftpConnected) {
          const oldP = currentDir === '/' ? `/${renameModal.oldName}` : `${currentDir}/${renameModal.oldName}`;
          const newP = currentDir === '/' ? `/${renameModal.newName.trim()}` : `${currentDir}/${renameModal.newName.trim()}`;
          await app.RenameServerSFTPFile(identifier, oldP, newP);
        } else {
          await app.RenameFile(identifier, currentDir, renameModal.oldName, renameModal.newName.trim());
        }
        addNotification({ type: 'success', title: t('serverDetail.renameSuccess'), message: t('serverDetail.renamedMessage', { name: renameModal.newName.trim() }) });
        setRenameModal({ isOpen: false, oldName: '', newName: '' });
        loadFiles(currentDir, sftpConnected);
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.renameFailed'), message: err.message });
      }
    }
  };

  const handleChmodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chmodModal.mode.trim()) return;
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        if (sftpConnected) {
          const p = currentDir === '/' ? `/${chmodModal.fileName}` : `${currentDir}/${chmodModal.fileName}`;
          await app.ChmodServerSFTPFile(identifier, p, chmodModal.mode.trim());
        } else {
          await app.ChmodFile(identifier, currentDir, chmodModal.fileName, chmodModal.mode.trim());
        }
        addNotification({ type: 'success', title: t('serverDetail.modePermissionsUpdated'), message: t('serverDetail.modeSet', { mode: chmodModal.mode.trim() }) });
        setChmodModal({ isOpen: false, fileName: '', mode: '0755' });
        loadFiles(currentDir, sftpConnected);
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.permissionsFailed'), message: err.message });
      }
    }
  };

  const handleCompress = async (files?: string[]) => {
    const targets = files && files.length > 0 ? files : selectedFileNames;
    if (targets.length === 0) return;
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        await app.CompressFiles(identifier, currentDir, targets);
        addNotification({ type: 'success', title: t('serverDetail.archiveCreated'), message: t('serverDetail.compressedItems', { count: targets.length }) });
        setSelectedFileNames([]);
        loadFiles(currentDir, sftpConnected);
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.compressFailed'), message: err.message });
      }
    }
  };

  const handleDecompress = async (fileName: string) => {
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        await app.DecompressFile(identifier, currentDir, fileName);
        addNotification({ type: 'success', title: t('serverDetail.decompressed'), message: t('serverDetail.extractedFile', { name: fileName }) });
        loadFiles(currentDir, sftpConnected);
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.decompressFailed'), message: err.message });
      }
    }
  };

  const handlePullRemoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pullRemoteModal.url.trim()) return;
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        await app.PullRemoteFile(identifier, currentDir, pullRemoteModal.url.trim(), pullRemoteModal.filename.trim());
        addNotification({ type: 'success', title: t('serverDetail.pullStarted'), message: t('serverDetail.pullMessage', { url: pullRemoteModal.url }) });
        setPullRemoteModal({ isOpen: false, url: '', filename: '' });
        loadFiles(currentDir, sftpConnected);
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.pullFailed'), message: err.message });
      }
    }
  };

  const handleBatchDelete = async () => {
    if (selectedFileNames.length === 0) return;
    if (!confirm(t('serverDetail.batchDeleteConfirm', { count: selectedFileNames.length }))) return;
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        if (sftpConnected) {
          for (const name of selectedFileNames) {
            const target = currentDir === '/' ? `/${name}` : `${currentDir}/${name}`;
            await app.DeleteServerSFTPFile(identifier, target);
          }
        } else {
          await app.DeleteFiles(identifier, currentDir, selectedFileNames);
        }
        addNotification({ type: 'success', title: t('serverDetail.deleted'), message: t('serverDetail.batchDeleteMessage', { count: selectedFileNames.length }) });
        setSelectedFileNames([]);
        loadFiles(currentDir, sftpConnected);
      } catch (err: any) {
        addNotification({ type: 'error', title: t('serverDetail.batchDeleteFailed'), message: err.message });
      }
    }
  };

  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;
    for (let i = 0; i < droppedFiles.length; i++) {
      uploadSingleFile(droppedFiles[i]);
    }
  };

  const loadDatabases = async () => {
    setLoadingDbs(true);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        const dbList = await app.ListDatabases(identifier);
        setDatabases(dbList || []);
      } catch (e: any) {
        addNotification({ type: 'error', title: t('serverDetail.databaseError'), message: e.message });
      } finally {
        setLoadingDbs(false);
      }
    }
  };

  const sendPowerDirect = async (signal: 'start' | 'restart' | 'stop' | 'kill') => {
    setActionLoading(true);
    try {
      if (signal === 'stop') {
        setOptimisticState('stopping');
      } else if (signal === 'kill') {
        setOptimisticState('offline');
      } else if (signal === 'start') {
        setOptimisticState('starting');
      }
      await sendPowerAction(identifier, signal);
      setConsoleLines((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] USER SENT POWER SIGNAL: ${signal.toUpperCase()}`,
      ]);
      fetchResources(identifier);
    } catch (err: any) {
      setOptimisticState(null);
      addNotification({
        type: 'error',
        title: t('serverDetail.actionFailed'),
        message: err.message || t('serverDetail.powerActionFailed'),
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePowerAction = async () => {
    if (!powerDialog) return;
    await sendPowerDirect(powerDialog);
    setPowerDialog(null);
  };

  const executeServerCommand = async (rawCmd: string) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;

    setConsoleLines((prev) => [...prev, `> ${cmd}`]);
    setCommandInput('');
    setHistoryIndex(-1);
    setTempDraft('');
    setLastExecutedCommand(cmd);

    // Update command history for this server
    setCmdHistory((prev) => {
      const filtered = prev.filter((c) => c !== cmd);
      const updated = [...filtered, cmd].slice(-100);
      try {
        localStorage.setItem(`pterodesk_cmd_history_${identifier}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      try {
        await app.SendServerCommand(cmd);
      } catch (err: any) {
        addNotification({
          type: 'error',
          title: t('serverDetail.commandFailed'),
          message: err.message || t('serverDetail.sendCommandFailed'),
        });
      }
    }
  };

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    await executeServerCommand(commandInput);
  };

  const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length === 0) return;

      if (historyIndex === -1) {
        setTempDraft(commandInput);
      }

      const nextIndex = historyIndex + 1;
      if (nextIndex < cmdHistory.length) {
        setHistoryIndex(nextIndex);
        setCommandInput(cmdHistory[cmdHistory.length - 1 - nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setCommandInput(cmdHistory[cmdHistory.length - 1 - nextIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommandInput(tempDraft);
      }
    }
  };

  const server = selectedServer;
  const usage = resources[identifier];
  const currentState = optimisticState || usage?.current_state || (server?.is_suspended ? 'suspended' : 'offline');

  useEffect(() => {
    if (optimisticState && usage?.current_state === optimisticState) {
      setOptimisticState(null);
    }
  }, [usage?.current_state, optimisticState]);

  const cpuPercent = usage ? (usage.resources.cpu_absolute).toFixed(1) : '0.0';
  const memoryMB = usage ? (usage.resources.memory_bytes / 1024 / 1024).toFixed(0) : '0';
  const diskMB = usage ? (usage.resources.disk_bytes / 1024 / 1024).toFixed(0) : '0';
  const rxBytes = usage?.resources?.network_rx_bytes || 0;
  const txBytes = usage?.resources?.network_tx_bytes || 0;

  // Primary Allocation & Connection Address
  const primaryAlloc = allocations.find((a) => a.is_default) || allocations[0];
  const displayHost = primaryAlloc
    ? (primaryAlloc.ip_alias || primaryAlloc.ip)
    : (server?.sftp_details?.ip || server?.node || 'localhost');
  const displayPort = primaryAlloc ? primaryAlloc.port : (server?.sftp_details?.port || 25565);
  const connectionAddress = `${displayHost}:${displayPort}`;

  const formatGigabits = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0.00 Gb';
    const bits = bytes * 8;
    const gb = bits / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} Gb`;
    const mb = bits / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} Mb`;
    const kb = bits / 1024;
    return `${kb.toFixed(1)} Kb`;
  };

  // Push into metric history
  useEffect(() => {
    if (usage) {
      const cpu = usage.resources.cpu_absolute || 0;
      const mem = (usage.resources.memory_bytes || 0) / 1024 / 1024;
      const disk = (usage.resources.disk_bytes || 0) / 1024 / 1024;
      const netBits = ((usage.resources.network_rx_bytes || 0) + (usage.resources.network_tx_bytes || 0)) * 8;
      const netGb = netBits / (1024 * 1024 * 1024);

      setCpuHistory((prev) => [...prev.slice(-24), cpu]);
      setMemHistory((prev) => [...prev.slice(-24), mem]);
      setDiskHistory((prev) => [...prev.slice(-24), disk]);
      setNetRxHistory((prev) => [...prev.slice(-24), (usage.resources.network_rx_bytes || 0) * 8 / (1024 * 1024 * 1024)]);
      setNetTxHistory((prev) => [...prev.slice(-24), (usage.resources.network_tx_bytes || 0) * 8 / (1024 * 1024 * 1024)]);
    }
  }, [usage?.resources?.cpu_absolute, usage?.resources?.memory_bytes, usage?.resources?.network_rx_bytes, usage?.resources?.network_tx_bytes]);

  // Limits and normalized 0-100% capacity ratios
  const cpuNum = parseFloat(cpuPercent);
  const cpuMax = server?.limits?.cpu || 0;
  // If cpuMax is configured (> 0), normalized capacity is (cpuNum / cpuMax) * 100
  const cpuCapacityPercent = cpuMax > 0 ? Math.min(100, Math.max(0, (cpuNum / cpuMax) * 100)).toFixed(1) : cpuPercent;
  const cpuColor = (cpuMax > 0 ? (cpuNum / cpuMax) * 100 : cpuNum) >= 85 ? '#EF4444' : '#38BDF8';

  const memNum = parseFloat(memoryMB);
  const memMax = server?.limits?.memory || 0;
  const memCapacityPercent = memMax > 0 ? Math.min(100, Math.max(0, (memNum / memMax) * 100)).toFixed(1) : '0';
  const memColor = (memMax > 0 ? (memNum / memMax) * 100 : 0) >= 85 ? '#EF4444' : '#38BDF8';

  const diskNum = parseFloat(diskMB);
  const diskMax = server?.limits?.disk || 0;
  const diskCapacityPercent = diskMax > 0 ? Math.min(100, Math.max(0, (diskNum / diskMax) * 100)).toFixed(1) : '0';
  const diskColor = (diskMax > 0 ? (diskNum / diskMax) * 100 : 0) >= 85 ? '#EF4444' : '#38BDF8';

  // Power options state machine
  const isSuspended = server?.is_suspended || currentState === 'suspended';
  const isStarting = currentState === 'starting';
  const isRunning = currentState === 'running';
  const isStopping = currentState === 'stopping';
  const isOffline = currentState === 'offline';

  const canStart = !isSuspended && isOffline;
  const canRestart = !isSuspended && isRunning;
  const canStop = !isSuspended && (isRunning || isStarting);
  const canKill = !isSuspended && (isRunning || isStarting || isStopping);

  // Breadcrumbs calculation
  const pathParts = currentDir.split('/').filter(Boolean);

  if (serverNotFound) {
    return (
      <div style={{ padding: '32px', width: '100%', maxWidth: '800px', margin: '40px auto' }}>
        <HttpErrorView
          code={404}
          title={t('serverDetail.notFoundTitle')}
          message={t('serverDetail.notFoundMessage', { identifier })}
          onBack={onBack}
        />
      </div>
    );
  }

  if (serverLoadError) {
    return (
      <div style={{ padding: '32px', width: '100%', maxWidth: '800px', margin: '40px auto' }}>
        <HttpErrorView
          code={500}
          title={t('serverDetail.serverErrorTitle')}
          message={serverLoadError}
          onRetry={loadServerData}
          onBack={onBack}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        flex: 1,
        overflow: 'hidden',
      }}
    >
      {/* Suspended Notice Banner */}
      {isSuspended && (
        <DisconnectedState status="suspended" />
      )}

      {/* Disconnected / Reconnecting State */}
      {!isSuspended && (wsStatus === 'disconnected' || wsStatus === 'reconnecting') && (
        <DisconnectedState
          status={wsStatus}
          onRetry={handleRetryWS}
          isRetrying={isRetryingWS}
          errorMessage={wsError}
        />
      )}

      {/* Top Breadcrumb & Control Bar */}
      <div
        style={{
          padding: '12px 20px',
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
              {server?.name || identifier}
            </h2>
            <StatusBadge status={currentState} />
          </div>
        </div>

        {/* Center: Compact Resource Usage Chip with Max Limits & Normalized 100% */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {metricsCollapsed ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '4px 12px',
                borderRadius: '20px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--color-border)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {/* CPU */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                title={`CPU: ${cpuPercent}% / ${cpuMax > 0 ? `${cpuMax}%` : 'Không giới hạn'} (Đang dùng ${cpuCapacityPercent}% công suất tối đa)`}
              >
                <Cpu size={12} color={cpuColor} />
                <span style={{ color: cpuColor, fontWeight: 600 }}>
                  {cpuPercent}% / {cpuMax > 0 ? `${cpuMax}%` : '∞'}
                </span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                  ({cpuCapacityPercent}%)
                </span>
              </div>
              <span style={{ color: 'var(--color-border)' }}>|</span>

              {/* RAM */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                title={`RAM: ${memoryMB} MB / ${memMax > 0 ? `${memMax} MB` : 'Không giới hạn'} (${memCapacityPercent}% tải)`}
              >
                <Activity size={12} color={memColor} />
                <span style={{ color: memColor, fontWeight: 600 }}>
                  {memoryMB} / {memMax > 0 ? `${memMax} MB` : '∞'}
                </span>
                {memMax > 0 && (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                    ({memCapacityPercent}%)
                  </span>
                )}
              </div>
              <span style={{ color: 'var(--color-border)' }}>|</span>

              {/* Disk */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                title={`Disk: ${diskMB} MB / ${diskMax > 0 ? `${diskMax} MB` : 'Không giới hạn'} (${diskCapacityPercent}% dung lượng)`}
              >
                <HardDrive size={12} color={diskColor} />
                <span style={{ color: diskColor, fontWeight: 600 }}>
                  {diskMB} / {diskMax > 0 ? `${diskMax} MB` : '∞'}
                </span>
                {diskMax > 0 && (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                    ({diskCapacityPercent}%)
                  </span>
                )}
              </div>
              <span style={{ color: 'var(--color-border)' }}>|</span>

              {/* Network */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                title={`Network RX/TX: ↓${formatGigabits(rxBytes)} ↑${formatGigabits(txBytes)}`}
              >
                <Network size={12} color="var(--color-primary-light)" />
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>
                  ↓{formatGigabits(rxBytes)} ↑{formatGigabits(txBytes)}
                </span>
              </div>

              <button
                onClick={() => setMetricsCollapsed(false)}
                title={t('serverDetail.expandMetrics')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  borderRadius: '3px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary-light)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
              >
                <ChevronDown size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setMetricsCollapsed(true)}
              title={t('serverDetail.collapseMetrics')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '16px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text)';
                e.currentTarget.style.borderColor = 'var(--color-border-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
              }}
            >
              <ChevronUp size={13} />
              <span>{t('serverDetail.collapseResources')}</span>
            </button>
          )}
        </div>

        {/* Power Action Buttons (Direct Adaptive State: Stop -> stopping -> Kill) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => sendPowerDirect('start')}
            disabled={!canStart || actionLoading}
            title={canStart ? t('server.power.start') : t('serverDetail.disabledWhile', { state: t(`server.status.${currentState}`) })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: canStart ? 'rgba(34, 197, 94, 0.15)' : 'var(--color-surface-hover)',
              border: `1px solid ${canStart ? 'rgba(34, 197, 94, 0.3)' : 'var(--color-border)'}`,
              color: canStart ? 'var(--color-success)' : 'var(--color-text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: canStart ? 'pointer' : 'not-allowed',
              opacity: canStart ? 1 : 0.45,
            }}
          >
            <Play size={12} /> {t('server.power.start')}
          </button>
          <button
            onClick={() => sendPowerDirect('restart')}
            disabled={!canRestart || actionLoading}
            title={canRestart ? t('server.power.restart') : t('serverDetail.disabledWhile', { state: t(`server.status.${currentState}`) })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: canRestart ? 'rgba(234, 179, 8, 0.15)' : 'var(--color-surface-hover)',
              border: `1px solid ${canRestart ? 'rgba(234, 179, 8, 0.3)' : 'var(--color-border)'}`,
              color: canRestart ? 'var(--color-warning)' : 'var(--color-text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: canRestart ? 'pointer' : 'not-allowed',
              opacity: canRestart ? 1 : 0.45,
            }}
          >
            <RotateCw size={12} /> {t('server.power.restart')}
          </button>

          {/* Adaptive Stop / Kill Button */}
          {currentState === 'stopping' ? (
            <button
              onClick={() => sendPowerDirect('kill')}
              disabled={actionLoading}
              title={t('serverDetail.forceKill')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid rgba(239, 68, 68, 0.6)',
                color: '#EF4444',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Power size={12} /> {t('server.power.kill')}
            </button>
          ) : (
            <button
              onClick={() => sendPowerDirect('stop')}
              disabled={!canStop || actionLoading}
              title={canStop ? t('server.power.stop') : t('serverDetail.disabledWhile', { state: t(`server.status.${currentState}`) })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: canStop ? 'rgba(239, 68, 68, 0.15)' : 'var(--color-surface-hover)',
                border: `1px solid ${canStop ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-border)'}`,
                color: canStop ? '#EF4444' : 'var(--color-text-muted)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: canStop ? 'pointer' : 'not-allowed',
                opacity: canStop ? 1 : 0.45,
              }}
            >
              <Square size={12} /> {t('server.power.stop')}
            </button>
          )}
        </div>
      </div>

      {/* Metrics Banner (Clean text, no graphs, normal font blue/neutral, red on overload) */}
      {!metricsCollapsed && (
        <div
          className="horizontal-scroll-container"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(130px, 1fr))',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            flexShrink: 0,
            overflowX: 'auto',
          }}
        >
          {/* CPU */}
          <div style={{ padding: '12px 16px', borderRight: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={13} color={cpuColor} /> {t('server.metrics.cpu')}
              </span>
              <span style={{ fontSize: '10px', color: cpuColor, fontWeight: 600 }}>{cpuCapacityPercent}%</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: cpuColor, marginTop: '4px' }}>
              {cpuPercent}% <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 400 }}>/ {cpuMax > 0 ? `${cpuMax}%` : t('serverDetail.unlimited')}</span>
            </div>
            <div style={{ height: '3px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, parseFloat(cpuCapacityPercent))}%`, backgroundColor: cpuColor, transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {/* Memory */}
          <div style={{ padding: '12px 16px', borderRight: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={13} color={memColor} /> {t('server.metrics.memory')}
              </span>
              {memMax > 0 && <span style={{ fontSize: '10px', color: memColor, fontWeight: 600 }}>{memCapacityPercent}%</span>}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: memColor, marginTop: '4px' }}>
              {memoryMB} MB <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 400 }}>/ {memMax > 0 ? `${memMax} MB` : t('serverDetail.unlimited')}</span>
            </div>
            <div style={{ height: '3px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, parseFloat(memCapacityPercent))}%`, backgroundColor: memColor, transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {/* Disk */}
          <div style={{ padding: '12px 16px', borderRight: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HardDrive size={13} color={diskColor} /> {t('server.metrics.disk')}
              </span>
              {diskMax > 0 && <span style={{ fontSize: '10px', color: diskColor, fontWeight: 600 }}>{diskCapacityPercent}%</span>}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: diskColor, marginTop: '4px' }}>
              {diskMB} MB <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 400 }}>/ {diskMax > 0 ? `${diskMax} MB` : t('serverDetail.unlimited')}</span>
            </div>
            <div style={{ height: '3px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, parseFloat(diskCapacityPercent))}%`, backgroundColor: diskColor, transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {/* Network (Gigabit) */}
          <div style={{ padding: '12px 16px', borderRight: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Network size={13} color="var(--color-primary-light)" /> {t('server.metrics.network')}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginTop: '4px', display: 'flex', gap: '8px' }}>
              <span style={{ color: '#10B981' }} title={t('serverDetail.networkInbound')}>↓ {formatGigabits(rxBytes)}</span>
              <span style={{ color: '#60A5FA' }} title={t('serverDetail.networkOutbound')}>↑ {formatGigabits(txBytes)}</span>
            </div>
          </div>

          {/* Server Address & Node with Quick Copy (No SFTP: prefix) */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={13} color="var(--color-primary-light)" /> {t('server.metrics.connectionAddress')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-mono)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '140px',
                }}
                title={connectionAddress}
              >
                {connectionAddress}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(connectionAddress);
                  setCopiedIp(true);
                  addNotification({
                    type: 'success',
                    title: t('common.copied'),
                    message: connectionAddress,
                    duration: 2000,
                  });
                  setTimeout(() => setCopiedIp(false), 2000);
                }}
                title={t('serverDetail.copyAddress')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: copiedIp ? 'rgba(34, 197, 94, 0.2)' : 'var(--color-surface-hover)',
                  border: `1px solid ${copiedIp ? 'var(--color-success)' : 'var(--color-border)'}`,
                  color: copiedIp ? 'var(--color-success)' : 'var(--color-text-secondary)',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {copiedIp ? <Check size={11} /> : <Copy size={11} />}
                {copiedIp ? t('serverDetail.copiedLabel') : t('serverDetail.copy')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div
        className="horizontal-scroll-container"
        style={{
          display: 'flex',
          gap: '4px',
          padding: '0 20px',
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        {[
          { key: 'console', label: t('serverDetail.tabConsole'), icon: Terminal, requiredPermission: 'control.console' },
          { key: 'files', label: t('serverDetail.tabFiles'), icon: FolderTree, requiredPermission: 'file.read' },
          { key: 'ide', label: t('serverDetail.tabIde'), icon: Code2, requiredPermission: 'file.read' },
          {
            key: 'databases',
            label: t('serverDetail.tabDatabases'),
            icon: Database,
            requiredPermission: 'database.read',
            badge: server?.feature_limits?.databases !== undefined && server.feature_limits.databases !== null
              ? `${databases.length}/${server.feature_limits.databases}`
              : null,
          },
          {
            key: 'backups',
            label: t('serverDetail.tabBackups'),
            icon: Archive,
            requiredPermission: 'backup.read',
            badge: server?.feature_limits?.backups !== undefined && server.feature_limits.backups !== null
              ? `${backups.length}/${server.feature_limits.backups}`
              : null,
          },
          { key: 'subusers', label: t('serverDetail.tabSubusers'), icon: Users, requiredPermission: 'user.read' },
          {
            key: 'network',
            label: t('serverDetail.tabNetwork'),
            icon: Network,
            requiredPermission: 'allocation.read',
            badge: server?.feature_limits?.allocations !== undefined && server.feature_limits.allocations !== null
              ? `${allocations.length}/${server.feature_limits.allocations}`
              : null,
          },
          { key: 'startup', label: t('serverDetail.tabStartup'), icon: Sliders, requiredPermission: 'startup.read' },
          { key: 'settings', label: t('serverDetail.tabSettings'), icon: Settings, requiredPermission: 'settings.rename' },
        ]
          .filter((tab) => hasServerPermission(server, tab.requiredPermission))
          .map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key as TabType)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
                color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--color-text)';
                  const svg = e.currentTarget.querySelector('svg');
                  if (svg) svg.style.stroke = 'var(--color-text)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  const svg = e.currentTarget.querySelector('svg');
                  if (svg) svg.style.stroke = 'var(--color-text-secondary)';
                }
              }}
            >
              <Icon size={14} color={isActive ? 'var(--color-primary-light)' : 'var(--color-text-secondary)'} />
              {tab.label}
              {tab.badge && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--color-text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Popout current tab into an independent detached window */}
        {!isDetachedWindow ? (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
            <button
              onClick={handleOpenDetachedWindow}
              title={t('serverDetail.openWindow')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 11px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-primary-light)';
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.backgroundColor = 'var(--color-primary-muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
              }}
            >
              <ExternalLink size={13} />
            </button>
          </div>
        ) : null}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Permission Guard for Active Tab */}
        {!hasServerPermission(server, getTabRequiredPermission(activeTab)) && (
          <div style={{ flex: 1, padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HttpErrorView
              code={403}
              title={t('serverDetail.forbiddenTitle')}
              message={t('serverDetail.forbiddenMessage', { tab: activeTab })}
              requiredPermission={getTabRequiredPermission(activeTab)}
              onBack={() => setActiveTab('console')}
            />
          </div>
        )}

        {hasServerPermission(server, getTabRequiredPermission(activeTab)) && activeTab === 'console' && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--color-bg)',
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
              fontSize: '12px',
              padding: '0',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Smart Minimalist Console Toolbar */}
            <ConsoleToolbar
              autoScroll={autoScroll}
              onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
              onClear={() => setConsoleLines([])}
              searchQuery={consoleSearch}
              onSearchChange={setConsoleSearch}
            />

            <div
              ref={consoleContainerRef}
              onScroll={handleConsoleScroll}
              className="custom-scrollbar"
              style={{
                flex: 1,
                minHeight: 0,
                width: '100%',
                maxWidth: '100%',
                overflowY: 'auto',
                overflowX: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
                padding: '16px',
                wordBreak: 'break-word',
              }}
            >
              {(consoleSearch
                ? consoleLines.filter((l) => l.toLowerCase().includes(consoleSearch.toLowerCase()))
                : consoleLines
              ).map((line, i) => (
                <ColorizedLine key={i} line={line} />
              ))}
              <div ref={consoleEndRef} />
            </div>

            {!autoScroll && (
              <button
                type="button"
                onClick={scrollToBottom}
                title="Cuộn xuống cuối log"
                className="btn-interactive"
                style={{
                  position: 'absolute',
                  bottom: '58px',
                  right: '20px',
                  width: '32px',
                  height: '32px',
                  backgroundColor: 'var(--color-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                  zIndex: 20,
                  transition: 'all 0.15s ease',
                }}
              >
                <ArrowDown size={15} />
              </button>
            )}

            <form
              onSubmit={handleSendCommand}
              style={{
                display: 'flex',
                gap: '8px',
                paddingTop: '8px',
                borderTop: '1px solid var(--color-border)',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--color-primary-light)', padding: '6px 0', fontWeight: 700 }}>
                &gt;
              </span>
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={handleCommandKeyDown}
                placeholder={t('serverDetail.consoleCommandPlaceholder')}
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />

              <button
                type="submit"
                className="btn-interactive"
                disabled={!commandInput.trim()}
                title="Gửi lệnh (Enter)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '30px',
                  borderRadius: '5px',
                  backgroundColor: commandInput.trim() ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                  border: `1px solid ${commandInput.trim() ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  color: commandInput.trim() ? '#FFFFFF' : 'var(--color-text-muted)',
                  cursor: commandInput.trim() ? 'pointer' : 'default',
                  transition: 'all 0.12s ease',
                  flexShrink: 0,
                }}
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        )}

        {/* IDE STUDIO (Integrated Server IDE) */}
        {activeTab === 'ide' && (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <ServerIDE
              serverIdentifier={identifier}
              serverName={server?.name || identifier}
              server={server}
              consoleLines={consoleLines}
              onSendCommand={executeServerCommand}
              onClearConsole={() => setConsoleLines([])}
              currentState={currentState}
            />
          </div>
        )}

        {/* FILE MANAGER */}
        {activeTab === 'files' && (
          <div style={{ padding: '16px 20px', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* File Actions Bar & Breadcrumbs */}
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px 8px 0 0',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                flexShrink: 0,
              }}
            >
              {/* Breadcrumb Path & Up Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                <button
                  onClick={handleGoBackDir}
                  disabled={currentDir === '/'}
                  title={currentDir === '/' ? 'Root Directory' : 'Go back to parent directory'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '5px',
                    backgroundColor: currentDir === '/' ? 'transparent' : 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: currentDir === '/' ? 'var(--color-text-muted)' : 'var(--color-text)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: currentDir === '/' ? 'not-allowed' : 'pointer',
                    opacity: currentDir === '/' ? 0.4 : 1,
                    marginRight: '6px',
                  }}
                >
                  <ArrowUp size={12} /> Up
                </button>
                <button
                  onClick={() => {
                    setSelectedFileNames([]);
                    loadFiles('/', sftpConnected);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: currentDir === '/' ? 'var(--color-text)' : 'var(--color-primary-light)',
                    fontWeight: currentDir === '/' ? 700 : 500,
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                >
                  /
                </button>
                {pathParts.map((part, index) => {
                  const subPath = '/' + pathParts.slice(0, index + 1).join('/');
                  const isLast = index === pathParts.length - 1;
                  return (
                    <React.Fragment key={subPath}>
                      <span style={{ color: 'var(--color-text-muted)' }}>/</span>
                      <button
                        onClick={() => {
                          setSelectedFileNames([]);
                          loadFiles(subPath, sftpConnected);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: isLast ? 'var(--color-text)' : 'var(--color-primary-light)',
                          fontWeight: isLast ? 700 : 500,
                          cursor: isLast ? 'default' : 'pointer',
                          padding: '2px 4px',
                        }}
                      >
                        {part}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Action Buttons: Filter, Upload, New Folder, New File, Pull URL, Refresh */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder={t('serverDetail.filterFiles')}
                  style={{
                    height: '28px',
                    padding: '0 8px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    outline: 'none',
                    width: '130px',
                  }}
                />

                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  title={t('serverDetail.upload')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Upload size={13} /> {t('serverDetail.upload')}
                </button>

                <button
                  onClick={() => {
                    setNewModalType('folder');
                    setNewItemName('');
                  }}
                  title={t('serverDetail.newFolder')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <FolderPlus size={13} /> {t('serverDetail.newFolder')}
                </button>

                <button
                  onClick={() => {
                    setNewModalType('file');
                    setNewItemName('');
                  }}
                  title={t('serverDetail.newFile')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <FilePlus size={13} /> {t('serverDetail.newFile')}
                </button>

                <button
                  onClick={() => setPullRemoteModal({ isOpen: true, url: '', filename: '' })}
                  title={t('serverDetail.pullUrl')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <Globe size={13} color="var(--color-primary-light)" /> Pull URL
                </button>

                <button
                  onClick={() => loadFiles(currentDir, sftpConnected)}
                  title={t('serverDetail.refreshFiles')}
                  style={{
                    padding: '5px 8px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={13} />
                </button>

                {/* View Switcher (List vs Grid) */}
                <div
                  style={{
                    display: 'inline-flex',
                    backgroundColor: 'var(--color-bg)',
                    borderRadius: '5px',
                    border: '1px solid var(--color-border)',
                    padding: '1px',
                    gap: '2px',
                    marginLeft: '4px',
                  }}
                >
                  <button
                    onClick={() => setFileViewMode('list')}
                    title={t('serverDetail.listView')}
                    style={{
                      padding: '4px 6px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: fileViewMode === 'list' ? 'var(--color-surface-hover)' : 'transparent',
                      color: fileViewMode === 'list' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <List size={13} />
                  </button>
                  <button
                    onClick={() => setFileViewMode('grid')}
                    title={t('serverDetail.gridView')}
                    style={{
                      padding: '4px 6px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: fileViewMode === 'grid' ? 'var(--color-surface-hover)' : 'transparent',
                      color: fileViewMode === 'grid' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <LayoutGrid size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Batch Action Bar if files selected */}
            {selectedFileNames.length > 0 && (
              <div
                style={{
                  padding: '8px 14px',
                  backgroundColor: 'var(--color-primary-muted)',
                  border: '1px solid var(--color-primary-glow)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary-light)' }}>
                  {selectedFileNames.length} file{selectedFileNames.length > 1 ? 's' : ''} selected
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => handleCompress()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    <Archive size={12} /> Compress Selected
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: 'var(--color-error)',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={12} /> Delete Selected
                  </button>
                  <button
                    onClick={() => setSelectedFileNames([])}
                    style={{
                      padding: '4px 8px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            {/* File List Table with Drag & Drop & Scroll */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDropFiles}
              className="custom-scrollbar"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: isDragging ? '2px dashed var(--color-primary-light)' : '1px solid var(--color-border)',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                position: 'relative',
              }}
            >
              {isDragging && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'var(--color-primary-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 20,
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#93C5FD',
                    pointerEvents: 'none',
                  }}
                >
                  Drop files to upload into {currentDir}
                </div>
              )}

              {/* File Content: Grid or List */}
              {loadingFiles ? (
                <div style={{ padding: '20px' }}>
                  <LoadingSkeleton lines={6} height={32} />
                </div>
              ) : fileList.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                  {t('serverDetail.emptyDirectory')}
                </div>
              ) : fileViewMode === 'grid' ? (
                /* GRID VIEW (view vuông) */
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: '12px',
                    padding: '16px',
                  }}
                >
                  {/* Parent Directory (..) Square Card */}
                  {currentDir !== '/' && (
                    <div
                      onClick={handleGoBackDir}
                      style={{
                        backgroundColor: 'var(--color-bg)',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        padding: '14px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg)')}
                    >
                      <FolderTree size={32} color="var(--color-primary-light)" />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>..</span>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>(Quay lại)</span>
                    </div>
                  )}

                  {fileList
                    .filter((f) => f.name.toLowerCase().includes(fileSearch.toLowerCase()))
                    .map((f) => {
                      const isSelected = selectedFileNames.includes(f.name);
                      const isArchive = /\.(tar\.gz|tgz|zip|tar|rar)$/i.test(f.name);
                      const filePath = currentDir === '/' ? `/${f.name}` : `${currentDir}/${f.name}`;

                      return (
                        <div
                          key={f.name}
                          draggable={!f.isDir}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', f.name);
                            handleDownloadWithExplorer(filePath, f.name);
                          }}
                          onContextMenu={(e) => handleContextMenu(e, f)}
                          onClick={() => {
                            if (f.isDir) {
                              setSelectedFileNames([]);
                              loadFiles(filePath, sftpConnected);
                            } else {
                              handleOpenFile(f.name);
                            }
                          }}
                          style={{
                            backgroundColor: isSelected ? 'var(--color-primary-muted)' : 'var(--color-bg)',
                            borderRadius: '8px',
                            border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            padding: '14px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s ease',
                            position: 'relative',
                            userSelect: 'none',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-bg)';
                          }}
                        >
                          {/* Checkbox */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ position: 'absolute', top: '6px', left: '6px' }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFileNames((prev) => [...prev, f.name]);
                                } else {
                                  setSelectedFileNames((prev) => prev.filter((n) => n !== f.name));
                                }
                              }}
                            />
                          </div>

                          {/* Quick Download Cloud */}
                          {!f.isDir && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadWithExplorer(filePath, f.name);
                              }}
                              title={t('serverDetail.downloadDesktop')}
                              style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-text-muted)',
                                cursor: 'pointer',
                                padding: '2px',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#38BDF8')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                            >
                              <DownloadCloud size={13} />
                            </button>
                          )}

                          {/* Icon */}
                          <div style={{ marginTop: '2px' }}>
                            {f.isDir ? (
                              <FolderTree size={32} color="var(--color-primary-light)" />
                            ) : isArchive ? (
                              <FileArchive size={32} color="var(--color-warning)" />
                            ) : (
                              <FileText size={32} color="var(--color-text-secondary)" />
                            )}
                          </div>

                          {/* Name */}
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: f.isDir ? 600 : 500,
                              color: 'var(--color-text)',
                              maxWidth: '110px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={f.name}
                          >
                            {f.name}
                          </div>

                          {/* Size */}
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                            {f.isDir
                              ? 'Folder'
                              : f.size > 1024 * 1024
                              ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
                              : `${(f.size / 1024).toFixed(1)} KB`}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                /* TABLE LIST VIEW */
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 3fr 1fr 1fr 180px',
                      padding: '8px 16px',
                      borderBottom: '1px solid var(--color-border)',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      position: 'sticky',
                      top: 0,
                      backgroundColor: 'var(--color-surface)',
                      zIndex: 10,
                    }}
                  >
                    <div>
                      <input
                        type="checkbox"
                        checked={fileList.length > 0 && selectedFileNames.length === fileList.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFileNames(fileList.map((f) => f.name));
                          } else {
                            setSelectedFileNames([]);
                          }
                        }}
                      />
                    </div>
                    <div>{t('serverDetail.name')}</div>
                    <div>{t('serverDetail.size')}</div>
                    <div>{t('serverDetail.permissions')}</div>
                    <div style={{ textAlign: 'right' }}>{t('serverDetail.actions')}</div>
                  </div>

                  {currentDir !== '/' && (
                    <div
                      onClick={handleGoBackDir}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 3fr 1fr 1fr 180px',
                        alignItems: 'center',
                        padding: '8px 16px',
                        borderBottom: '1px solid var(--color-border-subtle)',
                        fontSize: '13px',
                        cursor: 'pointer',
                        backgroundColor: 'rgba(255, 255, 255, 0.01)',
                        userSelect: 'none',
                        transition: 'background-color 0.1s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.01)')}
                    >
                      <div />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FolderTree size={16} color="var(--color-primary-light)" />
                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>..</span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>({t('serverDetail.parentDirectory')})</span>
                      </div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>-</div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>-</div>
                      <div />
                    </div>
                  )}

                  {fileList
                    .filter((f) => f.name.toLowerCase().includes(fileSearch.toLowerCase()))
                    .map((f, i) => {
                      const isSelected = selectedFileNames.includes(f.name);
                      const isArchive = /\.(tar\.gz|tgz|zip|tar|rar)$/i.test(f.name);
                      const filePath = currentDir === '/' ? `/${f.name}` : `${currentDir}/${f.name}`;

                      return (
                        <div
                          key={f.name}
                          draggable={!f.isDir}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', f.name);
                            handleDownloadWithExplorer(filePath, f.name);
                          }}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '40px 3fr 1fr 1fr 180px',
                            alignItems: 'center',
                            padding: '8px 16px',
                            borderBottom: i < fileList.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                            fontSize: '13px',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'var(--color-primary-muted)' : 'transparent',
                            transition: 'background-color 0.12s ease',
                            userSelect: 'none',
                          }}
                          onContextMenu={(e) => handleContextMenu(e, f)}
                          onClick={() => {
                            if (f.isDir) {
                              setSelectedFileNames([]);
                              loadFiles(filePath, sftpConnected);
                            } else {
                              handleOpenFile(f.name);
                            }
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          {/* Checkbox */}
                          <div onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFileNames((prev) => [...prev, f.name]);
                                } else {
                                  setSelectedFileNames((prev) => prev.filter((n) => n !== f.name));
                                }
                              }}
                            />
                          </div>

                          {/* Name */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                            {f.isDir ? (
                              <FolderTree size={16} color="var(--color-primary-light)" style={{ flexShrink: 0 }} />
                            ) : isArchive ? (
                              <FileArchive size={16} color="var(--color-warning)" style={{ flexShrink: 0 }} />
                            ) : (
                              <FileText size={16} color="var(--color-text-secondary)" style={{ flexShrink: 0 }} />
                            )}
                            <span
                              style={{
                                color: 'var(--color-text)',
                                fontWeight: f.isDir ? 600 : 400,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {f.name}
                            </span>
                          </div>

                          {/* Size */}
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            {f.isDir
                              ? 'Folder'
                              : f.size > 1024 * 1024
                              ? `${(f.size / (1024 * 1024)).toFixed(2)} MB`
                              : `${(f.size / 1024).toFixed(1)} KB`}
                          </div>

                          {/* Mode / Permissions */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setChmodModal({ isOpen: true, fileName: f.name, mode: f.mode || '0755' });
                            }}
                            title={t('serverDetail.editFilePermissions')}
                            style={{
                              fontSize: '11px',
                              color: 'var(--color-text-muted)',
                              fontFamily: 'var(--font-mono)',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary-light)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                          >
                            {f.mode || '0755'}
                          </div>

                          {/* Actions Suite */}
                          <div
                            style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Download to Desktop */}
                            {!f.isDir && (
                              <button
                                onClick={() => handleDownloadWithExplorer(filePath, f.name)}
                                title={t('serverDetail.downloadDesktop')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--color-text-secondary)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = '#38BDF8')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                              >
                                <DownloadCloud size={14} />
                              </button>
                            )}

                            {/* Download via Browser */}
                            {!f.isDir && (
                              <button
                                onClick={() => handleDownloadFile(f.name)}
                                title={t('serverDetail.downloadFile')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--color-text-secondary)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-success)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                              >
                                <Download size={14} />
                              </button>
                            )}

                            {/* Edit */}
                            {!f.isDir && (
                              <button
                                onClick={() => handleOpenFile(f.name)}
                                title={t('serverDetail.editFile')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--color-text-secondary)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary-light)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                              >
                                <Edit2 size={14} />
                              </button>
                            )}

                            {/* Copy */}
                            <button
                              onClick={() => handleCopyFile(f.name)}
                              title={t('serverDetail.duplicate')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                padding: '4px',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary-light)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                            >
                              <Copy size={14} />
                            </button>

                            {/* Rename */}
                            <button
                              onClick={() => setRenameModal({ isOpen: true, oldName: f.name, newName: f.name })}
                              title={t('serverDetail.rename')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                padding: '4px',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary-light)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                            >
                              <Edit2 size={14} />
                            </button>

                            {/* Permissions */}
                            <button
                              onClick={() => setChmodModal({ isOpen: true, fileName: f.name, mode: f.mode || '0755' })}
                              title={t('serverDetail.permissions')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                padding: '4px',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-warning)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                            >
                              <Key size={14} />
                            </button>

                            {/* Decompress if archive */}
                            {isArchive && (
                              <button
                                onClick={() => handleDecompress(f.name)}
                                title={t('serverDetail.extract')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--color-warning)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = '#FDE047')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-warning)')}
                              >
                                <FileArchive size={14} />
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => setFileToDelete(filePath)}
                              title={t('common.delete')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                padding: '4px',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-error)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </>
              )}
            </div>
          </div>
        )}

        {/* Databases tab */}
        {activeTab === 'databases' && (
          <div className="custom-scrollbar horizontal-scroll-container" style={{ padding: '24px', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', maxWidth: '1280px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <ServerSectionHeader
              icon={Database}
              title={t('serverDetail.databases') || 'Server Databases'}
              subtitle={`${databases.length} / ${server?.feature_limits?.databases !== undefined && server.feature_limits.databases !== null ? server.feature_limits.databases : 'Unlimited'} databases allocated`}
              actions={
                <button
                  onClick={() => loadDatabases()}
                  disabled={loadingDbs}
                  className="btn-interactive"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={13} className={loadingDbs ? 'animate-spin' : ''} />
                  <span>{t('common.refresh') || 'Làm mới'}</span>
                </button>
              }
            />

            {loadingDbs ? (
              <LoadingSkeleton lines={3} height={40} />
            ) : databases.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                No databases currently provisioned for this server
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                {databases.map((db) => (
                  <div
                    key={db.id}
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      padding: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Database size={15} color="var(--color-primary-light)" />
                      <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>
                        {db.name}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      User: {db.username}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      Host: {db.host.address}:{db.host.port}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Allocations (Client server network) tab */}
        {activeTab === 'network' && (
          <div className="custom-scrollbar horizontal-scroll-container" style={{ padding: '24px', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', maxWidth: '1280px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <ServerSectionHeader
              icon={Network}
              title="Network & Port Allocations"
              subtitle={`${allocations.length} / ${server?.feature_limits?.allocations !== undefined && server.feature_limits.allocations !== null ? server.feature_limits.allocations : 'Unlimited'} allocations assigned • Control IP bindings and ports`}
              actions={
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={loadAllocations}
                    disabled={loadingAllocations}
                    className="btn-interactive"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={13} className={loadingAllocations ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                  <button
                    onClick={handleAssignAllocation}
                    disabled={assigningAlloc}
                    className="btn-interactive"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-primary)',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: assigningAlloc ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 8px var(--color-primary-glow)',
                    }}
                  >
                    <Plus size={14} />
                    {assigningAlloc ? 'Assigning...' : 'Assign Allocation'}
                  </button>
                </div>
              }
            />

            {loadingAllocations && allocations.length === 0 ? (
              <LoadingSkeleton lines={4} />
            ) : allocations.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px dashed var(--color-border)',
                  borderRadius: '10px',
                  color: 'var(--color-text-muted)',
                }}
              >
                <Network size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
                  No Allocations Assigned
                </h4>
                <p style={{ fontSize: '12px', maxWidth: '380px', margin: '0 auto 16px' }}>
                  This server currently has no network ports bound. Click the button above to assign an available port from the node.
                </p>
                <button
                  onClick={handleAssignAllocation}
                  disabled={assigningAlloc}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {assigningAlloc ? 'Assigning...' : 'Assign Allocation Now'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {allocations.map((alloc) => {
                  const ipPort = `${alloc.ip}:${alloc.port}`;
                  const isPrimary = alloc.is_default;
                  const isBusySettingPrimary = settingPrimaryId === alloc.id;

                  return (
                    <div
                      key={alloc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 18px',
                        backgroundColor: 'var(--color-surface)',
                        border: isPrimary ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid var(--color-border)',
                        borderRadius: '8px',
                        boxShadow: isPrimary ? '0 0 12px rgba(34, 197, 94, 0.08)' : undefined,
                        transition: 'border-color 0.15s ease',
                      }}
                    >
                      {/* Left: Port details */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            backgroundColor: isPrimary ? 'rgba(34, 197, 94, 0.12)' : 'var(--color-surface-hover)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Network size={18} color={isPrimary ? 'var(--color-success)' : 'var(--color-primary-light)'} />
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: '14px',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--color-text)',
                                letterSpacing: '0.02em',
                              }}
                            >
                              {ipPort}
                            </span>

                            <button
                              title={t('serverDetail.copyAddressPort')}
                              onClick={() => {
                                navigator.clipboard.writeText(ipPort);
                                addNotification({ type: 'info', title: t('serverDetail.copied'), message: t('serverDetail.addressCopied', { address: ipPort }) });
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-text-muted)',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                            >
                              <Copy size={13} />
                            </button>

                            {isPrimary && (
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                  color: 'var(--color-success)',
                                  border: '1px solid rgba(34, 197, 94, 0.3)',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  letterSpacing: '0.04em',
                                }}
                              >
                                PRIMARY
                              </span>
                            )}

                            {alloc.ip_alias && (
                              <span
                                style={{
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'var(--color-surface-hover)',
                                  border: '1px solid var(--color-border)',
                                  color: 'var(--color-text-secondary)',
                                  fontSize: '10px',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                Alias: {alloc.ip_alias}
                              </span>
                            )}
                          </div>

                          {/* Notes */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <Tag size={12} color="var(--color-text-muted)" />
                            {alloc.notes ? (
                              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                {alloc.notes}
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                No note assigned
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {/* Note Edit Button */}
                        <button
                          title={t('serverDetail.editNote')}
                          onClick={() =>
                            setNoteModal({
                              isOpen: true,
                              allocId: alloc.id,
                              ipPort,
                              notes: alloc.notes || '',
                            })
                          }
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 10px',
                            borderRadius: '5px',
                            backgroundColor: 'var(--color-surface-hover)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                            fontSize: '11px',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          <Edit2 size={12} />
                          Note
                        </button>

                        {/* Make Primary Button */}
                        {!isPrimary && (
                          <button
                            title={t('serverDetail.setPrimary')}
                            disabled={isBusySettingPrimary}
                            onClick={() => handleSetPrimary(alloc.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 10px',
                              borderRadius: '5px',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              color: 'var(--color-primary-light)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: isBusySettingPrimary ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <Star size={12} />
                            {isBusySettingPrimary ? 'Setting...' : 'Make Primary'}
                          </button>
                        )}

                        {/* Unassign / Delete Allocation */}
                        {!isPrimary && (
                          <button
                            title={t('serverDetail.deleteAllocationTitle')}
                            onClick={() =>
                              setUnassignDialog({
                                isOpen: true,
                                allocId: alloc.id,
                                ipPort,
                              })
                            }
                            style={{
                              padding: '6px',
                              borderRadius: '5px',
                              backgroundColor: 'transparent',
                              border: '1px solid transparent',
                              color: 'var(--color-text-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--color-error)';
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--color-text-muted)';
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.borderColor = 'transparent';
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Startup tab */}
        {activeTab === 'startup' && (
          <div className="custom-scrollbar" style={{ padding: '24px', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', maxWidth: '1280px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <ServerSectionHeader
              icon={Play}
              title={t('startupTab.title') || 'Startup Configuration'}
              subtitle={t('startupTab.subtitle') || 'Docker images, launch parameters, and environment variables'}
              actions={
                <button
                  onClick={loadStartupConfig}
                  disabled={loadingStartup}
                  className="btn-interactive"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: loadingStartup ? 'not-allowed' : 'pointer',
                  }}
                >
                  <RefreshCw size={13} className={loadingStartup ? 'animate-spin' : ''} />
                  <span>{t('startupTab.refresh') || 'Refresh'}</span>
                </button>
              }
            />

            {loadingStartup && !startupConfig ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <LoadingSkeleton height="100px" />
                <LoadingSkeleton height="140px" />
                <LoadingSkeleton height="300px" />
              </div>
            ) : !startupConfig ? (
              <div
                style={{
                  padding: '36px',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                }}
              >
                <AlertTriangle size={32} color="var(--color-warning)" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                  {t('startupTab.notLoaded')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '16px' }}>
                  {t('startupTab.notLoadedDesc')}
                </div>
                <button
                  onClick={loadStartupConfig}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('startupTab.retry')}
                </button>
              </div>
            ) : (
              <>
                {/* Startup Command Card */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Terminal size={15} color="var(--color-primary-light)" />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                        {t('startupTab.commandTitle')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => setShowRawCommand(!showRawCommand)}
                        style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          backgroundColor: showRawCommand ? 'var(--color-primary-muted)' : 'transparent',
                          border: '1px solid var(--color-border)',
                          borderRadius: '4px',
                          color: showRawCommand ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        {showRawCommand ? t('startupTab.hideRaw') : t('startupTab.viewRaw')}
                      </button>

                      <button
                        onClick={() => handleCopyStartupCommand(startupConfig.startup_command)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          padding: '4px 10px',
                          backgroundColor: copiedCmd ? 'rgba(34, 197, 94, 0.2)' : 'var(--color-surface-hover)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '4px',
                          color: copiedCmd ? 'var(--color-success)' : 'var(--color-text)',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        {copiedCmd ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedCmd ? t('startupTab.copied') : t('startupTab.copyCommand')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Rendered Command */}
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      padding: '12px',
                      backgroundColor: 'var(--color-bg)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: '6px',
                      color: '#a5b4fc',
                      wordBreak: 'break-all',
                      lineHeight: '1.5',
                      userSelect: 'text',
                    }}
                  >
                    {startupConfig.startup_command || t('startupTab.noCommand')}
                  </div>

                  {/* Raw Command with variable highlighting if toggled */}
                  {showRawCommand && startupConfig.raw_startup_command && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--color-border)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                        {t('startupTab.rawTitle')}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          padding: '10px 12px',
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          border: '1px solid var(--color-border-subtle)',
                          borderRadius: '6px',
                          color: 'var(--color-text-secondary)',
                          wordBreak: 'break-all',
                          lineHeight: '1.5',
                        }}
                      >
                        {startupConfig.raw_startup_command}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        ℹ️ {t('startupTab.rawHelp')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Variables Header, Search & Filter Toolbar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sliders size={15} color="var(--color-primary-light)" />
                      <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                        {t('startupTab.envVariables')}
                      </h4>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        ({startupConfig.variables.filter((v: any) => {
                          if (startupFilter === 'editable' && !v.is_editable) return false;
                          if (startupFilter === 'custom') {
                            const cur = varDrafts[v.env_variable] ?? v.server_value ?? '';
                            const def = v.default_value ?? '';
                            if (cur === def) return false;
                          }
                          if (startupSearch.trim()) {
                            const q = startupSearch.toLowerCase().trim();
                            const matchName = (v.name || '').toLowerCase().includes(q);
                            const matchKey = (v.env_variable || '').toLowerCase().includes(q);
                            const matchDesc = (v.description || '').toLowerCase().includes(q);
                            const matchVal = (varDrafts[v.env_variable] || '').toLowerCase().includes(q);
                            return matchName || matchKey || matchDesc || matchVal;
                          }
                          return true;
                        }).length} / {startupConfig.variables.length})
                      </span>
                    </div>

                    {/* Filter Pills */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {[
                        { key: 'all', label: 'Tất cả' },
                        { key: 'editable', label: 'Có thể sửa' },
                        { key: 'custom', label: 'Đã tùy chỉnh' },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setStartupFilter(tab.key as any)}
                          style={{
                            fontSize: '11px',
                            padding: '4px 10px',
                            backgroundColor: startupFilter === tab.key ? 'var(--color-primary-muted)' : 'var(--color-surface)',
                            border: `1px solid ${startupFilter === tab.key ? 'var(--color-primary-light)' : 'var(--color-border)'}`,
                            borderRadius: '12px',
                            color: startupFilter === tab.key ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            fontWeight: startupFilter === tab.key ? 600 : 400,
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search Input */}
                  <div style={{ position: 'relative' }}>
                    <Search
                      size={14}
                      color="var(--color-text-muted)"
                      style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                      type="text"
                      placeholder={t('serverDetail.searchVariables')}
                      value={startupSearch}
                      onChange={(e) => setStartupSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 34px',
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '6px',
                        color: 'var(--color-text)',
                        fontSize: '12px',
                        outline: 'none',
                      }}
                    />
                    {startupSearch && (
                      <button
                        onClick={() => setStartupSearch('')}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Variables Grid */}
                {(() => {
                  const filteredVars = startupConfig.variables.filter((v: any) => {
                    if (startupFilter === 'editable' && !v.is_editable) return false;
                    if (startupFilter === 'custom') {
                      const cur = varDrafts[v.env_variable] ?? v.server_value ?? '';
                      const def = v.default_value ?? '';
                      if (cur === def) return false;
                    }
                    if (startupSearch.trim()) {
                      const q = startupSearch.toLowerCase().trim();
                      const matchName = (v.name || '').toLowerCase().includes(q);
                      const matchKey = (v.env_variable || '').toLowerCase().includes(q);
                      const matchDesc = (v.description || '').toLowerCase().includes(q);
                      const matchVal = (varDrafts[v.env_variable] || '').toLowerCase().includes(q);
                      return matchName || matchKey || matchDesc || matchVal;
                    }
                    return true;
                  });

                  if (filteredVars.length === 0) {
                    return (
                      <div
                        style={{
                          padding: '30px',
                          textAlign: 'center',
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          color: 'var(--color-text-muted)',
                          fontSize: '12px',
                        }}
                      >
                        Không tìm thấy biến môi trường nào phù hợp với bộ lọc.
                      </div>
                    );
                  }

                  return (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
                        gap: '14px',
                      }}
                    >
                      {filteredVars.map((v: any) => {
                        const key = v.env_variable;
                        const draftVal = varDrafts[key] ?? v.server_value ?? '';
                        const isModified = draftVal !== (v.server_value ?? '');
                        const isDifferentFromDefault = draftVal !== (v.default_value ?? '');
                        const isSaving = savingVarKey === key;
                        const isSecret = key.includes('PASS') || key.includes('SECRET') || key.includes('TOKEN') || key.includes('KEY');
                        const showPassword = showPasswordMap[key] || false;
                        const rules = v.rules || '';
                        const isRequired = rules.includes('required');
                        const isBoolean = rules.includes('boolean');

                        return (
                          <div
                            key={key}
                            style={{
                              backgroundColor: 'var(--color-surface)',
                              border: `1px solid ${isModified ? 'var(--color-warning)' : 'var(--color-border)'}`,
                              borderRadius: '8px',
                              padding: '16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                              position: 'relative',
                              transition: 'border-color 0.2s ease',
                            }}
                          >
                            {/* Top Row: Name, Key badge, Status badges */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>{v.name || key}</span>
                                  {isRequired && (
                                    <span style={{ fontSize: '10px', color: 'var(--color-error)', fontWeight: 700 }}>*</span>
                                  )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {isModified && (
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: 'var(--color-warning-bg)',
                                        color: 'var(--color-warning)',
                                        fontWeight: 600,
                                      }}
                                    >
                                      Chưa lưu
                                    </span>
                                  )}
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      backgroundColor: v.is_editable ? 'var(--color-success-bg)' : 'rgba(100, 116, 139, 0.15)',
                                      color: v.is_editable ? 'var(--color-success)' : 'var(--color-text-muted)',
                                      fontWeight: 500,
                                    }}
                                  >
                                    {v.is_editable ? 'Editable' : 'Read Only'}
                                  </span>
                                </div>
                              </div>

                              {/* Key Pill with Copy */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <span
                                  onClick={() => {
                                    navigator.clipboard.writeText(key);
                                    addNotification({ type: 'info', title: t('serverDetail.copied'), message: t('serverDetail.keyCopied', { key }) });
                                  }}
                                  title={t('serverDetail.clickToCopyKey')}
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11px',
                                    color: 'var(--color-primary-light)',
                                    backgroundColor: 'var(--color-primary-muted)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  {key}
                                  <Copy size={10} />
                                </span>
                              </div>

                              {/* Description */}
                              {v.description && (
                                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '8px', lineHeight: '1.4' }}>
                                  {v.description}
                                </p>
                              )}
                            </div>

                            {/* Input Field Control */}
                            <div>
                              {isBoolean ? (
                                <select
                                  disabled={!v.is_editable}
                                  value={draftVal}
                                  onChange={(e) => setVarDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                                  style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    backgroundColor: 'var(--color-bg)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '6px',
                                    color: 'var(--color-text)',
                                    fontSize: '12px',
                                    outline: 'none',
                                  }}
                                >
                                  <option value="0">0 (False / Tắt)</option>
                                  <option value="1">1 (True / Bật)</option>
                                </select>
                              ) : (
                                <div style={{ position: 'relative' }}>
                                  <input
                                    type={isSecret && !showPassword ? 'password' : 'text'}
                                    disabled={!v.is_editable}
                                    value={draftVal}
                                    onChange={(e) => setVarDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                                    placeholder={v.default_value || 'Chưa có giá trị'}
                                    style={{
                                      width: '100%',
                                      padding: `8px ${isSecret ? '34px' : '10px'} 8px 10px`,
                                      backgroundColor: v.is_editable ? 'var(--color-bg)' : 'rgba(0,0,0,0.3)',
                                      border: `1px solid ${isModified ? 'var(--color-warning)' : 'var(--color-border)'}`,
                                      borderRadius: '6px',
                                      color: 'var(--color-text)',
                                      fontSize: '12px',
                                      fontFamily: 'var(--font-mono)',
                                      outline: 'none',
                                    }}
                                  />
                                  {isSecret && (
                                    <button
                                      type="button"
                                      onClick={() => setShowPasswordMap((prev) => ({ ...prev, [key]: !showPassword }))}
                                      style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--color-text-muted)',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Footer with Default, Rules, Reset, AI Ask, and Save buttons */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingTop: '8px',
                                borderTop: '1px solid var(--color-border-subtle)',
                                flexWrap: 'wrap',
                                gap: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                  Mặc định: <code style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{v.default_value || '""'}</code>
                                </span>
                                {isDifferentFromDefault && v.is_editable && (
                                  <button
                                    type="button"
                                    onClick={() => handleResetVariable(key, v.default_value || '')}
                                    title={t('serverDetail.resetDefault')}
                                    style={{
                                      fontSize: '10px',
                                      padding: '2px 6px',
                                      backgroundColor: 'transparent',
                                      border: '1px solid var(--color-border)',
                                      borderRadius: '4px',
                                      color: 'var(--color-text-muted)',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}
                                  >
                                    <RotateCcw size={10} /> Reset
                                  </button>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {/* Save Button */}
                                {v.is_editable && (
                                  <button
                                    type="button"
                                    onClick={() => handleSaveVariable(key)}
                                    disabled={isSaving || !isModified}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '5px 10px',
                                      backgroundColor: isModified ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                                      border: 'none',
                                      borderRadius: '4px',
                                      color: isModified ? '#fff' : 'var(--color-text-muted)',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      cursor: isSaving || !isModified ? 'not-allowed' : 'pointer',
                                      opacity: isSaving ? 0.7 : 1,
                                    }}
                                  >
                                    {isSaving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
                                    <span>{isSaving ? 'Đang lưu...' : 'Lưu'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* BACKUPS TAB */}
        {activeTab === 'backups' && (
          <div className="custom-scrollbar horizontal-scroll-container" style={{ padding: '24px', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', maxWidth: '1280px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <ServerSectionHeader
              icon={Archive}
              title={t('serverDetail.backups') || 'Backups'}
              subtitle={`${backups.length} / ${server?.feature_limits?.backups !== undefined && server.feature_limits.backups !== null ? server.feature_limits.backups : 'Unlimited'} backups created • Manage archives and restore points`}
              actions={
                <button
                  onClick={() => setShowBackupModal(true)}
                  className="btn-interactive"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={14} /> {t('serverDetail.createBackup')}
                </button>
              }
            />

            {loadingBackups ? (
              <LoadingSkeleton lines={3} />
            ) : backups.length === 0 ? (
              <div
                style={{
                  padding: '40px',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: '8px',
                  border: '1px dashed var(--color-border)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <Archive size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{t('serverDetail.noBackups')}</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  Take a snapshot of your server files before making major modifications.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {backups.map((bak: any) => (
                  <div
                    key={bak.uuid}
                    style={{
                      padding: '14px 18px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                          {bak.name || bak.uuid}
                        </span>
                        {bak.is_locked ? (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(234, 179, 8, 0.15)',
                              color: 'var(--color-warning)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Lock size={10} /> Locked
                          </span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', display: 'flex', gap: '16px' }}>
                        <span>{t('serverDetail.sizeLabel', { size: (bak.bytes / 1024 / 1024).toFixed(1) })}</span>
                        <span>{t('serverDetail.createdLabel', { date: new Date(bak.created_at).toLocaleString() })}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => handleToggleBackupLock(bak.uuid)}
                        title={bak.is_locked ? 'Unlock Backup' : 'Lock Backup'}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--color-surface-hover)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        {bak.is_locked ? <Unlock size={13} /> : <Lock size={13} />}
                      </button>
                      <button
                        onClick={() => handleDownloadBackup(bak.uuid)}
                        title={t('serverDetail.downloadBackup')}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--color-surface-hover)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        <DownloadCloud size={13} />
                      </button>
                      <button
                        onClick={() => handleRestoreBackup(bak.uuid)}
                        title={t('serverDetail.restoreBackup')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(234, 179, 8, 0.15)',
                          border: '1px solid rgba(234, 179, 8, 0.3)',
                          color: 'var(--color-warning)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        {t('serverDetail.restore')}
                      </button>
                      <button
                        onClick={() => handleDeleteBackup(bak.uuid)}
                        disabled={bak.is_locked}
                        title={bak.is_locked ? 'Unlock before deleting' : 'Delete Backup'}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: 'var(--color-error)',
                          fontSize: '12px',
                          cursor: bak.is_locked ? 'not-allowed' : 'pointer',
                          opacity: bak.is_locked ? 0.4 : 1,
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUBUSERS TAB */}
        {activeTab === 'subusers' && (
          <div className="custom-scrollbar horizontal-scroll-container" style={{ padding: '24px', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', maxWidth: '1280px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <ServerSectionHeader
              icon={Users}
              title={t('serverDetail.subusers') || 'Subusers'}
              subtitle={t('serverDetail.subusersDesc') || 'Collaborator permissions and access control'}
              actions={
                <button
                  onClick={() => {
                    setSubuserToEdit(null);
                    setShowSubuserModal(true);
                  }}
                  className="btn-interactive"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={14} /> {t('serverDetail.addSubuser')}
                </button>
              }
            />

            {loadingSubusers ? (
              <LoadingSkeleton lines={3} />
            ) : subusers.length === 0 ? (
              <div
                style={{
                  padding: '40px',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: '8px',
                  border: '1px dashed var(--color-border)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{t('serverDetail.noSubusers')}</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  {t('serverDetail.ownerOnly')}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {subusers.map((sub: any) => (
                  <div
                    key={sub.uuid}
                    style={{
                      padding: '14px 18px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                        {sub.email}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {t('serverDetail.usernamePermissions', { username: sub.username, count: sub.permissions?.length || 0 })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setSubuserToEdit(sub);
                          setShowSubuserModal(true);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          color: 'var(--color-primary-light)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 500,
                        }}
                      >
                        <Edit2 size={13} /> {t('serverDetail.editPermissions')}
                      </button>

                      <button
                        onClick={() => handleDeleteSubuser(sub.uuid)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: 'var(--color-error)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Trash2 size={13} /> {t('serverDetail.remove')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SERVER SETTINGS SUBTAB */}
        {activeTab === 'settings' && (
          <ServerSettingsTab
            server={server}
            identifier={identifier}
            serverName={settingServerName}
            serverDesc={settingServerDesc}
            savingSettings={savingSettings}
            onServerNameChange={setSettingServerName}
            onServerDescChange={setSettingServerDesc}
            onSaveDetails={handleRenameServer}
            onCopyText={(text) => {
              navigator.clipboard.writeText(text);
              addNotification({
                type: 'success',
                title: t('common.copied'),
                message: text,
                duration: 2000,
              });
            }}
            reinstallModalOpen={reinstallModalOpen}
            onOpenReinstallModal={() => {
              setReinstallConfirmInput('');
              setReinstallModalOpen(true);
            }}
            onCloseReinstallModal={() => setReinstallModalOpen(false)}
            reinstalling={reinstalling}
            reinstallConfirmInput={reinstallConfirmInput}
            onReinstallConfirmInputChange={setReinstallConfirmInput}
            onConfirmReinstall={handleReinstallServer}
          />
        )}
      </div>

      {/* PteroMonaco Advanced File Editor */}
      {editingFile && (
        <PteroMonacoEditor
          fileName={editingFile}
          initialValue={fileContent}
          isSftp={sftpConnected}
          isSaving={savingFile}
          onSave={handleSaveFileContent}
          onClose={() => setEditingFile(null)}
          onOpenNewTab={() => {
            const fileToOpen = editingFile;
            setEditingFile(null);
            openFileInTab(identifier, fileToOpen, sftpConnected);
          }}
        />
      )}

      {/* Rename File / Folder Modal */}
      {renameModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setRenameModal({ isOpen: false, oldName: '', newName: '' });
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '12px' }}>
              Rename Item
            </h3>
            <form onSubmit={handleRenameSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  New Name
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={renameModal.newName}
                  onChange={(e) => setRenameModal((prev) => ({ ...prev, newName: e.target.value }))}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setRenameModal({ isOpen: false, oldName: '', newName: '' })}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chmod Permissions Modal */}
      {chmodModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setChmodModal({ isOpen: false, fileName: '', mode: '0755' });
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>
              {t('serverDetail.changePermissions')}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
              {t('serverDetail.target')} <code style={{ color: 'var(--color-primary-light)' }}>{chmodModal.fileName}</code>
            </p>

            <form onSubmit={handleChmodSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  {t('serverDetail.octalMode')}
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={chmodModal.mode}
                  onChange={(e) => setChmodModal((prev) => ({ ...prev, mode: e.target.value }))}
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
                {[
                  { label: t('serverDetail.fileMode'), mode: '0644' },
                  { label: t('serverDetail.execDirMode'), mode: '0755' },
                  { label: t('serverDetail.fullMode'), mode: '0777' },
                ].map((preset) => (
                  <button
                    key={preset.mode}
                    type="button"
                    onClick={() => setChmodModal((prev) => ({ ...prev, mode: preset.mode }))}
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setChmodModal({ isOpen: false, fileName: '', mode: '0755' })}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('serverDetail.updateMode')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pull Remote File Modal */}
      {pullRemoteModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPullRemoteModal({ isOpen: false, url: '', filename: '' });
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>
              {t('serverDetail.pullRemote')}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
              {t('serverDetail.pullRemoteDesc', { directory: currentDir })}
            </p>

            <form onSubmit={handlePullRemoteSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  {t('serverDetail.remoteUrl')}
                </label>
                <input
                  type="url"
                  autoFocus
                  required
                  placeholder="https://example.com/server.jar"
                  value={pullRemoteModal.url}
                  onChange={(e) => setPullRemoteModal((prev) => ({ ...prev, url: e.target.value }))}
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

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  {t('serverDetail.customFilename')}
                </label>
                <input
                  type="text"
                  placeholder={t('serverDetail.pullFilenamePlaceholder')}
                  value={pullRemoteModal.filename}
                  onChange={(e) => setPullRemoteModal((prev) => ({ ...prev, filename: e.target.value }))}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPullRemoteModal({ isOpen: false, url: '', filename: '' })}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('serverDetail.startPull')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Folder / File Modal */}
      {newModalType && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setNewModalType(null);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '18px',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '12px' }}>
              {t('serverDetail.createNew', { type: t(newModalType === 'folder' ? 'serverDetail.folder' : 'serverDetail.file') })}
            </h3>
            <form onSubmit={handleCreateNewItem}>
              <input
                type="text"
                autoFocus
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={newModalType === 'folder' ? 'folder-name' : 'config.yml'}
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
                  marginBottom: '16px',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setNewModalType(null)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('serverDetail.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Backup Modal */}
      {showBackupModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowBackupModal(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '12px' }}>
              {t('serverDetail.createServerBackup')}
            </h3>
            <form onSubmit={handleCreateBackup}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  {t('serverDetail.backupName')}
                </label>
                <input
                  type="text"
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                  placeholder={t('serverDetail.backupNamePlaceholder')}
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                <input
                  type="checkbox"
                  id="lockBackup"
                  checked={backupLocked}
                  onChange={(e) => setBackupLocked(e.target.checked)}
                />
                <label htmlFor="lockBackup" style={{ fontSize: '12px', color: 'var(--color-text)' }}>
                  {t('serverDetail.backupLockDesc')}
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowBackupModal(false)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creatingBackup}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: creatingBackup ? 'not-allowed' : 'pointer',
                  }}
                >
                  {creatingBackup ? t('serverDetail.starting') : t('serverDetail.createBackupAction')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subuser Invite / Permissions Editor Modal */}
      <SubuserPermissionsModal
        isOpen={showSubuserModal}
        onClose={() => {
          setShowSubuserModal(false);
          setSubuserToEdit(null);
        }}
        subuser={subuserToEdit}
        serverIdentifier={identifier}
        onSuccess={() => {
          loadSubusers();
          addNotification({
            type: 'success',
            title: t('serverDetail.subusersUpdated'),
            message: subuserToEdit
              ? t('serverDetail.permissionsUpdated', { email: subuserToEdit.email })
              : t('serverDetail.inviteSent'),
          });
        }}
      />

      {/* Allocation Note Modal */}
      {noteModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setNoteModal({ isOpen: false, allocId: 0, ipPort: '', notes: '' });
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
              {t('serverDetail.editAllocationNote')}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
              {t('serverDetail.endpoint')} <code style={{ color: 'var(--color-primary-light)', fontFamily: 'var(--font-mono)' }}>{noteModal.ipPort}</code>
            </p>

            <form onSubmit={handleSaveAllocationNote}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  {t('serverDetail.customNote')}
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder={t('serverDetail.notePlaceholder')}
                  value={noteModal.notes}
                  onChange={(e) => setNoteModal((prev) => ({ ...prev, notes: e.target.value }))}
                  style={{
                    width: '100%',
                    height: '36px',
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setNoteModal({ isOpen: false, allocId: 0, ipPort: '', notes: '' })}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={savingNote}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: savingNote ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingNote ? t('common.saving') : t('serverDetail.saveNote')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pterodactyl-Style File Context Menu */}
      {contextMenu.isOpen && contextMenu.file && createPortal(
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 10000,
            width: '190px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
            padding: '4px',
            userSelect: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with filename */}
          <div
            style={{
              padding: '6px 8px',
              borderBottom: '1px solid var(--color-border-subtle)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {contextMenu.file.name}
          </div>

          {/* Edit (if file) */}
          {!contextMenu.file.isDir && (
            <>
              <button
                onClick={() => {
                  const name = contextMenu.file!.name;
                  setContextMenu({ isOpen: false, x: 0, y: 0, file: null });
                  handleOpenFile(name);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: '5px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Edit2 size={13} color="var(--color-primary-light)" />
                <span>{t('serverDetail.editFile')}</span>
              </button>

              <button
                onClick={() => {
                  const name = contextMenu.file!.name;
                  const fullPath = currentDir === '/' ? `/${name}` : `${currentDir}/${name}`;
                  setContextMenu({ isOpen: false, x: 0, y: 0, file: null });
                  openFileInTab(identifier, fullPath, sftpConnected);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: '5px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <ExternalLink size={13} color="#60A5FA" />
                <span>{t('files.openNewTab')}</span>
              </button>
            </>
          )}

          {/* Download to Desktop (if file) */}
          {!contextMenu.file.isDir && (
            <button
              onClick={() => {
                const name = contextMenu.file!.name;
                setContextMenu({ isOpen: false, x: 0, y: 0, file: null });
                handleDownloadFile(name);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '6px 10px',
                borderRadius: '5px',
                background: 'none',
                border: 'none',
                color: 'var(--color-text)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Download size={13} color="var(--color-success)" />
              <span>{t('serverDetail.downloadDesktop')}</span>
            </button>
          )}

          {/* Rename */}
          <button
            onClick={() => {
              const name = contextMenu.file!.name;
              setContextMenu({ isOpen: false, x: 0, y: 0, file: null });
              setRenameModal({ isOpen: true, oldName: name, newName: name });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '6px 10px',
              borderRadius: '5px',
              background: 'none',
              border: 'none',
              color: 'var(--color-text)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <FileText size={13} />
            <span>{t('serverDetail.rename')}</span>
          </button>

          {/* Duplicate / Copy */}
          <button
            onClick={() => {
              const name = contextMenu.file!.name;
              setContextMenu({ isOpen: false, x: 0, y: 0, file: null });
              handleCopyFile(name);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '6px 10px',
              borderRadius: '5px',
              background: 'none',
              border: 'none',
              color: 'var(--color-text)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Copy size={13} />
            <span>{t('serverDetail.duplicate')}</span>
          </button>

          {/* Permissions (chmod) */}
          <button
            onClick={() => {
              const file = contextMenu.file!;
              setContextMenu({ isOpen: false, x: 0, y: 0, file: null });
              setChmodModal({ isOpen: true, fileName: file.name, mode: file.mode || '0755' });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '6px 10px',
              borderRadius: '5px',
              background: 'none',
              border: 'none',
              color: 'var(--color-text)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Key size={13} />
            <span>{t('serverDetail.permissions')}</span>
          </button>

          {/* Compress */}
          <button
            onClick={() => {
              const name = contextMenu.file!.name;
              setContextMenu({ isOpen: false, x: 0, y: 0, file: null });
              handleCompress([name]);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '6px 10px',
              borderRadius: '5px',
              background: 'none',
              border: 'none',
              color: 'var(--color-text)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Archive size={13} />
            <span>{t('serverDetail.archive')}</span>
          </button>

          {/* Decompress (if archive) */}
          {/\.(tar\.gz|tgz|zip|tar|rar)$/i.test(contextMenu.file.name) && (
            <button
              onClick={() => {
                const name = contextMenu.file!.name;
                setContextMenu({ isOpen: false, x: 0, y: 0, file: null });
                handleDecompress(name);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '6px 10px',
                borderRadius: '5px',
                background: 'none',
                border: 'none',
                color: 'var(--color-text)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <FileArchive size={13} color="var(--color-warning)" />
              <span>{t('serverDetail.extract')}</span>
            </button>
          )}

          <div style={{ height: '1px', backgroundColor: 'var(--color-border-subtle)', margin: '3px 0' }} />

          {/* Delete */}
          <button
            onClick={() => {
              const name = contextMenu.file!.name;
              setContextMenu({ isOpen: false, x: 0, y: 0, file: null });
              setFileToDelete(name);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '6px 10px',
              borderRadius: '5px',
              background: 'none',
              border: 'none',
              color: 'var(--color-error)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Trash2 size={13} color="var(--color-error)" />
            <span>{t('common.delete')}</span>
          </button>
        </div>,
        document.body
      )}

      {/* Confirmation Dialog for Allocation Unassign */}
      <ConfirmDialog
        isOpen={unassignDialog.isOpen}
        title={t('serverDetail.deleteAllocationTitle')}
        message={t('serverDetail.deleteAllocationMessage', { address: unassignDialog.ipPort })}
        confirmLabel={t('serverDetail.unassign')}
        isDestructive={true}
        isLoading={unassigning}
        onConfirm={handleUnassignAllocation}
        onCancel={() => setUnassignDialog({ isOpen: false, allocId: null, ipPort: '' })}
      />

      {/* Confirmation Dialog for File Deletion */}
      <ConfirmDialog
        isOpen={fileToDelete !== null}
        title={t('serverDetail.deleteFileTitle')}
        message={t('serverDetail.deleteFileMessage', { name: fileToDelete || '' })}
        confirmLabel={t('common.delete')}
        isDestructive={true}
        isLoading={deleteLoading}
        onConfirm={handleDeleteFile}
        onCancel={() => setFileToDelete(null)}
      />
    </div>
  );
};
