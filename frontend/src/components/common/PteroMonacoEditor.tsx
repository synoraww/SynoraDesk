import React, { useState, useEffect, useRef } from 'react';
import Editor, { loader } from '@monaco-editor/react';
// @ts-ignore
import * as monaco from 'monaco-editor';
import {
  FileCode2,
  Save,
  X,
  Code2,
  Minimize2,
  Maximize2,
  WrapText,
  Check,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { useI18n } from '../../i18n';

// Configure Monaco to load 100% locally from bundled node_modules
loader.config({ monaco });

interface PteroMonacoEditorProps {
  fileName: string;
  initialValue: string;
  isSaving: boolean;
  onSave: (content: string) => Promise<void> | void;
  onClose: () => void;
  onOpenNewTab?: () => void;
  isModal?: boolean;
}

/**
 * Detect language ID for Monaco based on file extension
 */
export function detectLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  const map: { [key: string]: string } = {
    // Config & Data
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'ini',
    ini: 'ini',
    cfg: 'ini',
    conf: 'ini',
    properties: 'ini',
    env: 'ini',
    xml: 'xml',
    svg: 'xml',

    // Web & Scripts
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',

    // Backend & Systems
    py: 'python',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    sql: 'sql',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    lua: 'lua',
    rb: 'ruby',
    dockerfile: 'dockerfile',

    // Text & Docs
    md: 'markdown',
    markdown: 'markdown',
    txt: 'plaintext',
    log: 'plaintext',
  };

  if (fileName.toLowerCase() === 'dockerfile') return 'dockerfile';
  return map[ext] || 'plaintext';
}

const SUPPORTED_LANGUAGES = [
  'json',
  'yaml',
  'javascript',
  'typescript',
  'python',
  'shell',
  'sql',
  'html',
  'css',
  'ini',
  'xml',
  'markdown',
  'plaintext',
  'java',
  'go',
  'rust',
  'cpp',
  'csharp',
  'php',
  'lua',
];

