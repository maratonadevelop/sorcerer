#!/usr/bin/env node
// Register and verify multiple non-admin users with progress output.
import { setTimeout as wait } from 'timers/promises';
import path from 'path';
import fs from 'fs';

// Load DATABASE_URL from .env files similar to server/env.ts so Postgres verification works
function loadLocalEnv() {
  const roots = [
    path.resolve(process.cwd()),
    path.resolve(process.cwd(), 'sorcerer'),
  ];
  const files = ['.env.local', '.env'];
  for (const root of roots) {
    for (const f of files) {
      try {
        const fp = path.join(root, f);
        if (!fs.existsSync(fp)) continue;
        const text = fs.readFileSync(fp, 'utf-8');
        for (const line of text.split(/\r?\n/)) {
          const s = line.trim();
          if (!s || s.startsWith('#')) continue;
          const idx = s.indexOf('=');
          if (idx <= 0) continue;
          const key = s.slice(0, idx).trim();
          let val = s.slice(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!(key in process.env)) process.env[key] = val;
        }
      } catch {}
    }
  }
}

loadLocalEnv();

const BASE = process.env.BASE_URL || 'http://localhost:5000';
const COUNT = Number(process.env.COUNT || process.argv[2] || 3);

function renderBar(step, total, label) {
  const width = 28;
  const filled = Math.max(0, Math.min(width, Math.round((step / total) * width)));
  const empty = width - filled;
  const bar = '[' + '#'.repeat(filled) + '-'.repeat(empty) + ']';
  process.stdout.write(`\r${bar} ${step}/${total} - ${label}`);
}

async function doRequest(pathname, opts = {}) {
  const url = `${BASE}${pathname}`;
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { res, text, json };
}

function extractCookieFromResponse(resp) {
  try {
    const arr = resp.headers.getSetCookie?.();
    if (Array.isArray(arr) && arr.length) {
      return arr.map((s) => String(s).split(';')[0]).join('; ');
    }
  } catch {}
  const sc = resp.headers.get('set-cookie');
  if (!sc) return '';
  return String(sc).split(';')[0];
}


async function verifyUserInPostgres(userId) {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) return { ok: false, reason: 'DATABASE_URL not set' };
    const { default: postgres } = await import('postgres');
    const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1 });
    const rows = await sql`SELECT id, email, is_admin as "isAdmin", password_hash as "passwordHash" FROM users WHERE id = ${userId} LIMIT 1`;
    await sql.end();
    const row = rows && rows[0];
    return { ok: !!row, row };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e) };
  }
}

async function tryWithRetries(fn, attempts = 3, baseDelay = 200) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = baseDelay * Math.pow(2, i);
      await wait(delay);
    }
  }
  throw lastErr;
}

async function runForUser(n, totalUsers) {
  const totalSteps = 4; // register, login, user, db
  let step = 0;
  const ts = Math.floor(Date.now() / 1000) + n; // ensure uniqueness
  const id = `user_smoke_${ts}_${n}`;
  const registerPayload = { id, email: `${id}@example.test`, password: 'password123', firstName: `User ${n}` };
  const loginPayload = { id, password: 'password123' };
  let cookie = '';
    const usePg = true;

  process.stdout.write(`\nUser ${n}/${totalUsers} -> ${id}\n`);

  // 1) Register
  step = 1; renderBar(step, totalSteps, 'Registering');
  const reg = await tryWithRetries(() => doRequest('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(registerPayload)
  }), 3, 250);
  cookie = extractCookieFromResponse(reg.res) || '';
  if (!reg.res.ok) throw new Error(`Register failed: ${reg.res.status} ${reg.text}`);
  await wait(200);

  // 2) Login
  step = 2; renderBar(step, totalSteps, 'Logging in');
  const loginHeaders = { 'content-type': 'application/json' };
  if (cookie) (loginHeaders).cookie = cookie;
  const lg = await tryWithRetries(() => doRequest('/api/login', { method: 'POST', headers: loginHeaders, body: JSON.stringify(loginPayload) }), 2, 200);
  const setCookie2 = extractCookieFromResponse(lg.res);
  if (setCookie2) cookie = cookie ? cookie + '; ' + setCookie2 : setCookie2;
  if (!lg.res.ok) throw new Error(`Login failed: ${lg.res.status} ${lg.text}`);
  await wait(200);

  // 3) /api/auth/user
  step = 3; renderBar(step, totalSteps, 'Fetching user');
  const userReq = await doRequest('/api/auth/user', { method: 'GET', headers: cookie ? { cookie } : {} });
  if (!userReq.res.ok) throw new Error(`/api/auth/user failed: ${userReq.res.status}`);
  const sessionUser = userReq.json;
  const isAdmin = !!(sessionUser && sessionUser.isAdmin);
  if (isAdmin) throw new Error('Expected non-admin user, but session shows isAdmin=true');
  await wait(150);

  // 4) Verify in DB
  step = 4; renderBar(step, totalSteps, 'Verifying DB');
  const verification = await verifyUserInPostgres(id);
  if (!verification.ok) throw new Error('User not found in DB: ' + (verification.reason || 'unknown'));
  await wait(150);

  renderBar(totalSteps, totalSteps, 'Done');
  process.stdout.write(`\n=> OK: ${id}\n`);
  return { id, ok: true };
}

async function main() {
  process.stdout.write(`Starting multi-user smoke test against ${BASE} (COUNT=${COUNT})\n`);
  const results = [];
  for (let i = 1; i <= COUNT; i++) {
    try {
      const r = await runForUser(i, COUNT);
      results.push(r);
    } catch (e) {
      process.stdout.write(`\n=> FAIL user ${i}: ${e?.message || String(e)}\n`);
      results.push({ id: `user_${i}`, ok: false, error: e?.message || String(e) });
    }
  }
  const ok = results.filter(r => r.ok).length;
  const fail = results.length - ok;
  process.stdout.write(`\nSummary: ${ok} passed, ${fail} failed (of ${results.length})\n`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch(err => { console.error('Fatal error:', err); process.exitCode = 10; });
