#!/usr/bin/env node
// E2E: Exercise Settings flows end-to-end
// Steps:
// - register user
// - login
// - GET /api/user/profile
// - PUT /api/user/profile (name/email)
// - POST /api/user/upload (tiny base64 png)
// - PUT /api/user/profile (profileImageUrl)
// - POST /api/auth/change-password
// - POST /api/logout and POST /api/login with new password
// - GET /api/auth/user and validate fields
// - If DATABASE_URL present, verify persisted columns in Postgres

import path from 'path';
import fs from 'fs';
import { setTimeout as wait } from 'timers/promises';

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
const API_BASE = process.env.API_BASE || 'http://localhost:5000';

function bar(step, total, label) {
  const width = 30;
  const filled = Math.max(0, Math.min(width, Math.round((step / total) * width)));
  const empty = width - filled;
  process.stdout.write(`\r[${'#'.repeat(filled)}${'-'.repeat(empty)}] ${step}/${total} ${label}`);
}

async function req(pathname, opts = {}) {
  const base = pathname.startsWith('/api') ? API_BASE : BASE;
  const url = `${base}${pathname}`;
  const headers = { 'accept': 'application/json', ...(opts.headers || {}) };
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  // If an API endpoint unexpectedly returns HTML, surface helpful context
  const ctype = res.headers.get('content-type') || '';
  if (pathname.startsWith('/api') && ctype.includes('text/html')) {
    console.warn(`WARN: ${pathname} responded with HTML from ${base}.`);
  }
  return { res, text, json };
}

function getSetCookie(resp) {
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

async function verifyInPostgres(userId) {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) return { ok: false, reason: 'DATABASE_URL not set' };
    const { default: postgres } = await import('postgres');
    const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1 });
    const rows = await sql`SELECT id, email, first_name as "firstName", last_name as "lastName", profile_image_url as "profileImageUrl" FROM users WHERE id = ${userId} LIMIT 1`;
    await sql.end();
    const row = rows && rows[0];
    return { ok: !!row, row };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e) };
  }
}

async function main() {
  const total = 10;
  let step = 0;
  const ts = Math.floor(Date.now() / 1000);
  const id = `settings_user_${ts}`;
  const email1 = `${id}@example.test`;
  const email2 = `${id}+new@example.test`;
  const pass1 = 'password123';
  const pass2 = 'password456';
  const first1 = 'Primeiro';
  const last1 = 'Usuario';
  const first2 = 'NomeAtualizado';
  const last2 = 'SobrenomeAtualizado';

  // 1x1 PNG transparent
  const tinyPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMB9p5cXj8AAAAASUVORK5CYII=';

  process.stdout.write(`Running settings E2E against ${BASE}\n`);

  // Register
  step = 1; bar(step, total, 'register');
  const reg = await req('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, email: email1, password: pass1, firstName: first1, lastName: last1 }) });
  if (!reg.res.ok) throw new Error(`register failed: ${reg.res.status} ${reg.text}`);
  let cookie = getSetCookie(reg.res) || '';
  await wait(150);

  // Login
  step = 2; bar(step, total, 'login');
  const lg = await req('/api/login', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ id, password: pass1 }) });
  if (!lg.res.ok) throw new Error(`login failed: ${lg.res.status} ${lg.text}`);
  const setCookie2 = getSetCookie(lg.res);
  if (setCookie2) cookie = cookie ? cookie + '; ' + setCookie2 : setCookie2;
  await wait(150);

  // GET profile
  step = 3; bar(step, total, 'get profile');
  const prof1 = await req('/api/user/profile', { headers: cookie ? { cookie } : {} });
  if (!prof1.res.ok) throw new Error(`profile get failed: ${prof1.res.status}`);
  await wait(100);

  // PUT profile (name/email)
  step = 4; bar(step, total, 'update profile');
  const upd1 = await req('/api/user/profile', { method: 'PUT', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ firstName: first2, lastName: last2, email: email2 }) });
  if (!upd1.res.ok) throw new Error(`profile update failed: ${upd1.res.status} ${upd1.text}`);
  await wait(120);

  // Upload avatar
  step = 5; bar(step, total, 'upload avatar');
  const upload = await req('/api/user/upload', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ filename: 'avatar.png', data: `data:image/png;base64,${tinyPngBase64}` }) });
  const ctype = upload.res.headers.get('content-type') || '';
  if (!upload.res.ok || !ctype.includes('application/json') || !upload.json?.url) throw new Error(`upload failed: ${upload.res.status} ${upload.text}`);
  const avatarUrl = upload.json.url;
  await wait(120);

  // PUT profile (avatar url)
  step = 6; bar(step, total, 'set avatar');
  const upd2 = await req('/api/user/profile', { method: 'PUT', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ profileImageUrl: avatarUrl }) });
  if (!upd2.res.ok) throw new Error(`profile set avatar failed: ${upd2.res.status} ${upd2.text}`);
  await wait(120);

  // Change password
  step = 7; bar(step, total, 'change password');
  const chg = await req('/api/auth/change-password', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ currentPassword: pass1, newPassword: pass2 }) });
  if (!chg.res.ok) throw new Error(`change-password failed: ${chg.res.status} ${chg.text}`);
  await wait(120);

  // Logout
  step = 8; bar(step, total, 'logout');
  const lo = await req('/api/logout', { method: 'POST', headers: cookie ? { cookie } : {} });
  if (!lo.res.ok) throw new Error(`logout failed: ${lo.res.status}`);
  cookie = '';
  await wait(100);

  // Login with new password
  step = 9; bar(step, total, 'login new pass');
  const lg2 = await req('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, password: pass2 }) });
  if (!lg2.res.ok) throw new Error(`re-login failed: ${lg2.res.status} ${lg2.text}`);
  cookie = getSetCookie(lg2.res) || '';
  await wait(120);

  // GET /api/auth/user and verify fields
  step = 10; bar(step, total, 'verify session');
  const me = await req('/api/auth/user', { headers: cookie ? { cookie } : {} });
  if (!me.res.ok) throw new Error(`auth/user failed: ${me.res.status}`);
  const su = me.json || {};
  if (su.firstName !== first2 || su.lastName !== last2) throw new Error('name not updated in session');
  if (!su.profileImageUrl || typeof su.profileImageUrl !== 'string') throw new Error('avatar not present in session');

  // Verify in Postgres when configured
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('sqlite')) {
    const db = await verifyInPostgres(id);
    if (!db.ok) throw new Error('not found in DB: ' + (db.reason || 'unknown'));
    const row = db.row;
    if (row.firstName !== first2 || row.lastName !== last2) throw new Error('DB name not updated');
    if (!row.profileImageUrl || typeof row.profileImageUrl !== 'string') throw new Error('DB avatar not set');
  }

  process.stdout.write(`\nOK settings flow for ${id}\n`);
}

main().catch((e) => { console.error('\nE2E settings failed:', e?.message || String(e)); process.exitCode = 1; });
