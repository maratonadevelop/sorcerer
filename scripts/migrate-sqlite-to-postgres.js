// scripts/migrate-sqlite-to-postgres.js
// Simple migration helper that reads rows from the local SQLite database and
// inserts them into the target Postgres database (Supabase). Adapt table names
// and columns to match your schema. Run with:
//
//   DATABASE_URL="postgresql://..." node scripts/migrate-sqlite-to-postgres.js

const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Default to the app-local dev.sqlite (works when running from sorcerer/ folder)
const SQLITE_PATH = process.env.SQLITE_PATH || path.resolve(__dirname, '..', 'dev.sqlite');
// Optional: load DATABASE_URL from a local file (gitignored) to avoid putting secrets in commands.
try {
  const appRoot = path.resolve(__dirname, '..');
  const candidates = [
    path.resolve(appRoot, '.env.migrate.local'),
    path.resolve(appRoot, '.env.migrate'),
    path.resolve(process.cwd(), '.env.migrate.local'),
    path.resolve(process.cwd(), '.env.migrate'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const parsed = dotenv.parse(fs.readFileSync(p));
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }
    }
  }
} catch {}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  const appRoot = path.resolve(__dirname, '..');
  console.error('ERROR: DATABASE_URL is not set.');
  console.error('');
  console.error('To run this migration safely without typing secrets into a command:');
  console.error('1) Create a file named .env.migrate.local in the app folder (recommended):');
  console.error(`   ${appRoot}`);
  console.error('2) Put this line in it:');
  console.error('   DATABASE_URL=postgresql://postgres:<PASSWORD>@<HOST>:5432/postgres');
  console.error('');
  console.error('Then run:');
  console.error('  npm run db:migrate');
  console.error('');
  console.error('Notes:');
  console.error('- .env.migrate.local is gitignored in this repo and should not be committed.');
  console.error('- SQLITE_PATH defaults to ../dev.sqlite; override with SQLITE_PATH if needed.');
  process.exit(1);
}

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

function sqliteCols(tableName) {
  try {
    return sqlite.prepare(`PRAGMA table_info('${tableName}')`).all().map((c) => c.name);
  } catch {
    return [];
  }
}

function selectExisting(tableName, desiredCols) {
  const cols = new Set(sqliteCols(tableName));
  return desiredCols.filter((c) => cols.has(c));
}

