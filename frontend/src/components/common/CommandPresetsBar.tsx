import React, { useState, useEffect, useRef } from 'react';
import {
  Bookmark,
  Plus,
  Download,
  Upload,
  Trash2,
  Play,
  X,
  FileCode,
  Copy,
  Check,
  Zap,
} from 'lucide-react';
import { useI18n } from '../../i18n';

export interface CommandPreset {
  id: string;
  label: string;
  command: string;
}

interface CommandPresetsBarProps {
  serverIdentifier: string;
  onSelectCommand: (cmd: string) => void;
  onExecuteCommand: (cmd: string) => void;
  lastExecutedCommand?: string;
}

export const CommandPresetsBar: React.FC<CommandPresetsBarProps> = ({
  serverIdentifier,
  onSelectCommand,
  onExecuteCommand,
  lastExecutedCommand,
}) => {
  const { t } = useI18n();
  const storageKey = `pterodesk_cmd_presets_${serverIdentifier}`;
  const autoSaveStorageKey = `pterodesk_cmd_autosave_${serverIdentifier}`;

  const [presets, setPresets] = useState<CommandPreset[]>([]);
  const [autoSave, setAutoSave] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(autoSaveStorageKey);
      return saved !== null ? saved === 'true' : true; // Default auto-save is ON
    } catch {
      return true;
    }
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCmd, setNewCmd] = useState('');
  const [importJson, setImportJson] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load presets from localStorage strictly without any hardcoded defaults
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setPresets(parsed);
          return;
        }
      }
    } catch {}
    setPresets([]);
  }, [storageKey]);

  // Reactive Auto-Save: Whenever a command is executed in console, automatically append to presets if enabled
  useEffect(() => {
    if (!lastExecutedCommand || !autoSave) return;
    const cmd = lastExecutedCommand.trim();
    if (!cmd) return;

    setPresets((prev) => {
      // Check if this command is already registered as a preset
      if (prev.some((p) => p.command.trim().toLowerCase() === cmd.toLowerCase())) {
        return prev;
      }
      const newPreset: CommandPreset = {
        id: `preset-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        label: cmd,
        command: cmd,
      };
      const updated = [...prev, newPreset];
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [lastExecutedCommand, autoSave, storageKey]);

  // Save presets helper
  const savePresets = (updated: CommandPreset[]) => {
    setPresets(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
  };

  const toggleAutoSave = () => {
    const next = !autoSave;
    setAutoSave(next);
    try {
      localStorage.setItem(autoSaveStorageKey, String(next));
    } catch {}
  };

  const handleAddPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCmd.trim()) return;

    const newPreset: CommandPreset = {
      id: `preset-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      label: newLabel.trim() || newCmd.trim(),
      command: newCmd.trim(),
    };

    savePresets([...presets, newPreset]);
    setNewLabel('');
    setNewCmd('');
    setShowAddModal(false);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    savePresets(presets.filter((p) => p.id !== id));
  };

  const handleClearAllPresets = () => {
    if (presets.length === 0) return;
    if (window.confirm(t('commandPresets.clearConfirm'))) {
      savePresets([]);
    }
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(presets, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cmd_presets_${serverIdentifier}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    try {
      navigator.clipboard.writeText(dataStr);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    } catch {}
  };

  const handleImportJson = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        const valid = parsed
          .filter((item) => item && (item.command || item.cmd))
          .map((item, idx) => ({
            id: `imported-${Date.now()}-${idx}`,
            label: item.label || item.name || item.command || item.cmd,
            command: item.command || item.cmd,
          }));

        if (valid.length > 0) {
          savePresets([...presets, ...valid]);
          setShowImportModal(false);
          setImportJson('');
        }
      }
    } catch {
      alert(t('commandPresets.invalidJson'));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleImportJson(content);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 8px',
        backgroundColor: 'var(--color-surface-elevated)',
        borderTop: '1px solid var(--color-border)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        userSelect: 'none',
        overflowX: 'auto',
      }}
      className="custom-scrollbar"
    >
      {/* Icon title badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--color-primary-light)',
          flexShrink: 0,
          paddingRight: '2px',
        }}
        title={t('commandPresets.title')}
      >
        <Bookmark size={12} />
        <span>{t('commandPresets.sample')}</span>
      </div>

      {/* Preset Pills List */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0, overflowX: 'auto' }}
        className="custom-scrollbar"
      >
        {presets.length === 0 ? (
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '0 6px' }}>
            {t('commandPresets.empty')}
          </span>
        ) : (
          presets.map((preset) => (
            <div
              key={preset.id}
              onClick={() => onSelectCommand(preset.command)}
              title={t('commandPresets.clickToFill', { command: preset.command })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface)')}
            >
              <span>{preset.label}</span>

              {/* Quick Run icon */}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onExecuteCommand(preset.command);
                }}
                title={t('commandPresets.runNow')}
                style={{
                  color: 'var(--color-success)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '1px',
                  borderRadius: '2px',
                }}
              >
                <Play size={10} fill="currentColor" />
              </span>

              {/* Quick Delete icon */}
              <span
                onClick={(e) => handleDeletePreset(preset.id, e)}
                title={t('commandPresets.deleteOne')}
                style={{
                  color: 'var(--color-text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '1px',
                  borderRadius: '2px',
                  opacity: 0.6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
              >
                <X size={10} />
              </span>
            </div>
          ))
        )}
      </div>

      {/* Action Buttons: Auto-Save Toggle, Add, Export, Import, Clear */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
        {/* Auto-Save Toggle */}
        <button
          type="button"
          onClick={toggleAutoSave}
          title={t(autoSave ? 'commandPresets.autosaveOn' : 'commandPresets.autosaveOff')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: autoSave ? 'rgba(34, 197, 94, 0.15)' : 'var(--color-surface)',
            border: `1px solid ${autoSave ? 'rgba(34, 197, 94, 0.4)' : 'var(--color-border)'}`,
            color: autoSave ? 'var(--color-success)' : 'var(--color-text-muted)',
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Zap size={10} fill={autoSave ? 'currentColor' : 'none'} />
          <span>{t(autoSave ? 'commandPresets.autosaveOnShort' : 'commandPresets.autosaveOffShort')}</span>
        </button>

        {/* Add Preset */}
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          title={t('commandPresets.addManually')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 7px',
            borderRadius: '4px',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            color: 'var(--color-primary-light)',
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={11} />
          <span>{t('commandPresets.add')}</span>
        </button>

        {/* Export Presets */}
        <button
          type="button"
          onClick={handleExportJson}
          title={t(copiedNotification ? 'commandPresets.exportCopied' : 'commandPresets.export')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: copiedNotification ? 'rgba(34, 197, 94, 0.2)' : 'var(--color-surface)',
            border: `1px solid ${copiedNotification ? 'var(--color-success)' : 'var(--color-border)'}`,
            color: copiedNotification ? 'var(--color-success)' : 'var(--color-text-secondary)',
            fontSize: '10px',
            cursor: 'pointer',
          }}
        >
          {copiedNotification ? <Check size={11} /> : <Download size={11} />}
          <span>{t(copiedNotification ? 'commandPresets.exported' : 'commandPresets.exportShort')}</span>
        </button>

        {/* Import Presets */}
        <button
          type="button"
          onClick={() => setShowImportModal(true)}
          title={t('commandPresets.import')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            fontSize: '10px',
            cursor: 'pointer',
          }}
        >
          <Upload size={11} />
          <span>{t('commandPresets.importShort')}</span>
        </button>

        {/* Clear All Presets */}
        {presets.length > 0 && (
          <button
            type="button"
            onClick={handleClearAllPresets}
            title={t('commandPresets.clearAll')}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '2px 5px',
              borderRadius: '4px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: 'var(--color-error)',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* Hidden File Input for Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".json"
        style={{ display: 'none' }}
      />

      {/* Modal: Add Preset */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              padding: '16px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
                {t('commandPresets.addManually')}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddPreset}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  {t('commandPresets.label')}
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder={t('commandPresets.labelPlaceholder')}
                  style={{
                    width: '100%',
                    height: '32px',
                    padding: '0 8px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  {t('commandPresets.command')}
                </label>
                <input
                  type="text"
                  required
                  value={newCmd}
                  onChange={(e) => setNewCmd(e.target.value)}
                  placeholder={t('commandPresets.commandPlaceholder')}
                  style={{
                    width: '100%',
                    height: '32px',
                    padding: '0 8px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-surface)',
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
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('commandPresets.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Import Presets */}
      {showImportModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowImportModal(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              padding: '16px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
                {t('commandPresets.import')}
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  border: '1px dashed var(--color-primary)',
                  color: 'var(--color-primary-light)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginBottom: '10px',
                }}
              >
                <Upload size={14} />
                {t('commandPresets.chooseJsonFile')}
              </button>

              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                {t('commandPresets.pasteJson')}
              </div>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder='[{"label": "Help", "command": "help"}, {"label": "Save", "command": "save-all"}]'
                rows={5}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleImportJson(importJson)}
                disabled={!importJson.trim()}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-primary)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: importJson.trim() ? 'pointer' : 'not-allowed',
                  opacity: importJson.trim() ? 1 : 0.6,
                }}
              >
                {t('commandPresets.load')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
