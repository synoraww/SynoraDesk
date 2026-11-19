import React from 'react';
import { Trash2, ArrowDown, Search, ExternalLink } from 'lucide-react';

// Standard 16 ANSI colors (Normal + Bright)
const ANSI_COLORS: { [key: number]: string } = {
  30: '#94A3B8', // Black re-tuned to visible slate (anti-black on dark background)
  31: '#EF4444', // Red
  32: '#22C55E', // Green
  33: '#F59E0B', // Yellow
  34: '#3B82F6', // Blue
  35: '#A855F7', // Magenta
  36: '#06B6D4', // Cyan
  37: '#F1F5F9', // White
  90: '#94A3B8', // Bright Black / Gray
  91: '#F87171', // Bright Red
  92: '#4ADE80', // Bright Green
  93: '#FDE047', // Bright Yellow
  94: '#60A5FA', // Bright Blue
  95: '#C084FC', // Bright Magenta
  96: '#22D3EE', // Bright Cyan
  97: '#FFFFFF', // Bright White
};

interface TextSegment {
  text: string;
  color?: string;
  bgColor?: string;
  bold?: boolean;
  underline?: boolean;
}

/**
 * Intelligent contrast tuner to ensure ANSI text is NEVER invisible on dark or light backgrounds
 */
function tuneColorContrast(colorStr: string): string {
  if (!colorStr) return 'var(--color-text)';

  // If black or very dark gray, lift it to visible slate
  if (colorStr === '#000000' || colorStr === '#1E293B' || colorStr === '#0F172A') {
    return '#94A3B8';
  }

  return colorStr;
}

/**
 * Parses ANSI escape sequences into styled text segments with background & text styling
 */
export function parseAnsi(rawText: string): TextSegment[] {
  // Strip non-color control sequences (e.g. cursor moves, clear screen, screen erase)
  const text = rawText.replace(/(?:\u001b|\x1b)\[[0-9;]*[a-ln-zA-Z]/g, '');

  // Match color SGR codes: \u001b[...m or \u001b[m
  const regex = /(?:\u001b|\x1b)\[([0-9;]*)m/g;
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let currentColor: string | undefined = undefined;
  let currentBgColor: string | undefined = undefined;
  let isBold = false;
  let isUnderline = false;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        color: currentColor,
        bgColor: currentBgColor,
        bold: isBold,
        underline: isUnderline,
      });
    }

    const codeStr = match[1];
    if (!codeStr || codeStr === '0') {
      // \u001b[m or \u001b[0m is reset
      currentColor = undefined;
      currentBgColor = undefined;
      isBold = false;
      isUnderline = false;
    } else {
      const codes = codeStr.split(';').map(Number);
      for (let i = 0; i < codes.length; i++) {
        const code = codes[i];
        if (code === 0) {
          currentColor = undefined;
          currentBgColor = undefined;
          isBold = false;
          isUnderline = false;
        } else if (code === 1) {
          isBold = true;
        } else if (code === 4) {
          isUnderline = true;
        } else if (code === 22) {
          isBold = false;
        } else if (code === 24) {
          isUnderline = false;
        } else if (code === 39) {
          currentColor = undefined;
        } else if (code === 49) {
          currentBgColor = undefined;
        } else if (ANSI_COLORS[code]) {
          currentColor = tuneColorContrast(ANSI_COLORS[code]);
        } else if (code >= 40 && code <= 47) {
          // Standard Background Colors (40-47)
          const fgCode = code - 10;
          currentBgColor = ANSI_COLORS[fgCode];
        } else if (code === 38 && codes[i + 1] === 5 && codes[i + 2] !== undefined) {
          // 256 colors foreground: 38;5;n
          const colorCode = codes[i + 2];
          if (colorCode < 16 && ANSI_COLORS[colorCode + 30]) {
            currentColor = tuneColorContrast(ANSI_COLORS[colorCode + 30]);
          } else {
            currentColor = '#38BDF8';
          }
          i += 2;
        } else if (code === 48 && codes[i + 1] === 5 && codes[i + 2] !== undefined) {
          // 256 colors background: 48;5;n
          currentBgColor = 'rgba(255, 255, 255, 0.1)';
          i += 2;
        } else if (code === 38 && codes[i + 1] === 2 && codes[i + 4] !== undefined) {
          // 24-bit TrueColor: 38;2;r;g;b
          const r = codes[i + 2];
          const g = codes[i + 3];
          const b = codes[i + 4];
          currentColor = `rgb(${r}, ${g}, ${b})`;
          i += 4;
        }
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      color: currentColor,
      bgColor: currentBgColor,
      bold: isBold,
      underline: isUnderline,
    });
  }

  return segments;
}

/**
 * Render text with clickable URL links
 */
const RenderWithLinks: React.FC<{ text: string }> = ({ text }) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <>
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noreferrer"
              style={{
                color: 'var(--color-primary-light)',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </>
  );
};

/**
 * Checks if line contains ANSI codes; if not, applies intelligent log-level coloring & contrast
 */