async function migrateTable(client, tableName, selectCols, mapRowToInsert) {
  console.log(`Migrating table: ${tableName}`);
  const effectiveSelectCols = selectExisting(tableName, selectCols);
  if (effectiveSelectCols.length === 0) {
    console.log(`Table ${tableName} exists but has none of the expected columns; skipping.`);
    return;
  }
  const rows = sqlite.prepare(`SELECT ${effectiveSelectCols.join(', ')} FROM ${tableName}`).all();
  if (!rows.length) {
    console.log(`No rows found for ${tableName}, skipping.`);
    return;
  }

  for (const r of rows) {
    const obj = mapRowToInsert ? mapRowToInsert(r) : r;
    const cols = Object.keys(obj);
    const params = cols.map((_, i) => `$${i + 1}`);
    const sql = `INSERT INTO ${tableName} (${cols.join(',')}) VALUES (${params.join(',')}) ON CONFLICT DO NOTHING`;
    const values = cols.map(c => obj[c]);
    try {
      await client.query(sql, values);
    } catch (err) {
      console.error(`Failed to insert into ${tableName}:`, err.message);
      throw err;
    }
  }

  console.log(`Finished migrating ${tableName} (${rows.length} rows)`);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure target schema exists (Supabase fresh DB)
    await client.query(`CREATE TABLE IF NOT EXISTS chapters (
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
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS characters (
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
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_i18n TEXT,
      description TEXT NOT NULL,
      description_i18n TEXT,
      slug TEXT,
      details TEXT,
      image_url TEXT,
      tags TEXT,
      map_x INTEGER NOT NULL,
      map_y INTEGER NOT NULL,
      type TEXT NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS codex_entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      title_i18n TEXT,
      description TEXT NOT NULL,
      description_i18n TEXT,
      content TEXT,
      category TEXT NOT NULL,
      image_url TEXT
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS blog_posts (
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
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS reading_progress (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      last_read_at TEXT NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS audio_tracks (
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
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS audio_assignments (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      priority INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    )`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_audio_assign_specific ON audio_assignments(entity_type, entity_id, active, priority)');

    await client.query(`CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expire TEXT NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      first_name TEXT,
      last_name TEXT,
      profile_image_url TEXT,
      password_hash TEXT,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    )`);

    // Core entities
    await migrateTable(client, 'users', ['id','email','first_name','last_name','profile_image_url','password_hash','is_admin','created_at','updated_at'], (r) => ({
      id: r.id,
      email: r.email,
      first_name: r.first_name,
      last_name: r.last_name,
      profile_image_url: r.profile_image_url,
      password_hash: r.password_hash ?? null,
      is_admin: r.is_admin,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    await migrateTable(
      client,
      'chapters',
      ['id','title','title_i18n','slug','content','content_i18n','excerpt','excerpt_i18n','chapter_number','arc_number','arc_title','reading_time','published_at','image_url'],
      (r) => ({
        id: r.id,
        title: r.title,
        title_i18n: r.title_i18n ?? null,
        slug: r.slug,
        content: r.content,
        content_i18n: r.content_i18n ?? null,
        excerpt: r.excerpt,
        excerpt_i18n: r.excerpt_i18n ?? null,
        chapter_number: r.chapter_number,
        arc_number: r.arc_number ?? null,
        arc_title: r.arc_title ?? null,
        reading_time: r.reading_time,
        published_at: r.published_at,
        image_url: r.image_url ?? null,
      })
    );

    await migrateTable(client, 'characters', ['id','name','name_i18n','title','title_i18n','description','story','slug','image_url','role'], (r) => ({
      id: r.id,
      name: r.name,
      name_i18n: r.name_i18n ?? null,
      title: r.title,
      title_i18n: r.title_i18n ?? null,
      description: r.description,
      story: r.story ?? null,
      slug: r.slug,
      image_url: r.image_url ?? null,
      role: r.role,
    }));

    await migrateTable(client, 'locations', ['id','name','name_i18n','description','description_i18n','details','image_url','slug','tags','map_x','map_y','type'], (r) => ({
      id: r.id,
      name: r.name,
      name_i18n: r.name_i18n ?? null,
      description: r.description,
      description_i18n: r.description_i18n ?? null,
      details: r.details ?? null,
      image_url: r.image_url ?? null,
      slug: r.slug ?? null,
      tags: r.tags ?? null,
      map_x: r.map_x,
      map_y: r.map_y,
      type: r.type,
    }));

    await migrateTable(client, 'codex_entries', ['id','title','title_i18n','description','description_i18n','content','category','image_url'], (r) => ({
      id: r.id,
      title: r.title,
      title_i18n: r.title_i18n ?? null,
      description: r.description,
      description_i18n: r.description_i18n ?? null,
      content: r.content ?? null,
      category: r.category,
      image_url: r.image_url ?? null,
    }));

    await migrateTable(client, 'blog_posts', ['id','title','title_i18n','slug','content','content_i18n','excerpt','excerpt_i18n','category','published_at','image_url'], (r) => ({
      id: r.id,
      title: r.title,
      title_i18n: r.title_i18n ?? null,
      slug: r.slug,
      content: r.content,
      content_i18n: r.content_i18n ?? null,
      excerpt: r.excerpt,
      excerpt_i18n: r.excerpt_i18n ?? null,
      category: r.category,
      published_at: r.published_at,
      image_url: r.image_url ?? null,
    }));

    // Dependent tables
    await migrateTable(client, 'reading_progress', ['id','chapter_id','session_id','progress','last_read_at'], (r) => ({
      id: r.id,
      chapter_id: r.chapter_id,
      session_id: r.session_id,
      progress: r.progress,
      last_read_at: r.last_read_at,
    }));

    await migrateTable(client, 'audio_tracks', ['id','title','kind','file_url','loop','volume_default','volume_user_max','fade_in_ms','fade_out_ms','created_at','updated_at'], (r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      file_url: r.file_url,
      loop: r.loop,
      volume_default: r.volume_default,
      volume_user_max: r.volume_user_max ?? r.volume_default ?? 70,
      fade_in_ms: r.fade_in_ms ?? null,
      fade_out_ms: r.fade_out_ms ?? null,
      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,
    }));

    await migrateTable(client, 'audio_assignments', ['id','track_id','entity_type','entity_id','priority','active','created_at','updated_at'], (r) => ({
      id: r.id,
      track_id: r.track_id,
      entity_type: r.entity_type,
      entity_id: r.entity_id ?? null,
      priority: r.priority,
      active: r.active,
      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,
    }));

    await migrateTable(client, 'meta', ['key','value','updated_at'], (r) => ({
      key: r.key,
      value: r.value ?? null,
      updated_at: r.updated_at ?? null,
    }));

    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', err.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

main();
