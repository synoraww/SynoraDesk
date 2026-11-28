export function isSafeHttpUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function openSafeExternalUrl(rawUrl: string): boolean {
  if (!isSafeHttpUrl(rawUrl)) {
    return false;
  }
  const safeUrl = rawUrl.trim();
  // @ts-ignore
  const runtime = window.runtime;
  if (runtime?.BrowserOpenURL) {
    runtime.BrowserOpenURL(safeUrl);
    return true;
  }
  window.open(safeUrl, '_blank', 'noopener,noreferrer');
  return true;
}
