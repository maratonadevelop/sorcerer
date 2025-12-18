// scripts/export-postgres-to-json.cjs
// Dump Supabase/Postgres tables to JSON files under sorcerer/data for backup/migration.
// Usage (PowerShell):
//   $env:DATABASE_URL="postgresql://user:pass@host:5432/db"; node scripts/export-postgres-to-json.cjs

const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const outDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(outDir, { recursive: true });

const conn = process.env.DATABASE_URL;
if (!conn || !/^postgres/i.test(conn)) {
  console.error('DATABASE_URL must point to Postgres for export. Current:', conn);
  process.exit(1);
}

// Force TLS but accept Supabase cert by default
const sql = postgres(conn, {
  ssl: { rejectUnauthorized: false },
  max: 5,
  idle_timeout: 10000,
});

async function dump(table, file, orderBySql) {
  console.log(`Exporting ${table} -> ${file}`);
  const rows = await sql.unsafe(`select * from ${table} ${orderBySql || ''}`);
  const fp = path.join(outDir, file);
  fs.writeFileSync(fp, JSON.stringify(rows, null, 2), 'utf8');
}

(async () => {
  try {
    await dump('users', 'users.json');
    await dump('chapters', 'offline-chapters.json', 'order by chapter_number asc');
    await dump('characters', 'offline-characters.json');
    await dump('locations', 'offline-locations.json');
    await dump('codex_entries', 'offline-codex.json');
    // Optional: blog posts and reading progress
    await dump('blog_posts', 'offline-blog.json', 'order by published_at desc');
    await dump('reading_progress', 'offline-progress.json');
    console.log('Export completed. Files written to', outDir);
  } catch (e) {
    console.error('Export failed:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    try { await sql.end({ timeout: 5 }); } catch {}
  }
})();
