// MUST be first - force IPv4 before any network modules load
import './ipv4-first';
import './env';
import './insecureTls';
import * as schema from "@shared/schema";
import postgres from 'postgres';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';

// env helpers
const env = (k: string, d?: string) => process.env[k] ?? d ?? '';

const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const runningOnRender = !!process.env.RENDER || !!process.env.RENDER_EXTERNAL_URL;

// Debug: log environment detection
console.log(`RENDER detected: ${runningOnRender ? 'yes' : 'no'}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || '<unset>'}`);
console.log(`DATABASE_URL set: ${process.env.DATABASE_URL ? 'yes (length: ' + process.env.DATABASE_URL.length + ')' : 'no'}`);

const databaseUrl = env('DATABASE_URL', '');
const explicitWriteUrl = env('DATABASE_URL_WRITE', '');

// Helper: detect Postgres URL
const looksLikePostgres = (u: string) => u.startsWith('postgres://') || u.startsWith('postgresql://');

// Helper to mask password in URL for logging (defined early for use in error messages)
const maskDbUrl = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return url.replace(/:\/\/[^@]*@/, '://****@');
  }
};

// Require Postgres in all environments except local dev if explicitly desired.
// This repo is now Postgres-only by request.
const effectiveWriteUrl = explicitWriteUrl || databaseUrl;
if (!effectiveWriteUrl || !looksLikePostgres(effectiveWriteUrl)) {
  console.error('Fatal: DATABASE_URL (or DATABASE_URL_WRITE) must be set to a Postgres connection string.');
  console.error(`Current DATABASE_URL: ${databaseUrl ? maskDbUrl(databaseUrl) : '<empty>'}`);
  process.exit(1);
}

const baseWriteUrl = effectiveWriteUrl;
const baseReadUrl = env('DATABASE_URL_READ', baseWriteUrl);

const ensureParams = (u: string, extra: Record<string, string>) => {
  try {
    const url = new URL(u);
    Object.entries(extra).forEach(([k, v]) => {
      if (!url.searchParams.has(k)) url.searchParams.set(k, v);
    });
    return url.toString();
  } catch {
    return u;
  }
};

// Exports: db (Drizzle instance) and pool (raw connection object)
let db: any;
let pool: any;

// health/circuit state (Postgres path)
let failStreak = 0;
let circuitOpenUntil = 0;
const maxFails = parseInt(env('DB_HEALTH_FAILS_TO_TRIP', '3'), 10);
const openMs = parseInt(env('DB_HEALTH_OPEN_AFTER_MS', '15000'), 10);

// Simple retry with exponential backoff for transient errors
async function withRetry<T>(fn: () => Promise<T>, tries = 2, baseDelayMs = 120): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const transient = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'].includes(err?.code) || /timeout/i.test(err?.message ?? '');
      if (!transient || i === tries - 1) break;
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

