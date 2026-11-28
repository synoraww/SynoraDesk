import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Editor, { loader } from '@monaco-editor/react';
// @ts-ignore
import * as monaco from 'monaco-editor';
import {
  FolderTree,
  Folder,
  FolderOpen,
  FileCode2,
  FileText,
  Terminal,
  RefreshCw,
  Save,
  X,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Search,
  Send,
  FilePlus,
  FolderPlus,
  PanelLeftClose,
  PanelLeft,
  Columns2,
  Rows2,
  Lock,
  Unlock,
  ChevronUp,
  Trash2,
  Copy,
  Scissors,
  ClipboardPaste,
  Edit2,
  Download,
  DownloadCloud,
  Upload,
  Link,
  Check,
} from 'lucide-react';
import { detectLanguage } from './PteroMonacoEditor';
import { ColorizedLine, getLogLineEntries } from './ConsoleViewer';
import { ConfirmDialog } from './ConfirmDialog';
import { useUIStore } from '../../stores/uiStore';
import { Server } from '../../stores/serverStore';
import { useI18n } from '../../i18n';
import {
  useFileClipboard,
  setFileClipboard,
  clearFileClipboard,
  getFileClipboard,
} from '../../utils/fileClipboard';

loader.config({ monaco });

export interface ServerIDEProps {
  serverIdentifier: string;
  serverName: string;
  server: Server | null;
  consoleLines: string[];
  onSendCommand: (cmd: string) => Promise<void>;
  onClearConsole?: () => void;
  currentState: string;
}

interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  children?: FileNode[];
  isExpanded?: boolean;
}

interface IDETab {
  path: string;
  name: string;
  content: string;
  initialContent: string;
  isDirty: boolean;
  isSaving: boolean;
  language: string;
}

interface SavedIDEState {
  tabs: Array<{ path: string; name: string; language: string }>;
  activeTabPath: string | null;
  expandedPaths: string[];
  selectedPath?: string | null;
  sidebarWidth: number;
  terminalSize: number;
  terminalOrientation: 'bottom' | 'right';
  terminalOpen: boolean;
  isLayoutLocked: boolean;
}

