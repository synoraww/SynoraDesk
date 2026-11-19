import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { loader } from '@monaco-editor/react';
// @ts-ignore
import * as monaco from 'monaco-editor';
import {
  FolderTree,
  Folder,
  FolderOpen,
  FileCode2,
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
} from 'lucide-react';
import { detectLanguage } from './PteroMonacoEditor';
import { ColorizedLine } from './ConsoleViewer';
import { useUIStore } from '../../stores/uiStore';
import { Server } from '../../stores/serverStore';
import { useI18n } from '../../i18n';

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
  const [loadingRoot, setLoadingRoot] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  // Persist IDE layout and tabs memory
  useEffect(() => {
    try {
      const stateToSave: SavedIDEState = {
        tabs: tabs.map((t) => ({ path: t.path, name: t.name, language: t.language })),
        activeTabPath,
        expandedPaths,
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
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    const isSelected = activeTabPath === node.path;

    return (
      <div key={node.path}>
        <div
          onClick={() => {
            if (node.isDir) {
              toggleNodeExpansion(node);
            } else {
              handleOpenFile(node.path, node.name);
            }
          }}
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
                gap: '3px',
                padding: '2px 6px',
                borderRadius: '3px',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              {isHorizontal ? <Columns2 size={12} /> : <Rows2 size={12} />}
              <span>{isHorizontal ? 'Chia đôi đứng' : 'Chia ngang'}</span>
            </button>

            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
              {consoleLines.length} dòng
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
              {consoleLines.map((line, idx) => (
                <div
                  key={idx}
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
                <Send size={10} /> Gửi
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
                  {creatingType === 'file' ? 'Tạo tệp mới:' : 'Tạo thư mục mới:'}
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
                    Hủy
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '2px 8px', fontSize: '10px', backgroundColor: 'var(--color-primary)', border: 'none', color: '#fff', borderRadius: '3px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Tạo
                  </button>
                </div>
              </form>
            )}

            {/* Tree nodes */}
            <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}>
              {loadingRoot ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  <RefreshCw size={16} className="animate-spin" style={{ margin: '0 auto 6px' }} />
                  Đang tải cấu trúc tệp...
                </div>
              ) : fileTree.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Thư mục trống
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
                  Chọn tệp từ cây bên trái để mở soạn thảo.
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
                    <RotateCcw size={11} /> Hủy
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
                    <Save size={11} /> {activeTab.isSaving ? 'Đang lưu...' : 'Lưu'}
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
                  <span>{isLayoutLocked ? 'Đã khóa' : 'Khóa'}</span>
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
                    Server IDE Studio
                  </div>
                  <div style={{ fontSize: '12px', maxWidth: '340px', textAlign: 'center' }}>
                    Kết nối trực tiếp API hệ thống tệp và bảng điều khiển container của <strong>{serverName}</strong>.
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
                    {activeTab.isDirty ? 'Chưa lưu (Ctrl+S)' : 'Đã đồng bộ'}
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
    </div>
  );
};
