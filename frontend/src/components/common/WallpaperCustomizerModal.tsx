import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Move,
  RotateCcw,
  Check,
  Maximize2,
  Sliders,
  Grid,
  Eye,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useUIStore, WallpaperFitMode } from '../../stores/uiStore';
import { useI18n } from '../../i18n';

interface WallpaperCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WallpaperCustomizerModal: React.FC<WallpaperCustomizerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { customBackground, updateBackgroundSettings, theme } = useUIStore();
  const { t } = useI18n();

  // Working copy states
  const [scale, setScale] = useState<number>(1.0);
  const [posX, setPosX] = useState<number>(50);
  const [posY, setPosY] = useState<number>(50);
  const [opacity, setOpacity] = useState<number>(0.75);
  const [blur, setBlur] = useState<number>(0);
  const [fitMode, setFitMode] = useState<WallpaperFitMode>('cover');
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Mouse dragging on preview box
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialX: number; initialY: number }>({
    mouseX: 0,
    mouseY: 0,
    initialX: 50,
    initialY: 50,
  });

  const previewRef = useRef<HTMLDivElement>(null);

  // Initialize with store values when opened
  useEffect(() => {
    if (isOpen) {
      setScale(customBackground.scale ?? 1.0);
      setPosX(customBackground.positionX ?? 50);
      setPosY(customBackground.positionY ?? 50);
      setOpacity(customBackground.opacity ?? 0.75);
      setBlur(customBackground.blur ?? 0);
      setFitMode(customBackground.fitMode ?? 'cover');
    }
  }, [isOpen, customBackground]);

  // Live update background as user tweaks settings
  const applyLiveChanges = (
    newScale: number,
    newX: number,
    newY: number,
    newOpacity: number,
    newBlur: number,
    newFit: WallpaperFitMode
  ) => {
    updateBackgroundSettings(newOpacity, newBlur, newScale, newX, newY, newFit);
  };

  const handleScaleChange = (val: number) => {
    const clamped = Math.max(0.5, Math.min(3.5, Math.round(val * 100) / 100));
    setScale(clamped);
    applyLiveChanges(clamped, posX, posY, opacity, blur, fitMode);
  };

  const handlePosXChange = (val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    setPosX(clamped);
    applyLiveChanges(scale, clamped, posY, opacity, blur, fitMode);
  };

  const handlePosYChange = (val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    setPosY(clamped);
    applyLiveChanges(scale, posX, clamped, opacity, blur, fitMode);
  };

  const handleOpacityChange = (val: number) => {
    setOpacity(val);
    applyLiveChanges(scale, posX, posY, val, blur, fitMode);
  };

  const handleBlurChange = (val: number) => {
    setBlur(val);
    applyLiveChanges(scale, posX, posY, opacity, val, fitMode);
  };

  const handleFitModeChange = (mode: WallpaperFitMode) => {
    setFitMode(mode);
    applyLiveChanges(scale, posX, posY, opacity, blur, mode);
  };

  // 9-Grid Position Presets
  const setPresetPosition = (presetX: number, presetY: number) => {
    setPosX(presetX);
    setPosY(presetY);
    applyLiveChanges(scale, presetX, presetY, opacity, blur, fitMode);
  };

  // Reset to default settings
  const handleReset = () => {
    const defScale = 1.0;
    const defX = 50;
    const defY = 50;
    const defOpacity = 0.75;
    const defBlur = 0;
    const defFit: WallpaperFitMode = 'cover';

    setScale(defScale);
    setPosX(defX);
    setPosY(defY);
    setOpacity(defOpacity);
    setBlur(defBlur);
    setFitMode(defFit);
    applyLiveChanges(defScale, defX, defY, defOpacity, defBlur, defFit);
  };

  // Mouse drag handling for interactive preview box
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: posX,
      initialY: posY,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !previewRef.current) return;
      const rect = previewRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      // Invert delta because dragging image left means focal point shifts right
      // Scale factor sensitivity adjustment
      const sensitivity = 1.2;
      const percentDeltaX = -(deltaX / rect.width) * 100 * sensitivity;
      const percentDeltaY = -(deltaY / rect.height) * 100 * sensitivity;

      const newX = Math.max(0, Math.min(100, Math.round(dragStartRef.current.initialX + percentDeltaX)));
      const newY = Math.max(0, Math.min(100, Math.round(dragStartRef.current.initialY + percentDeltaY)));

      setPosX(newX);
      setPosY(newY);
      applyLiveChanges(scale, newX, newY, opacity, blur, fitMode);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, scale, opacity, blur, fitMode]);

  // Wheel zoom on preview
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomStep = e.deltaY < 0 ? 0.1 : -0.1;
    handleScaleChange(scale + zoomStep);
  };

  if (!isOpen || !customBackground.enabled || !customBackground.dataUrl) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55), 0 0 30px var(--color-primary-glow)',
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
            backgroundColor: 'var(--color-surface-hover)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-primary-muted)',
                color: 'var(--color-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sliders size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                {t('wallpaper.modalTitle') || 'Tùy chỉnh & Căn chỉnh hình nền'}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
                {t('wallpaper.modalSubtitle') || 'Kéo để chọn phần ảnh, phóng to/thu nhỏ và chọn vị trí hiển thị'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleReset}
              className="btn-interactive"
              title="Đặt lại về mặc định"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={13} />
              <span>{t('common.reset') || 'Đặt lại'}</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
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
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Interactive Drag & Preview Frame */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>
                {t('wallpaper.interactivePreview') || 'Khung nhìn trực quan (Kéo chuột để căn góc ảnh)'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                  />
                  <span>Lưới chia bố cục 1/3</span>
                </label>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  X: <strong style={{ color: 'var(--color-primary-light)' }}>{posX}%</strong> | Y: <strong style={{ color: 'var(--color-primary-light)' }}>{posY}%</strong> | Zoom: <strong style={{ color: 'var(--color-primary-light)' }}>{Math.round(scale * 100)}%</strong>
                </span>
              </div>
            </div>

            <div
              ref={previewRef}
              onMouseDown={handleMouseDown}
              onWheel={handleWheel}
              style={{
                width: '100%',
                height: '240px',
                borderRadius: '10px',
                border: isDragging ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                backgroundColor: '#070A11',
                overflow: 'hidden',
                position: 'relative',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                boxShadow: isDragging ? '0 0 20px var(--color-primary-glow)' : 'inset 0 2px 8px rgba(0,0,0,0.4)',
                transition: 'border-color 0.15s ease',
              }}
            >
              {/* Wallpaper image with live transform */}
              <img
                src={customBackground.dataUrl}
                alt="Wallpaper"
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: fitMode === 'contain' ? 'contain' : 'cover',
                  objectPosition: `${posX}% ${posY}%`,
                  transform: `scale(${scale})`,
                  transformOrigin: `${posX}% ${posY}%`,
                  filter: blur > 0 ? `blur(${Math.min(blur, 8)}px)` : 'none',
                  pointerEvents: 'none',
                  display: 'block',
                  transition: isDragging ? 'none' : 'transform 0.1s ease',
                }}
              />

              {/* Tint Overlay Preview */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor:
                    theme === 'dark'
                      ? `rgba(11, 15, 25, ${opacity})`
                      : `rgba(248, 250, 252, ${opacity})`,
                  pointerEvents: 'none',
                }}
              />

              {/* Rule of Thirds Grid Overlay */}
              {showGrid && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    border: '1px dashed rgba(255, 255, 255, 0.12)',
                  }}
                >
                  <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: '1px', borderLeft: '1px dashed rgba(255, 255, 255, 0.2)' }} />
                  <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: '1px', borderLeft: '1px dashed rgba(255, 255, 255, 0.2)' }} />
                  <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: '1px', borderTop: '1px dashed rgba(255, 255, 255, 0.2)' }} />
                  <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: '1px', borderTop: '1px dashed rgba(255, 255, 255, 0.2)' }} />

                  {/* Focal point indicator */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${posX}%`,
                      top: `${posY}%`,
                      transform: 'translate(-50%, -50%)',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: '2px solid var(--color-primary)',
                      backgroundColor: 'rgba(99, 102, 241, 0.3)',
                      boxShadow: '0 0 10px var(--color-primary-glow)',
                    }}
                  />
                </div>
              )}

              {/* Drag Hint Pill */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '12px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  backdropFilter: 'blur(6px)',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  pointerEvents: 'none',
                }}
              >
                <Move size={12} color="var(--color-primary-light)" />
                <span>Bấm giữ & rê chuột để di chuyển ảnh</span>
              </div>
            </div>
          </div>

          {/* Controls Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}
          >
            {/* Left Column: Zoom & Mode */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
              }}
            >
              {/* Zoom In / Out */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ZoomIn size={14} color="var(--color-primary-light)" />
                    {t('wallpaper.zoomLevel') || 'Mức độ Phóng to (Zoom)'}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary-light)' }}>
                    {Math.round(scale * 100)}%
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => handleScaleChange(scale - 0.15)}
                    className="btn-interactive"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <ZoomOut size={14} />
                  </button>

                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.05"
                    value={scale}
                    onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                  />

                  <button
                    onClick={() => handleScaleChange(scale + 0.15)}
                    className="btn-interactive"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>

                {/* Quick Zoom Presets */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  {[1.0, 1.25, 1.5, 2.0, 2.5].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleScaleChange(preset)}
                      style={{
                        flex: 1,
                        padding: '4px 0',
                        borderRadius: '4px',
                        border: scale === preset ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        backgroundColor: scale === preset ? 'var(--color-primary-muted)' : 'var(--color-surface)',
                        color: scale === preset ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {Math.round(preset * 100)}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Fit Mode */}
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>
                  {t('wallpaper.fitMode') || 'Chế độ lấp đầy khung hình'}
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    onClick={() => handleFitModeChange('cover')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: fitMode === 'cover' ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      backgroundColor: fitMode === 'cover' ? 'var(--color-primary-muted)' : 'var(--color-surface)',
                      color: fitMode === 'cover' ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div>Phủ đầy (Cover)</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                      Căng kín màn hình, cắt viền
                    </div>
                  </button>

                  <button
                    onClick={() => handleFitModeChange('contain')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: fitMode === 'contain' ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      backgroundColor: fitMode === 'contain' ? 'var(--color-primary-muted)' : 'var(--color-surface)',
                      color: fitMode === 'contain' ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div>Vừa khung (Contain)</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                      Hiện trọn vẹn toàn bộ ảnh
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: 9-Grid Position & Sliders */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Grid size={14} color="var(--color-primary-light)" />
                  {t('wallpaper.quickPosition') || 'Căn nhanh tiêu điểm 9 góc'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  {posX}% - {posY}%
                </span>
              </div>

              {/* 3x3 Grid Buttons */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px',
                  maxWidth: '220px',
                  margin: '0 auto',
                  width: '100%',
                }}
              >
                {[
                  { label: '↖', x: 0, y: 0, title: 'Trên Trái' },
                  { label: '⬆', x: 50, y: 0, title: 'Trên Giữa' },
                  { label: '↗', x: 100, y: 0, title: 'Trên Phải' },
                  { label: '⬅', x: 0, y: 50, title: 'Giữa Trái' },
                  { label: '⏺', x: 50, y: 50, title: 'Trung Tâm' },
                  { label: '➡', x: 100, y: 50, title: 'Giữa Phải' },
                  { label: '↙', x: 0, y: 100, title: 'Dưới Trái' },
                  { label: '⬇', x: 50, y: 100, title: 'Dưới Giữa' },
                  { label: '↘', x: 100, y: 100, title: 'Dưới Phải' },
                ].map((item, idx) => {
                  const isActive = Math.abs(posX - item.x) < 5 && Math.abs(posY - item.y) < 5;
                  return (
                    <button
                      key={idx}
                      onClick={() => setPresetPosition(item.x, item.y)}
                      title={item.title}
                      style={{
                        height: '32px',
                        borderRadius: '6px',
                        border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        backgroundColor: isActive ? 'var(--color-primary-muted)' : 'var(--color-surface)',
                        color: isActive ? 'var(--color-primary-light)' : 'var(--color-text)',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Horizontal Slider (X) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Căn ngang (X)</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{posX}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={posX}
                  onChange={(e) => handlePosXChange(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                />
              </div>

              {/* Vertical Slider (Y) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Căn dọc (Y)</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{posY}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={posY}
                  onChange={(e) => handlePosYChange(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* Effects Row: Dimming & Blur */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              padding: '14px',
              borderRadius: '10px',
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* Dimming */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                  {t('settings.overlayDimming') || 'Độ tối phủ nền'}
                </span>
                <span style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>
                  {Math.round(opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.3"
                max="0.95"
                step="0.05"
                value={opacity}
                onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
            </div>

            {/* Blur */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                  {t('settings.backgroundBlur') || 'Độ mờ kính (Blur)'}
                </span>
                <span style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>
                  {blur}px
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={blur}
                onChange={(e) => handleBlurChange(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--color-surface-hover)',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Mọi thay đổi được lưu tự động và áp dụng tức thì trên toàn ứng dụng.
          </span>

          <button
            onClick={onClose}
            className="btn-interactive"
            style={{
              padding: '8px 22px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-primary)',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Check size={16} />
            <span>{t('common.done') || 'Hoàn tất & Đóng'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
