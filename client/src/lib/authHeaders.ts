export function authHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...(extra || {}) };
  try {
    if (import.meta.env.DEV) {
      const tok = typeof window !== 'undefined' ? localStorage.getItem('devToken') : null;
      if (tok) headers['Authorization'] = `Bearer ${tok}`;
    }
  } catch {}
  return headers;
}
