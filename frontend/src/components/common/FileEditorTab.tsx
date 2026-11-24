import React, { useEffect, useState } from 'react';
import { PteroMonacoEditor } from './PteroMonacoEditor';
import { LoadingSkeleton } from './LoadingSkeleton';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useUIStore } from '../../stores/uiStore';
import { useI18n } from '../../i18n';

interface FileEditorTabProps {
  serverIdentifier: string;
  filePath: string;
  tabId: string;
}

export const FileEditorTab: React.FC<FileEditorTabProps> = ({
  serverIdentifier,
  filePath,
  tabId,
}) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { closeTab, updateTab } = useWorkspaceStore();
  const { addNotification } = useUIStore();
  const { t } = useI18n();

  useEffect(() => {
    let mounted = true;
    const loadFile = async () => {
      setLoading(true);
      // @ts-ignore
      const app = window.go?.main?.App;
      if (!app) {
        setLoading(false);
        return;
      }

      try {
        const text = await app.GetFileContents(serverIdentifier, filePath);
        if (mounted) {
          setContent(text || '');
        }
      } catch (err: any) {
        addNotification({
          type: 'error',
          title: t('files.openFailed'),
          message: err.message || t('files.loadError'),
        });
        if (mounted) {
          setContent('');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadFile();
    return () => {
      mounted = false;
    };
  }, [serverIdentifier, filePath]);

  const handleSave = async (newContent: string) => {
    setSaving(true);
    // @ts-ignore
    const app = window.go?.main?.App;
    if (!app) {
      setSaving(false);
      return;
    }

    try {
      await app.WriteFile(serverIdentifier, filePath, newContent);
      setContent(newContent);
      updateTab(tabId, { isDirty: false });
      addNotification({
        type: 'success',
        title: t('files.saved'),
        message: t('files.savedMessage', { path: filePath }),
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('files.saveFailed'),
        message: err.message || t('files.saveError'),
      });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (loading || content === null) {
    return (
      <div style={{ padding: '24px', backgroundColor: '#1E1E1E', height: '100%' }}>
        <LoadingSkeleton lines={8} height={28} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, height: '100%', minHeight: 0, position: 'relative' }}>
      <PteroMonacoEditor
        fileName={filePath}
        initialValue={content}
        isSaving={saving}
        isModal={false}
        onSave={handleSave}
        onClose={() => closeTab(tabId)}
      />
    </div>
  );
};
