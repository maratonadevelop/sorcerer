// scripts/import-json-to-postgres.cjs
// Reads JSON files from sorcerer/data and inserts them into Postgres (Supabase).
// Usage: node scripts/import-json-to-postgres.cjs

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const DATA_DIR = path.join(__dirname, '..', 'data');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('ERROR: set DATABASE_URL in env or .env');
  process.exit(1);
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function toSnake(s) {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase();
}

async function getTableColumns(client, table) {
  const res = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`,
    [table]
  );
  const map = {};
  for (const r of res.rows) map[r.column_name] = r.data_type;
  return map;
}

async function insertObjects(table, arr) {
  if (!Array.isArray(arr)) return 0;
  const client = await pool.connect();
  let count = 0;
  try {
    const colsInfo = await getTableColumns(client, table);
    const allowedCols = Object.keys(colsInfo);

    await client.query('BEGIN');
    for (const obj of arr) {
      // normalize keys: camelCase -> snake_case
      const normalized = {};
      for (const k of Object.keys(obj)) {
        const nk = toSnake(k);
        let v = obj[k];
        // convert boolean to integer for integer columns
        if (typeof v === 'boolean') v = v ? 1 : 0;
        // stringify objects/arrays
        if (v && typeof v === 'object') v = JSON.stringify(v);
        normalized[nk] = v;
      }

        // Auto-fill some common missing fields to satisfy NOT NULL constraints
        // characters/chapter: title/slug
        if (table === 'characters') {
          if (!normalized.title && normalized.name) normalized.title = normalized.name;
          if (!normalized.slug) {
            const base = normalized.name || normalized.title || 'char';
            normalized.slug = `${base}`.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g,'') + '-' + (normalized.id || Math.random().toString(36).slice(2,8));
          }
          // description fallback
          if (!normalized.description) normalized.description = normalized.name || normalized.title || 'No description provided';
          // role fallback
          if (!normalized.role) normalized.role = 'unknown';
        }
        if (table === 'chapters') {
          if (!normalized.title && normalized.name) normalized.title = normalized.name;
          if (!normalized.slug && normalized.title) normalized.slug = `${normalized.title}`.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g,'') + '-' + (normalized.id || Math.random().toString(36).slice(2,8));
          if (!normalized.description) normalized.description = normalized.title || 'No description provided';
        }
        // locations: ensure map_x/map_y
        if (table === 'locations') {
          if (normalized.map_x === undefined || normalized.map_x === null) normalized.map_x = 0;
          if (normalized.map_y === undefined || normalized.map_y === null) normalized.map_y = 0;
          if (!normalized.description) normalized.description = normalized.name || 'No description provided';
        }

        // filter to existing columns only
      const keys = Object.keys(normalized).filter(k => allowedCols.includes(k));
      if (keys.length === 0) continue;

      const cols = keys;
      const vals = keys.map(k => normalized[k] === undefined ? null : normalized[k]);
      const params = vals.map((_, i) => `$${i + 1}`);
      const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${params.join(',')}) ON CONFLICT DO NOTHING`;
      await client.query(sql, vals);
      count++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Failed inserting into ${table}:`, err.message || err);
    throw err;
  } finally {
    client.release();
  }
  return count;
}

async function main() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  if (!files.length) {
    console.log('No JSON files found in', DATA_DIR);
    process.exit(0);
  }
  console.log('Found JSON files:', files.join(', '));

  const report = {};
  for (const f of files) {
    const full = path.join(DATA_DIR, f);
    try {
      const json = readJsonFile(full);
      if (f.includes('chapters')) {
        report.chapters = await insertObjects('chapters', json);
      } else if (f.includes('characters')) {
        report.characters = await insertObjects('characters', json);
      } else if (f.includes('locations')) {
        report.locations = await insertObjects('locations', json);
      } else if (f.includes('codex')) {
        report.codex_entries = await insertObjects('codex_entries', json);
      } else if (f.includes('users')) {
        report.users = await insertObjects('users', json);
      } else if (f.includes('blog') || f.includes('posts')) {
        report.blog_posts = await insertObjects('blog_posts', json);
      } else {
        // fallback: try codex_entries
        report[f] = await insertObjects('codex_entries', json);
      }
    } catch (err) {
      console.error('Error processing', f, err.message || err);
    }
  }

  console.log('Import report:', report);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
