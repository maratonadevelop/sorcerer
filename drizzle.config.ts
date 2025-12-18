import { defineConfig } from "drizzle-kit";

// Allow local development with SQLite (dev.sqlite) while supporting POSTGRES in prod.
const sqlitePath = process.env.DB_PATH;
const sqliteFallbackUrl = sqlitePath
  ? (sqlitePath.startsWith('file:') ? sqlitePath : `file:${sqlitePath}`)
  : 'file:./dev.sqlite';

const url = process.env.DATABASE_URL || sqliteFallbackUrl;
const dialect = url.startsWith('file:') || url.includes('sqlite') ? 'sqlite' : 'postgresql';

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect,
  dbCredentials: {
    url,
  },
});
