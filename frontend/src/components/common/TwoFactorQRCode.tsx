import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, AlertCircle, RefreshCw } from 'lucide-react';

interface TwoFactorQRCodeProps {
  imageUrlData?: string;
  secret: string;
  accountEmail?: string;
  accountUsername?: string;
  panelName?: string;
  size?: number;
}

export const TwoFactorQRCode: React.FC<TwoFactorQRCodeProps> = ({
  imageUrlData,
  secret,
  accountEmail,
  accountUsername,
  panelName,
  size = 160,
}) => {
  const [imgError, setImgError] = useState(false);

  // Normalize issuer and account identifiers
  const issuer = (panelName || 'Pterodactyl').replace(/[:\/\\]/g, '').trim() || 'Pterodactyl';
  const accountId = (accountEmail || accountUsername || 'user').replace(/[:\/\\]/g, '').trim() || 'user';

  // Construct standard OTPAuth URL
  const fallbackOtpauth = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountId)}?secret=${encodeURIComponent(secret || '')}&issuer=${encodeURIComponent(issuer)}`;

  // Determine what to render
  const rawData = (imageUrlData || '').trim();

  // If rawData is an otpauth URI, use it directly for QR generation
  const isOtpauth = rawData.toLowerCase().startsWith('otpauth://');
  const qrValue = isOtpauth ? rawData : fallbackOtpauth;

  // Check if rawData is a valid image URL (data:image/ or http/https) and not in error state
  const isDataOrHttpImg =
    !imgError &&
    (rawData.startsWith('data:image/png') ||
      rawData.startsWith('data:image/jpeg') ||
      rawData.startsWith('data:image/svg+xml') ||
      rawData.startsWith('http://') ||
      rawData.startsWith('https://'));

  // Check if rawData is raw SVG markup
  const isRawSvg = rawData.startsWith('<svg') && rawData.endsWith('</svg>');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          padding: '12px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          width: `${size + 24}px`,
          height: `${size + 24}px`,
          boxSizing: 'border-box',
        }}
      >
        {isDataOrHttpImg ? (
          <img
            src={rawData}
            alt="2FA QR Code"
            onError={() => setImgError(true)}
            style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain' }}
          />
        ) : isRawSvg ? (
          <div
            dangerouslySetInnerHTML={{ __html: rawData }}
            style={{ width: `${size}px`, height: `${size}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          />
        ) : secret || isOtpauth ? (
          <QRCodeSVG
            value={qrValue}
            size={size}
            bgColor="#FFFFFF"
            fgColor="#000000"
            level="M"
            marginSize={0}
          />
        ) : (
          <div
            style={{
              width: `${size}px`,
              height: `${size}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666666',
              gap: '6px',
            }}
          >
            <AlertCircle size={28} color="#ef4444" />
            <span style={{ fontSize: '11px', textAlign: 'center' }}>No QR Data</span>
          </div>
        )}
      </div>
      <span
        style={{
          fontSize: '11px',
          color: 'var(--color-text-muted)',
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <QrCode size={12} /> Scan with Google Authenticator, Authy or 1Password
      </span>
    </div>
  );
};
