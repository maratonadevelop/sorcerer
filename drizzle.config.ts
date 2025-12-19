import { defineConfig } from "drizzle-kit";

// Postgres-only
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL must be set for drizzle-kit');
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: 'postgresql',
  dbCredentials: {
    url,
  },
});
