import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Shield,
  Check,
  Search,
  CheckSquare,
  Square,
  Terminal,
  Users,
  FolderOpen,
  Puzzle,
  Archive,
  Network,
  Cpu,
  Database,
  Calendar,
  Settings,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { useI18n } from '../../i18n';

export interface PermissionItem {
  key: string;
  name: string;
  description: string;
}

export interface PermissionCategory {
  category: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  permissions: PermissionItem[];
}

export const PERMISSION_GROUPS: PermissionCategory[] = [
  {
    category: 'control',
    title: 'Control / Power & Console',
    description: "Permissions that control a user's ability to control the power state of a server, or send commands.",
    icon: <Terminal size={15} color="#10B981" />,
    permissions: [
      { key: 'control.console', name: 'console', description: 'Allows a user to send commands to the server instance via the console.' },
      { key: 'control.start', name: 'start', description: 'Allows a user to start the server if it is stopped.' },
      { key: 'control.stop', name: 'stop', description: 'Allows a user to stop a server if it is running.' },
      { key: 'control.restart', name: 'restart', description: 'Allows a user to perform a server restart. This allows them to start the server if it is offline, but not put the server in a completely stopped state.' },
    ],
  },
  {
    category: 'user',
    title: 'User / Subusers Management',
    description: 'Permissions that allow a user to manage other subusers on a server. They will never be able to edit their own account, or assign permissions they do not have themselves.',
    icon: <Users size={15} color="#6366F1" />,
    permissions: [
      { key: 'user.create', name: 'create', description: 'Allows a user to create new subusers for the server.' },
      { key: 'user.read', name: 'read', description: 'Allows the user to view subusers and their permissions for the server.' },
      { key: 'user.update', name: 'update', description: 'Allows a user to modify other subusers.' },
      { key: 'user.delete', name: 'delete', description: 'Allows a user to delete a subuser from the server.' },
    ],
  },
  {
    category: 'file',
    title: 'Filesystem & SFTP',
    description: "Permissions that control a user's ability to modify the filesystem for this server.",
    icon: <FolderOpen size={15} color="#F59E0B" />,
    permissions: [
      { key: 'file.create', name: 'create', description: 'Allows a user to create additional files and folders via the Panel or direct upload.' },
      { key: 'file.read', name: 'read', description: 'Allows a user to view the contents of a directory, but not view the contents of or download files.' },
      { key: 'file.read-content', name: 'read-content', description: 'Allows a user to view the contents of a given file. This will also allow the user to download files.' },
      { key: 'file.update', name: 'update', description: 'Allows a user to update the contents of an existing file or directory.' },
      { key: 'file.delete', name: 'delete', description: 'Allows a user to delete files or directories.' },
      { key: 'file.archive', name: 'archive', description: 'Allows a user to archive the contents of a directory as well as decompress existing archives on the system.' },
      { key: 'file.sftp', name: 'sftp', description: 'Allows a user to connect to SFTP and manage server files using the other assigned file permissions.' },
    ],
  },
  {
    category: 'plugin',
    title: 'Plugins & Addons',
    description: "Permissions that control a user's ability to view and install Minecraft plugins.",
    icon: <Puzzle size={15} color="#8B5CF6" />,
    permissions: [
      { key: 'plugin.read', name: 'read', description: 'Allows a user to view the plugin catalog and installed plugins.' },
      { key: 'plugin.download', name: 'download', description: 'Allows installing verified plugins; file create is also required, and replacements require file update/delete.' },
    ],
  },
  {
    category: 'backup',
    title: 'Backups',
    description: "Permissions that control a user's ability to generate and manage server backups.",
    icon: <Archive size={15} color="#EC4899" />,
    permissions: [
      { key: 'backup.create', name: 'create', description: 'Allows a user to create new backups for this server.' },
      { key: 'backup.read', name: 'read', description: 'Allows a user to view all backups that exist for this server.' },
      { key: 'backup.delete', name: 'delete', description: 'Allows a user to remove backups from the system.' },
      { key: 'backup.download', name: 'download', description: 'Allows a user to download a backup for the server. Danger: this allows a user to access all files for the server in the backup.' },
      { key: 'backup.restore', name: 'restore', description: 'Allows a user to restore a backup for the server. Danger: this allows the user to delete all of the server files in the process.' },
    ],
  },
  {
    category: 'allocation',
    title: 'Network Allocations',
    description: "Permissions that control a user's ability to modify the port allocations for this server.",
    icon: <Network size={15} color="#06B6D4" />,
    permissions: [
      { key: 'allocation.read', name: 'read', description: 'Allows a user to view all allocations currently assigned to this server. Users with any level of access to this server can always view the primary allocation.' },
      { key: 'allocation.create', name: 'create', description: 'Allows a user to assign additional allocations to the server.' },
      { key: 'allocation.update', name: 'update', description: 'Allows a user to change the primary server allocation and attach notes to each allocation.' },
      { key: 'allocation.delete', name: 'delete', description: 'Allows a user to delete an allocation from the server.' },
    ],
  },
  {
    category: 'startup',
    title: 'Startup Parameters & Docker',
    description: "Permissions that control a user's ability to view this server's startup parameters.",
    icon: <Cpu size={15} color="#14B8A6" />,
    permissions: [
      { key: 'startup.read', name: 'read', description: 'Allows a user to view the startup variables for a server.' },
      { key: 'startup.update', name: 'update', description: 'Allows a user to modify the startup variables for the server.' },
      { key: 'startup.docker-image', name: 'docker-image', description: 'Allows a user to modify the Docker image used when running the server.' },
    ],
  },
  {
    category: 'database',
    title: 'Databases',
    description: "Permissions that control a user's access to the database management for this server.",
    icon: <Database size={15} color="var(--color-primary-light)" />,
    permissions: [
      { key: 'database.create', name: 'create', description: 'Allows a user to create a new database for this server.' },
      { key: 'database.read', name: 'read', description: 'Allows a user to view the database associated with this server.' },
      { key: 'database.update', name: 'update', description: 'Allows a user to rotate the password on a database instance. If the user does not have the view_password permission they will not see the updated password.' },
      { key: 'database.delete', name: 'delete', description: 'Allows a user to remove a database instance from this server.' },
      { key: 'database.view_password', name: 'view_password', description: 'Allows a user to view the password associated with a database instance for this server.' },
    ],
  },
  {
    category: 'schedule',
    title: 'Schedules & Automation',
    description: "Permissions that control a user's access to the schedule management for this server.",
    icon: <Calendar size={15} color="#84CC16" />,
    permissions: [
      { key: 'schedule.create', name: 'create', description: 'Allows a user to create new schedules for this server.' },
      { key: 'schedule.read', name: 'read', description: 'Allows a user to view schedules and the tasks associated with them for this server.' },
      { key: 'schedule.update', name: 'update', description: 'Allows a user to update schedules and schedule tasks for this server.' },
      { key: 'schedule.delete', name: 'delete', description: 'Allows a user to delete schedules for this server.' },
    ],
  },
  {
    category: 'settings',
    title: 'Settings',
    description: "Permissions that control a user's access to the settings for this server.",
    icon: <Settings size={15} color="#64748B" />,
    permissions: [
      { key: 'settings.rename', name: 'rename', description: 'Allows a user to rename this server and change the description of it.' },
      { key: 'settings.reinstall', name: 'reinstall', description: 'Allows a user to trigger a reinstall of this server.' },
    ],
  },
  {
    category: 'activity',
    title: 'Activity Logs',
    description: "Permissions that control a user's access to the server activity logs.",
    icon: <Activity size={15} color="#A855F7" />,
    permissions: [
      { key: 'activity.read', name: 'read', description: 'Allows a user to view the activity logs for the server.' },
    ],
  },
];

