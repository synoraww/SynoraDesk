import { useState, useEffect } from 'react';

export interface FileClipboardItem {
  action: 'copy' | 'cut';
  serverIdentifier: string;
  sourceDir: string;
  path: string;
  name: string;
  isDir: boolean;
}

const STORAGE_KEY = 'pterodesk_file_clipboard';

export function getFileClipboard(): FileClipboardItem | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setFileClipboard(item: FileClipboardItem | null) {
  try {
    if (!item) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(item));
    }
  } catch {}
  window.dispatchEvent(new CustomEvent('pterodesk_file_clipboard', { detail: item }));
}

export function clearFileClipboard() {
  setFileClipboard(null);
}

export function useFileClipboard(): FileClipboardItem | null {
  const [clipboard, setClipboard] = useState<FileClipboardItem | null>(() => getFileClipboard());

  useEffect(() => {
    const handleChange = () => {
      setClipboard(getFileClipboard());
    };
    window.addEventListener('pterodesk_file_clipboard', handleChange);
    window.addEventListener('storage', handleChange);
    return () => {
      window.removeEventListener('pterodesk_file_clipboard', handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);

  return clipboard;
}
