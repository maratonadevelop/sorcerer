import './env';
import * as schema from "@shared/schema";
import { randomUUID } from 'crypto';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import postgres from 'postgres';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';

// env helpers
const env = (k: string, d?: string) => process.env[k] ?? d ?? '';

// Determine DB targets: prefer explicit WRITE/READ URLs; fallback to DATABASE_URL or SQLite.
// IMPORTANT: On Render we rely on DB_PATH (e.g. /data/database.sqlite) for SQLite deployments.
const runningOnRender = !!process.env.RENDER || !!process.env.RENDER_EXTERNAL_URL;
const sqlitePath = env('DB_PATH', '') || (runningOnRender ? '/data/database.sqlite' : '');
const sqliteFallbackUrl = sqlitePath
  ? (sqlitePath.startsWith('file:') ? sqlitePath : `file:${sqlitePath}`)
  : 'file:./dev.sqlite';

const looksLikeDefaultDevSqlite = (u: string) => {
  const raw = (u || '').trim();
  if (!raw) return false;
  const normalized = raw.replace(/^file:/, '');
  return normalized === './dev.sqlite' || normalized === 'dev.sqlite' || normalized.endsWith('/dev.sqlite') || normalized.endsWith('\\dev.sqlite');
};

const databaseUrl = env('DATABASE_URL', '');
const explicitWriteUrl = env('DATABASE_URL_WRITE', '');

// If DB_PATH is configured and DATABASE_URL is empty or still pointing at the local default,
// prefer DB_PATH so Render SQLite deployments don't accidentally use ./dev.sqlite.
const inferredWriteUrl = (sqlitePath && (!databaseUrl || looksLikeDefaultDevSqlite(databaseUrl)))
  ? sqliteFallbackUrl
  : (databaseUrl || sqliteFallbackUrl);

const baseWriteUrl = explicitWriteUrl || inferredWriteUrl;
const baseReadUrl = env('DATABASE_URL_READ', baseWriteUrl);

const maskDbUrl = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return url.replace(/:\/\/.*@/, '://****@');
  }
};

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

// Helper: detect sqlite vs postgres (based on write URL)
const isSqlite = baseWriteUrl.startsWith('file:') || baseWriteUrl.includes('sqlite');

// Shared SQLite schema bootstrap (kept for local dev)
const ensureSqliteSchema = (dbInst: any) => {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS chapters (
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
    );`,
    `CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_i18n TEXT,
      title TEXT NOT NULL,
      title_i18n TEXT,
  description TEXT NOT NULL,
  story TEXT,
  slug TEXT NOT NULL UNIQUE,
  image_url TEXT,
  role TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_i18n TEXT,
      description TEXT NOT NULL,
      description_i18n TEXT,
      details TEXT,
      image_url TEXT,
      slug TEXT,
      tags TEXT,
      map_x INTEGER NOT NULL,
      map_y INTEGER NOT NULL,
      type TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS codex_entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      title_i18n TEXT,
      description TEXT NOT NULL,
      description_i18n TEXT,
      content TEXT,
      category TEXT NOT NULL,
      image_url TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS blog_posts (
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
    );`,
    `CREATE TABLE IF NOT EXISTS reading_progress (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      last_read_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS audio_tracks (
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
    );`,
    `CREATE TABLE IF NOT EXISTS audio_assignments (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      priority INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );`,
  // Performance: index to speed up resolveAudio filtering
  `CREATE INDEX IF NOT EXISTS idx_audio_assign_specific ON audio_assignments(entity_type, entity_id, active, priority);`,
    // Session store table: keep both legacy `expire` (Drizzle schema) and `expired` (connect-sqlite3 expects this).
    `CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expire TEXT,
      expired INTEGER
    );`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      first_name TEXT,
      last_name TEXT,
      profile_image_url TEXT,
      password_hash TEXT,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );`,
  ];

  // Execute schema creation statements safely.
  dbInst.transaction((statements: string[]) => {
    for (const stmt of statements) {
      dbInst.prepare(stmt).run();
    }
  })(stmts);
  console.log('SQLite schema verified.');
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

