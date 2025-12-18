#!/usr/bin/env node
// Improved end-to-end smoke test with retries and a small terminal progress bar
import { setTimeout as wait } from 'timers/promises';
import path from 'path';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:5000';

function renderBar(step, total, label) {
  const width = 28;
  const filled = Math.round((step / total) * width);
  const empty = width - filled;
  const bar = '[' + '#'.repeat(filled) + '-'.repeat(empty) + ']';
  process.stdout.write(`\r${bar} ${step}/${total} - ${label}`);
}

async function doRequest(path, opts = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
  return { res, text, json };
}

function extractCookieFromResponse(resp) {
  // Prefer Node's getSetCookie (undici) when available
  try {
    const arr = resp.headers.getSetCookie?.();
    if (Array.isArray(arr) && arr.length) {
      return arr.map((s) => String(s).split(';')[0]).join('; ');
    }
  } catch {}
  const sc = resp.headers.get('set-cookie');
  if (!sc) return '';
  // Take only the first cookie's name=value pair; avoids issues with commas in Expires
  return String(sc).split(';')[0];
}

async function verifyUserInLocalSqlite(userId) {
  // Check sorcerer/dev.sqlite for the user
  try {
    const dbPath = path.resolve(process.cwd(), 'sorcerer', 'dev.sqlite');
    if (!fs.existsSync(dbPath)) return { ok: false, reason: 'sqlite file not found' };
    const { default: BetterSqlite3 } = await import('better-sqlite3');
    const db = new BetterSqlite3(dbPath, { readonly: true });
    const row = db.prepare('SELECT id, email, is_admin as isAdmin, password_hash as passwordHash FROM users WHERE id = ? LIMIT 1').get(userId);
    return { ok: !!row, row };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e) };
  }
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

async function main() {
  const total = 4;
  let step = 0;

  const ts = Math.floor(Date.now() / 1000);
  const id = `smoke_test_${ts}`;
  const registerPayload = { id, email: `${id}@example.test`, password: 'password123', firstName: 'Smoke' };
  const loginPayload = { id, password: 'password123' };

  process.stdout.write('\nStarting smoke E2E test against ' + BASE + '\n');

  // Step 1: register (with retries)
  step = 1; renderBar(step, total, 'Registering');
  let cookie = '';
  let reg;
  try {
    reg = await tryWithRetries(() => doRequest('/api/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(registerPayload)
    }), 3, 250);
  } catch (err) {
    process.stdout.write('\n\nRegister request failed: ' + String(err) + '\n');
    // proceed to try login below
  }

  if (reg) {
    const setCookie = extractCookieFromResponse(reg.res);
    cookie = setCookie || '';
    if (!reg.res.ok) {
      const body = reg.json ?? reg.text;
      process.stdout.write('\n\nRegister returned ' + reg.res.status + ': ' + (typeof body === 'string' ? body : JSON.stringify(body)) + '\n');
      // don't exit here — try login in case user already exists or session fallback is enabled
    } else {
      renderBar(step, total, 'Registered');
      await wait(300);
    }
  }

  // Step 2: login (use cookie if set by register, otherwise try credentials)
  step = 2; renderBar(step, total, 'Logging in');
  let lg;
  try {
    const loginOpts = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(loginPayload) };
    if (cookie) loginOpts.headers = { ...loginOpts.headers, cookie };
    lg = await tryWithRetries(() => doRequest('/api/login', loginOpts), 2, 200);
  } catch (err) {
    process.stdout.write('\n\nLogin request failed: ' + String(err) + '\n');
    process.exitCode = 3; return;
  }

  const setCookie2 = extractCookieFromResponse(lg.res);
  if (setCookie2) {
    const more = setCookie2;
    if (more) cookie = cookie ? cookie + '; ' + more : more;
  }

  if (!lg.res.ok) {
    const body = lg.json ?? lg.text;
    process.stdout.write('\n\nLogin returned ' + lg.res.status + ': ' + (typeof body === 'string' ? body : JSON.stringify(body)) + '\n');
    process.exitCode = 3; return;
  }

  renderBar(step, total, 'Logged in');
  await wait(300);

  // Step 3: fetch auth user
  step = 3; renderBar(step, total, 'Fetching /api/auth/user');
  const userReqOpts = { method: 'GET', headers: {} };
  if (cookie) userReqOpts.headers.cookie = cookie;
  const userResp = await doRequest('/api/auth/user', userReqOpts);
  await wait(200);

  if (!userResp.res.ok) {
    const body = userResp.json ?? userResp.text;
    process.stdout.write('\n\nFetching /api/auth/user failed: ' + userResp.res.status + ' - ' + (typeof body === 'string' ? body : JSON.stringify(body)) + '\n');
    process.exitCode = 4; return;
  }

  renderBar(step, total, 'Done');
  process.stdout.write('\n\nAuthenticated user:\n');
  process.stdout.write(JSON.stringify(userResp.json, null, 2) + '\n');

  // Step 4: verify user exists in DB (prefer Postgres when configured)
  step = 4; renderBar(step, total, 'Verifying DB user');
  const usePg = !!process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:') && !process.env.DATABASE_URL.includes('sqlite');
  const dbCheck = usePg ? await verifyUserInPostgres(id) : await verifyUserInLocalSqlite(id);
  process.stdout.write('\n\nDB user check: ' + (dbCheck.ok ? 'FOUND' : 'NOT FOUND') + '\n');
  if (!dbCheck.ok && dbCheck.reason) process.stdout.write('Reason: ' + dbCheck.reason + '\n');
  if (dbCheck.ok) process.stdout.write('Row: ' + JSON.stringify(dbCheck.row) + '\n');
  process.exitCode = 0;
}

main().catch(err => { console.error('\nError during smoke test:', err); process.exitCode = 10; });