export const ServerIDE: React.FC<ServerIDEProps> = ({
  serverIdentifier,
  serverName,
  server,
  consoleLines,
  onSendCommand,
  onClearConsole,
  currentState,
}) => {
  const { addNotification } = useUIStore();
  const { t } = useI18n();
  const clipboard = useFileClipboard();
  const storageKey = `pterodesk_ide_v2_${serverIdentifier}`;

  // Load initial persisted configuration
  const savedState: SavedIDEState | null = (() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  // Layout & Splitter State
  const [sidebarWidth, setSidebarWidth] = useState<number>(savedState?.sidebarWidth || 250);
  const [terminalSize, setTerminalSize] = useState<number>(savedState?.terminalSize || 240);
  const [terminalOrientation, setTerminalOrientation] = useState<'bottom' | 'right'>(
    savedState?.terminalOrientation || 'bottom'
  );
  const [terminalOpen, setTerminalOpen] = useState<boolean>(
    savedState?.terminalOpen !== undefined ? savedState.terminalOpen : true
  );
  const [isLayoutLocked, setIsLayoutLocked] = useState<boolean>(savedState?.isLayoutLocked || false);

  // File tree state
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<string[]>(savedState?.expandedPaths || []);
  const [selectedPath, setSelectedPath] = useState<string | null>(savedState?.selectedPath || null);
  const [loadingRoot, setLoadingRoot] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    node: FileNode | null;
    parentDir: string;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    node: null,
    parentDir: '',
  });

  // Modals & Action States
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean;
    path: string;
    oldName: string;
    newName: string;
    parentDir: string;
  }>({
    isOpen: false,
    path: '',
    oldName: '',
    newName: '',
    parentDir: '',
  });

  const [pullModal, setPullModal] = useState<{
    isOpen: boolean;
    targetDir: string;
    url: string;
    filename: string;
  }>({
    isOpen: false,
    targetDir: '',
    url: '',
    filename: '',
  });

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    path: string;
    name: string;
    isDir: boolean;
  }>({
    isOpen: false,
    path: '',
    name: '',
    isDir: false,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetDir, setUploadTargetDir] = useState<string>('');

  // Close context menu on global click or context menu outside
  useEffect(() => {
    const handleCloseMenu = () => {
      if (contextMenu.isOpen) {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('click', handleCloseMenu);
    return () => {
      window.removeEventListener('click', handleCloseMenu);
    };
  }, [contextMenu.isOpen]);

  // Editor Tabs state
  const [tabs, setTabs] = useState<IDETab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(savedState?.activeTabPath || null);

  // Terminal state
  const [terminalCommand, setTerminalCommand] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`pterodesk_cmd_history_${serverIdentifier}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [draftCmd, setDraftCmd] = useState('');
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Inline create form
  const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(null);
  const [creatingTargetDir, setCreatingTargetDir] = useState<string>('');
  const [newEntryName, setNewEntryName] = useState('');

  // Dragging splitters state
  const isDraggingSidebar = useRef(false);
  const isDraggingTerminal = useRef(false);

  // Active tab getter
  const activeTab = tabs.find((t) => t.path === activeTabPath);

  // Persist IDE layout, tabs, expanded folders, and selected file
  useEffect(() => {
    try {
      const stateToSave: SavedIDEState = {
        tabs: tabs.map((t) => ({ path: t.path, name: t.name, language: t.language })),
        activeTabPath,
        expandedPaths,
        selectedPath,
        sidebarWidth,
        terminalSize,
        terminalOrientation,
        terminalOpen,
        isLayoutLocked,
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch {}
  }, [
    storageKey,
    tabs,
    activeTabPath,
    expandedPaths,
    selectedPath,
    sidebarWidth,
    terminalSize,
    terminalOrientation,
    terminalOpen,
    isLayoutLocked,
  ]);

  // Load directory helper
  const fetchDirectory = useCallback(
    async (dirPath: string): Promise<FileNode[]> => {
      try {
        // @ts-ignore
        const files: any[] = await window.go.main.App.ListFiles(serverIdentifier, dirPath);
        const nodes: FileNode[] = (files || []).map((f) => {
          const itemPath = dirPath ? `${dirPath}/${f.name}` : f.name;
          return {
            name: f.name,
            path: itemPath,
            isDir: f.is_file === false || f.isDir === true || f.mode?.startsWith('d'),
            size: f.size || 0,
            isExpanded: expandedPaths.includes(itemPath),
          };
        });
        nodes.sort((a, b) => {
          if (a.isDir === b.isDir) return a.name.localeCompare(b.name);
          return a.isDir ? -1 : 1;
        });
        return nodes;
      } catch (err: any) {
        return [];
      }
    },
    [serverIdentifier, expandedPaths]
  );

  // Load root files and auto-expand remembered folders
  const loadRootFiles = useCallback(async () => {
    setLoadingRoot(true);
    try {
      const rootNodes = await fetchDirectory('');

      // Auto-load children for expanded directories
      const expandNodes = async (nodes: FileNode[]): Promise<FileNode[]> => {
        const result: FileNode[] = [];
        for (const node of nodes) {
          if (node.isDir && expandedPaths.includes(node.path)) {
            const children = await fetchDirectory(node.path);
            const nested = await expandNodes(children);
            result.push({ ...node, isExpanded: true, children: nested });
          } else {
            result.push(node);
          }
        }
        return result;
      };

      const finalTree = await expandNodes(rootNodes);
      setFileTree(finalTree);
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('serverIDE.loadRootErrorTitle'),
        message: err.message || t('serverIDE.loadRootErrorMessage'),
      });
    } finally {
      setLoadingRoot(false);
    }
  }, [fetchDirectory, expandedPaths, addNotification, t]);

  useEffect(() => {
    loadRootFiles();
  }, [serverIdentifier]);

  // Restore saved open tabs content on mount
  useEffect(() => {
    if (savedState?.tabs && savedState.tabs.length > 0 && tabs.length === 0) {
      const restoreSavedTabs = async () => {
        const loaded: IDETab[] = [];
        for (const item of savedState.tabs) {
          try {
            // @ts-ignore
            const content = await window.go.main.App.GetFileContents(serverIdentifier, item.path);
            loaded.push({
              path: item.path,
              name: item.name,
              content: content || '',
              initialContent: content || '',
              isDirty: false,
              isSaving: false,
              language: item.language || detectLanguage(item.name),
            });
          } catch {
            // If file was deleted or unreadable, skip
          }
        }
        if (loaded.length > 0) {
          setTabs(loaded);
          const hasSavedActive = loaded.some((t) => t.path === savedState.activeTabPath);
          setActiveTabPath(hasSavedActive ? savedState.activeTabPath : loaded[0].path);
        }
      };
      restoreSavedTabs();
    }
  }, [serverIdentifier]);

  // Toggle folder expansion
  const toggleNodeExpansion = async (node: FileNode) => {
    if (!node.isDir) return;

    const nextExpanded = !node.isExpanded;
    let nextExpandedPaths = [...expandedPaths];
    if (nextExpanded) {
      if (!nextExpandedPaths.includes(node.path)) nextExpandedPaths.push(node.path);
    } else {
      nextExpandedPaths = nextExpandedPaths.filter((p) => p !== node.path && !p.startsWith(`${node.path}/`));
    }
    setExpandedPaths(nextExpandedPaths);

    const updateRecursive = async (nodes: FileNode[]): Promise<FileNode[]> => {
      const updated: FileNode[] = [];
      for (const item of nodes) {
        if (item.path === node.path) {
          let children = item.children;
          if (nextExpanded && !children) {
            children = await fetchDirectory(item.path);
          }
          updated.push({
            ...item,
            isExpanded: nextExpanded,
            children,
          });
        } else if (item.children) {
          const updatedChildren = await updateRecursive(item.children);
          updated.push({ ...item, children: updatedChildren });
        } else {
          updated.push(item);
        }
      }
      return updated;
    };

    const newTree = await updateRecursive(fileTree);
    setFileTree(newTree);
  };

  // Open file in editor tab
  const handleOpenFile = async (filePath: string, fileName: string) => {
    const existing = tabs.find((t) => t.path === filePath);
    if (existing) {
      setActiveTabPath(filePath);
      return;
    }

    try {
      const newTab: IDETab = {
        path: filePath,
        name: fileName,
        content: '',
        initialContent: '',
        isDirty: false,
        isSaving: false,
        language: detectLanguage(fileName),
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabPath(filePath);

      // @ts-ignore
      const content = await window.go.main.App.GetFileContents(serverIdentifier, filePath);

      setTabs((prev) =>
        prev.map((t) =>
          t.path === filePath ? { ...t, content: content || '', initialContent: content || '' } : t
        )
      );
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('serverIDE.readFileErrorTitle'),
        message: err.message || t('serverIDE.readFileErrorMessage', { file: fileName }),
      });
      setTabs((prev) => prev.filter((t) => t.path !== filePath));
    }
  };

  // Close tab
  const handleCloseTab = (filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const tabToClose = tabs.find((t) => t.path === filePath);
    if (tabToClose?.isDirty) {
      if (!window.confirm(t('serverIDE.closeUnsavedConfirm', { file: tabToClose.name }))) {
        return;
      }
    }

    const nextTabs = tabs.filter((t) => t.path !== filePath);
    setTabs(nextTabs);

    if (activeTabPath === filePath) {
      if (nextTabs.length > 0) {
        setActiveTabPath(nextTabs[nextTabs.length - 1].path);
      } else {
        setActiveTabPath(null);
      }
    }
  };

  // Editor typing change
  const handleEditorChange = (newVal: string | undefined) => {
    if (!activeTabPath || newVal === undefined) return;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.path === activeTabPath) {
          return {
            ...t,
            content: newVal,
            isDirty: newVal !== t.initialContent,
          };
        }
        return t;
      })
    );
  };

  // Save active tab
  const handleSaveActiveTab = async () => {
    if (!activeTab || activeTab.isSaving) return;

    setTabs((prev) =>
      prev.map((t) => (t.path === activeTab.path ? { ...t, isSaving: true } : t))
    );

    try {
      // @ts-ignore
      await window.go.main.App.WriteFile(serverIdentifier, activeTab.path, activeTab.content);
      setTabs((prev) =>
        prev.map((t) =>
          t.path === activeTab.path
            ? { ...t, initialContent: t.content, isDirty: false, isSaving: false }
            : t
        )
      );
      addNotification({
        type: 'success',
        title: t('serverIDE.fileSavedTitle'),
        message: t('serverIDE.fileSavedMessage', { file: activeTab.name }),
        duration: 2000,
      });
    } catch (err: any) {
      setTabs((prev) =>
        prev.map((t) => (t.path === activeTab.path ? { ...t, isSaving: false } : t))
      );
      addNotification({
        type: 'error',
        title: t('serverIDE.saveFileErrorTitle'),
        message: err.message || t('serverIDE.saveFileErrorMessage'),
      });
    }
  };

  // Revert active tab
  const handleRevertActiveTab = () => {
    if (!activeTab || !activeTab.isDirty) return;
    if (window.confirm(t('serverIDE.revertConfirm', { file: activeTab.name }))) {
      setTabs((prev) =>
        prev.map((t) =>
          t.path === activeTab.path ? { ...t, content: t.initialContent, isDirty: false } : t
        )
      );
    }
  };

  // Shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveActiveTab();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  // Terminal scroll to bottom
  useEffect(() => {
    if (terminalOpen) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [consoleLines, terminalOpen]);

  // Send terminal command
  const handleSendTerminalCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = terminalCommand.trim();
    if (!cmd) return;

    setTerminalCommand('');
    setHistoryIdx(-1);
    setDraftCmd('');

    setCmdHistory((prev) => {
      const updated = [...prev.filter((c) => c !== cmd), cmd].slice(-50);
      try {
        localStorage.setItem(`pterodesk_cmd_history_${serverIdentifier}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    await onSendCommand(cmd);
  };

  // Terminal arrow up/down
  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      if (historyIdx === -1) {
        setDraftCmd(terminalCommand);
        const newIdx = cmdHistory.length - 1;
        setHistoryIdx(newIdx);
        setTerminalCommand(cmdHistory[newIdx]);
      } else if (historyIdx > 0) {
        const newIdx = historyIdx - 1;
        setHistoryIdx(newIdx);
        setTerminalCommand(cmdHistory[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx !== -1) {
        if (historyIdx < cmdHistory.length - 1) {
          const newIdx = historyIdx + 1;
          setHistoryIdx(newIdx);
          setTerminalCommand(cmdHistory[newIdx]);
        } else {
          setHistoryIdx(-1);
          setTerminalCommand(draftCmd);
        }
      }
    }
  };

  // Inline create file/folder
  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newEntryName.trim();
    if (!name) return;

    try {
      const targetPath = creatingTargetDir ? `${creatingTargetDir}/${name}` : name;
      if (creatingType === 'file') {
        // @ts-ignore
        await window.go.main.App.WriteFile(serverIdentifier, targetPath, '');
        addNotification({
          type: 'success',
          title: t('serverIDE.fileCreatedTitle'),
          message: t('serverIDE.fileCreatedMessage', { name }),
        });
        handleOpenFile(targetPath, name);
      } else {
        // @ts-ignore
        await window.go.main.App.CreateFile(serverIdentifier, creatingTargetDir, name);
        addNotification({
          type: 'success',
          title: t('serverIDE.directoryCreatedTitle'),
          message: t('serverIDE.directoryCreatedMessage', { name }),
        });
      }
      setCreatingType(null);
      setNewEntryName('');
      loadRootFiles();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('serverIDE.createFailedTitle'),
        message: err.message || t('serverIDE.createFailedMessage'),
      });
    }
  };

  const getParentDir = (filePath: string): string => {
    const parts = filePath.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length <= 1) return '';
    parts.pop();
    return parts.join('/');
  };

  const handleNodeContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPath(node.path);
    const parent = node.isDir ? node.path : getParentDir(node.path);
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 340);
    setContextMenu({
      isOpen: true,
      x,
      y,
      node,
      parentDir: parent,
    });
  };

  const handleTreeContainerContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 300);
    setContextMenu({
      isOpen: true,
      x,
      y,
      node: null,
      parentDir: '',
    });
  };

  const handleDownloadFile = async (filePath: string, fileName: string) => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app?.DownloadServerFileWithDialog) {
        const savedPath = await app.DownloadServerFileWithDialog(serverIdentifier, filePath, fileName);
        if (savedPath) {
          addNotification({
            type: 'success',
            title: t('serverIDE.downloadSuccess'),
            message: savedPath,
          });
        }
      } else if (app?.GetFileDownloadURL) {
        const url = await app.GetFileDownloadURL(serverIdentifier, filePath);
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            throw new Error('Invalid download URL scheme');
          }
        } catch {
          throw new Error('Invalid download URL');
        }
        window.open(url, '_blank', 'noopener,noreferrer');
        addNotification({
          type: 'success',
          title: t('serverIDE.downloadSuccess'),
          message: fileName,
        });
      }
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('serverIDE.downloadFailed'),
        message: err.message,
      });
    }
  };

  const handlePaste = async (targetDir: string) => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
    const cb = getFileClipboard();
    if (!cb) return;

    // @ts-ignore
    const app = window.go?.main?.App;
    if (!app) return;

    try {
      const targetPath = targetDir ? `${targetDir}/${cb.name}` : cb.name;
      if (cb.action === 'cut') {
        if (targetPath === cb.path) return;
        await app.RenameFile(serverIdentifier, '/', cb.path, targetPath);
        clearFileClipboard();
        addNotification({
          type: 'success',
          title: t('serverIDE.paste'),
          message: t('serverIDE.pasteSuccess', { name: cb.name }),
        });
      } else {
        if (targetDir === cb.sourceDir || targetPath === cb.path) {
          await app.CopyFile(serverIdentifier, cb.path.startsWith('/') ? cb.path : `/${cb.path}`);
        } else {
          const content = await app.GetFileContents(serverIdentifier, cb.path);
          await app.WriteFile(serverIdentifier, targetPath, content || '');
        }
        addNotification({
          type: 'success',
          title: t('serverIDE.copy'),
          message: t('serverIDE.pasteSuccess', { name: cb.name }),
        });
      }
      loadRootFiles();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('serverIDE.pasteFailed'),
        message: err.message,
      });
    }
  };

  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    // @ts-ignore
    const app = window.go?.main?.App;
    if (!app) return;
    const { parentDir, oldName, newName } = renameModal;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;

    try {
      const oldRel = parentDir ? `${parentDir}/${oldName}` : oldName;
      const newRel = parentDir ? `${parentDir}/${trimmed}` : trimmed;
      await app.RenameFile(serverIdentifier, '/', oldRel, newRel);
      addNotification({
        type: 'success',
        title: t('serverIDE.renameSuccess'),
        message: t('serverDetail.renamedMessage', { name: trimmed }),
      });
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.path === oldRel) {
            return { ...tab, path: newRel, name: trimmed, language: detectLanguage(trimmed) };
          }
          return tab;
        })
      );
      if (activeTabPath === oldRel) {
        setActiveTabPath(newRel);
      }
      setRenameModal((prev) => ({ ...prev, isOpen: false }));
      loadRootFiles();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('serverIDE.renameFailed'),
        message: err.message,
      });
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      const parent = getParentDir(deleteDialog.path);
      await app.DeleteFiles(serverIdentifier, parent ? `/${parent}` : '/', [deleteDialog.name]);
      addNotification({
        type: 'success',
        title: t('serverDetail.deleted'),
        message: t('serverDetail.deletedMessage', { name: deleteDialog.name }),
      });
      setTabs((prev) => prev.filter((t) => t.path !== deleteDialog.path));
      if (activeTabPath === deleteDialog.path) {
        setActiveTabPath(null);
      }
      setDeleteDialog((prev) => ({ ...prev, isOpen: false }));
      loadRootFiles();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('serverDetail.deleteFailed'),
        message: err.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmPull = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pullModal.url.trim()) return;
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      await app.PullRemoteFile(
        serverIdentifier,
        pullModal.targetDir ? `/${pullModal.targetDir}` : '/',
        pullModal.url.trim(),
        pullModal.filename.trim()
      );
      addNotification({
        type: 'success',
        title: t('serverDetail.pullStarted'),
        message: t('serverDetail.pullMessage', { url: pullModal.url }),
      });
      setPullModal((prev) => ({ ...prev, isOpen: false, url: '', filename: '' }));
      loadRootFiles();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('serverDetail.pullFailed'),
        message: err.message,
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    // @ts-ignore
    const app = window.go?.main?.App;
    if (!app) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = async () => {
        const res = reader.result as string;
        const base64 = res.split(',')[1] || res;
        try {
          await app.UploadServerFileDirect(serverIdentifier, uploadTargetDir ? `/${uploadTargetDir}` : '/', file.name, base64);
          addNotification({
            type: 'success',
            title: t('serverDetail.uploadFinished'),
            message: t('serverDetail.uploadMessage', { name: file.name }),
          });
          loadRootFiles();
        } catch (err: any) {
          addNotification({
            type: 'error',
            title: t('serverDetail.uploadFailed'),
            message: err.message,
          });
        }
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Dragging Resizer Logic
  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    if (isLayoutLocked) return;
    e.preventDefault();
    isDraggingSidebar.current = true;

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      const newWidth = Math.max(180, Math.min(500, moveEvt.clientX));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      isDraggingSidebar.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleTerminalMouseDown = (e: React.MouseEvent) => {
    if (isLayoutLocked) return;
    e.preventDefault();
    isDraggingTerminal.current = true;
    const startY = e.clientY;
    const startX = e.clientX;
    const startSize = terminalSize;

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (!isDraggingTerminal.current) return;
      if (terminalOrientation === 'bottom') {
        const delta = startY - moveEvt.clientY;
        const newSize = Math.max(120, Math.min(650, startSize + delta));
        setTerminalSize(newSize);
      } else {
        const delta = startX - moveEvt.clientX;
        const newSize = Math.max(220, Math.min(800, startSize + delta));
        setTerminalSize(newSize);
      }
    };

    const onMouseUp = () => {
      isDraggingTerminal.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Render tree item
  const renderTreeItem = (node: FileNode, depth = 0) => {
    if (searchFilter && !node.name.toLowerCase().includes(searchFilter.toLowerCase())) {
      return null;
    }
    const isSelected = selectedPath === node.path || activeTabPath === node.path;

    return (
      <div key={node.path}>
        <div
          onClick={() => {
            setSelectedPath(node.path);
            if (node.isDir) {
              toggleNodeExpansion(node);
            } else {
              handleOpenFile(node.path, node.name);
            }
          }}
          onContextMenu={(e) => handleNodeContextMenu(e, node)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            paddingLeft: `${depth * 14 + 10}px`,
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: isSelected ? 'var(--color-primary-muted)' : 'transparent',
            color: isSelected ? 'var(--color-primary-light)' : 'var(--color-text)',
            fontSize: '12px',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => {
            if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
          }}
          onMouseLeave={(e) => {
            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {node.isDir ? (
            <>
              {node.isExpanded ? <ChevronDown size={13} color="var(--color-text-muted)" /> : <ChevronRight size={13} color="var(--color-text-muted)" />}
              {node.isExpanded ? <FolderOpen size={14} color="#FBBF24" /> : <Folder size={14} color="#F59E0B" />}
            </>
          ) : (
            <>
              <span style={{ width: '13px' }} />
              <FileCode2 size={14} color="var(--color-primary-light)" />
            </>
          )}

          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              fontFamily: node.isDir ? 'inherit' : 'var(--font-mono)',
            }}
            title={node.path}
          >
            {node.name}
          </span>
        </div>

        {node.isDir && node.isExpanded && node.children && (
          <div>{node.children.map((child) => renderTreeItem(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  // Helper to render terminal body with ANSI styling & lines
  const renderTerminalContent = () => {
    const isHorizontal = terminalOrientation === 'bottom';

    return (
      <>
        {/* Terminal Header */}
        <div
          style={{
            height: '30px',
            padding: '0 10px',
            backgroundColor: 'var(--color-surface)',
            borderBottom: terminalOpen ? '1px solid var(--color-border)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={13} color="var(--color-primary-light)" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.04em' }}>
              SERVER CONSOLE
            </span>
            <span
              style={{
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: '3px',
                fontWeight: 700,
                backgroundColor:
                  currentState === 'running'
                    ? 'rgba(34, 197, 94, 0.15)'
                    : currentState === 'stopping'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(148, 163, 184, 0.15)',
                color:
                  currentState === 'running'
                    ? 'var(--color-success)'
                    : currentState === 'stopping'
                    ? '#EF4444'
                    : 'var(--color-text-muted)',
              }}
            >
              {currentState.toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Split layout toggle button (Bottom <-> Right) */}
            <button
              onClick={() => setTerminalOrientation(isHorizontal ? 'right' : 'bottom')}
              title={t(isHorizontal ? 'serverIDE.splitTerminalVertical' : 'serverIDE.splitTerminalBottom')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '22px',
                borderRadius: '3px',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              {isHorizontal ? <Columns2 size={12} /> : <Rows2 size={12} />}
            </button>

            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
              {t('serverIDE.linesCount', { count: consoleLines.length })}
            </span>

            {/* Clear Log button */}
            {onClearConsole && (
              <button
                onClick={onClearConsole}
                title={t('serverIDE.clearLog')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
              >
                <Trash2 size={11} />
              </button>
            )}

            <button
              onClick={() => setTerminalOpen(!terminalOpen)}
              title={t(terminalOpen ? 'serverIDE.collapse' : 'serverIDE.expand')}
              style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {terminalOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>

        {/* Terminal Body */}
        {terminalOpen && (
          <div
            style={{
              height: isHorizontal ? `${terminalSize}px` : 'calc(100% - 30px)',
              flex: isHorizontal ? undefined : 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#070A11',
              minHeight: 0,
            }}
          >
            {/* Colorized ANSI Logs (No line numbers) */}
            <div
              className="custom-scrollbar"
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                width: '100%',
                maxWidth: '100%',
                padding: '8px 12px',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '12px',
                lineHeight: '1.4',
                color: '#E2E8F0',
                userSelect: 'text',
                wordBreak: 'break-word',
              }}
            >
              {getLogLineEntries(consoleLines).map(({ line, key }) => (
                <div
                  key={key}
                  style={{
                    minHeight: '18px',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                    whiteSpace: 'pre-wrap',
                    padding: '1px 0',
                    width: '100%',
                    maxWidth: '100%',
                  }}
                >
                  <ColorizedLine line={line} />
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSendTerminalCommand}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: '#0B0F1A',
                flexShrink: 0,
              }}
            >
              <span style={{ color: 'var(--color-primary-light)', fontWeight: 700, fontSize: '13px' }}>
                &gt;
              </span>
              <input
                type="text"
                value={terminalCommand}
                onChange={(e) => setTerminalCommand(e.target.value)}
                onKeyDown={handleTerminalKeyDown}
                placeholder={t('serverIDE.consolePlaceholder')}
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={!terminalCommand.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  backgroundColor: terminalCommand.trim() ? 'var(--color-primary)' : 'transparent',
                  border: '1px solid var(--color-border)',
                  color: terminalCommand.trim() ? '#fff' : 'var(--color-text-muted)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: terminalCommand.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                <Send size={10} /> {t('serverIDE.send')}
              </button>
            </form>
          </div>
        )}
      </>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--color-bg)',
        overflow: 'hidden',
      }}
    >
      {/* Top Workspace Main Row */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left Panel: File Explorer */}
        {sidebarOpen ? (
          <div
            style={{
              width: `${sidebarWidth}px`,
              backgroundColor: 'var(--color-surface)',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              borderRight: '1px solid var(--color-border)',
            }}
          >
            {/* Toolbar */}
            <div
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FolderTree size={15} color="var(--color-primary-light)" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.04em' }}>
                  EXPLORER
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => {
                    setCreatingType('file');
                    setCreatingTargetDir('');
                    setNewEntryName('');
                  }}
                  title={t('serverIDE.newFile')}
                  style={{ padding: '3px', borderRadius: '3px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                >
                  <FilePlus size={13} />
                </button>
                <button
                  onClick={() => {
                    setCreatingType('folder');
                    setCreatingTargetDir('');
                    setNewEntryName('');
                  }}
                  title={t('serverIDE.newFolder')}
                  style={{ padding: '3px', borderRadius: '3px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                >
                  <FolderPlus size={13} />
                </button>
                <button
                  onClick={loadRootFiles}
                  disabled={loadingRoot}
                  title={t('serverIDE.refreshTree')}
                  style={{ padding: '3px', borderRadius: '3px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                >
                  <RefreshCw size={12} className={loadingRoot ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  title={t('serverIDE.collapseTree')}
                  style={{ padding: '3px', borderRadius: '3px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                >
                  <PanelLeftClose size={13} />
                </button>
              </div>
            </div>

            {/* Search */}
            <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--color-bg)',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  padding: '3px 8px',
                }}
              >
                <Search size={11} color="var(--color-text-muted)" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder={t('serverIDE.filterFiles')}
                  style={{ border: 'none', background: 'transparent', color: 'var(--color-text)', fontSize: '11px', width: '100%', outline: 'none' }}
                />
              </div>
            </div>

            {/* Inline creation */}
            {creatingType && (
              <form
                onSubmit={handleCreateEntry}
                style={{
                  padding: '8px 10px',
                  backgroundColor: 'var(--color-surface-hover)',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-primary-light)' }}>
                  {creatingType === 'file' ? t('serverIDE.newFilePrompt') : t('serverIDE.newFolderPrompt')}
                </div>
                <input
                  type="text"
                  autoFocus
                  value={newEntryName}
                  onChange={(e) => setNewEntryName(e.target.value)}
                  placeholder={creatingType === 'file' ? 'server.properties' : 'plugins'}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    color: 'var(--color-text)',
                    fontSize: '11px',
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setCreatingType(null)}
                    style={{ padding: '2px 6px', fontSize: '10px', backgroundColor: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: '3px', cursor: 'pointer' }}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--color-primary)', border: 'none', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {t('common.create')}
                  </button>
                </div>
              </form>
            )}

            {/* Tree nodes */}
            <div
              className="custom-scrollbar"
              onContextMenu={handleTreeContainerContextMenu}
              style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}
            >
              {loadingRoot ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  <RefreshCw size={16} className="animate-spin" style={{ margin: '0 auto 6px' }} />
                  {t('serverIDE.loadingFiles')}
                </div>
              ) : fileTree.length === 0 ? (
                <div
                  onContextMenu={handleTreeContainerContextMenu}
                  style={{ padding: '24px 12px', textAlign: 'center', fontSize: '11px', color: 'var(--color-text-muted)', cursor: 'default' }}
                >
                  <FolderTree size={28} color="var(--color-text-muted)" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <div>{t('serverIDE.emptyDirectory')}</div>
                  <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.7 }}>
                    {t('serverIDE.emptyAreaTip')}
                  </div>
                </div>
              ) : (
                fileTree.map((node) => renderTreeItem(node, 0))
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setSidebarOpen(true)}
            title={t('serverIDE.openFileTree')}
            style={{
              width: '32px',
              backgroundColor: 'var(--color-surface)',
              borderRight: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              borderTop: 'none',
              borderBottom: 'none',
              borderLeft: 'none',
            }}
          >
            <PanelLeft size={15} />
          </button>
        )}

        {/* Resizer Divider between Explorer & Editor */}
        {sidebarOpen && (
          <div
            onMouseDown={handleSidebarMouseDown}
            style={{
              width: '4px',
              cursor: isLayoutLocked ? 'default' : 'col-resize',
              backgroundColor: 'transparent',
              transition: 'background-color 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!isLayoutLocked) e.currentTarget.style.backgroundColor = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title={t(isLayoutLocked ? 'serverIDE.layoutLocked' : 'serverIDE.resizeExplorer')}
          />
        )}

        {/* Center / Middle Area: Editor + (Optional Vertical Terminal Split) */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: terminalOrientation === 'right' && terminalOpen ? 'row' : 'column',
            overflow: 'hidden',
          }}
        >
          {/* Code Editor Column */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg)' }}>
            {/* Editor Tabs Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)',
                overflowX: 'auto',
                flexShrink: 0,
              }}
            >
              {tabs.map((tab) => {
                const isActive = tab.path === activeTabPath;
                return (
                  <div
                    key={tab.path}
                    onClick={() => setActiveTabPath(tab.path)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 12px',
                      fontSize: '12px',
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      backgroundColor: isActive ? 'var(--color-bg)' : 'transparent',
                      borderRight: '1px solid var(--color-border-subtle)',
                      borderTop: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
                      color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)',
                      userSelect: 'none',
                    }}
                  >
                    <FileCode2 size={13} color={isActive ? 'var(--color-primary-light)' : 'var(--color-text-muted)'} />
                    <span>{tab.name}</span>
                    {tab.isDirty && (
                      <span
                        style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EAB308' }}
                        title={t('serverIDE.unsavedChanges')}
                      />
                    )}
                    <button
                      onClick={(e) => handleCloseTab(tab.path, e)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2px',
                        borderRadius: '3px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}

              {tabs.length === 0 && (
                <div style={{ padding: '7px 16px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {t('serverIDE.noFileSelected')}
                </div>
              )}

              {/* Editor Right Toolbar: Revert, Save, Lock Layout */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '10px' }}>
                {activeTab?.isDirty && (
                  <button
                    onClick={handleRevertActiveTab}
                    title={t('serverIDE.discardChanges')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--color-border)',
                      borderRadius: '4px',
                      color: 'var(--color-text-secondary)',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={11} /> {t('common.cancel')}
                  </button>
                )}

                {activeTab && (
                  <button
                    onClick={handleSaveActiveTab}
                    disabled={activeTab.isSaving || !activeTab.isDirty}
                    title={t('serverIDE.saveShortcut')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 10px',
                      backgroundColor: activeTab.isDirty ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                      border: 'none',
                      borderRadius: '4px',
                      color: activeTab.isDirty ? '#FFFFFF' : 'var(--color-text-muted)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: activeTab.isDirty ? 'pointer' : 'default',
                    }}
                  >
                    <Save size={11} /> {activeTab.isSaving ? t('common.saving') : t('common.save')}
                  </button>
                )}

                {/* Lock Layout Button */}
                <button
                  onClick={() => setIsLayoutLocked(!isLayoutLocked)}
                  title={t(isLayoutLocked ? 'serverIDE.unlockLayout' : 'serverIDE.lockLayout')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 6px',
                    backgroundColor: isLayoutLocked ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    color: isLayoutLocked ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  {isLayoutLocked ? <Lock size={12} /> : <Unlock size={12} />}
                  <span>{isLayoutLocked ? t('serverIDE.locked') : t('serverIDE.lock')}</span>
                </button>
              </div>
            </div>

            {/* Monaco Editor Container */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              {activeTab ? (
                <Editor
                  height="100%"
                  language={activeTab.language}
                  value={activeTab.content}
                  theme="vs-dark"
                  onChange={handleEditorChange}
                  options={{
                    fontSize: 13,
                    fontFamily: 'var(--font-mono, "JetBrains Mono", Consolas, monospace)',
                    minimap: { enabled: true },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true,
                    tabSize: 2,
                    renderWhitespace: 'selection',
                  }}
                />
              ) : (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <FolderTree size={44} strokeWidth={1.2} color="var(--color-border)" />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                    Server IDE
                  </div>
                  <div style={{ fontSize: '12px', maxWidth: '340px', textAlign: 'center' }}>
                    {t('serverIDE.containerHeader', { serverName })}
                  </div>
                </div>
              )}
            </div>

            {/* Editor Status Bar */}
            {activeTab && (
              <div
                style={{
                  height: '22px',
                  backgroundColor: 'var(--color-surface)',
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 12px',
                  fontSize: '11px',
                  color: 'var(--color-text-muted)',
                  fontFamily: 'var(--font-mono)',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>{activeTab.path}</span>
                  <span>•</span>
                  <span style={{ color: activeTab.isDirty ? '#EAB308' : '#10B981' }}>
                    {activeTab.isDirty ? t('serverIDE.unsavedWithShortcut') : t('serverIDE.synced')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span>UTF-8</span>
                  <span style={{ textTransform: 'uppercase' }}>{activeTab.language}</span>
                </div>
              </div>
            )}
          </div>

          {/* Vertical Terminal Divider if orientation === 'right' */}
          {terminalOrientation === 'right' && terminalOpen && (
            <div
              onMouseDown={handleTerminalMouseDown}
              style={{
                width: '4px',
                cursor: isLayoutLocked ? 'default' : 'col-resize',
                backgroundColor: 'transparent',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!isLayoutLocked) e.currentTarget.style.backgroundColor = 'var(--color-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title={t(isLayoutLocked ? 'serverIDE.layoutLocked' : 'serverIDE.resizeTerminalWidth')}
            />
          )}

          {/* Vertical Terminal Panel if orientation === 'right' */}
          {terminalOrientation === 'right' && terminalOpen && (
            <div
              style={{
                width: `${terminalSize}px`,
                borderLeft: '1px solid var(--color-border)',
                backgroundColor: '#090D16',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
              }}
            >
              {renderTerminalContent()}
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Terminal Divider if orientation === 'bottom' */}
      {terminalOrientation === 'bottom' && terminalOpen && (
        <div
          onMouseDown={handleTerminalMouseDown}
          style={{
            height: '4px',
            cursor: isLayoutLocked ? 'default' : 'row-resize',
            backgroundColor: 'transparent',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!isLayoutLocked) e.currentTarget.style.backgroundColor = 'var(--color-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title={t(isLayoutLocked ? 'serverIDE.layoutLocked' : 'serverIDE.resizeTerminalHeight')}
        />
      )}

      {/* Horizontal Terminal Panel if orientation === 'bottom' */}
      {terminalOrientation === 'bottom' && (
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            backgroundColor: '#090D16',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          {renderTerminalContent()}
        </div>
      )}

      {/* Hidden file upload input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        style={{ display: 'none' }}
      />

      {/* Rename Modal */}
      {renameModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setRenameModal((prev) => ({ ...prev, isOpen: false }))}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '20px',
              width: '380px',
              maxWidth: '90vw',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '12px' }}>
              {t('serverIDE.renameTitle')}
            </h3>
            <form onSubmit={handleConfirmRename}>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
                {t('serverIDE.renamePrompt', { name: renameModal.oldName })}
              </p>
              <input
                type="text"
                autoFocus
                value={renameModal.newName}
                onChange={(e) => setRenameModal((prev) => ({ ...prev, newName: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  outline: 'none',
                  marginBottom: '16px',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setRenameModal((prev) => ({ ...prev, isOpen: false }))}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {t('common.discard')}
                </button>
                <button
                  type="submit"
                  disabled={!renameModal.newName.trim() || renameModal.newName === renameModal.oldName}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '5px',
                    cursor:
                      !renameModal.newName.trim() || renameModal.newName === renameModal.oldName
                        ? 'not-allowed'
                        : 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {t('serverIDE.rename')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pull Remote Modal */}
      {pullModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setPullModal((prev) => ({ ...prev, isOpen: false }))}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '20px',
              width: '420px',
              maxWidth: '90vw',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>
              {t('serverIDE.pullRemoteTitle')}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
              {t('serverIDE.pullRemoteDesc', { dir: pullModal.targetDir || '/' })}
            </p>
            <form onSubmit={handleConfirmPull}>
              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  {t('serverIDE.pullRemoteUrl')}
                </label>
                <input
                  type="url"
                  autoFocus
                  required
                  placeholder={t('serverIDE.remoteFilePlaceholder')}
                  value={pullModal.url}
                  onChange={(e) => setPullModal((prev) => ({ ...prev, url: e.target.value }))}
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
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  {t('serverIDE.pullRemoteFilename')}
                </label>
                <input
                  type="text"
                  placeholder={t('serverIDE.pluginPlaceholder')}
                  value={pullModal.filename}
                  onChange={(e) => setPullModal((prev) => ({ ...prev, filename: e.target.value }))}
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
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPullModal((prev) => ({ ...prev, isOpen: false }))}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {t('common.discard')}
                </button>
                <button
                  type="submit"
                  disabled={!pullModal.url.trim()}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '5px',
                    cursor: !pullModal.url.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {t('serverDetail.startPull')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title={t('serverIDE.deleteConfirmTitle')}
        message={t('serverIDE.deleteConfirmMessage', { name: deleteDialog.name })}
        confirmLabel={t('serverIDE.delete')}
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Context Menu */}
      {contextMenu.isOpen &&
        createPortal(
          <div
            className="context-menu-dropdown"
            style={{
              position: 'fixed',
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '4px 8px 6px',
                borderBottom: '1px solid var(--color-border-subtle)',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {contextMenu.node ? contextMenu.node.name : contextMenu.parentDir || '/'}
            </div>

            {/* If clicked on a file */}
            {contextMenu.node && !contextMenu.node.isDir && (
              <>
                <button
                  className="context-menu-item"
                  onClick={() => {
                    const node = contextMenu.node!;
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    handleOpenFile(node.path, node.name);
                  }}
                >
                  <FileText size={13} color="#60A5FA" />
                  <span>{t('serverIDE.open')}</span>
                </button>

                <button
                  className="context-menu-item"
                  onClick={() => {
                    const node = contextMenu.node!;
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setFileClipboard({
                      action: 'copy',
                      serverIdentifier,
                      sourceDir: getParentDir(node.path),
                      path: node.path,
                      name: node.name,
                      isDir: false,
                    });
                    addNotification({
                      type: 'info',
                      title: t('serverIDE.copy'),
                      message: t('serverIDE.copiedClipboard'),
                    });
                  }}
                >
                  <Copy size={13} />
                  <span>{t('serverIDE.copy')}</span>
                  <span className="context-menu-shortcut">Ctrl+C</span>
                </button>

                <button
                  className="context-menu-item"
                  onClick={() => {
                    const node = contextMenu.node!;
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setFileClipboard({
                      action: 'cut',
                      serverIdentifier,
                      sourceDir: getParentDir(node.path),
                      path: node.path,
                      name: node.name,
                      isDir: false,
                    });
                    addNotification({
                      type: 'info',
                      title: t('serverIDE.cut'),
                      message: t('serverIDE.cutClipboard'),
                    });
                  }}
                >
                  <Scissors size={13} />
                  <span>{t('serverIDE.cut')}</span>
                  <span className="context-menu-shortcut">Ctrl+X</span>
                </button>

                <button
                  className="context-menu-item"
                  onClick={() => {
                    const node = contextMenu.node!;
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    navigator.clipboard.writeText(node.path);
                    addNotification({
                      type: 'success',
                      title: t('serverIDE.copyPath'),
                      message: t('serverIDE.pathCopied'),
                    });
                  }}
                >
                  <Link size={13} />
                  <span>{t('serverIDE.copyPath')}</span>
                </button>

                <button
                  className="context-menu-item"
                  onClick={() => {
                    const node = contextMenu.node!;
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setRenameModal({
                      isOpen: true,
                      path: node.path,
                      oldName: node.name,
                      newName: node.name,
                      parentDir: getParentDir(node.path),
                    });
                  }}
                >
                  <Edit2 size={13} />
                  <span>{t('serverIDE.rename')}</span>
                  <span className="context-menu-shortcut">F2</span>
                </button>

                <button
                  className="context-menu-item"
                  onClick={() => {
                    const node = contextMenu.node!;
                    handleDownloadFile(node.path, node.name);
                  }}
                >
                  <Download size={13} color="var(--color-success)" />
                  <span>{t('serverIDE.downloadDesktop')}</span>
                </button>

                <div className="context-menu-divider" />

                <button
                  className="context-menu-item danger"
                  onClick={() => {
                    const node = contextMenu.node!;
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setDeleteDialog({
                      isOpen: true,
                      path: node.path,
                      name: node.name,
                      isDir: false,
                    });
                  }}
                >
                  <Trash2 size={13} color="var(--color-error)" />
                  <span>{t('serverIDE.delete')}</span>
                </button>
              </>
            )}

            {/* If clicked on a directory */}
            {contextMenu.node && contextMenu.node.isDir && (
              <>
                <button
                  className="context-menu-item"
                  onClick={() => {
                    const node = contextMenu.node!;
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setCreatingType('file');
                    setCreatingTargetDir(node.path);
                    setNewEntryName('');
                  }}
                >
                  <FilePlus size={13} color="var(--color-primary-light)" />
                  <span>{t('serverIDE.newFileInFolder')}</span>
                </button>

                <button
                  className="context-menu-item"
                  onClick={() => {
                    const node = contextMenu.node!;
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setCreatingType('folder');
                    setCreatingTargetDir(node.path);
                    setNewEntryName('');
                  }}
                >
                  <FolderPlus size={13} color="#F59E0B" />
                  <span>{t('serverIDE.newFolderInFolder')}</span>
                </button>

                <button
                  className="context-menu-item"
                  disabled={!clipboard || clipboard.serverIdentifier !== serverIdentifier}
                  onClick={() => {
                    const node = contextMenu.node!;
                    handlePaste(node.path);
                  }}
                >
                  <ClipboardPaste size={13} />
                  <span>{t('serverIDE.paste')}</span>
                  <span className="context-menu-shortcut">Ctrl+V</span>
                </button>

                <button
                  className="context-menu-item"
                  onClick={() => {
                    const node = contextMenu.node!;
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setPullModal({
                      isOpen: true,
                      targetDir: node.path,
                      url: '',
                      filename: '',
                    });
                  }}
                >
                  <DownloadCloud size={13} color="#38BDF8" />
                  <span>{t('serverIDE.pullRemote')}</span>
                </button>

                <button
                  className="context-menu-item"
                  onClick={() => {
                    const node = contextMenu.node!;
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setUploadTargetDir(node.path);
                    fileInputRef.current?.click();
                  }}
                >
                  <Upload size={13} />
                  <span>{t('serverIDE.uploadFile')}</span>
                </button>

                <div className="context-menu-divider" />

                <button
                  className="context-menu-item"
                  onClick={() => {
                    const node = contextMenu.node!;
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    navigator.clipboard.writeText(node.path);
                    addNotification({
                      type: 'success',
                      title: t('serverIDE.copyPath'),
                      message: t('serverIDE.pathCopied'),
                    });
                  }}
                >
                  <Link size={13} />
                  <span>{t('serverIDE.copyPath')}</span>
                </button>

                <button
                  className="context-menu-item"
                  onClick={() => {
                    const node = contextMenu.node!;
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setRenameModal({
                      isOpen: true,
                      path: node.path,
                      oldName: node.name,
                      newName: node.name,
                      parentDir: getParentDir(node.path),
                    });
                  }}
                >
                  <Edit2 size={13} />
                  <span>{t('serverIDE.rename')}</span>
                </button>

                <div className="context-menu-divider" />

                <button
                  className="context-menu-item danger"
                  onClick={() => {
                    const node = contextMenu.node!;
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setDeleteDialog({
                      isOpen: true,
                      path: node.path,
                      name: node.name,
                      isDir: true,
                    });
                  }}
                >
                  <Trash2 size={13} color="var(--color-error)" />
                  <span>{t('serverIDE.delete')}</span>
                </button>
              </>
            )}

            {/* If right-clicked on empty area */}
            {!contextMenu.node && (
              <>
                <button
                  className="context-menu-item"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setCreatingType('file');
                    setCreatingTargetDir('');
                    setNewEntryName('');
                  }}
                >
                  <FilePlus size={13} color="var(--color-primary-light)" />
                  <span>{t('serverIDE.newFile')}</span>
                </button>

                <button
                  className="context-menu-item"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setCreatingType('folder');
                    setCreatingTargetDir('');
                    setNewEntryName('');
                  }}
                >
                  <FolderPlus size={13} color="#F59E0B" />
                  <span>{t('serverIDE.newFolder')}</span>
                </button>

                <button
                  className="context-menu-item"
                  disabled={!clipboard || clipboard.serverIdentifier !== serverIdentifier}
                  onClick={() => handlePaste('')}
                >
                  <ClipboardPaste size={13} />
                  <span>{t('serverIDE.paste')}</span>
                  <span className="context-menu-shortcut">Ctrl+V</span>
                </button>

                <button
                  className="context-menu-item"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setPullModal({
                      isOpen: true,
                      targetDir: '',
                      url: '',
                      filename: '',
                    });
                  }}
                >
                  <DownloadCloud size={13} color="#38BDF8" />
                  <span>{t('serverIDE.pullRemote')}</span>
                </button>

                <button
                  className="context-menu-item"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    setUploadTargetDir('');
                    fileInputRef.current?.click();
                  }}
                >
                  <Upload size={13} />
                  <span>{t('serverIDE.uploadFile')}</span>
                </button>

                <div className="context-menu-divider" />

                <button
                  className="context-menu-item"
                  onClick={() => {
                    setContextMenu((prev) => ({ ...prev, isOpen: false }));
                    loadRootFiles();
                  }}
                >
                  <RefreshCw size={13} />
                  <span>{t('serverIDE.refreshTree')}</span>
                </button>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
