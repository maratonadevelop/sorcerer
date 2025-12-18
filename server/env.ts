import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env vars from multiple common locations, prioritizing nearer files (nearest wins).
// This lets us keep .env.local at the workspace root or inside the app folder.
try {
  const cwd = process.cwd();
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
      dotenv.config({ path: p, override: true });
    }
  }
} catch (e) {
  // Best effort; keep server running with process.env
}
