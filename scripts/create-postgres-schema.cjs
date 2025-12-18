// scripts/create-postgres-schema.cjs
// Creates the necessary tables on a Postgres database (Supabase) based on
// the project's schema. Run with:
//   DATABASE_URL="postgresql://..." node scripts/create-postgres-schema.cjs

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('ERROR: set DATABASE_URL env var');
  process.exit(1);
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    // Enable pgcrypto for gen_random_uuid()
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    // Create tables (types adapted for Postgres)
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
        slug TEXT,
        details TEXT,
        image_url TEXT,
        tags TEXT,
        description_i18n TEXT,
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
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        chapter_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        last_read_at TEXT NOT NULL,
        CONSTRAINT fk_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id)
      );`,
      `CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE,
        first_name TEXT,
        last_name TEXT,
        profile_image_url TEXT,
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

    for (const s of stmts) {
      await client.query(s);
    }

    console.log('Postgres schema created/verified successfully');
  } catch (err) {
    console.error('Failed to create schema:', err.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