export const ColorizedLine: React.FC<{ line: string }> = ({ line }) => {
  // If line has ANSI escape codes, parse them directly
  if (line.includes('\u001b') || line.includes('\x1b')) {
    const segments = parseAnsi(line);
    return (
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
          lineHeight: 1.38,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          minHeight: '17px',
          letterSpacing: '0px',
        }}
      >
        {segments.map((seg, i) => (
          <span
            key={i}
            style={{
              color: seg.color || 'var(--color-text)',
              backgroundColor: seg.bgColor,
              fontWeight: seg.bold ? 700 : 400,
              textDecoration: seg.underline ? 'underline' : 'none',
              padding: seg.bgColor ? '0 2px' : undefined,
              borderRadius: seg.bgColor ? '2px' : undefined,
            }}
          >
            <RenderWithLinks text={seg.text} />
          </span>
        ))}
      </div>
    );
  }

  // Automatic semantic coloring based on log content
  const lower = line.toLowerCase();
  let defaultColor = 'var(--color-text)'; // Default text color
  let bgColor: string | undefined = undefined;
  let isImportant = false;

  if (line.startsWith('> ')) {
    // User sent command
    defaultColor = '#60A5FA'; // Bright blue
    isImportant = true;
  } else if (
    lower.includes('error') ||
    lower.includes('fatal') ||
    lower.includes('exception') ||
    lower.includes('severe') ||
    lower.includes('crash') ||
    lower.includes('failed')
  ) {
    defaultColor = '#F87171'; // Light red
    bgColor = 'rgba(239, 68, 68, 0.08)';
  } else if (
    lower.includes('warn') ||
    lower.includes('warning')
  ) {
    defaultColor = '#FBBF24'; // Warm amber
    bgColor = 'rgba(245, 158, 11, 0.06)';
  } else if (
    lower.includes('info') ||
    lower.includes('[info]')
  ) {
    defaultColor = '#38BDF8'; // Sky blue
  } else if (
    lower.includes('success') ||
    lower.includes('done') ||
    lower.includes('listening on') ||
    lower.includes('started') ||
    lower.includes('ready')
  ) {
    defaultColor = '#4ADE80'; // Emerald green
  } else if (
    lower.includes('debug') ||
    lower.includes('trace')
  ) {
    defaultColor = '#94A3B8'; // Slate
  }

  // Highlight timestamps if in [HH:MM:SS] format
  const timestampRegex = /^(\[\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?\]|\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/i;
  const tsMatch = line.match(timestampRegex);

  if (tsMatch) {
    const timestamp = tsMatch[0];
    const rest = line.slice(timestamp.length);
    return (
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
          lineHeight: 1.38,
          backgroundColor: bgColor,
          padding: bgColor ? '1px 4px' : undefined,
          borderRadius: bgColor ? '3px' : undefined,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          minHeight: '17px',
          letterSpacing: '0px',
        }}
      >
        <span style={{ color: '#818CF8', fontWeight: 600 }}>{timestamp}</span>
        <span style={{ color: defaultColor, fontWeight: isImportant ? 600 : 400 }}>
          <RenderWithLinks text={rest} />
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
        lineHeight: 1.38,
        color: defaultColor,
        backgroundColor: bgColor,
        padding: bgColor ? '1px 4px' : undefined,
        borderRadius: bgColor ? '3px' : undefined,
        fontWeight: isImportant ? 600 : 400,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        minHeight: '17px',
        letterSpacing: '0px',
      }}
    >
      <RenderWithLinks text={line} />
    </div>
  );
};

/**
 * Smart Minimalist Console Toolbar Component with Clear, Auto-scroll, and Search
 */
interface ConsoleToolbarProps {
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  onClear: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const ConsoleToolbar: React.FC<ConsoleToolbarProps> = ({
  autoScroll,
  onToggleAutoScroll,
  onClear,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 10px',
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        fontSize: '11px',
        gap: '8px',
      }}
    >
      {/* Search Bar - Sleek & Compact */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'var(--color-surface-hover)',
          borderRadius: '5px',
          padding: '3px 8px',
          border: '1px solid var(--color-border)',
          maxWidth: '200px',
          flex: 1,
        }}
      >
        <Search size={12} color="var(--color-text-muted)" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Lọc log..."
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--color-text)',
            fontSize: '11px',
            width: '100%',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 0 }}
          >
            ×
          </button>
        )}
      </div>

      {/* Action Buttons: Minimalist Icons Only */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        {/* Toggle Auto-scroll Icon */}
        <button
          type="button"
          onClick={onToggleAutoScroll}
          className="btn-interactive"
          title={autoScroll ? 'Tự cuộn đang bật (Nhấn để tắt)' : 'Tự cuộn đang tắt (Nhấn để bật)'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            borderRadius: '5px',
            backgroundColor: autoScroll ? 'var(--color-primary-muted)' : 'var(--color-surface-hover)',
            border: `1px solid ${autoScroll ? 'var(--color-primary)' : 'var(--color-border)'}`,
            color: autoScroll ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          <ArrowDown size={13} />
        </button>

        {/* Clear Console Icon */}
        <button
          type="button"
          onClick={onClear}
          className="btn-interactive"
          title="Xóa trắng màn hình console"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            borderRadius: '5px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: 'var(--color-error)',
            cursor: 'pointer',
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};
