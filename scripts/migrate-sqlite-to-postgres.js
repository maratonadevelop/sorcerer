// scripts/migrate-sqlite-to-postgres.js
// Simple migration helper that reads rows from the local SQLite database and
// inserts them into the target Postgres database (Supabase). Adapt table names
// and columns to match your schema. Run with:
//
//   DATABASE_URL="postgresql://..." node scripts/migrate-sqlite-to-postgres.js

const Database = require('better-sqlite3');
const { Pool } = require('pg');

const SQLITE_PATH = process.env.SQLITE_PATH || './sorcerer/dev.sqlite';
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: please set DATABASE_URL env var pointing to Postgres');
  process.exit(1);
}

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function migrateTable(client, tableName, selectCols, mapRowToInsert) {
  console.log(`Migrating table: ${tableName}`);
  const rows = sqlite.prepare(`SELECT ${selectCols.join(', ')} FROM ${tableName}`).all();
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

    // TODO: adapt these calls to match your actual table/column names and order (FKs)
    await migrateTable(client, 'users', ['id','email','first_name','last_name','profile_image_url','is_admin','created_at','updated_at'], (r) => ({
      id: r.id,
      email: r.email,
      first_name: r.first_name,
      last_name: r.last_name,
      profile_image_url: r.profile_image_url,
      is_admin: r.is_admin,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    await migrateTable(client, 'chapters', ['id','title','slug','content','excerpt','chapter_number','arc_number','arc_title','reading_time','published_at','image_url'], (r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      content: r.content,
      excerpt: r.excerpt,
      chapter_number: r.chapter_number,
      arc_number: r.arc_number,
      arc_title: r.arc_title,
      reading_time: r.reading_time,
      published_at: r.published_at,
      image_url: r.image_url,
    }));

    await migrateTable(client, 'characters', ['id','name','title','description','story','slug','image_url','role'], (r) => ({
      id: r.id,
      name: r.name,
      title: r.title,
      description: r.description,
      story: r.story,
      slug: r.slug,
      image_url: r.image_url,
      role: r.role,
    }));

    await migrateTable(client, 'locations', ['id','name','description','details','image_url','slug','tags','map_x','map_y','type'], (r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      details: r.details,
      image_url: r.image_url,
      slug: r.slug,
      tags: r.tags,
      map_x: r.map_x,
      map_y: r.map_y,
      type: r.type,
    }));

    // Add other tables as needed

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
