/**
 * SQLite initialization module - ONLY imported when using SQLite (local dev)
 * This file is kept separate to avoid loading better-sqlite3 on Render production
 */
import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema";
import { randomUUID } from 'crypto';

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
    `CREATE INDEX IF NOT EXISTS idx_audio_assign_specific ON audio_assignments(entity_type, entity_id, active, priority);`,
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

  dbInst.transaction((statements: string[]) => {
    for (const stmt of statements) {
      dbInst.prepare(stmt).run();
    }
  })(stmts);
  console.log('SQLite schema verified.');
};

export function initSqlite(sqliteFile: string) {
  console.log(`Using database at: file:${sqliteFile}`);
  console.log(`DB_PATH value: ${process.env.DB_PATH ? process.env.DB_PATH : '<unset>'}`);
  console.log(`RENDER detected: ${process.env.RENDER || process.env.RENDER_EXTERNAL_URL ? 'yes' : 'no'}`);

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

  // Add a custom function to the SQLite instance for UUID generation
  try {
    sqliteDb.function('gen_random_uuid', () => randomUUID());
  } catch (e) {
    console.warn('Could not register gen_random_uuid function:', e);
  }

  // Run the schema setup for local dev
  try {
    ensureSqliteSchema(sqliteDb);
  } catch (e) {
    console.error('Fatal: Failed to ensure SQLite schema:', e);
    process.exit(1);
  }

  // Ensure existing databases get the new columns (migrations)
  migrateColumns(sqliteDb);

  const db = drizzleSqlite(sqliteDb, { schema });
  return { db, pool: sqliteDb };
}

function migrateColumns(sqliteDb: any) {
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

    // Locations columns
    try {
      const locCols = sqliteDb.prepare("PRAGMA table_info('locations');").all();
      if (!locCols.some((c: any) => c.name === 'name_i18n')) {
        try { sqliteDb.prepare("ALTER TABLE locations ADD COLUMN name_i18n TEXT;").run(); } catch {}
      }
      if (!locCols.some((c: any) => c.name === 'description_i18n')) {
        try { sqliteDb.prepare("ALTER TABLE locations ADD COLUMN description_i18n TEXT;").run(); } catch {}
      }
      if (!locCols.some((c: any) => c.name === 'image_url')) {
        try { sqliteDb.prepare("ALTER TABLE locations ADD COLUMN image_url TEXT;").run(); } catch {}
      }
      if (!locCols.some((c: any) => c.name === 'details')) {
        try { sqliteDb.prepare("ALTER TABLE locations ADD COLUMN details TEXT;").run(); } catch {}
      }
      if (!locCols.some((c: any) => c.name === 'slug')) {
        try { sqliteDb.prepare("ALTER TABLE locations ADD COLUMN slug TEXT;").run(); } catch {}
      }
      if (!locCols.some((c: any) => c.name === 'tags')) {
        try { sqliteDb.prepare("ALTER TABLE locations ADD COLUMN tags TEXT;").run(); } catch {}
      }
    } catch {}

    // Codex columns
    try {
      const codexCols = sqliteDb.prepare("PRAGMA table_info('codex_entries');").all();
      if (!codexCols.some((c: any) => c.name === 'title_i18n')) {
        try { sqliteDb.prepare("ALTER TABLE codex_entries ADD COLUMN title_i18n TEXT;").run(); } catch {}
      }
      if (!codexCols.some((c: any) => c.name === 'description_i18n')) {
        try { sqliteDb.prepare("ALTER TABLE codex_entries ADD COLUMN description_i18n TEXT;").run(); } catch {}
      }
      if (!codexCols.some((c: any) => c.name === 'content')) {
        try { sqliteDb.prepare("ALTER TABLE codex_entries ADD COLUMN content TEXT;").run(); } catch {}
      }
    } catch {}

    // Chapters i18n columns
    try {
      const chapterCols2 = sqliteDb.prepare("PRAGMA table_info('chapters');").all();
      if (!chapterCols2.some((c: any) => c.name === 'title_i18n')) {
        try { sqliteDb.prepare("ALTER TABLE chapters ADD COLUMN title_i18n TEXT;").run(); } catch {}
      }
      if (!chapterCols2.some((c: any) => c.name === 'content_i18n')) {
        try { sqliteDb.prepare("ALTER TABLE chapters ADD COLUMN content_i18n TEXT;").run(); } catch {}
      }
      if (!chapterCols2.some((c: any) => c.name === 'excerpt_i18n')) {
        try { sqliteDb.prepare("ALTER TABLE chapters ADD COLUMN excerpt_i18n TEXT;").run(); } catch {}
      }
    } catch {}

    // Blog i18n columns
    try {
      const blogCols = sqliteDb.prepare("PRAGMA table_info('blog_posts');").all();
      if (!blogCols.some((c: any) => c.name === 'title_i18n')) {
        try { sqliteDb.prepare("ALTER TABLE blog_posts ADD COLUMN title_i18n TEXT;").run(); } catch {}
      }
      if (!blogCols.some((c: any) => c.name === 'content_i18n')) {
        try { sqliteDb.prepare("ALTER TABLE blog_posts ADD COLUMN content_i18n TEXT;").run(); } catch {}
      }
      if (!blogCols.some((c: any) => c.name === 'excerpt_i18n')) {
        try { sqliteDb.prepare("ALTER TABLE blog_posts ADD COLUMN excerpt_i18n TEXT;").run(); } catch {}
      }
    } catch {}

    // Characters i18n columns
    try {
      const charCols2 = sqliteDb.prepare("PRAGMA table_info('characters');").all();
      if (!charCols2.some((c: any) => c.name === 'name_i18n')) {
        try { sqliteDb.prepare("ALTER TABLE characters ADD COLUMN name_i18n TEXT;").run(); } catch {}
      }
      if (!charCols2.some((c: any) => c.name === 'title_i18n')) {
        try { sqliteDb.prepare("ALTER TABLE characters ADD COLUMN title_i18n TEXT;").run(); } catch {}
      }
    } catch {}

    // Sessions expired column
    try {
      const sessCols = sqliteDb.prepare("PRAGMA table_info('sessions');").all();
      if (!sessCols.some((c: any) => c.name === 'expired')) {
        try {
          sqliteDb.prepare("ALTER TABLE sessions ADD COLUMN expired INTEGER;").run();
          if (sessCols.some((c: any) => c.name === 'expire')) {
            try { sqliteDb.prepare("UPDATE sessions SET expired = COALESCE(expired, expire);").run(); } catch {}
          }
        } catch {}
      }
    } catch {}
  } catch (e) {
    console.warn('Could not verify/alter table schemas:', e);
  }
}