if (isSqlite) {
  // Initialize SQLite connection for local dev
  const sqliteFile = baseWriteUrl.replace(/^file:/, '');
  // Explicit log for Render debugging: shows the effective SQLite file chosen.
  // (No credentials involved for SQLite paths.)
  /* eslint-disable no-console */
  console.log(`Using database at: file:${sqliteFile}`);
  console.log(`Using database (sqlite): ${maskDbUrl(baseWriteUrl)}`);
  console.log(`DB_PATH value: ${process.env.DB_PATH ? process.env.DB_PATH : '<unset>'}`);
  console.log(`RENDER detected: ${process.env.RENDER || process.env.RENDER_EXTERNAL_URL ? 'yes' : 'no'}`);
  /* eslint-enable no-console */

  // Guardrail: in production (especially on Render), accidentally using ./dev.sqlite
  // leads to missing schema and non-persistent data.
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
    const usingDefaultDevSqlite = sqliteFile === './dev.sqlite' || sqliteFile === 'dev.sqlite';
    if (usingDefaultDevSqlite && !process.env.DB_PATH) {
      console.error('Fatal: DB_PATH is not set in production, and the app would use ./dev.sqlite.');
      console.error('Set DB_PATH to a persistent path (Render disk mount), e.g. /data/database.sqlite.');
      process.exit(1);
    }
  }

  const sqliteDb = new Database(sqliteFile);

  // Add a custom function to the SQLite instance for UUID generation to maintain
  // compatibility with schemas that might expect it (e.g., from Postgres).
  try {
    sqliteDb.function('gen_random_uuid', () => randomUUID());
  } catch (e) {
    // Function might already exist, ignore the error.
    console.warn('Could not register gen_random_uuid function:', e);
  }

  // Run the schema setup for local dev
  try {
    ensureSqliteSchema(sqliteDb);
  } catch (e) {
    console.error('Fatal: Failed to ensure SQLite schema:', e);
    process.exit(1);
  }

  // Ensure existing databases get the new columns (kept for compatibility)
  try {
    const cols = sqliteDb.prepare("PRAGMA table_info('characters');").all();
    const hasStory = cols.some((c: any) => c.name === 'story');
    if (!hasStory) {
      console.log("Adding missing 'story' column to characters table");
      try {
        sqliteDb.prepare("ALTER TABLE characters ADD COLUMN story TEXT;").run();
      } catch (e) {
        console.warn("Could not add 'story' column to characters table:", e);
      }
    }
    const hasSlug = cols.some((c: any) => c.name === 'slug');
    if (!hasSlug) {
      console.log("Adding missing 'slug' column to characters table");
      try {
        sqliteDb.prepare("ALTER TABLE characters ADD COLUMN slug TEXT;").run();
        sqliteDb.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_slug ON characters(slug);").run();
      } catch (e) {
        console.warn("Could not add 'slug' column to characters table:", e);
      }
    }
    // Ensure existing chapters table has arc fields
    const chapterCols = sqliteDb.prepare("PRAGMA table_info('chapters');").all();
    const hasArcNumber = chapterCols.some((c: any) => c.name === 'arc_number');
    if (!hasArcNumber) {
      try {
        console.log("Adding missing 'arc_number' column to chapters table");
        sqliteDb.prepare("ALTER TABLE chapters ADD COLUMN arc_number INTEGER;").run();
      } catch (e) {
        console.warn("Could not add 'arc_number' column to chapters table:", e);
      }
    }
    const hasArcTitle = chapterCols.some((c: any) => c.name === 'arc_title');
    if (!hasArcTitle) {
      try {
        console.log("Adding missing 'arc_title' column to chapters table");
        sqliteDb.prepare("ALTER TABLE chapters ADD COLUMN arc_title TEXT;").run();
      } catch (e) {
        console.warn("Could not add 'arc_title' column to chapters table:", e);
      }
    }
    // Ensure locations table has image_url and details columns (idempotent)
    try {
      const locCols = sqliteDb.prepare("PRAGMA table_info('locations');").all();
      const hasNameI18n = locCols.some((c: any) => c.name === 'name_i18n');
      if (!hasNameI18n) {
        console.log("Adding missing 'name_i18n' column to locations table");
        try { sqliteDb.prepare("ALTER TABLE locations ADD COLUMN name_i18n TEXT;").run(); } catch (e) { console.warn("Could not add 'name_i18n' column to locations table:", e); }
      }
      const hasDescI18n = locCols.some((c: any) => c.name === 'description_i18n');
      if (!hasDescI18n) {
        console.log("Adding missing 'description_i18n' column to locations table");
        try { sqliteDb.prepare("ALTER TABLE locations ADD COLUMN description_i18n TEXT;").run(); } catch (e) { console.warn("Could not add 'description_i18n' column to locations table:", e); }
      }
      const hasImage = locCols.some((c: any) => c.name === 'image_url');
      if (!hasImage) {
        console.log("Adding missing 'image_url' column to locations table");
        try { sqliteDb.prepare("ALTER TABLE locations ADD COLUMN image_url TEXT;").run(); } catch (e) { console.warn("Could not add 'image_url' column to locations table:", e); }
      }
      const hasDetails = locCols.some((c: any) => c.name === 'details');
      if (!hasDetails) {
        console.log("Adding missing 'details' column to locations table");
        try { sqliteDb.prepare("ALTER TABLE locations ADD COLUMN details TEXT;").run(); } catch (e) { console.warn("Could not add 'details' column to locations table:", e); }
      }
      const hasSlug = locCols.some((c: any) => c.name === 'slug');
      if (!hasSlug) {
        console.log("Adding missing 'slug' column to locations table");
        try { sqliteDb.prepare("ALTER TABLE locations ADD COLUMN slug TEXT;").run(); } catch (e) { console.warn("Could not add 'slug' column to locations table:", e); }
      }
      const hasTags = locCols.some((c: any) => c.name === 'tags');
      if (!hasTags) {
        console.log("Adding missing 'tags' column to locations table");
        try { sqliteDb.prepare("ALTER TABLE locations ADD COLUMN tags TEXT;").run(); } catch (e) { console.warn("Could not add 'tags' column to locations table:", e); }
      }
    } catch (e) {
      console.warn('Could not verify/alter locations table schema:', e);
    }

    // Ensure i18n/content columns exist on codex_entries (required by Drizzle schema)
    try {
      const codexCols = sqliteDb.prepare("PRAGMA table_info('codex_entries');").all();
      const hasTitleI18n = codexCols.some((c: any) => c.name === 'title_i18n');
      if (!hasTitleI18n) {
        console.log("Adding missing 'title_i18n' column to codex_entries table");
        try { sqliteDb.prepare("ALTER TABLE codex_entries ADD COLUMN title_i18n TEXT;").run(); } catch (e) { console.warn("Could not add 'title_i18n' column to codex_entries table:", e); }
      }
      const hasDescriptionI18n = codexCols.some((c: any) => c.name === 'description_i18n');
      if (!hasDescriptionI18n) {
        console.log("Adding missing 'description_i18n' column to codex_entries table");
        try { sqliteDb.prepare("ALTER TABLE codex_entries ADD COLUMN description_i18n TEXT;").run(); } catch (e) { console.warn("Could not add 'description_i18n' column to codex_entries table:", e); }
      }
      const hasContent = codexCols.some((c: any) => c.name === 'content');
      if (!hasContent) {
        console.log("Adding missing 'content' column to codex_entries table");
        try { sqliteDb.prepare("ALTER TABLE codex_entries ADD COLUMN content TEXT;").run(); } catch (e) { console.warn("Could not add 'content' column to codex_entries table:", e); }
      }
    } catch (e) {
      console.warn('Could not verify/alter codex_entries table schema:', e);
    }

    // Ensure i18n columns exist on chapters and blog_posts (kept in sync with Drizzle schema)
    try {
      const chapterCols2 = sqliteDb.prepare("PRAGMA table_info('chapters');").all();
      const hasTitleI18n = chapterCols2.some((c: any) => c.name === 'title_i18n');
      if (!hasTitleI18n) {
        console.log("Adding missing 'title_i18n' column to chapters table");
        try { sqliteDb.prepare("ALTER TABLE chapters ADD COLUMN title_i18n TEXT;").run(); } catch (e) { console.warn("Could not add 'title_i18n' column to chapters table:", e); }
      }
      const hasContentI18n = chapterCols2.some((c: any) => c.name === 'content_i18n');
      if (!hasContentI18n) {
        console.log("Adding missing 'content_i18n' column to chapters table");
        try { sqliteDb.prepare("ALTER TABLE chapters ADD COLUMN content_i18n TEXT;").run(); } catch (e) { console.warn("Could not add 'content_i18n' column to chapters table:", e); }
      }
      const hasExcerptI18n = chapterCols2.some((c: any) => c.name === 'excerpt_i18n');
      if (!hasExcerptI18n) {
        console.log("Adding missing 'excerpt_i18n' column to chapters table");
        try { sqliteDb.prepare("ALTER TABLE chapters ADD COLUMN excerpt_i18n TEXT;").run(); } catch (e) { console.warn("Could not add 'excerpt_i18n' column to chapters table:", e); }
      }
    } catch (e) {
      console.warn('Could not verify/alter chapters i18n schema:', e);
    }

    try {
      const blogCols = sqliteDb.prepare("PRAGMA table_info('blog_posts');").all();
      const hasTitleI18n = blogCols.some((c: any) => c.name === 'title_i18n');
      if (!hasTitleI18n) {
        console.log("Adding missing 'title_i18n' column to blog_posts table");
        try { sqliteDb.prepare("ALTER TABLE blog_posts ADD COLUMN title_i18n TEXT;").run(); } catch (e) { console.warn("Could not add 'title_i18n' column to blog_posts table:", e); }
      }
      const hasContentI18n = blogCols.some((c: any) => c.name === 'content_i18n');
      if (!hasContentI18n) {
        console.log("Adding missing 'content_i18n' column to blog_posts table");
        try { sqliteDb.prepare("ALTER TABLE blog_posts ADD COLUMN content_i18n TEXT;").run(); } catch (e) { console.warn("Could not add 'content_i18n' column to blog_posts table:", e); }
      }
      const hasExcerptI18n = blogCols.some((c: any) => c.name === 'excerpt_i18n');
      if (!hasExcerptI18n) {
        console.log("Adding missing 'excerpt_i18n' column to blog_posts table");
        try { sqliteDb.prepare("ALTER TABLE blog_posts ADD COLUMN excerpt_i18n TEXT;").run(); } catch (e) { console.warn("Could not add 'excerpt_i18n' column to blog_posts table:", e); }
      }
    } catch (e) {
      console.warn('Could not verify/alter blog_posts i18n schema:', e);
    }

    // Ensure i18n columns exist on characters
    try {
      const charCols2 = sqliteDb.prepare("PRAGMA table_info('characters');").all();
      const hasNameI18n = charCols2.some((c: any) => c.name === 'name_i18n');
      if (!hasNameI18n) {
        console.log("Adding missing 'name_i18n' column to characters table");
        try { sqliteDb.prepare("ALTER TABLE characters ADD COLUMN name_i18n TEXT;").run(); } catch (e) { console.warn("Could not add 'name_i18n' column to characters table:", e); }
      }
      const hasTitleI18n = charCols2.some((c: any) => c.name === 'title_i18n');
      if (!hasTitleI18n) {
        console.log("Adding missing 'title_i18n' column to characters table");
        try { sqliteDb.prepare("ALTER TABLE characters ADD COLUMN title_i18n TEXT;").run(); } catch (e) { console.warn("Could not add 'title_i18n' column to characters table:", e); }
      }
    } catch (e) {
      console.warn('Could not verify/alter characters i18n schema:', e);
    }

    // Ensure sessions table has `expired` column required by connect-sqlite3
    try {
      const sessCols = sqliteDb.prepare("PRAGMA table_info('sessions');").all();
      const hasExpired = sessCols.some((c: any) => c.name === 'expired');
      if (!hasExpired) {
        console.log("Adding missing 'expired' column to sessions table");
        try {
          sqliteDb.prepare("ALTER TABLE sessions ADD COLUMN expired INTEGER;").run();
        } catch (e) {
          console.warn("Could not add 'expired' column to sessions table:", e);
        }
        // Best-effort copy from legacy `expire` column if it exists
        const hasExpire = sessCols.some((c: any) => c.name === 'expire');
        if (hasExpire) {
          try { sqliteDb.prepare("UPDATE sessions SET expired = COALESCE(expired, expire);").run(); } catch {}
        }
      }
    } catch (e) {
      console.warn('Could not verify/alter sessions table schema:', e);
    }
  } catch (e) {
    console.warn('Could not verify/alter characters table schema:', e);
  }

  db = drizzleSqlite(sqliteDb, { schema });
  pool = sqliteDb;
} else {
  // Postgres (Supabase) connection via postgres-js
  // Normalize URLs with pgBouncer and TLS parameters
  // Use pooler by host:port only (e.g., 6543 on Supabase). Do not add unknown params like 'pgbouncer'.
  const writeUrl = ensureParams(baseWriteUrl, { sslmode: 'require' });
  const readUrl = ensureParams(baseReadUrl, { sslmode: 'require' });

  const sqlWrite = postgres(writeUrl, {
    ssl: { rejectUnauthorized: env('DB_SSL_STRICT', 'false') === 'true' },
    max: parseInt(env('DB_POOL_MAX', '10'), 10),
    idle_timeout: parseInt(env('DB_IDLE_TIMEOUT_MS', '30000'), 10),
    // Silence benign Postgres NOTICE messages like "relation already exists"
    onnotice: () => {},
    keep_alive: 1,
  });
  const sqlRead = postgres(readUrl, {
    ssl: { rejectUnauthorized: env('DB_SSL_STRICT', 'false') === 'true' },
    max: Math.max(2, Math.floor(parseInt(env('DB_POOL_MAX', '10'), 10) / 2)),
    idle_timeout: parseInt(env('DB_IDLE_TIMEOUT_MS', '30000'), 10),
    onnotice: () => {},
    keep_alive: 1,
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
        slug TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        excerpt TEXT NOT NULL,
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
        title TEXT,
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
        content TEXT,
        category TEXT NOT NULL,
        image_url TEXT
      )`;
      await sqlWrite`CREATE TABLE IF NOT EXISTS blog_posts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        excerpt TEXT NOT NULL,
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
      await sqlWrite`CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire TEXT NOT NULL
      )`;
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
    if (isSqlite) return true;
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
  if (isSqlite) {
    console.log(`Using database (sqlite): ${maskDbUrl(baseWriteUrl)}`);
    return;
  }
  if ((pool as any)?._init) {
    await (pool as any)._init();
  }
}

export async function dbClose() {
  try { if (pool?.end) await pool.end(); } catch {}
}

export { db, pool };


