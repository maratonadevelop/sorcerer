import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env vars from multiple common locations, prioritizing nearer files (nearest wins).
// This lets us keep .env.local at the workspace root or inside the app folder.
try {
  const cwd = process.cwd();
  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  const runningOnRender = !!process.env.RENDER || !!process.env.RENDER_EXTERNAL_URL;
  // In production (especially Render), never load local .env files.
  // Those files are for dev only and can accidentally force DATABASE_URL=file:./dev.sqlite.
  if (isProduction || runningOnRender) {
    // Best effort; keep server running with process.env
    // eslint-disable-next-line no-empty
  } else {
    const allowOverride = true;

    // Load parent first, then current; and load .env before .env.local so .env.local overrides.
    const candidates = [
      // parent (workspace root)
      path.resolve(cwd, '..', '.env'),
      path.resolve(cwd, '..', '.env.local'),
      // current (app folder)
      path.resolve(cwd, '.env'),
      path.resolve(cwd, '.env.local'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const parsed = dotenv.parse(fs.readFileSync(p));
        for (const [k, v] of Object.entries(parsed)) {
          if (allowOverride || process.env[k] === undefined) process.env[k] = v;
        }
      }
    }
  }
} catch (e) {
  // Best effort; keep server running with process.env
}