{
  // Postgres (Supabase) connection via postgres-js
  // Normalize URLs with pgBouncer and TLS parameters
  // Use pooler by host:port only (e.g., 6543 on Supabase). Do not add unknown params like 'pgbouncer'.
  const writeUrl = ensureParams(baseWriteUrl, { sslmode: 'require' });
  const readUrl = ensureParams(baseReadUrl, { sslmode: 'require' });

  // Force IPv4 to avoid ENETUNREACH errors on some cloud platforms (Render)
  const postgresOptions = {
    ssl: { rejectUnauthorized: env('DB_SSL_STRICT', 'false') === 'true' },
    max: parseInt(env('DB_POOL_MAX', '10'), 10),
    idle_timeout: parseInt(env('DB_IDLE_TIMEOUT_MS', '30000'), 10),
    // Silence benign Postgres NOTICE messages like "relation already exists"
    onnotice: () => {},
    keep_alive: 1,
    // Force IPv4 DNS resolution to avoid IPv6 connectivity issues
    connection: {
      options: '--search_path=public',
    },
  };

  // Add host option to force IPv4 by extracting hostname and using DNS lookup
  const sqlWrite = postgres(writeUrl, {
    ...postgresOptions,
    // Force IPv4 by setting the family option via fetch options
    fetch_types: false,
  });
  const sqlRead = postgres(readUrl, {
    ...postgresOptions,
    max: Math.max(2, Math.floor(parseInt(env('DB_POOL_MAX', '10'), 10) / 2)),
    fetch_types: false,
  });

  // drizzle-orm/postgres-js expects the writer client instance
  db = drizzlePostgres(sqlWrite, { schema });
  pool = sqlWrite;

  // Ensure core schema exists in Postgres (idempotent)
  const ensurePostgresSchema = async () => {
    try {
      // Use TEXT ids to match SQLite shape and avoid uuid extension requirements.
      await sqlWrite`CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        title_i18n TEXT,
        slug TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        content_i18n TEXT,
        excerpt TEXT NOT NULL,
        excerpt_i18n TEXT,
        chapter_number INTEGER NOT NULL,
        arc_number INTEGER,
        arc_title TEXT,
        reading_time INTEGER NOT NULL,
        published_at TEXT NOT NULL,
        image_url TEXT
      )`;
      await sqlWrite`CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_i18n TEXT,
        title TEXT,
        title_i18n TEXT,
        description TEXT,
        story TEXT,
        slug TEXT NOT NULL UNIQUE,
        image_url TEXT,
        role TEXT NOT NULL
      )`;
      await sqlWrite`CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        name_i18n TEXT,
        description_i18n TEXT,
        details TEXT,
        image_url TEXT,
        slug TEXT,
        tags TEXT,
        map_x INTEGER NOT NULL,
        map_y INTEGER NOT NULL,
        type TEXT NOT NULL
      )`;
      await sqlWrite`CREATE TABLE IF NOT EXISTS codex_entries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        title_i18n TEXT,
        description_i18n TEXT,
        content TEXT,
        category TEXT NOT NULL,
        image_url TEXT
      )`;
      await sqlWrite`CREATE TABLE IF NOT EXISTS blog_posts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        title_i18n TEXT,
        slug TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        content_i18n TEXT,
        excerpt TEXT NOT NULL,
        excerpt_i18n TEXT,
        category TEXT NOT NULL,
        published_at TEXT NOT NULL,
        image_url TEXT
      )`;
      await sqlWrite`CREATE TABLE IF NOT EXISTS reading_progress (
        id TEXT PRIMARY KEY,
        chapter_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        last_read_at TEXT NOT NULL
      )`;
      await sqlWrite`CREATE TABLE IF NOT EXISTS audio_tracks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        file_url TEXT NOT NULL,
        loop INTEGER NOT NULL DEFAULT 1,
        volume_default INTEGER NOT NULL DEFAULT 70,
        volume_user_max INTEGER NOT NULL DEFAULT 70,
        fade_in_ms INTEGER,
        fade_out_ms INTEGER,
        created_at TEXT,
        updated_at TEXT
      )`;
      await sqlWrite`CREATE TABLE IF NOT EXISTS audio_assignments (
        id TEXT PRIMARY KEY,
        track_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        priority INTEGER NOT NULL DEFAULT 1,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
      )`;
      await sqlWrite`CREATE INDEX IF NOT EXISTS idx_audio_assign_specific ON audio_assignments(entity_type, entity_id, active, priority)`;
      // Sessions table format required by connect-pg-simple
      await sqlWrite`CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR(255) NOT NULL PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )`;
      await sqlWrite`CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)`;
      await sqlWrite`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        first_name TEXT,
        last_name TEXT,
        profile_image_url TEXT,
        password_hash TEXT,
        is_admin INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      )`;
      await sqlWrite`CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      )`;

      // Best-effort: add missing columns to existing tables (idempotent)
      const addCol = async (table: string, col: string, ddl: string) => {
        try { await sqlWrite.unsafe(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${ddl}`); } catch {}
      };
      await addCol('chapters', 'title_i18n', 'TEXT');
      await addCol('chapters', 'content_i18n', 'TEXT');
      await addCol('chapters', 'excerpt_i18n', 'TEXT');

      await addCol('characters', 'name_i18n', 'TEXT');
      await addCol('characters', 'title_i18n', 'TEXT');

      await addCol('locations', 'name_i18n', 'TEXT');
      await addCol('locations', 'description_i18n', 'TEXT');

      await addCol('codex_entries', 'title_i18n', 'TEXT');
      await addCol('codex_entries', 'description_i18n', 'TEXT');
      await addCol('codex_entries', 'content', 'TEXT');

      await addCol('blog_posts', 'title_i18n', 'TEXT');
      await addCol('blog_posts', 'content_i18n', 'TEXT');
      await addCol('blog_posts', 'excerpt_i18n', 'TEXT');

      await addCol('audio_tracks', 'volume_user_max', 'INTEGER NOT NULL DEFAULT 70');
      await addCol('users', 'password_hash', 'TEXT');
    } catch (e) {
      console.warn('Failed to ensure Postgres schema (will continue):', e);
    }
  };

  // Exported init to apply session-level settings and log targets
  async function initPostgres() {
    // Session timeouts (statement and idle in xact)
    const stmtMs = parseInt(env('DB_STMT_TIMEOUT_MS', '15000'), 10);
    const idleTxMs = parseInt(env('DB_IDLE_TX_TIMEOUT_MS', '15000'), 10);
    try {
      await withRetry(async () => {
        // Note: SET does not accept parameters; embed validated integers directly
        await sqlWrite.unsafe(`set statement_timeout = ${Math.max(0, Number.isFinite(stmtMs) ? stmtMs : 15000)}`);
        await sqlWrite.unsafe(`set idle_in_transaction_session_timeout = ${Math.max(0, Number.isFinite(idleTxMs) ? idleTxMs : 15000)}`);
        await sqlWrite.unsafe(`set lock_timeout = 5000`);
      });
    } catch (e) {
      console.warn('Could not apply session timeouts (v2):', (e as any)?.message || e);
    }

    await ensurePostgresSchema();

    /* eslint-disable no-console */
    console.log(`Using database (write): ${maskDbUrl(writeUrl)}`);
    if (readUrl !== writeUrl) console.log(`Using database (read) : ${maskDbUrl(readUrl)}`);
    console.log('Connected to Postgres (Supabase)');
    /* eslint-enable no-console */
  }

  // Attach helpers on pool for ping operations
  (pool as any)._sqlRead = sqlRead;

  // Provide exported init for index.ts
  (pool as any)._init = initPostgres;
}

// Health helpers for /ready
export async function dbReadyPing(): Promise<boolean> {
  try {
    const read = (pool as any)?._sqlRead || pool;
    await withRetry(() => read`select 1`, 2);
    failStreak = 0;
    return true;
  } catch {
    failStreak++;
    if (failStreak >= maxFails) circuitOpenUntil = Date.now() + (parseInt(env('DB_HEALTH_OPEN_AFTER_MS', '15000'), 10));
    return false;
  }
}

export function dbCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

export async function dbInit() {
  if ((pool as any)?._init) {
    await (pool as any)._init();
  }
}

export async function dbClose() {
  try { if (pool?.end) await pool.end(); } catch {}
}

export { db, pool };


