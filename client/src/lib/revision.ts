// Simple client-side content revision tag to bust HTTP cache after admin edits
// Stored in localStorage so it persists across navigations and tabs.

const KEY = 'contentRev';

export function getRevision(): string {
  try {
    const v = localStorage.getItem(KEY);
    if (v) return v;
  } catch {}
  // Initialize with current timestamp if missing
  const init = String(Date.now());
  try { localStorage.setItem(KEY, init); } catch {}
  return init;
}

export function bumpRevision(): string {
  const next = String(Date.now());
  try { localStorage.setItem(KEY, next); } catch {}
  return next;
}

export function withRevisionParam(url: string, rev?: string): string {
  const r = rev || getRevision();
  if (!url) return url;
  try {
    const u = new URL(url, window.location.origin);
    // Only append to API GETs we control
    u.searchParams.set('v', r);
    return u.pathname + u.search;
  } catch {
    // Fallback for relative URLs without base
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${encodeURIComponent(r)}`;
  }
}