export const PteroMonacoEditor: React.FC<PteroMonacoEditorProps> = ({
  fileName,
  initialValue,
  isSaving,
  onSave,
  onClose,
  onOpenNewTab,
  isModal = true,
}) => {
  const { t } = useI18n();
  const [content, setContent] = useState(initialValue);
  const [language, setLanguage] = useState(() => detectLanguage(fileName));
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');
  const [minimap, setMinimap] = useState(true);
  const [isSaved, setIsSaved] = useState(true);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const editorRef = useRef<any>(null);

  // Update language when file name changes
  useEffect(() => {
    setLanguage(detectLanguage(fileName));
  }, [fileName]);

  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
    editorRef.current = editor;

    // Add Ctrl+S / Cmd+S save command directly in Monaco
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      handleSave();
    });

    editor.focus();
  };

  const handleChange = (value: string | undefined) => {
    setContent(value ?? '');
    setIsSaved(false);
  };

  const handleSave = async () => {
    await onSave(content);
    setIsSaved(true);
  };

  const handleRequestClose = () => {
    if (!isSaved) {
      setShowUnsavedPrompt(true);
    } else {
      onClose();
    }
  };

  const handleSaveAndClose = async () => {
    await handleSave();
    setShowUnsavedPrompt(false);
    onClose();
  };

  const handleDiscardAndClose = () => {
    setShowUnsavedPrompt(false);
    onClose();
  };

  // Line count & char count stats
  const lineCount = content.split('\n').length;
  const charCount = content.length;

  const editorContainer = (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: isModal ? '94%' : '100%',
        maxWidth: isModal ? '1280px' : '100%',
        height: isModal ? '88%' : '100%',
        backgroundColor: '#1E1E1E',
        border: isModal ? '1px solid var(--color-border)' : 'none',
        borderRadius: isModal ? '10px' : '0px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: isModal ? '0 20px 40px rgba(0, 0, 0, 0.6)' : 'none',
        position: 'relative',
      }}
    >
      {/* Unsaved Changes Prompt Dialog */}
      {showUnsavedPrompt && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '440px',
              width: '90%',
              boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <AlertTriangle size={20} color="var(--color-warning)" />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                {t('files.unsavedTitle')}
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              {t('files.unsavedPrompt', { file: fileName })}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowUnsavedPrompt(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDiscardAndClose}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--color-error)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('files.discardAndClose')}
              </button>
              <button
                onClick={handleSaveAndClose}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-primary)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('files.saveAndClose')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monaco Header Bar */}
        <div
          style={{
            height: '48px',
            backgroundColor: '#252526',
            borderBottom: '1px solid #333333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            userSelect: 'none',
          }}
        >
          {/* File Name & Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <FileCode2 size={16} color="var(--color-primary-light)" />
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#CCCCCC',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {fileName}
            </span>

            {!isSaved && (
              <span
                style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  color: 'var(--color-warning)',
                  fontWeight: 600,
                }}
              >
                UNSAVED
              </span>
            )}

          </div>

          {/* Controls: Language dropdown, Minimap, Wrap, Save, Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Language Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Code2 size={13} color="#888888" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  height: '26px',
                  padding: '0 6px',
                  borderRadius: '4px',
                  backgroundColor: '#333333',
                  border: '1px solid #444444',
                  color: '#CCCCCC',
                  fontSize: '11px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Word Wrap Toggle */}
            <button
              onClick={() => setWordWrap((prev) => (prev === 'on' ? 'off' : 'on'))}
              title={`${t('files.wordWrap')} (${wordWrap.toUpperCase()})`}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: wordWrap === 'on' ? '#374151' : '#2D2D2D',
                border: '1px solid #444444',
                color: wordWrap === 'on' ? '#60A5FA' : '#888888',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <WrapText size={12} />
              {t('files.wrap')}
            </button>

            {/* Minimap Toggle */}
            <button
              onClick={() => setMinimap((prev) => !prev)}
              title={t('files.minimap')}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: minimap ? '#374151' : '#2D2D2D',
                border: '1px solid #444444',
                color: minimap ? '#60A5FA' : '#888888',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {minimap ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              Map
            </button>

            {/* Open in New Tab Button */}
            {onOpenNewTab && isModal && (
              <button
                onClick={onOpenNewTab}
                title={t('files.openNewTab')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 9px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#CCCCCC',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'background-color 0.12s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
              >
                <ExternalLink size={12} />
                <span>{t('files.openNewTab')}</span>
              </button>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '5px',
                backgroundColor: 'var(--color-primary)',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px var(--color-primary-glow)',
              }}
            >
              <Save size={13} />
              {isSaving ? t('common.loading') : `${t('common.save')} (Ctrl+S)`}
            </button>

            {/* Close Button */}
            <button
              onClick={handleRequestClose}
              title={t('common.close')}
              style={{
                padding: '6px',
                background: 'none',
                border: 'none',
                color: '#888888',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#888888')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Monaco Editor Container */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            value={content}
            onChange={handleChange}
            onMount={handleEditorDidMount}
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
              fontLigatures: true,
              tabSize: 2,
              minimap: { enabled: minimap },
              wordWrap: wordWrap,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              renderWhitespace: 'selection',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              lineNumbers: 'on',
              folding: true,
              bracketPairColorization: { enabled: true },
            }}
          />
        </div>

        {/* Monaco Status Bar */}
        <div
          style={{
            height: '24px',
            backgroundColor: '#007ACC',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>{t('files.lines', { count: lineCount })}</span>
            <span>{t('files.length', { count: charCount })}</span>
            <span>UTF-8</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>{language.toUpperCase()}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={11} /> {isSaved ? t('files.savedStatus') : t('files.modifiedStatus')}
            </span>
          </div>
        </div>
      </div>
    );

  if (!isModal) {
    return editorContainer;
  }

  return (
    <div
      onClick={handleRequestClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '24px',
      }}
    >
      {editorContainer}
    </div>
  );
};
