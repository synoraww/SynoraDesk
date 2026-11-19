import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Lock, Sparkles, Shield, Copy } from 'lucide-react';
import { WindowMinimise, WindowToggleMaximise, Quit } from '../../../wailsjs/runtime/runtime';
import { useSecurityStore } from '../../stores/securityStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useI18n } from '../../i18n';
import logo from '../../assets/images/logo-universal.png';

interface CustomTitleBarProps {
  onCheckUpdates?: () => void;
  title?: string;
  isDetached?: boolean;
  onClose?: () => void;
}

export const CustomTitleBar: React.FC<CustomTitleBarProps> = ({
  onCheckUpdates,
  title: propTitle,
  isDetached = false,
  onClose,
}) => {
  const { lockType, lockApp } = useSecurityStore();
  const { tabs, activeTabId } = useWorkspaceStore();
  const { t } = useI18n();

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const currentTitle = propTitle || (activeTab ? activeTab.title : 'SynoraDesk');

  return (
    <div
      className="wails-drag glass-panel"
      style={{
        height: '32px',
        width: '100%',
        backgroundColor: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        userSelect: 'none',
        position: 'relative',
        zIndex: 50,
        paddingLeft: '10px',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Left: Branding Logo + Title + Version Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <img
          src={logo}
          alt="SynoraDesk"
          style={{ width: '18px', height: '18px', objectFit: 'cover', borderRadius: '4px' }}
        />
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
          SynoraDesk
        </span>
        <span
          style={{
            fontSize: '9px',
            fontWeight: 600,
            padding: '1px 5px',
            borderRadius: '4px',
            backgroundColor: isDetached ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-primary-muted)',
            color: isDetached ? '#818CF8' : 'var(--color-primary-light)',
            letterSpacing: '0.02em',
          }}
        >
          {isDetached ? (t('common.detachedBadge') || 'Cửa sổ phụ') : 'v1.02A'}
        </span>
      </div>

      {/* Middle: Active Document / Window Title (Truncated) */}
      <div
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--color-text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          padding: '0 16px',
        }}
      >
        {currentTitle}
      </div>

      {/* Right: Quick Actions & Windows Controls */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', flexShrink: 0 }}>
        {/* Check Update Button */}
        {!isDetached && onCheckUpdates && (
          <button
            onClick={onCheckUpdates}
            className="wails-no-drag btn-interactive"
            title={t('titlebar.checkUpdates') || 'Kiểm tra cập nhật'}
            style={{
              height: '32px',
              padding: '0 8px',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              fontSize: '11px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
              e.currentTarget.style.color = 'var(--color-primary-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            <Sparkles size={12} color="var(--color-primary-light)" />
            <span style={{ display: 'none' }}>Updates</span>
          </button>
        )}

        {/* Quick Lock Button (if lock configured) */}
        {!isDetached && lockType !== 'none' && (
          <button
            onClick={lockApp}
            className="wails-no-drag btn-interactive"
            title={t('titlebar.quickLock') || 'Khóa ứng dụng ngay lập tức'}
            style={{
              height: '32px',
              padding: '0 10px',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
              e.currentTarget.style.color = 'var(--color-error)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            <Lock size={13} />
          </button>
        )}

        {/* Window Control 1: Minimize */}
        <button
          onClick={() => WindowMinimise()}
          className="wails-no-drag"
          title={t('titlebar.minimize') || 'Thu nhỏ'}
          style={{
            width: '44px',
            height: '32px',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.12s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Minus size={13} />
        </button>

        {/* Window Control 2: Maximize / Restore */}
        <button
          onClick={() => WindowToggleMaximise()}
          className="wails-no-drag"
          title={t('titlebar.maximize') || 'Phóng to'}
          style={{
            width: '44px',
            height: '32px',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.12s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Square size={11} />
        </button>

        {/* Window Control 3: Close (Windows Fluent Red on hover) */}
        <button
          onClick={onClose ? onClose : () => Quit()}
          className="wails-no-drag"
          title={t('titlebar.close') || 'Đóng'}
          style={{
            width: '46px',
            height: '32px',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.12s ease, color 0.12s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#E81123';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
