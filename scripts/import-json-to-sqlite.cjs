// scripts/import-json-to-sqlite.cjs
// Load JSON backups from sorcerer/data and insert into local SQLite (./dev.sqlite by default).
// Usage (PowerShell):
//   $env:SQLITE_PATH="./sorcerer/dev.sqlite"; node scripts/import-json-to-sqlite.cjs

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'dev.sqlite');

fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });
const db = new Database(SQLITE_PATH);

// Minimal schema ensure (matches server/db.ts ensureSqliteSchema)
function ensureSchema() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS chapters (
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
    );`,
    `CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT,
      description TEXT,
      story TEXT,
      slug TEXT NOT NULL UNIQUE,
      image_url TEXT,
      role TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS locations (
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
    );`,
    `CREATE TABLE IF NOT EXISTS codex_entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      content TEXT,
      category TEXT NOT NULL,
      image_url TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      category TEXT NOT NULL,
      published_at TEXT NOT NULL,
      image_url TEXT
    );`,
  ];
  db.transaction((arr) => arr.forEach((s) => db.prepare(s).run()))(stmts);
}

function loadJson(name) {
  const fp = path.join(DATA_DIR, name);
  if (!fs.existsSync(fp)) return [];
  return JSON.parse(fs.readFileSync(fp, 'utf8') || '[]');
}

function upsert(table, obj) {
  const cols = Object.keys(obj);
  const placeholders = cols.map((c) => `@${c}`).join(',');
  const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${cols.filter(c=>c!=='id').map(c=>`${c}=excluded.${c}`).join(',')}`;
  db.prepare(sql).run(obj);
}

function normalizeChapter(c) {
  return {
    id: c.id,
    title: c.title || c.name || 'Untitled',
    slug: c.slug || String((c.title||c.name||c.id||'capitulo')).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),
    content: c.content || '',
    excerpt: c.excerpt || c.description || '',
    chapter_number: c.chapterNumber ?? c.chapter_number ?? 1,
    arc_number: c.arcNumber ?? c.arc_number ?? null,
    arc_title: c.arcTitle ?? c.arc_title ?? null,
    reading_time: c.readingTime ?? c.reading_time ?? 5,
    published_at: c.publishedAt ?? c.published_at ?? new Date().toISOString(),
    image_url: c.imageUrl ?? c.image_url ?? null,
  };
}

function normalizeCharacter(c) {
  return {
    id: c.id,
    name: c.name || 'Sem Nome',
    title: c.title || c.name || '',
    description: c.description || '',
    story: c.story || null,
    slug: c.slug || String((c.name||c.title||c.id||'char')).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),
    image_url: c.imageUrl ?? c.image_url ?? null,
    role: c.role || 'unknown',
  };
}

function normalizeLocation(l) {
  return {
    id: l.id,
    name: l.name || 'Localidade',
    description: l.description || '',
    details: l.details || null,
    image_url: l.imageUrl ?? l.image_url ?? null,
    slug: l.slug || String((l.name||l.id||'loc')).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),
    tags: l.tags || null,
    map_x: l.mapX ?? l.map_x ?? 0,
    map_y: l.mapY ?? l.map_y ?? 0,
    type: l.type || 'other',
  };
}

function normalizeCodex(e) {
  return {
    id: e.id,
    title: e.title || 'Entrada',
    description: e.description || '',
    content: e.content ?? null,
    category: (e.category || 'other').toLowerCase(),
    image_url: e.imageUrl ?? e.image_url ?? null,
  };
}

function normalizeBlog(b) {
  return {
    id: b.id,
    title: b.title || 'Post',
    slug: b.slug || String((b.title||b.id||'post')).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),
    content: b.content || '',
    excerpt: b.excerpt || b.description || '',
    category: (b.category || 'general').toLowerCase(),
    published_at: b.publishedAt ?? b.published_at ?? new Date().toISOString(),
    image_url: b.imageUrl ?? b.image_url ?? null,
  };
}

(function main() {
  ensureSchema();

  const chapters = loadJson('offline-chapters.json');
  const characters = loadJson('offline-characters.json');
  const locations = loadJson('offline-locations.json');
  const codex = loadJson('offline-codex.json');
  const blog = loadJson('offline-blog.json');

  const report = { chapters: 0, characters: 0, locations: 0, codex: 0, blog: 0 };

  db.transaction(() => {
    for (const c of chapters) { upsert('chapters', normalizeChapter(c)); report.chapters++; }
    for (const c of characters) { upsert('characters', normalizeCharacter(c)); report.characters++; }
    for (const l of locations) { upsert('locations', normalizeLocation(l)); report.locations++; }
    for (const e of codex) { upsert('codex_entries', normalizeCodex(e)); report.codex++; }
    for (const p of blog) { upsert('blog_posts', normalizeBlog(p)); report.blog++; }
  })();

  console.log('Import finished into', SQLITE_PATH, 'Counts:', report);
})();