const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));

interface SubuserPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subuser?: {
    uuid: string;
    username: string;
    email: string;
    permissions: string[];
    two_factor?: boolean;
  } | null;
  serverIdentifier: string;
  onSuccess: () => void;
}

export const SubuserPermissionsModal: React.FC<SubuserPermissionsModalProps> = ({
  isOpen,
  onClose,
  subuser,
  serverIdentifier,
  onSuccess,
}) => {
  const { t } = useI18n();
  const isEditing = Boolean(subuser);

  const [email, setEmail] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSearchTerm('');
      if (subuser) {
        setEmail(subuser.email || '');
        setSelectedPermissions(subuser.permissions || []);
      } else {
        setEmail('');
        setSelectedPermissions(['control.console', 'control.start', 'control.restart']);
      }
    }
  }, [isOpen, subuser]);

  if (!isOpen) return null;

  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleCategory = (categoryGroup: PermissionCategory) => {
    const groupKeys = categoryGroup.permissions.map((p) => p.key);
    const allSelected = groupKeys.every((k) => selectedPermissions.includes(k));

    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((k) => !groupKeys.includes(k)));
    } else {
      setSelectedPermissions((prev) => Array.from(new Set([...prev, ...groupKeys])));
    }
  };

  const selectAll = () => {
    setSelectedPermissions(ALL_PERMISSION_KEYS);
  };

  const clearAll = () => {
    setSelectedPermissions([]);
  };

  const selectReadOnly = () => {
    const readOnlyKeys = ALL_PERMISSION_KEYS.filter((k) => k.endsWith('.read') || k.endsWith('.read-content'));
    setSelectedPermissions(readOnlyKeys);
  };

  const filteredGroups = PERMISSION_GROUPS.map((group) => {
    if (!searchTerm.trim()) return group;
    const term = searchTerm.toLowerCase();
    const matched = group.permissions.filter(
      (p) =>
        p.key.toLowerCase().includes(term) ||
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        group.title.toLowerCase().includes(term)
    );
    return {
      ...group,
      permissions: matched,
    };
  }).filter((group) => group.permissions.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // @ts-ignore
    const app = window.go?.main?.App;
    if (!app) {
      setErrorMessage(t('subusers.backendUnavailable'));
      return;
    }

    setLoading(true);
    try {
      if (isEditing && subuser) {
        await app.UpdateSubuser(serverIdentifier, subuser.uuid, selectedPermissions);
      } else {
        if (!email.trim()) {
          setErrorMessage(t('subusers.invalidEmail'));
          setLoading(false);
          return;
        }
        await app.CreateSubuser(serverIdentifier, email.trim(), selectedPermissions);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || t('subusers.operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
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
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="custom-scrollbar"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          backgroundColor: '#0F131D',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
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
            backgroundColor: '#141A26',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield size={18} color="var(--color-primary-light)" />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
                {isEditing
                  ? t('subusers.editTitle', { name: subuser?.username || subuser?.email || '' })
                  : t('subusers.inviteTitle')}
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {isEditing ? `UUID: ${subuser?.uuid}` : t('subusers.inviteDescription')}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div
            className="custom-scrollbar"
            style={{
              padding: '16px 20px',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {/* Error Message */}
            {errorMessage && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--color-error)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={15} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Subuser Email info / input */}
            {!isEditing ? (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '6px' }}>
                  {t('subusers.email')}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="collaborator@example.com"
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>{subuser?.email}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {t('subusers.username')} <span style={{ color: 'var(--color-text)' }}>{subuser?.username}</span>
                  </div>
                </div>
                {subuser?.two_factor && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    {t('subusers.twoFactorEnabled')}
                  </span>
                )}
              </div>
            )}

            {/* Toolbar: Search & Select All/Clear All */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              {/* Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '180px' }}>
                <Search size={14} color="var(--color-text-muted)" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('subusers.searchPermissions')}
                  style={{
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    width: '100%',
                  }}
                />
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginRight: '4px' }}>
                  {t('subusers.selectedCount', { selected: selectedPermissions.length, total: ALL_PERMISSION_KEYS.length })}
                </span>
                <button
                  type="button"
                  onClick={selectAll}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                  }}
                >
                  {t('subusers.selectAll')}
                </button>
                <button
                  type="button"
                  onClick={selectReadOnly}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                  }}
                >
                  {t('subusers.readOnly')}
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                  }}
                >
                  {t('subusers.clearSelection')}
                </button>
              </div>
            </div>

            {/* Permission Categories List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredGroups.map((group) => {
                const groupKeys = group.permissions.map((p) => p.key);
                const allSelected = groupKeys.length > 0 && groupKeys.every((k) => selectedPermissions.includes(k));
                const someSelected = groupKeys.some((k) => selectedPermissions.includes(k));

                return (
                  <div
                    key={group.category}
                    style={{
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Category Header */}
                    <div
                      style={{
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {group.icon}
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                            {t(`subusers.categories.${group.category}.title`)}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {t(`subusers.categories.${group.category}.description`)}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleCategory(group)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: allSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                          border: `1px solid ${allSelected ? 'rgba(99, 102, 241, 0.4)' : 'var(--color-border)'}`,
                          color: allSelected ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        {allSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                        {t(allSelected ? 'subusers.deselectCategory' : 'subusers.selectCategory')}
                      </button>
                    </div>

                    {/* Permissions Grid */}
                    <div
                      style={{
                        padding: '10px 14px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                        gap: '8px',
                      }}
                    >
                      {group.permissions.map((perm) => {
                        const checked = selectedPermissions.includes(perm.key);
                        return (
                          <div
                            key={perm.key}
                            onClick={() => togglePermission(perm.key)}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              backgroundColor: checked ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                              border: `1px solid ${checked ? 'rgba(99, 102, 241, 0.3)' : 'var(--color-border)'}`,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}} // handled by parent onClick
                              style={{ marginTop: '2px', cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: checked ? 'var(--color-primary-light)' : 'var(--color-text)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <span>{perm.name}</span>
                                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                                  ({perm.key})
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--color-text-secondary)',
                                  marginTop: '2px',
                                  lineHeight: 1.35,
                                }}
                              >
                                {t(`subusers.permissionDescriptions.${perm.key.replace(/[.-]/g, '_')}`)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: '#141A26',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {t('subusers.enabledCount', { count: selectedPermissions.length })}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '7px 18px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-primary)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {loading
                  ? t('common.saving')
                  : isEditing
                    ? t('subusers.save')
                    : t('subusers.invite')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
