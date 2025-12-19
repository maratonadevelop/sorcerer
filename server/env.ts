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
  // Those files are for dev only and can accidentally override DATABASE_URL.
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

    // Optional: local migration env (gitignored). Load LAST and override so you can
    // force Postgres DATABASE_URL for dev without touching .env.local.
    try {
      const migrateCandidates = [
        path.resolve(cwd, '.env.migrate.local'),
        path.resolve(cwd, '.env.migrate'),
      ];
      for (const p of migrateCandidates) {
        if (fs.existsSync(p)) {
          const parsed = dotenv.parse(fs.readFileSync(p));
          for (const [k, v] of Object.entries(parsed)) {
            process.env[k] = v;
          }
        }
      }
    } catch {
      // ignore
    }
  }
} catch (e) {
  // Best effort; keep server running with process.env
}
