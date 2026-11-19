import React, { useState, useEffect } from 'react';
import { Server } from 'lucide-react';

export interface PanelFaviconProps {
  url?: string;
  name?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  fallbackIcon?: React.ReactNode;
}

/**
 * PanelFavicon automatically fetches the panel website favicon
 * with priority sequence:
 * 1. /favicons/favicon.ico (standard Pterodactyl route)
 * 2. /public/favicons/favicon.ico
 * 3. /favicons/favicon.png
 * 4. /favicons/favicon-32x32.png
 * 5. /favicon.ico
 * Gracefully falls back to Server icon on load failure.
 */
export const PanelFavicon: React.FC<PanelFaviconProps> = ({
  url,
  name,
  size = 18,
  className,
  style,
  fallbackIcon,
}) => {
  const cleanUrl = url ? url.trim().replace(/\/+$/, '') : '';

  const candidates = cleanUrl
    ? [
        `${cleanUrl}/favicons/favicon.ico`,
        `${cleanUrl}/public/favicons/favicon.ico`,
        `${cleanUrl}/favicons/favicon.png`,
        `${cleanUrl}/favicons/favicon-32x32.png`,
        `${cleanUrl}/favicon.ico`,
      ]
    : [];

  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    setCurrentIdx(0);
    setHasError(false);
  }, [cleanUrl]);

  if (!cleanUrl || hasError || currentIdx >= candidates.length) {
    if (fallbackIcon) {
      return <>{fallbackIcon}</>;
    }
    return (
      <Server
        size={size}
        color="var(--color-primary-light)"
        className={className}
        style={style}
      />
    );
  }

  return (
    <img
      src={candidates[currentIdx]}
      alt={name ? `${name} icon` : 'Panel Icon'}
      referrerPolicy="no-referrer"
      onError={() => {
        if (currentIdx + 1 < candidates.length) {
          setCurrentIdx((prev) => prev + 1);
        } else {
          setHasError(true);
        }
      }}
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        borderRadius: size > 24 ? '6px' : '4px',
        flexShrink: 0,
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style,
      }}
      loading="lazy"
    />
  );
};
