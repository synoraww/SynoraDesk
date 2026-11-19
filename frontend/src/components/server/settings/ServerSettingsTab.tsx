import React from 'react';
import { Settings } from 'lucide-react';
import { Server } from '../../../stores/serverStore';
import { ServerSectionHeader } from '../ServerSectionHeader';
import { ServerInfoCard } from './ServerInfoCard';
import { ServerRenameCard } from './ServerRenameCard';
import { ServerDangerZoneCard } from './ServerDangerZoneCard';
import { useI18n } from '../../../i18n';

interface ServerSettingsTabProps {
  server: Server | null;
  identifier: string;
  serverName: string;
  serverDesc: string;
  savingSettings: boolean;
  onServerNameChange: (val: string) => void;
  onServerDescChange: (val: string) => void;
  onSaveDetails: (e: React.FormEvent) => void;
  onCopyText: (text: string, label: string) => void;
  reinstallModalOpen: boolean;
  onOpenReinstallModal: () => void;
  onCloseReinstallModal: () => void;
  reinstalling: boolean;
  reinstallConfirmInput: string;
  onReinstallConfirmInputChange: (val: string) => void;
  onConfirmReinstall: () => void;
}

export const ServerSettingsTab: React.FC<ServerSettingsTabProps> = ({
  server,
  identifier,
  serverName,
  serverDesc,
  savingSettings,
  onServerNameChange,
  onServerDescChange,
  onSaveDetails,
  onCopyText,
  reinstallModalOpen,
  onOpenReinstallModal,
  onCloseReinstallModal,
  reinstalling,
  reinstallConfirmInput,
  onReinstallConfirmInputChange,
  onConfirmReinstall,
}) => {
  const { t } = useI18n();

  return (
    <div
      className="custom-scrollbar"
      style={{
        padding: '24px',
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Header */}
        <ServerSectionHeader
          icon={Settings}
          title={t('serverSettings.title') || 'Server Settings'}
          subtitle={t('serverSettings.subtitle') || 'Reinstall, rename, SFTP credentials, and dangerous actions'}
        />

        {/* Modular Cards */}
        <ServerInfoCard
          server={server}
          identifier={identifier}
          onCopyText={onCopyText}
        />

        <ServerRenameCard
          name={serverName}
          description={serverDesc}
          saving={savingSettings}
          onNameChange={onServerNameChange}
          onDescChange={onServerDescChange}
          onSubmit={onSaveDetails}
        />

        <ServerDangerZoneCard
          onOpenReinstallModal={onOpenReinstallModal}
          reinstallModalOpen={reinstallModalOpen}
          onCloseReinstallModal={onCloseReinstallModal}
          reinstalling={reinstalling}
          confirmInput={reinstallConfirmInput}
          onConfirmInputChange={onReinstallConfirmInputChange}
          onConfirmReinstall={onConfirmReinstall}
        />
      </div>
    </div>
  );
};
