import React, { useEffect, useState } from 'react';
import {
  Settings,
  Shield,
  Folder,
  Moon,
  Sun,
  Database,
  Info,
  CheckCircle2,
  Globe,
  FileCode2,
  Image as ImageIcon,
  FolderOpen,
  Trash2,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { useUIStore, AccentTheme } from '../stores/uiStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useI18n, Language } from '../i18n';
import { SecuritySettingsCard } from '../components/security/SecuritySettingsCard';
import { WallpaperCustomizerModal } from '../components/common/WallpaperCustomizerModal';

// 5 Theme Accent Options matching user reference screenshot
const ACCENT_OPTIONS: { id: AccentTheme; name: string; color: string; labelVi: string; labelEn: string }[] = [
  { id: 'blue', name: 'Blue', color: '#3B82F6', labelVi: 'Xanh dương (Blue)', labelEn: 'Ocean Blue' },
  { id: 'green', name: 'Green', color: '#10B981', labelVi: 'Xanh lá (Green)', labelEn: 'Emerald Green' },
  { id: 'purple', name: 'Purple', color: '#8B5CF6', labelVi: 'Tím (Purple)', labelEn: 'Royal Purple' },
  { id: 'amber', name: 'Amber', color: '#F59E0B', labelVi: 'Cam (Amber)', labelEn: 'Sunset Amber' },
  { id: 'rose', name: 'Rose', color: '#F43F5E', labelVi: 'Đỏ / Hồng (Rose)', labelEn: 'Crimson Rose' },
];

// SVG Mesh Sphere Component matching reference screenshot
const MeshSphere: React.FC<{ color: string; active?: boolean }> = ({ color, active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id={`glow-${color.replace('#', '')}`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={color} stopOpacity="0.45" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </radialGradient>
    </defs>
    {/* Inner soft glow */}
    <circle cx="12" cy="12" r="10" fill={`url(#glow-${color.replace('#', '')})`} />
    {/* Outer boundary sphere */}
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.6" opacity={active ? 1 : 0.8} />
    {/* Longitude ellipses */}
    <ellipse cx="12" cy="12" rx="4.5" ry="10" stroke={color} strokeWidth="1.2" opacity={active ? 0.95 : 0.7} />
    {/* Latitude lines */}
    <line x1="2" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1.2" opacity={active ? 0.95 : 0.7} />
    <line x1="3.8" y1="7" x2="20.2" y2="7" stroke={color} strokeWidth="1" opacity={active ? 0.8 : 0.55} strokeDasharray="1.2 1.2" />
    <line x1="3.8" y1="17" x2="20.2" y2="17" stroke={color} strokeWidth="1" opacity={active ? 0.8 : 0.55} strokeDasharray="1.2 1.2" />
    {/* Center core point */}
    <circle cx="12" cy="12" r="1.5" fill={color} />
  </svg>
);

export const SettingsPage: React.FC = () => {
  const {
    theme,
    setTheme,
    accentTheme,
    setAccentTheme,
    customBackground,
    selectAndApplyBackgroundImage,
    updateBackgroundSettings,
    removeCustomBackground,
  } = useUIStore();
  const { editorOpenInNewTab, setEditorOpenInNewTab } = useWorkspaceStore();
  const { language, setLanguage, t } = useI18n();
  const [dataDir, setDataDir] = useState<string>('Loading...');
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState(false);

  useEffect(() => {
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app) {
      app.GetAppDataDir().then((dir: string) => setDataDir(dir || ''));
    }
  }, []);

  const handleOpenBackgroundFolder = () => {
    // @ts-ignore
    const app = window.go?.main?.App;
    if (app?.OpenBackgroundFolder) {
      app.OpenBackgroundFolder();
    }
  };

  const hasBg = customBackground.enabled && Boolean(customBackground.dataUrl);

  return (
    <div style={{ width: '100%', padding: '24px 28px', maxWidth: '800px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
          {t('settings.title')}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
          {t('settings.subtitle')}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Language Selection Card */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Globe size={16} color="var(--color-primary-light)" />
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
              {t('settings.language')}
            </h2>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            Select preferred display language for interface and alerts
          </p>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setLanguage('en')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: language === 'en' ? 'var(--color-primary-muted)' : 'var(--color-surface-hover)',
                border: `1px solid ${language === 'en' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '18px' }}>🇬🇧</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{t('settings.languageEn')}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t('settings.languageEnglishDesc')}</div>
              </div>
            </button>

            <button
              onClick={() => setLanguage('vi')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: language === 'vi' ? 'var(--color-primary-muted)' : 'var(--color-surface-hover)',
                border: `1px solid ${language === 'vi' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '18px' }}>🇻🇳</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{t('settings.languageVi')}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t('settings.languageVietnameseDesc')}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Code Editor Preferences Card */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <FileCode2 size={16} color="var(--color-primary-light)" />
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
              {t('settings.editor')}
            </h2>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={editorOpenInNewTab}
              onChange={(e) => setEditorOpenInNewTab(e.target.checked)}
              style={{ marginTop: '3px', cursor: 'pointer' }}
            />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                {t('settings.editorOpenNewTab')}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                {t('settings.editorOpenNewTabDesc')}
              </div>
            </div>
          </label>
        </div>

        {/* Appearance & Signature Theme Card */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '20px',
          }}
        >
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
            {t('settings.appearance')}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            {t('settings.colorThemeDesc')}
          </p>

          {/* Theme Selector Pill Bar - Matching exact screenshot design */}
          <div style={{ marginBottom: '18px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '14px',
                padding: '6px 12px 6px 16px',
                backgroundColor: 'rgba(14, 18, 27, 0.95)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  letterSpacing: '0.01em',
                }}
              >
                Theme
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {ACCENT_OPTIONS.map((opt) => {
                  const isSelected = accentTheme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setAccentTheme(opt.id)}
                      title={language === 'vi' ? opt.labelVi : opt.labelEn}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                        border: isSelected ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid transparent',
                        boxShadow: isSelected ? `0 0 14px ${opt.color}40` : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                        padding: 0,
                      }}
                    >
                      <MeshSphere color={opt.color} active={isSelected} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Dark / Light Mode Switches */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setTheme('dark')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: theme === 'dark' ? 'var(--color-primary-muted)' : 'var(--color-surface-hover)',
                border: `1px solid ${theme === 'dark' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              <Moon size={18} color={theme === 'dark' ? 'var(--color-primary-light)' : 'var(--color-text-muted)'} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{t('settings.darkTheme')}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t('settings.darkThemeDesc')}</div>
              </div>
            </button>

            <button
              onClick={() => setTheme('light')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: theme === 'light' ? 'var(--color-primary-muted)' : 'var(--color-surface-hover)',
                border: `1px solid ${theme === 'light' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              <Sun size={18} color={theme === 'light' ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{t('settings.lightTheme')}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t('settings.lightThemeDesc')}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Custom Background Image Card */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ImageIcon size={16} color="var(--color-primary-light)" />
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                {t('settings.customBackground')}
              </h2>
            </div>
            {hasBg && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-success)',
                  backgroundColor: 'var(--color-success-bg)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                }}
              >
                {t('settings.backgroundActive')}
              </span>
            )}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            {t('settings.customBackgroundDesc')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Buttons: Select Image & Open Separate Folder */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={selectAndApplyBackgroundImage}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <ImageIcon size={14} />
                {hasBg ? t('settings.changeBackground') : t('settings.selectBackground')}
              </button>

              <button
                onClick={handleOpenBackgroundFolder}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-surface-hover)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <FolderOpen size={14} color="var(--color-primary-light)" />
                {t('settings.openFolder')}
              </button>

              {hasBg && (
                <button
                  onClick={() => setIsWallpaperModalOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-primary-muted)',
                    color: 'var(--color-primary-light)',
                    border: '1px solid var(--color-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Sliders size={14} />
                  <span>{t('wallpaper.customizeButton') || 'Căn góc & Phóng to (Zoom)'}</span>
                </button>
              )}

              {hasBg && (
                <button
                  onClick={removeCustomBackground}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-error-bg)',
                    color: 'var(--color-error)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    marginLeft: 'auto',
                  }}
                >
                  <Trash2 size={14} />
                  {t('settings.removeBackground')}
                </button>
              )}
            </div>

            {/* Saved Location in dedicated folder notice */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Folder size={13} color="var(--color-primary-light)" />
                {t('settings.savedLocation')}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--color-text)',
                  wordBreak: 'break-all',
                }}
              >
                {customBackground.path || (dataDir !== 'Loading...' ? `${dataDir}\\backgrounds` : '...\\PteroDesk\\backgrounds')}
              </div>
            </div>

            {/* Preview & Tuning Sliders (Visible when image is applied) */}
            {hasBg && (
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                  alignItems: 'center',
                }}
              >
                {/* Thumbnail Preview (Clickable to open Customizer) */}
                <div
                  onClick={() => setIsWallpaperModalOpen(true)}
                  title="Nhấn để mở công cụ căn chỉnh & phóng to chi tiết"
                  className="btn-interactive"
                  style={{
                    width: '130px',
                    height: '86px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    border: '1px solid var(--color-border)',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                >
                  <img
                    src={customBackground.dataUrl}
                    alt="Background Preview"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: customBackground.fitMode === 'contain' ? 'contain' : 'cover',
                      objectPosition: `${customBackground.positionX ?? 50}% ${customBackground.positionY ?? 50}%`,
                      transform: `scale(${customBackground.scale ?? 1})`,
                      transformOrigin: `${customBackground.positionX ?? 50}% ${customBackground.positionY ?? 50}%`,
                      filter: customBackground.blur > 0 ? `blur(${Math.min(customBackground.blur, 6)}px)` : 'none',
                      display: 'block',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor:
                        theme === 'dark'
                          ? `rgba(11, 15, 25, ${customBackground.opacity})`
                          : `rgba(248, 250, 252, ${customBackground.opacity})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      color: 'var(--color-text)',
                      fontWeight: 600,
                      gap: '4px',
                    }}
                  >
                    <Sliders size={12} color="var(--color-primary-light)" />
                    <span>Chỉnh sửa</span>
                  </div>
                </div>

                {/* Sliders & Quick Info */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Status Badges */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      Zoom: <strong style={{ color: 'var(--color-primary-light)' }}>{Math.round((customBackground.scale ?? 1) * 100)}%</strong>
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      Vị trí: <strong style={{ color: 'var(--color-primary-light)' }}>{customBackground.positionX ?? 50}% : {customBackground.positionY ?? 50}%</strong>
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {customBackground.fitMode === 'contain' ? 'Vừa khung' : 'Phủ đầy'}
                    </span>
                  </div>

                  {/* Dimming Slider */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                        {t('settings.overlayDimming')}
                      </span>
                      <span style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>
                        {Math.round(customBackground.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="0.95"
                      step="0.05"
                      value={customBackground.opacity}
                      onChange={(e) => updateBackgroundSettings(parseFloat(e.target.value), customBackground.blur)}
                      style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Blur Slider */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                        {t('settings.backgroundBlur')}
                      </span>
                      <span style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>
                        {customBackground.blur}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="1"
                      value={customBackground.blur}
                      onChange={(e) => updateBackgroundSettings(customBackground.opacity, parseInt(e.target.value, 10))}
                      style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Security & DPAPI */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '20px',
          }}
        > 

          <div
            style={{
              padding: '12px 14px',
              borderRadius: '6px',
              backgroundColor: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-success)', fontWeight: 600 }}>
              <CheckCircle2 size={14} /> {t('settings.dpapiActive')}
            </div>
            <div>
              {t('settings.credentialsEncrypted')}
            </div>
          </div>
        </div>

        {/* Local Storage & Data Directory */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Database size={16} color="var(--color-primary-light)" />
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
              {t('settings.localDataTitle')}
            </h2>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
            {t('settings.localDataDesc')}
          </p>

          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            <span style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>{t('settings.applicationDirectory')}</span>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                border: '1px solid var(--color-border)',
                wordBreak: 'break-all',
              }}
            >
              {dataDir}
            </div>
          </div>
        </div>

        {/* Security & App Lock Card */}
        <SecuritySettingsCard />

        {/* About Card */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Info size={16} color="var(--color-primary-light)" />
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
              {t('settings.aboutTitle')}
            </h2>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
            {t('settings.aboutDesc')}
          </p>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            <div>{t('settings.version')}</div>
            <div style={{ fontSize: '11px', marginTop: '2px' }}>{t('settings.builtWith')}</div>
          </div>
        </div>

        {/* Wallpaper Customizer Modal */}
        <WallpaperCustomizerModal
          isOpen={isWallpaperModalOpen}
          onClose={() => setIsWallpaperModalOpen(false)}
        />
      </div>
    </div>
  );
};
