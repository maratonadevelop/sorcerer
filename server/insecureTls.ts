// IMPORTANT: This module is intentionally side-effectful.
// It is imported very early (before DB/session connections) to optionally
// relax TLS verification in environments that present a self-signed chain.

const env = (k: string) => (process.env[k] || '').trim();

const runningOnRender = !!env('RENDER') || !!env('RENDER_EXTERNAL_URL');

// Opt-in via env, but default to enabled on Render unless explicitly disabled.
// This is a pragmatic workaround for "self-signed certificate in certificate chain".
// Best practice is to provide a valid CA chain instead of disabling verification.
const allow = (() => {
  const v = env('ALLOW_SELF_SIGNED_CERTS').toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return runningOnRender;
})();

if (allow) {
  // Node reads this env var to default rejectUnauthorized=false.
  // This affects ALL outbound TLS connections made by this process.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  // eslint-disable-next-line no-console
  console.warn('[tls] ALLOW_SELF_SIGNED_CERTS enabled: TLS verification disabled (NODE_TLS_REJECT_UNAUTHORIZED=0)');
}
