import React, { useState } from 'react';
import {
  Sun,
  Moon,
  RotateCw,
  Search,
  Server,
  Layers,
  ChevronDown,
  Check,
  Plus,
  User,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { usePanelStore } from '../../stores/panelStore';
import { useServerStore } from '../../stores/serverStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useI18n } from '../../i18n';
import { PanelFavicon } from '../common/PanelFavicon';

interface TopBarProps {
  onOpenPanelModal?: () => void;
  onNavigateTab?: (tab: any) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenPanelModal, onNavigateTab }) => {
  const { theme, toggleTheme } = useUIStore();
  const { panels, activePanel, currentAccount, panelAccounts, switchPanel } = usePanelStore();
  const { activeTabId, updateTab } = useWorkspaceStore();
  const { fetchServers, fetchDashboardStats } = useServerStore();
  const { t } = useI18n();

  const [panelDropdownOpen, setPanelDropdownOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchServers(), fetchDashboardStats()]);
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  return (
    <header
      className="wails-drag glass-panel"
      style={{
        height: '48px',
        flexShrink: 0,
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        userSelect: 'none',
        position: 'relative',
        zIndex: 10,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Left: Panel Switcher & Account Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setPanelDropdownOpen(!panelDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 10px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <PanelFavicon url={activePanel?.url} name={activePanel?.name} size={15} />
            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activePanel ? activePanel.name : 'Select Panel'}
            </span>
            <ChevronDown size={12} color="var(--color-text-muted)" />
          </button>

          {/* Dropdown Menu */}
          {panelDropdownOpen && (
            <>
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 99,
                }}
                onClick={() => setPanelDropdownOpen(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  width: '260px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 100,
                  padding: '4px',
                }}
              >
                <div
                  style={{
                    padding: '6px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Panels & Accounts
                </div>
                {panels.length === 0 ? (
                  <div style={{ padding: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    No panels configured
                  </div>
                ) : (
                  panels.map((p) => {
                    const acc = panelAccounts[p.id];
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          switchPanel(p.id);
                          updateTab(activeTabId, { panelId: p.id });
                          setPanelDropdownOpen(false);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          backgroundColor: p.id === activePanel?.id ? 'var(--color-surface-hover)' : 'transparent',
                          color: 'var(--color-text)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, minWidth: 0, paddingRight: '4px' }}>
                          <PanelFavicon url={p.url} name={p.name} size={18} />
                          <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {p.url.replace(/^https?:\/\//, '')}
                            </div>
                            {acc && (
                              <div style={{ fontSize: '10px', color: 'var(--color-primary-light)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <User size={10} />
                                <span style={{ fontWeight: 600 }}>{acc.username}</span>
                                <span style={{ opacity: 0.7 }}>({acc.email})</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {p.id === activePanel?.id && <Check size={14} color="var(--color-primary)" />}
                      </button>
                    );
                  })
                )}
                <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '4px', paddingTop: '4px' }}>
                  <button
                    onClick={() => {
                      setPanelDropdownOpen(false);
                      onOpenPanelModal?.();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--color-primary-light)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Plus size={14} />
                    Add New Panel
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Current Account Indicator */}
        {currentAccount && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: '5px',
              backgroundColor: 'var(--color-primary-muted)',
              border: '1px solid var(--color-primary-glow)',
              fontSize: '11px',
              color: 'var(--color-primary-light)',
            }}
            title={`API Key xác thực: ${currentAccount.username} (${currentAccount.email})${currentAccount.admin ? ' • Root Admin' : ''}`}
          >
            <PanelFavicon url={activePanel?.url} name={activePanel?.name} size={13} />
            <span style={{ fontWeight: 600 }}>{currentAccount.username}</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>({currentAccount.email})</span>
            {currentAccount.admin && (
              <span
                style={{
                  fontSize: '9px',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  backgroundColor: 'var(--color-primary)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  marginLeft: '2px',
                }}
              >
                ADMIN
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          title={t('layout.refreshData')}
          disabled={refreshing}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <RotateCw
            size={15}
            style={{
              animation: refreshing ? 'spin 0.6s linear infinite' : 'none',
            }}
          />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={t('layout.switchTheme', { theme: t(theme === 'dark' ? 'layout.themeLight' : 'layout.themeDark') })}
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
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </header>
  );
};
