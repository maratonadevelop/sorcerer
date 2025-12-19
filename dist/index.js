var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/ipv4-first.ts
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

// server/env.ts
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
try {
  const cwd = process.cwd();
  const isProduction2 = (process.env.NODE_ENV || "").toLowerCase() === "production";
  const runningOnRender2 = !!process.env.RENDER || !!process.env.RENDER_EXTERNAL_URL;
  if (isProduction2 || runningOnRender2) {
  } else {
    const allowOverride = true;
    const candidates = [
      // parent (workspace root)
      path.resolve(cwd, "..", ".env"),
      path.resolve(cwd, "..", ".env.local"),
      // current (app folder)
      path.resolve(cwd, ".env"),
      path.resolve(cwd, ".env.local")
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const parsed = dotenv.parse(fs.readFileSync(p));
        for (const [k, v] of Object.entries(parsed)) {
          if (allowOverride || process.env[k] === void 0) process.env[k] = v;
        }
      }
    }
    try {
      const migrateCandidates = [
        path.resolve(cwd, ".env.migrate.local"),
        path.resolve(cwd, ".env.migrate")
      ];
      for (const p of migrateCandidates) {
        if (fs.existsSync(p)) {
          const parsed = dotenv.parse(fs.readFileSync(p));
          for (const [k, v] of Object.entries(parsed)) {
            process.env[k] = v;
          }
        }
      }
    } catch {
    }
  }
} catch (e) {
}

// server/index.ts
import express2 from "express";
import compression from "compression";
import cors from "cors";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  audioAssignments: () => audioAssignments,
  audioTracks: () => audioTracks,
  blogPosts: () => blogPosts,
  chapters: () => chapters,
  characters: () => characters,
  codexEntries: () => codexEntries,
  insertAudioAssignmentSchema: () => insertAudioAssignmentSchema,
  insertAudioTrackSchema: () => insertAudioTrackSchema,
  insertBlogPostSchema: () => insertBlogPostSchema,
  insertChapterSchema: () => insertChapterSchema,
  insertCharacterSchema: () => insertCharacterSchema,
  insertCodexEntrySchema: () => insertCodexEntrySchema,
  insertLocationSchema: () => insertLocationSchema,
  insertReadingProgressSchema: () => insertReadingProgressSchema,
  locations: () => locations,
  meta: () => meta,
  readingProgress: () => readingProgress,
  sessions: () => sessions,
  users: () => users
});
import { pgTable, text, integer, index, varchar, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var chapters = pgTable("chapters", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  // Localized versions for UI content (optional)
  titleI18n: text("title_i18n"),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  contentI18n: text("content_i18n"),
  excerpt: text("excerpt").notNull(),
  excerptI18n: text("excerpt_i18n"),
  chapterNumber: integer("chapter_number").notNull(),
  // Arc metadata (optional)
  arcNumber: integer("arc_number"),
  arcTitle: text("arc_title"),
  readingTime: integer("reading_time").notNull(),
  // in minutes
  publishedAt: text("published_at").notNull(),
  imageUrl: text("image_url")
});
var characters = pgTable("characters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameI18n: text("name_i18n"),
  title: text("title").notNull(),
  titleI18n: text("title_i18n"),
  description: text("description").notNull(),
  story: text("story"),
  slug: text("slug").notNull().unique(),
  imageUrl: text("image_url"),
  role: text("role").notNull()
  // protagonist, antagonist, supporting
});
var locations = pgTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameI18n: text("name_i18n"),
  description: text("description").notNull(),
  // Short machine-friendly slug for URLs and filtering (optional but recommended)
  slug: text("slug"),
  // Long-form rich HTML/details for the location (nullable)
  details: text("details"),
  // Banner/cover image for the location
  imageUrl: text("image_url"),
  // Comma-separated tags for quick filtering (e.g. "continente,kingdom,ocean")
  tags: text("tags"),
  descriptionI18n: text("description_i18n"),
  mapX: integer("map_x").notNull(),
  // x coordinate on map (percentage)
  mapY: integer("map_y").notNull(),
  // y coordinate on map (percentage)
  type: text("type").notNull()
  // kingdom, forest, ruins, etc.
});
var codexEntries = pgTable("codex_entries", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  titleI18n: text("title_i18n"),
  description: text("description").notNull(),
  descriptionI18n: text("description_i18n"),
  // Full rich HTML content (detailed story). New column added 2025-09 to separate
  // the brief card description from the detailed page content.
  content: text("content"),
  category: text("category").notNull(),
  // magic, creatures, items, other
  imageUrl: text("image_url")
});
var blogPosts = pgTable("blog_posts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  titleI18n: text("title_i18n"),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  contentI18n: text("content_i18n"),
  excerpt: text("excerpt").notNull(),
  excerptI18n: text("excerpt_i18n"),
  category: text("category").notNull(),
  // update, world-building, behind-scenes, research
  publishedAt: text("published_at").notNull(),
  imageUrl: text("image_url")
});
var readingProgress = pgTable("reading_progress", {
  id: text("id").primaryKey(),
  chapterId: text("chapter_id").notNull().references(() => chapters.id),
  sessionId: text("session_id").notNull(),
  // browser session
  progress: integer("progress").notNull().default(0),
  // percentage read
  lastReadAt: text("last_read_at").notNull()
});
var audioTracks = pgTable("audio_tracks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  // classification for UI filtering: music | ambient | sfx
  kind: text("kind").notNull(),
  fileUrl: text("file_url").notNull(),
  loop: integer("loop").notNull().default(1),
  // 1=true 0=false
  volumeDefault: integer("volume_default").notNull().default(70),
  // 0-100 suggested
  // Max volume the end user slider is allowed to reach for this track (0-100)
  volumeUserMax: integer("volume_user_max").notNull().default(70),
  fadeInMs: integer("fade_in_ms"),
  fadeOutMs: integer("fade_out_ms"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at")
});
var audioAssignments = pgTable("audio_assignments", {
  id: text("id").primaryKey(),
  trackId: text("track_id").notNull().references(() => audioTracks.id),
  // entityType: 'global'|'page'|'chapter'|'character'|'codex'|'location'
  entityType: text("entity_type").notNull(),
  // entityId nullable for global or page-level assignments (e.g., page=codex)
  entityId: text("entity_id"),
  // Higher number overrides lower for same specificity
  priority: integer("priority").notNull().default(1),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at"),
  updatedAt: text("updated_at")
});
var insertChapterSchema = createInsertSchema(chapters).omit({
  id: true
});
var insertCharacterSchema = createInsertSchema(characters).omit({
  id: true
});
var insertLocationSchema = createInsertSchema(locations).omit({
  id: true
});
var insertCodexEntrySchema = createInsertSchema(codexEntries).omit({
  id: true
});
var insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true
});
var insertReadingProgressSchema = createInsertSchema(readingProgress).omit({
  id: true
});
var insertAudioTrackSchema = createInsertSchema(audioTracks).omit({
  id: true
});
var insertAudioAssignmentSchema = createInsertSchema(audioAssignments).omit({
  id: true
});
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid", { length: 255 }).primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
var users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  // Password hash for server-side authentication (bcrypt)
  passwordHash: text("password_hash"),
  isAdmin: integer("is_admin").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at")
});
var meta = pgTable("meta", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: text("updated_at")
});

// server/db.ts
import postgres from "postgres";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
var env = (k, d) => process.env[k] ?? d ?? "";
var isProduction = (process.env.NODE_ENV || "").toLowerCase() === "production";
var runningOnRender = !!process.env.RENDER || !!process.env.RENDER_EXTERNAL_URL;
console.log(`RENDER detected: ${runningOnRender ? "yes" : "no"}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || "<unset>"}`);
console.log(`DATABASE_URL set: ${process.env.DATABASE_URL ? "yes (length: " + process.env.DATABASE_URL.length + ")" : "no"}`);
var databaseUrl = env("DATABASE_URL", "");
var explicitWriteUrl = env("DATABASE_URL_WRITE", "");
var looksLikePostgres = (u) => u.startsWith("postgres://") || u.startsWith("postgresql://");
var maskDbUrl = (url) => {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return url.replace(/:\/\/[^@]*@/, "://****@");
  }
};
var effectiveWriteUrl = explicitWriteUrl || databaseUrl;
if (!effectiveWriteUrl || !looksLikePostgres(effectiveWriteUrl)) {
  console.error("Fatal: DATABASE_URL (or DATABASE_URL_WRITE) must be set to a Postgres connection string.");
  console.error(`Current DATABASE_URL: ${databaseUrl ? maskDbUrl(databaseUrl) : "<empty>"}`);
  process.exit(1);
}
var baseWriteUrl = effectiveWriteUrl;
var baseReadUrl = env("DATABASE_URL_READ", baseWriteUrl);
var ensureParams = (u, extra) => {
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
var db;
var pool;
var failStreak = 0;
var circuitOpenUntil = 0;
var maxFails = parseInt(env("DB_HEALTH_FAILS_TO_TRIP", "3"), 10);
var openMs = parseInt(env("DB_HEALTH_OPEN_AFTER_MS", "15000"), 10);
async function withRetry(fn, tries = 2, baseDelayMs = 120) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const transient = ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"].includes(err?.code) || /timeout/i.test(err?.message ?? "");
      if (!transient || i === tries - 1) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}
{
  const writeUrl = ensureParams(baseWriteUrl, { sslmode: "require" });
  const readUrl = ensureParams(baseReadUrl, { sslmode: "require" });
  const postgresOptions = {
    ssl: { rejectUnauthorized: env("DB_SSL_STRICT", "false") === "true" },
    max: parseInt(env("DB_POOL_MAX", "10"), 10),
    idle_timeout: parseInt(env("DB_IDLE_TIMEOUT_MS", "30000"), 10),
    // Silence benign Postgres NOTICE messages like "relation already exists"
    onnotice: () => {
    },
    keep_alive: 1,
    // Force IPv4 DNS resolution to avoid IPv6 connectivity issues
    connection: {
      options: "--search_path=public"
    }
  };
  const sqlWrite = postgres(writeUrl, {
    ...postgresOptions,
    // Force IPv4 by setting the family option via fetch options
    fetch_types: false
  });
  const sqlRead = postgres(readUrl, {
    ...postgresOptions,
    max: Math.max(2, Math.floor(parseInt(env("DB_POOL_MAX", "10"), 10) / 2)),
    fetch_types: false
  });
  db = drizzlePostgres(sqlWrite, { schema: schema_exports });
  pool = sqlWrite;
  const ensurePostgresSchema = async () => {
    try {
      await sqlWrite`CREATE TABLE IF NOT EXISTS chapters (
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
      )`;
      await sqlWrite`CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_i18n TEXT,
        title TEXT,
        title_i18n TEXT,
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
        name_i18n TEXT,
        description_i18n TEXT,
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
        title_i18n TEXT,
        description_i18n TEXT,
        content TEXT,
        category TEXT NOT NULL,
        image_url TEXT
      )`;
      await sqlWrite`CREATE TABLE IF NOT EXISTS blog_posts (
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
        volume_user_max INTEGER NOT NULL DEFAULT 70,
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
        sid VARCHAR(255) NOT NULL PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )`;
      await sqlWrite`CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)`;
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
      const addCol = async (table, col, ddl) => {
        try {
          await sqlWrite.unsafe(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${ddl}`);
        } catch {
        }
      };
      await addCol("chapters", "title_i18n", "TEXT");
      await addCol("chapters", "content_i18n", "TEXT");
      await addCol("chapters", "excerpt_i18n", "TEXT");
      await addCol("characters", "name_i18n", "TEXT");
      await addCol("characters", "title_i18n", "TEXT");
      await addCol("locations", "name_i18n", "TEXT");
      await addCol("locations", "description_i18n", "TEXT");
      await addCol("codex_entries", "title_i18n", "TEXT");
      await addCol("codex_entries", "description_i18n", "TEXT");
      await addCol("codex_entries", "content", "TEXT");
      await addCol("blog_posts", "title_i18n", "TEXT");
      await addCol("blog_posts", "content_i18n", "TEXT");
      await addCol("blog_posts", "excerpt_i18n", "TEXT");
      await addCol("audio_tracks", "volume_user_max", "INTEGER NOT NULL DEFAULT 70");
      await addCol("users", "password_hash", "TEXT");
    } catch (e) {
      console.warn("Failed to ensure Postgres schema (will continue):", e);
    }
  };
  async function initPostgres() {
    const stmtMs = parseInt(env("DB_STMT_TIMEOUT_MS", "15000"), 10);
    const idleTxMs = parseInt(env("DB_IDLE_TX_TIMEOUT_MS", "15000"), 10);
    try {
      await withRetry(async () => {
        await sqlWrite.unsafe(`set statement_timeout = ${Math.max(0, Number.isFinite(stmtMs) ? stmtMs : 15e3)}`);
        await sqlWrite.unsafe(`set idle_in_transaction_session_timeout = ${Math.max(0, Number.isFinite(idleTxMs) ? idleTxMs : 15e3)}`);
        await sqlWrite.unsafe(`set lock_timeout = 5000`);
      });
    } catch (e) {
      console.warn("Could not apply session timeouts (v2):", e?.message || e);
    }
    await ensurePostgresSchema();
    console.log(`Using database (write): ${maskDbUrl(writeUrl)}`);
    if (readUrl !== writeUrl) console.log(`Using database (read) : ${maskDbUrl(readUrl)}`);
    console.log("Connected to Postgres (Supabase)");
  }
  pool._sqlRead = sqlRead;
  pool._init = initPostgres;
}
async function dbReadyPing() {
  try {
    const read = pool?._sqlRead || pool;
    await withRetry(() => read`select 1`, 2);
    failStreak = 0;
    return true;
  } catch {
    failStreak++;
    if (failStreak >= maxFails) circuitOpenUntil = Date.now() + parseInt(env("DB_HEALTH_OPEN_AFTER_MS", "15000"), 10);
    return false;
  }
}
function dbCircuitOpen() {
  return Date.now() < circuitOpenUntil;
}
async function dbInit() {
  if (pool?._init) {
    await pool._init();
  }
}

// server/storage.ts
import { eq, and } from "drizzle-orm";
import fs3 from "fs";
import path3 from "path";
import { randomUUID } from "crypto";

// server/importers/fullnovel.ts
import fs2 from "fs";
import path2 from "path";
function mdToHtml(md) {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let para = [];
  const flush = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" ").trim())}</p>`);
      para = [];
    }
  };
  const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/`([^`]+)`/g, "<code>$1</code>");
  for (const line of lines) {
    const l = line.trimEnd();
    if (/^#{1,6}\s+/.test(l)) {
      flush();
      const level = l.match(/^#+/)?.[0].length || 1;
      const text2 = l.replace(/^#{1,6}\s+/, "");
      out.push(`<h${level}>${inline(text2)}</h${level}>`);
      continue;
    }
    if (l === "") {
      flush();
      continue;
    }
    para.push(l);
  }
  flush();
  return out.join("\n");
}
function parseFullNovelMarkdown(filePath) {
  const candidates = [
    filePath ? path2.resolve(filePath) : "",
    path2.resolve(process.cwd(), "sorcerer", "attached_assets", "FullNOVEL.md"),
    path2.resolve(process.cwd(), "attached_assets", "FullNOVEL.md")
  ].filter(Boolean);
  const fp = candidates.find((p) => fs2.existsSync(p));
  if (!fp) return [];
  const raw = fs2.readFileSync(fp, "utf8");
  const content = raw.replace(/\r\n?/g, "\n");
  const headingRe = /^##\s*Cap[íi]tulo\s+(\d+)\s*[:\-]\s*(.*)$/gmi;
  const matches = [];
  for (const m of content.matchAll(headingRe)) {
    const idx = m.index;
    if (typeof idx !== "number") continue;
    const full = m[0] || "";
    const num = parseInt(m[1], 10);
    const titleRest = (m[2] || "").trim();
    matches.push({ index: idx, length: full.length, num, title: titleRest });
  }
  const chapters2 = [];
  for (let i = 0; i < matches.length; i++) {
    const h = matches[i];
    const startBody = h.index + h.length;
    const endBody = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const body = content.slice(startBody, endBody).trim();
    const num = h.num;
    const restTitle = h.title;
    const displayTitle = `Cap\xEDtulo ${num} \u2014 ${restTitle || (num === 1 ? "Pr\xF3logo" : "")}`.trim();
    const slug = `arco-1-o-limiar-capitulo-${num}`;
    const plain = body.replace(/\*\*|\*/g, "").replace(/\n+/g, " ").trim();
    const sentences = plain.split(/(?<=[.!?])\s+/).filter(Boolean);
    let excerpt = sentences.slice(0, 3).join(" ");
    if (excerpt.length > 300) excerpt = excerpt.slice(0, 300).trim() + "\u2026";
    const contentHtml = mdToHtml(body);
    chapters2.push({
      title: displayTitle,
      slug,
      excerpt,
      contentHtml,
      chapterNumber: num,
      arcNumber: 1,
      arcTitle: "O Limiar"
    });
  }
  return chapters2;
}

// server/storage.ts
import bcrypt from "bcryptjs";
var DatabaseStorage = class {
  constructor() {
    this.seedData();
  }
  // Helper: create a filesystem-safe, url-friendly slug
  slugify(input) {
    const s = (input || "").toString().trim().toLowerCase();
    const normalized = s.normalize ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : s;
    return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^[-]+|[-]+$/g, "");
  }
  // Ensure the slug is unique in `characters`. If `ignoreId` is provided, that row is excluded
  async ensureUniqueCharacterSlug(desiredSlug, ignoreId) {
    let base = this.slugify(desiredSlug) || this.slugify(desiredSlug) || "char";
    let slug = base;
    let i = 0;
    while (true) {
      const rows = await db.select().from(characters).where(eq(characters.slug, slug));
      const existing = rows.find((r) => ignoreId ? r.id !== ignoreId : true);
      if (!existing) return slug;
      i += 1;
      slug = `${base}-${i}`;
      if (i > 50) return `${base}-${Date.now()}`;
    }
  }
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  async upsertUser(userData) {
    const [user] = await db.insert(users).values(userData).onConflictDoUpdate({
      target: users.id,
      set: {
        ...userData,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    }).returning();
    return user;
  }
  // Helper: create user by email (used for admin seed) if not present
  async createUserIfNotExists(id, email, passwordHash, isAdmin2) {
    const existing = await this.getUser(id);
    if (existing) return existing;
    return this.upsertUser({ id, email, passwordHash, isAdmin: isAdmin2 ? 1 : 0, createdAt: (/* @__PURE__ */ new Date()).toISOString(), updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
  }
  // Chapter methods
  async getChapters() {
    try {
      return await db.select().from(chapters).orderBy(chapters.chapterNumber);
    } catch (error) {
      console.error("DB error in getChapters:", error);
      return [];
    }
  }
  async getChapterBySlug(slug) {
    try {
      const [chapter] = await db.select().from(chapters).where(eq(chapters.slug, slug));
      return chapter;
    } catch (error) {
      console.error("DB error in getChapterBySlug:", error);
      return void 0;
    }
  }
  async getChapterById(id) {
    try {
      const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id));
      return chapter;
    } catch (error) {
      console.error("DB error in getChapterById:", error);
      return void 0;
    }
  }
  async createChapter(chapter) {
    const payload = { ...chapter };
    if (!payload.id) payload.id = randomUUID();
    try {
      const [newChapter] = await db.insert(chapters).values(payload).returning();
      if (newChapter) return newChapter;
    } catch (e) {
      console.warn("Insert returning not supported or failed for chapters, falling back to SELECT:", e);
    }
    const [f] = await db.select().from(chapters).where(eq(chapters.id, payload.id));
    if (f) return f;
    return payload;
  }
  async updateChapter(id, chapter) {
    try {
      const [updatedChapter] = await db.update(chapters).set(chapter).where(eq(chapters.id, id)).returning();
      if (updatedChapter) return updatedChapter;
    } catch (e) {
      console.warn("Update returning not supported or failed for chapters, falling back to SELECT:", e);
    }
    const [f] = await db.select().from(chapters).where(eq(chapters.id, id));
    return f;
  }
  async deleteChapter(id) {
    const [existing] = await db.select().from(chapters).where(eq(chapters.id, id));
    if (!existing) return false;
    await db.delete(chapters).where(eq(chapters.id, id));
    return true;
  }
  // Character methods
  async getCharacters() {
    try {
      return await db.select().from(characters);
    } catch (error) {
      console.error("DB error in getCharacters:", error);
      try {
        const offlineFile = path3.resolve(process.cwd(), "data", "offline-characters.json");
        const data = await fs3.promises.readFile(offlineFile, "utf-8");
        const arr = JSON.parse(data || "[]");
        return arr;
      } catch (fileErr) {
        return [];
      }
    }
  }
  async getCharacterById(id) {
    try {
      const [character] = await db.select().from(characters).where(eq(characters.id, id));
      return character;
    } catch (error) {
      console.error("DB error in getCharacterById:", error);
      try {
        const offlineFile = path3.resolve(process.cwd(), "data", "offline-characters.json");
        const data = await fs3.promises.readFile(offlineFile, "utf-8");
        const arr = JSON.parse(data || "[]");
        return arr.find((c) => c.id === id);
      } catch (fileErr) {
        return void 0;
      }
    }
  }
  async getCharacterBySlug(slug) {
    const [character] = await db.select().from(characters).where(eq(characters.slug, slug));
    return character;
  }
  async createCharacter(character) {
    const payload = { ...character };
    if (!payload.id) payload.id = randomUUID();
    try {
      payload.slug = await this.ensureUniqueCharacterSlug(payload.slug || payload.name || payload.id);
    } catch (e) {
      payload.slug = this.slugify(payload.slug || payload.name || payload.id);
    }
    try {
      const [newCharacter] = await db.insert(characters).values(payload).returning();
      if (newCharacter) return newCharacter;
    } catch (e) {
      console.warn("Insert returning not supported or failed for characters, falling back to SELECT:", e);
    }
    const [f] = await db.select().from(characters).where(eq(characters.id, payload.id));
    if (f) return f;
    return payload;
  }
  async updateCharacter(id, character) {
    const toUpdate = { ...character };
    if (toUpdate.slug || toUpdate.name) {
      try {
        toUpdate.slug = await this.ensureUniqueCharacterSlug(toUpdate.slug || toUpdate.name || id, id);
      } catch (e) {
        toUpdate.slug = this.slugify(toUpdate.slug || toUpdate.name || id);
      }
    }
    try {
      const [updatedCharacter] = await db.update(characters).set(toUpdate).where(eq(characters.id, id)).returning();
      if (updatedCharacter) return updatedCharacter;
    } catch (e) {
      console.warn("Update returning not supported or failed for characters, falling back to SELECT:", e);
    }
    const [f] = await db.select().from(characters).where(eq(characters.id, id));
    return f;
  }
  async deleteCharacter(id) {
    const [existing] = await db.select().from(characters).where(eq(characters.id, id));
    if (!existing) return false;
    await db.delete(characters).where(eq(characters.id, id));
    return true;
  }
  // Location methods
  async getLocations() {
    try {
      return await db.select().from(locations);
    } catch (error) {
      console.error("DB error in getLocations:", error);
      try {
        const offlineFile = path3.resolve(process.cwd(), "data", "offline-locations.json");
        const data = await fs3.promises.readFile(offlineFile, "utf-8");
        const arr = JSON.parse(data || "[]");
        return arr;
      } catch (fileErr) {
        return [];
      }
    }
  }
  async getLocationById(id) {
    try {
      const [location] = await db.select().from(locations).where(eq(locations.id, id));
      return location;
    } catch (error) {
      console.error("DB error in getLocationById:", error);
      return void 0;
    }
  }
  async createLocation(location) {
    const payload = { ...location };
    if (!payload.id) payload.id = randomUUID();
    try {
      const [newLocation] = await db.insert(locations).values(payload).returning();
      if (newLocation) return newLocation;
    } catch (e) {
      console.warn("Insert returning not supported or failed for locations, falling back to SELECT:", e);
    }
    const [f] = await db.select().from(locations).where(eq(locations.id, payload.id));
    if (f) return f;
    return payload;
  }
  async updateLocation(id, location) {
    try {
      console.log("storage.updateLocation id=", id, "payload=", JSON.stringify(location));
      const [updatedLocation] = await db.update(locations).set(location).where(eq(locations.id, id)).returning();
      if (updatedLocation) {
        console.log("storage.updateLocation returning updated row for id=", id);
        return updatedLocation;
      }
    } catch (e) {
      console.warn("Update returning not supported or failed for locations, falling back to SELECT:", e);
    }
    try {
      const [f] = await db.select().from(locations).where(eq(locations.id, id));
      console.log("storage.updateLocation SELECT fallback result for id=", id, f ? JSON.stringify(f) : "(not found)");
      return f;
    } catch (e) {
      console.error("storage.updateLocation SELECT fallback failed for id=", id, e);
      return void 0;
    }
  }
  async deleteLocation(id) {
    const [existing] = await db.select().from(locations).where(eq(locations.id, id));
    if (!existing) return false;
    await db.delete(locations).where(eq(locations.id, id));
    return true;
  }
  // Codex methods
  async getCodexEntries() {
    try {
      return await db.select().from(codexEntries);
    } catch (error) {
      console.error("DB error in getCodexEntries:", error);
      try {
        const offlineFile = path3.resolve(process.cwd(), "data", "offline-codex.json");
        const data = await fs3.promises.readFile(offlineFile, "utf-8");
        const arr = JSON.parse(data || "[]");
        return arr;
      } catch (fileErr) {
        return [];
      }
    }
  }
  async getCodexEntriesByCategory(category) {
    try {
      return await db.select().from(codexEntries).where(eq(codexEntries.category, category));
    } catch (error) {
      console.error("DB error in getCodexEntriesByCategory:", error);
      return [];
    }
  }
  async getCodexEntryById(id) {
    try {
      const [entry] = await db.select().from(codexEntries).where(eq(codexEntries.id, id));
      return entry;
    } catch (error) {
      console.error("DB error in getCodexEntryById:", error);
      return void 0;
    }
  }
  async createCodexEntry(entry) {
    const payload = { ...entry };
    if (!payload.id) payload.id = randomUUID();
    try {
      const [newEntry] = await db.insert(codexEntries).values(payload).returning();
      if (newEntry) return newEntry;
    } catch (e) {
      console.warn("Insert returning not supported or failed for codex entries, falling back to SELECT:", e);
    }
    const [f] = await db.select().from(codexEntries).where(eq(codexEntries.id, payload.id));
    if (f) return f;
    return payload;
  }
  async updateCodexEntry(id, entry) {
    try {
      const [updatedEntry] = await db.update(codexEntries).set(entry).where(eq(codexEntries.id, id)).returning();
      if (updatedEntry) return updatedEntry;
    } catch (e) {
      console.warn("Update returning not supported or failed for codex entries, falling back to SELECT:", e);
    }
    const [f] = await db.select().from(codexEntries).where(eq(codexEntries.id, id));
    return f;
  }
  async deleteCodexEntry(id) {
    const [existing] = await db.select().from(codexEntries).where(eq(codexEntries.id, id));
    if (!existing) return false;
    await db.delete(codexEntries).where(eq(codexEntries.id, id));
    return true;
  }
  // Blog methods
  async getBlogPosts() {
    try {
      return await db.select().from(blogPosts).orderBy(blogPosts.publishedAt);
    } catch (error) {
      console.error("DB error in getBlogPosts:", error);
      return [];
    }
  }
  async getBlogPostBySlug(slug) {
    try {
      const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
      return post;
    } catch (error) {
      console.error("DB error in getBlogPostBySlug:", error);
      return void 0;
    }
  }
  async getBlogPostById(id) {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }
  async createBlogPost(post) {
    const payload = { ...post };
    if (!payload.id) payload.id = randomUUID();
    try {
      payload.slug = await this.ensureUniqueCharacterSlug(payload.slug || payload.title || payload.id);
    } catch (e) {
      payload.slug = this.slugify(payload.slug || payload.title || payload.id);
    }
    try {
      const [newPost] = await db.insert(blogPosts).values(payload).returning();
      if (newPost) return newPost;
    } catch (e) {
      console.warn("Insert returning not supported or failed for blog posts, falling back to SELECT:", e);
    }
    const [f] = await db.select().from(blogPosts).where(eq(blogPosts.id, payload.id));
    if (f) return f;
    return payload;
  }
  async updateBlogPost(id, post) {
    const toUpdate = { ...post };
    if (toUpdate.slug || toUpdate.title) {
      try {
        toUpdate.slug = await this.ensureUniqueCharacterSlug(toUpdate.slug || toUpdate.title || id, id);
      } catch (e) {
        toUpdate.slug = this.slugify(toUpdate.slug || toUpdate.title || id);
      }
    }
    try {
      const [updatedPost] = await db.update(blogPosts).set(toUpdate).where(eq(blogPosts.id, id)).returning();
      if (updatedPost) return updatedPost;
    } catch (e) {
      console.warn("Update returning not supported or failed for blog posts, falling back to SELECT:", e);
    }
    const [f] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return f;
  }
  async deleteBlogPost(id) {
    const [existing] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    if (!existing) return false;
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
    return true;
  }
  // Reading progress methods
  async getReadingProgress(sessionId, chapterId) {
    const [progress] = await db.select().from(readingProgress).where(and(eq(readingProgress.sessionId, sessionId), eq(readingProgress.chapterId, chapterId)));
    return progress;
  }
  async updateReadingProgress(sessionId, chapterId, progress) {
    try {
      const [existingProgress] = await db.update(readingProgress).set({
        progress,
        lastReadAt: (/* @__PURE__ */ new Date()).toISOString()
      }).where(and(eq(readingProgress.sessionId, sessionId), eq(readingProgress.chapterId, chapterId))).returning();
      if (existingProgress) {
        return existingProgress;
      }
      const [newProgress] = await db.insert(readingProgress).values({
        sessionId,
        chapterId,
        progress,
        lastReadAt: (/* @__PURE__ */ new Date()).toISOString()
      }).returning();
      return newProgress;
    } catch (error) {
      console.error("DB error in updateReadingProgress:", error);
      throw error;
    }
  }
  // Audio system methods
  async getAudioTracks() {
    try {
      return await db.select().from(audioTracks);
    } catch (e) {
      console.error("DB error getAudioTracks:", e);
      return [];
    }
  }
  async getAudioTrack(id) {
    try {
      const [row] = await db.select().from(audioTracks).where(eq(audioTracks.id, id));
      return row;
    } catch (e) {
      return void 0;
    }
  }
  async createAudioTrack(track) {
    const payload = { ...track };
    if (!payload.id) payload.id = randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    payload.createdAt = payload.createdAt || now;
    payload.updatedAt = now;
    try {
      const [row] = await db.insert(audioTracks).values(payload).returning();
      if (row) return row;
    } catch (e) {
      console.warn("Insert audioTracks returning failed, fallback SELECT:", e);
    }
    const [f] = await db.select().from(audioTracks).where(eq(audioTracks.id, payload.id));
    return f || payload;
  }
  async updateAudioTrack(id, patch) {
    const toUpdate = { ...patch, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    try {
      const [row] = await db.update(audioTracks).set(toUpdate).where(eq(audioTracks.id, id)).returning();
      if (row) return row;
    } catch (e) {
      console.warn("Update audioTracks returning failed, fallback SELECT:", e);
    }
    const [f] = await db.select().from(audioTracks).where(eq(audioTracks.id, id));
    return f;
  }
  async deleteAudioTrack(id) {
    const [existing] = await db.select().from(audioTracks).where(eq(audioTracks.id, id));
    if (!existing) return false;
    await db.delete(audioTracks).where(eq(audioTracks.id, id));
    try {
      await db.delete(audioAssignments).where(eq(audioAssignments.trackId, id));
    } catch {
    }
    return true;
  }
  async getAudioAssignments() {
    try {
      return await db.select().from(audioAssignments);
    } catch (e) {
      console.error("DB error getAudioAssignments:", e);
      return [];
    }
  }
  async getAudioAssignment(id) {
    try {
      const [row] = await db.select().from(audioAssignments).where(eq(audioAssignments.id, id));
      return row;
    } catch {
      return void 0;
    }
  }
  async createAudioAssignment(assign) {
    const payload = { ...assign };
    if (!payload.id) payload.id = randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    payload.createdAt = payload.createdAt || now;
    payload.updatedAt = now;
    try {
      const [row] = await db.insert(audioAssignments).values(payload).returning();
      if (row) return row;
    } catch (e) {
      console.warn("Insert audioAssignments returning failed, fallback SELECT:", e);
    }
    const [f] = await db.select().from(audioAssignments).where(eq(audioAssignments.id, payload.id));
    return f || payload;
  }
  async updateAudioAssignment(id, patch) {
    const toUpdate = { ...patch, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    try {
      const [row] = await db.update(audioAssignments).set(toUpdate).where(eq(audioAssignments.id, id)).returning();
      if (row) return row;
    } catch (e) {
      console.warn("Update audioAssignments returning failed, fallback SELECT:", e);
    }
    const [f] = await db.select().from(audioAssignments).where(eq(audioAssignments.id, id));
    return f;
  }
  async deleteAudioAssignment(id) {
    const [existing] = await db.select().from(audioAssignments).where(eq(audioAssignments.id, id));
    if (!existing) return false;
    await db.delete(audioAssignments).where(eq(audioAssignments.id, id));
    return true;
  }
  async resolveAudio(params) {
    try {
      const wants = [];
      if (params.chapterId) wants.push({ type: "chapter", id: params.chapterId });
      if (params.characterId) wants.push({ type: "character", id: params.characterId });
      if (params.codexId) wants.push({ type: "codex", id: params.codexId });
      if (params.locationId) wants.push({ type: "location", id: params.locationId });
      if (params.page) wants.push({ type: "page", id: params.page });
      wants.push({ type: "global" });
      const list = await this.getAudioAssignments();
      const filtered = (list || []).filter((a) => {
        if (!a.active) return false;
        if (a.entityType === "chapter" && params.chapterId) return a.entityId === params.chapterId;
        if (a.entityType === "character" && params.characterId) return a.entityId === params.characterId;
        if (a.entityType === "codex" && params.codexId) return a.entityId === params.codexId;
        if (a.entityType === "location" && params.locationId) return a.entityId === params.locationId;
        if (a.entityType === "page" && params.page) return a.entityId === params.page;
        if (a.entityType === "global") return true;
        return false;
      });
      if (filtered.length === 0) return void 0;
      const specRank = (t) => ["chapter", "character", "codex", "location"].includes(t) ? 3 : t === "global" ? 2 : 1;
      filtered.sort((a, b) => {
        const s = specRank(b.entityType) - specRank(a.entityType);
        if (s !== 0) return s;
        return (b.priority || 0) - (a.priority || 0);
      });
      return await this.getAudioTrack(filtered[0].trackId);
    } catch (e) {
      console.warn("resolveAudio failed:", e);
      return void 0;
    }
  }
  async seedData() {
    try {
      const getMeta = async (key) => {
        try {
          const rows = await pool`SELECT value FROM meta WHERE key=${key} LIMIT 1`;
          return rows && rows[0] ? rows[0].value : void 0;
        } catch {
          return void 0;
        }
      };
      const setMeta = async (key, value) => {
        const iso = (/* @__PURE__ */ new Date()).toISOString();
        try {
          await pool`INSERT INTO meta(key, value, updated_at) VALUES(${key}, ${value}, ${iso}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at`;
          return;
        } catch (e) {
          try {
            await pool`DELETE FROM meta WHERE key=${key}`;
            await pool`INSERT INTO meta(key, value, updated_at) VALUES(${key}, ${value}, ${iso})`;
            return;
          } catch {
          }
        }
      };
      try {
        const existingCodex = await this.getCodexEntries();
        if (!existingCodex || existingCodex.length === 0) {
          const manaHtml = `<h2>Sistema de An\xE9is de Mana</h2><h3>Sistema de Conex\xE3o de An\xE9is de Mana</h3><p>O Sistema de Conex\xE3o de An\xE9is de Mana \xE9 uma estrutura de desenvolvimento arcano que organiza o dom\xEDnio de mana em sete n\xEDveis ascendentes. Cada "anel" representa um est\xE1gio de habilidade e controle, do contato inicial com mana \xE0 transcend\xEAncia c\xF3smica. Este sistema guia praticantes em uma jornada de evolu\xE7\xE3o m\xE1gica, de manipula\xE7\xF5es b\xE1sicas \xE0 cria\xE7\xE3o de novas realidades.</p><p><strong>Para Cada Subn\xEDvel</strong>: C\xF3digo de Identifica\xE7\xE3o: [X.Y] (X = Anel, Y = Subn\xEDvel)</p><p><strong>Indicadores de Dom\xEDnio</strong>: [Sinais de Progresso]</p><p><strong>Falhas Comuns</strong>: [Indicadores de problemas no uso e magia daquele anel]</p><hr/><h3>Conex\xE3o de Anel de Mana 1: Anel do Despertar</h3><p><em>Descri\xE7\xE3o</em>: Primeiro contato e manipula\xE7\xE3o inicial de mana.</p><p><em>Riscos</em>: Exaust\xE3o mental, confus\xE3o sensorial.</p><p><em>Marca</em>: Aura vis\xEDvel fraca.</p><h4>[1.1] Percep\xE7\xE3o de Mana</h4><ul><li><strong>Habilidade</strong>: Sentir a presen\xE7a de mana.</li><li><strong>Desafios</strong>: Ajustar-se a uma nova sensa\xE7\xE3o, Mana.</li><li><strong>Indicadores de Dom\xEDnio</strong>: Identifica\xE7\xE3o consistente de fontes de mana.</li><li><strong>Falhas Comuns</strong>: Sobrecarga sensorial, dorm\xEAncia.</li></ul><h4>[1.2] Controle Inicial</h4><ul><li><strong>Habilidade</strong>: Manipula\xE7\xE3o b\xE1sica de mana interna.</li><li><strong>Desafios</strong>: Resili\xEAncia mental e f\xEDsica.</li><li><strong>Indicadores de Dom\xEDnio</strong>: Canalizar mana sem desgaste excessivo.</li><li><strong>Falhas Comuns</strong>: Fluxo de energia ineficiente, fadiga excessiva.</li></ul><h4>[1.3] Primeiras Manipula\xE7\xF5es</h4><ul><li><strong>Habilidade</strong>: Gerar manifesta\xE7\xF5es simples.</li><li><strong>Desafios</strong>: Manter controle constante.</li><li><strong>Indicadores de Dom\xEDnio</strong>: Criar pulsos de aura est\xE1veis.</li><li><strong>Falhas Comuns</strong>: Desconex\xE3o s\xFAbita, dissipa\xE7\xE3o r\xE1pida.</li></ul><hr/><h3>Conex\xE3o de Anel de Mana 2: Anel da Forja Interna</h3><p><em>Descri\xE7\xE3o</em>: Dom\xEDnio corporal e infus\xE3o de mana em objetos.</p><p><em>Riscos</em>: Desequil\xEDbrio f\xEDsico, sobrecarga de objetos.</p><p><em>Marca</em>: Fortalecimento f\xEDsico vis\xEDvel.</p><h4>[2.1] Fortifica\xE7\xE3o F\xEDsica</h4><ul><li><strong>Habilidade</strong>: Aprimoramento f\xEDsico com mana.</li><li><strong>Desafios</strong>: Equilibrar aprimoramento pelo corpo.</li><li><strong>Indicadores de Dom\xEDnio</strong>: Fortifica\xE7\xE3o corporal uniforme.</li><li><strong>Falhas Comuns</strong>: Desequil\xEDbrio entre membros.</li></ul><h4>[2.2] Infus\xE3o B\xE1sica</h4><ul><li><strong>Habilidade</strong>: Carregar objetos com mana.</li><li><strong>Desafios</strong>: Manter infus\xE3o est\xE1vel.</li><li><strong>Indicadores de Dom\xEDnio</strong>: Infus\xE3o de longa dura\xE7\xE3o.</li><li><strong>Falhas Comuns</strong>: Deteriora\xE7\xE3o de objetos, radia\xE7\xE3o m\xE1gica.</li></ul><h4>[2.3] Dom\xEDnio Interno de Mana</h4><ul><li><strong>Habilidade</strong>: Controle completo de mana interna pessoal.</li><li><strong>Desafios</strong>: Manter amplifica\xE7\xF5es est\xE1veis.</li><li><strong>Indicadores de Dom\xEDnio</strong>: Encantamentos cont\xEDnuos.</li><li><strong>Falhas Comuns</strong>: Instabilidade sob estresse.</li></ul><hr/><h3>Conex\xE3o de Anel de Mana 3: Anel da Expans\xE3o</h3><p><em>Descri\xE7\xE3o</em>: Manipula\xE7\xE3o de mana al\xE9m do corpo.</p><p><em>Riscos</em>: Desequil\xEDbrio ambiental, esgotamento de mana.</p><p><em>Marca</em>: Aura mais densa.</p><h4>[3.1] Manipula\xE7\xE3o Externa</h4><ul><li><strong>Habilidade</strong>: Afetar o ambiente com mana; concentrar quantidade significativa de energia fora do corpo.</li><li><strong>Desafios</strong>: Controle sobre grandes quantidades de energia.</li><li><strong>Indicadores de Dom\xEDnio</strong>: Manipula\xE7\xE3o precisa de mana.</li><li><strong>Falhas Comuns</strong>: Perda de controle, resist\xEAncia mental.</li></ul><h4>[3.2] Sentinela Elemental</h4><ul><li><strong>Habilidade</strong>: Controle b\xE1sico de elementos externos e internos.</li><li><strong>Desafios</strong>: Efeitos colaterais de elementos, como superaquecimento com fogo.</li><li><strong>Indicadores de Dom\xEDnio</strong>: Harmonia entre mana interna e externa.</li><li><strong>Falhas Comuns</strong>: Esgotamento excessivo de mana.</li></ul><h4>[3.3] Consolida\xE7\xE3o Elemental</h4><ul><li><strong>Habilidade</strong>: Controle efetivo de elementos.</li><li><strong>Desafios</strong>: Equil\xEDbrio ambiental.</li><li><strong>Indicadores de Dom\xEDnio</strong>: Intera\xE7\xE3o harmoniosa com elementos.</li><li><strong>Falhas Comuns</strong>: Drenagem ambiental excessiva.</li></ul><hr/><h3>Conex\xE3o de Anel de Mana 4: Anel da Harmonia</h3><p><em>Descri\xE7\xE3o</em>: Dom\xEDnio elemental avan\xE7ado e harmonia suprema com mana interna e externa.</p><p><em>Riscos</em>: Instabilidade ambiental, altera\xE7\xF5es clim\xE1ticas.</p><p><em>Marca</em>: Manifesta\xE7\xF5es elementais poderosas.</p><h4>[4.1] Coordena\xE7\xE3o Elemental</h4><ul><li><strong>Habilidade</strong>: Manipular m\xFAltiplos elementos simultaneamente.</li><li><strong>Desafios</strong>: Manter equil\xEDbrio natural.</li><li><strong>Indicadores de Dom\xEDnio</strong>: Controle multi-elemental.</li><li><strong>Falhas Comuns</strong>: Mudan\xE7as clim\xE1ticas n\xE3o intencionais.</li></ul><h4>[4.2] Controle Destrutivo</h4><ul><li><strong>Habilidade</strong>: Magia em larga escala.</li><li><strong>Desafios</strong>: Estabilidade do ecossistema.</li><li><strong>Indicadores de Dom\xEDnio</strong>: Destrui\xE7\xE3o controlada.</li><li><strong>Falhas Comuns</strong>: Desequil\xEDbrio regional de mana.</li></ul><h4>[4.3] Manipula\xE7\xE3o Avan\xE7ada</h4><ul><li><strong>Habilidade</strong>: Transforma\xE7\xE3o ambiental.</li><li><strong>Desafios</strong>: Controle absoluto.</li><li><strong>Indicadores de Dom\xEDnio</strong>: Cria\xE7\xE3o de ecossistemas.</li><li><strong>Falhas Comuns</strong>: Altera\xE7\xF5es clim\xE1ticas permanentes.</li></ul><hr/><h3>Conex\xE3o de Anel de Mana 5: Anel do Dom\xEDnio</h3><p><em>Descri\xE7\xE3o</em>: Dom\xEDnio absoluto de mana.</p><p><em>Riscos</em>: Desconex\xE3o da realidade, paradoxos.</p><p><em>Marca</em>: Altera\xE7\xE3o da realidade.</p><h4>[5.1] Cria\xE7\xE3o de Realidade</h4><ul><li><strong>Habilidade</strong>: Gerar realidades alternativas.</li><li><strong>Desafios</strong>: Manter conex\xE3o com a realidade.</li><li><strong>Indicadores de Dom\xEDnio</strong>: Cria\xE7\xF5es est\xE1veis.</li><li><strong>Falhas Comuns</strong>: Distor\xE7\xE3o temporal-espacial.</li></ul><h4>[5.2] Manipula\xE7\xE3o da Ess\xEAncia</h4><ul><li><strong>Habilidade</strong>: Alterar os pr\xF3prios conceitos de mana.</li><li><strong>Desafios</strong>: Estabilidade universal.</li><li><strong>Indicadores de Dom\xEDnio</strong>: Transforma\xE7\xE3o controlada.</li><li><strong>Falhas Comuns</strong>: Ruptura do anel.</li></ul><h4>[5.3] Dom\xEDnio Completo</h4><ul><li><strong>Habilidade</strong>: Controle universal.</li><li><strong>Desafios</strong>: Reter humanidade.</li><li><strong>Indicadores de Dom\xEDnio</strong>: Harmonia com o universo.</li><li><strong>Falhas Comuns</strong>: Tirania m\xE1gica, isolamento.</li></ul><hr/><h3>Conex\xE3o de Anel de Mana 6: Anel da Cria\xE7\xE3o</h3><p><em>"Os Criadores de Mana, Forjadores de Novas Realidades"</em> \u2014 Neste n\xEDvel, o praticante n\xE3o apenas manipula mana, mas a cria com suas pr\xF3prias regras e conceitos. Podem gerar feiti\xE7os e encantamentos nunca vistos antes, moldando o mundo com imenso poder criativo. Deuses antigos e seres primordiais residem aqui.</p><hr/><h3>Conex\xE3o de Anel de Mana 7: Anel da Transcend\xEAncia</h3><p><em>"Os Guardi\xF5es da Ess\xEAncia"</em> \u2014 Este anel \xE9 o \xE1pice da jornada na conex\xE3o com mana, um estado de absoluta transcend\xEAncia que nenhum mortal jamais alcan\xE7ou. Aqui, o praticante torna-se uma entidade de mana pura, capaz de moldar o universo e a pr\xF3pria realidade em escala c\xF3smica.</p>`;
          await this.createCodexEntry({
            title: "Sistema de Conex\xE3o de An\xE9is de Mana",
            description: manaHtml,
            category: "magic",
            imageUrl: null
          });
          console.log("Seeded Codex: Sistema de Conex\xE3o de An\xE9is de Mana");
        }
      } catch (e) {
        console.warn("Codex seed skipped due to error:", e);
      }
      const existingChapters = await this.getChapters();
      if (existingChapters.length === 0) {
        const chapter1 = {
          title: "O Despertar dos Poderes Antigos",
          slug: "despertar-poderes-antigos",
          content: `As brumas do tempo se separaram como cortinas antigas, revelando um mundo que Eldric mal reconhecia. Onde antes a Grande Espiral de Luminar perfurava os c\xE9us, agora apenas ru\xEDnas permaneciam, tomadas por vinhas espinhosas que pulsavam com escurid\xE3o antinatural.

Ele deu um passo \xE0 frente, suas botas desgastadas esmagando fragmentos cristalinos que antes eram janelas para outros reinos. Tr\xEAs s\xE9culos. Era esse o tempo que ele havia ficado selado no Vazio Entre Mundos, e em sua aus\xEAncia, tudo o que ele havia lutado para proteger havia desmoronado.

"Os selos est\xE3o quebrados", ele sussurrou, sua voz carregando poder que fez o pr\xF3prio ar tremer. Atr\xE1s dele, a realidade se curvou e torceu conforme sua aura m\xE1gica despertava ap\xF3s seu longo sono. "E a escurid\xE3o criou ra\xEDzes onde a luz antes floresceu."

O Primeiro Feiticeiro havia retornado, mas o mundo que ele conhecia se foi para sempre. Em seu lugar estava um reino consumido pelas sombras, onde o pr\xF3prio tecido da magia havia sido corrompido. Ainda assim, dentro dessa corrup\xE7\xE3o, Eldric sentiu algo mais - uma presen\xE7a familiar, antiga e mal\xE9vola.

"Malachar", ele suspirou, o nome tendo gosto de cinzas em sua l\xEDngua. Seu antigo aprendiz, aquele em quem havia confiado acima de todos os outros, aquele cuja trai\xE7\xE3o havia levado ao seu aprisionamento. O Rei das Sombras n\xE3o apenas havia sobrevivido aos s\xE9culos; ele havia prosperado.`,
          excerpt: "Eldric desperta em um mundo arruinado pela escurid\xE3o e sente o rastro de um inimigo antigo...",
          chapterNumber: 15,
          arcNumber: 2,
          arcTitle: "Ascens\xE3o das Sombras",
          readingTime: 12,
          publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1e3).toISOString(),
          imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250"
        };
        const chapter2 = {
          title: "Sombras no Horizonte",
          slug: "sombras-no-horizonte",
          content: "Os ex\xE9rcitos dos Reinos do Norte se re\xFAnem enquanto press\xE1gios sombrios aparecem pelo c\xE9u. A guerra parece inevit\xE1vel...",
          excerpt: "Os ex\xE9rcitos se movem enquanto press\xE1gios no c\xE9u anunciam um conflito inevit\xE1vel...",
          chapterNumber: 14,
          arcNumber: 2,
          arcTitle: "Ascens\xE3o das Sombras",
          readingTime: 15,
          publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString(),
          imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250"
        };
        const chapter3 = {
          title: "Os Bosques Sussurrantes",
          slug: "bosques-sussurrantes",
          content: "Lyanna se aventura na floresta proibida, guiada apenas por profecias antigas e suas crescentes habilidades m\xE1gicas...",
          excerpt: "Lyanna entra na floresta proibida guiada por profecias e novos poderes...",
          chapterNumber: 13,
          arcNumber: 1,
          arcTitle: "O Despertar",
          readingTime: 18,
          publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1e3).toISOString(),
          imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250"
        };
        await this.createChapter(chapter1);
        await this.createChapter(chapter2);
        await this.createChapter(chapter3);
      }
      try {
        try {
          await pool`ALTER TABLE codex_entries ADD COLUMN content TEXT`;
        } catch {
        }
      } catch {
      }
      try {
        try {
          await pool`ALTER TABLE audio_tracks ADD COLUMN volume_user_max INTEGER DEFAULT 70 NOT NULL`;
        } catch {
        }
        try {
          await pool`CREATE INDEX IF NOT EXISTS idx_audio_assignments_entity ON audio_assignments(entity_type, entity_id, active, priority)`;
        } catch {
        }
      } catch {
      }
      const forceImport = process.env.IMPORT_FULLNOVEL_ON_STARTUP === "true";
      let alreadyImported = false;
      try {
        const rowVal = await getMeta("fullnovel_imported");
        alreadyImported = rowVal === "true";
      } catch (e) {
        alreadyImported = false;
      }
      if (forceImport || !alreadyImported) {
        try {
          let uploadImages = [];
          try {
            const uploadsDir = path3.resolve(process.cwd(), "uploads");
            const entries = await fs3.promises.readdir(uploadsDir, { withFileTypes: true });
            const allowed = /* @__PURE__ */ new Set([".jpg", ".jpeg", ".png", ".webp"]);
            uploadImages = entries.filter((e) => e.isFile()).map((e) => e.name).filter((name) => allowed.has(path3.extname(name).toLowerCase())).map((name) => `/uploads/${name}`);
          } catch {
          }
          const parsed = parseFullNovelMarkdown();
          if (parsed.length > 0) {
            const existence = await Promise.all(parsed.map(async (ch) => !!await this.getChapterBySlug(ch.slug)));
            const allExist = existence.every(Boolean);
            if (allExist && !forceImport) {
              console.log("Arc 1 chapters already present; skipping FullNOVEL import");
            } else {
              let imgIndex = 0;
              for (const ch of parsed) {
                const exists = await this.getChapterBySlug(ch.slug);
                const readingTime = Math.max(1, Math.ceil(ch.contentHtml.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length / 250));
                const chosenImage = uploadImages.length > 0 ? uploadImages[imgIndex++ % uploadImages.length] : "/FinalMap.png";
                const payload = {
                  title: ch.title,
                  slug: ch.slug,
                  excerpt: ch.excerpt,
                  content: ch.contentHtml,
                  chapterNumber: ch.chapterNumber,
                  arcNumber: ch.arcNumber,
                  arcTitle: ch.arcTitle,
                  readingTime,
                  publishedAt: (/* @__PURE__ */ new Date()).toISOString(),
                  imageUrl: chosenImage
                };
                if (!exists) {
                  const created = await this.createChapter(payload);
                  console.log("Imported Arc1 chapter from FullNOVEL.md:", created.slug);
                } else if (forceImport) {
                  await this.updateChapter(exists.id, {
                    title: payload.title,
                    excerpt: payload.excerpt,
                    content: payload.content,
                    readingTime: payload.readingTime,
                    // Update image during force import to spread unique images too
                    imageUrl: payload.imageUrl
                  });
                  console.log("Arc 1 chapter exists, updated from FullNOVEL.md:", ch.slug);
                }
              }
            }
          } else {
            console.log("FullNOVEL.md not found or empty, skipping import");
          }
          if (!forceImport) {
            try {
              await setMeta("fullnovel_imported", "true");
            } catch {
            }
          }
        } catch (e) {
          console.warn("Arc 1 chapters seed skipped due to error:", e);
        }
      }
      try {
        try {
          await pool`ALTER TABLE users ADD COLUMN password_hash TEXT`;
        } catch {
        }
      } catch (e) {
      }
      const forceSeedCharacters = process.env.FORCE_SEED_CHARACTERS === "true";
      const charactersSeeded = await getMeta("seed_characters_done") === "true";
      const seeds = [
        {
          baseSlug: this.slugify("Aslam Arianthe"),
          data: {
            name: "Aslam Arianthe",
            title: "O Primeiro Feiticeiro",
            description: "Antigo e poderoso, Aslam retorna ap\xF3s s\xE9culos para encontrar seu mundo transformado pela guerra e escurid\xE3o. Gentil e compassivo, apesar de seu poder imenso, carrega uma solid\xE3o por ser 'diferente'.",
            imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=400",
            role: "protagonist",
            slug: this.slugify("Aslam Arianthe")
          }
        },
        // Also seed Aslam Radianthe (alternate canonical name requested)
        {
          baseSlug: this.slugify("Aslam Radianthe"),
          data: {
            name: "Aslam Radianthe",
            title: "O Primeiro Mestre da Mana",
            description: "Primeiro mestre da magia humana, conhecido por criar os An\xE9is de Conex\xE3o e por sua miss\xE3o de reatar a humanidade \xE0 mana.",
            // store detailed biography in 'story' so UIs that read 'story' can show the long text
            story: `Aslam Radianthe nasceu no continente de Luminah, em uma aldeia simples cercada por rios e florestas. Diferente de todas as crian\xE7as ao seu redor, veio ao mundo em sil\xEAncio, observando o ambiente como se j\xE1 compreendesse algo invis\xEDvel aos olhos humanos. Desde o in\xEDcio a mana, ess\xEAncia que permeia toda a cria\xE7\xE3o, respondeu \xE0 sua presen\xE7a de forma \xFAnica. \xC1rvores mortas floresciam com um toque, o vento se curvava ao seu redor e at\xE9 as chuvas pareciam respeitar seus passos.

Durante a inf\xE2ncia, enquanto outras crian\xE7as brincavam sem preocupa\xE7\xF5es, Aslam contemplava o c\xE9u e os rios. Seus pais, lavradores humildes, viam nele um mist\xE9rio, mas escolheram n\xE3o interferir em seu destino. Aos sete anos trouxe vida a um tronco seco apenas com o toque e, a partir desse evento, iniciou sozinho sua jornada de descobertas.

Na juventude dominava os elementos b\xE1sicos da natureza e aos dezesseis j\xE1 era capaz de controlar \xE1gua, terra e vento. Sua fama se espalhou quando conteve uma tempestade colossal que amea\xE7ava destruir sua aldeia. Reis e senhores enviaram emiss\xE1rios oferecendo riquezas, terras e poder em troca de sua lealdade, mas Aslam recusou a todos. O que buscava n\xE3o era domina\xE7\xE3o, mas compreens\xE3o.

Sua jornada o levou muito al\xE9m das fronteiras humanas. Nos desertos escaldantes de Karang-Th\xFBl em Ferros ergueu um o\xE1sis que floresceu em meio \xE0 morte. Nas ilhas de Aquarius aprendeu com sereias segredos ocultos das mar\xE9s. Em Silvanum, os elfos compartilharam antigos ensinamentos, e nas montanhas drac\xF4nicas encontrou criaturas t\xE3o antigas quanto o mundo, que viam nele tanto promessa quanto amea\xE7a.

Foi ent\xE3o que entendeu sua verdadeira miss\xE3o. N\xE3o deveria apenas usar a mana para si, mas ensinar os humanos a se reconectarem com ela. Criou os An\xE9is de Conex\xE3o como guia, abrindo caminho para que a humanidade pudesse trilhar a mesma jornada. Reis, camponeses, guerreiros e estudiosos o reconheceram como o primeiro mestre da magia humana.

No entanto, ao aprofundar-se nos segredos da mana descobriu que os humanos eram limitados n\xE3o por natureza, mas por um selamento imposto por for\xE7as primordiais. Determinado a libertar sua esp\xE9cie, confrontou uma entidade t\xE3o antiga quanto o pr\xF3prio cosmos. A batalha devastou terras e c\xE9us e terminou com sua derrota. Aslam foi aprisionado em um vazio fora do tempo e do espa\xE7o.

Mil anos se passaram. Seu nome esmaeceu at\xE9 se tornar mito. No entanto, o destino ainda o aguardava. Selado em trevas, resistiu at\xE9 despertar em um novo corpo, o do jovem nobre Kaelus Rhys Sylvaris, da Casa Sylvaris em Calonia. Assim voltou ao mundo, renascido e ao mesmo tempo estrangeiro em sua pr\xF3pria terra.

Aslam carrega uma ess\xEAncia marcada pela compaix\xE3o e pela solid\xE3o de quem j\xE1 foi diferente de todos. Apesar do imenso poder, fala com suavidade e prefere ensinar em vez de dominar. Hoje reconstr\xF3i seu caminho a partir do in\xEDcio, equilibrando a sabedoria milenar de sua vida passada com o fardo de viver a vida de outro. Seu prop\xF3sito permanece inabal\xE1vel: ensinar, proteger e libertar a humanidade do selo que a aprisiona.
`,
            imageUrl: null,
            role: "protagonist",
            slug: this.slugify("Aslam Radianthe")
          }
        },
        {
          baseSlug: this.slugify("Lyra Stormweaver"),
          data: {
            name: "Lyra Stormweaver",
            title: "Conjuradora de Tempestades",
            description: "Uma jovem maga com cabelos negros e t\xFAnica azul adornada com runas antigas. Seus olhos brilhantes sugerem suas habilidades m\xE1gicas, determinada mas tensa.",
            imageUrl: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=400",
            role: "protagonist",
            slug: this.slugify("Lyra Stormweaver")
          }
        },
        {
          baseSlug: this.slugify("Lorde Aldrich Sylvaris"),
          data: {
            name: "Lorde Aldrich Sylvaris",
            title: "Cabe\xE7a da Casa Sylvaris",
            description: "Senhor imponente de tom \xE9bano profundo e cabelo raspado com barba cheia. L\xEDder da poderosa Casa Sylvaris, com 46 anos e n\xEDvel de anel de mana 3.1.",
            imageUrl: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=400",
            role: "supporting",
            slug: this.slugify("Lorde Aldrich Sylvaris")
          }
        },
        {
          baseSlug: this.slugify("Kellen Aurelio"),
          data: {
            name: "Kellen Aurelio",
            title: "Guerreiro Experiente",
            description: "Alto e musculoso, com cabelos negros e olhos intensos. Veste uma armadura marcada por batalhas que contam hist\xF3rias de combates passados.",
            imageUrl: "https://images.unsplash.com/photo-1566492031773-4f4e44671d66?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=400",
            role: "supporting",
            slug: this.slugify("Kellen Aurelio")
          }
        }
      ];
      if (forceSeedCharacters || !charactersSeeded) {
        for (const s of seeds) {
          try {
            const exists = await this.getCharacterBySlug(s.baseSlug);
            if (!exists) {
              await this.createCharacter(s.data);
            }
          } catch (e) {
            console.warn("Seed character insert skipped:", s.baseSlug, e);
          }
        }
        try {
          const current = await this.getCharacters();
          for (const s of seeds) {
            const group = current.filter((c) => c.slug === s.baseSlug || c.slug.startsWith(`${s.baseSlug}-`));
            if (group.length > 1) {
              const keep = group.find((c) => c.slug === s.baseSlug) || group[0];
              for (const g of group) {
                if (g.id !== keep.id) {
                  await this.deleteCharacter(g.id);
                }
              }
              console.log(`Deduplicated characters for slug '${s.baseSlug}': kept ${keep.slug}, removed ${group.length - 1}`);
            }
          }
        } catch (e) {
          console.warn("Character dedup pass skipped:", e);
        }
        if (!forceSeedCharacters) await setMeta("seed_characters_done", "true");
      }
      try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (adminEmail && adminPassword) {
          const adminId = process.env.ADMIN_ID || "admin-root";
          const existingByEmail = await this.getUserByEmail(adminEmail);
          const rounds = Number(process.env.ADMIN_BCRYPT_ROUNDS || process.env.BCRYPT_ROUNDS || 12);
          const forcePwdUpdate = process.env.ADMIN_FORCE_UPDATE_PASSWORD === "true";
          if (!existingByEmail) {
            const hash = bcrypt.hashSync(adminPassword, rounds);
            await this.createUserIfNotExists(adminId, adminEmail, hash, true);
            console.log(`Seeded admin user '${adminEmail}' (id=${adminId}) via env vars.`);
          } else {
            let needsUpdate = false;
            const updatePayload = { ...existingByEmail };
            if (!existingByEmail.isAdmin) {
              updatePayload.isAdmin = 1;
              needsUpdate = true;
            }
            if (forcePwdUpdate) {
              updatePayload.passwordHash = bcrypt.hashSync(adminPassword, rounds);
              needsUpdate = true;
            }
            if (needsUpdate) {
              await this.upsertUser(updatePayload);
              console.log(`Upgraded existing user '${adminEmail}' to admin${forcePwdUpdate ? " + updated password" : ""}.`);
            } else {
              console.log(`Admin user '${adminEmail}' already present; no upgrade needed.`);
            }
          }
        } else {
          console.log("Admin seed skipped (ADMIN_EMAIL or ADMIN_PASSWORD not set).");
        }
      } catch (e) {
        console.warn("Admin seed failed:", e);
      }
      const valaria = {
        name: "Reino de Valaria",
        description: "Capital pr\xF3spera onde residem nobres e artes\xE3os. Centro pol\xEDtico e cultural com arquitetura majestosa.",
        mapX: 33,
        mapY: 25,
        type: "capital"
      };
      const aethermoor = {
        name: "Cidade Flutuante de Aethermoor",
        description: "Maravilha da engenharia m\xE1gica, suspensa no ar por cristais encantados. Centro de conhecimento arcano.",
        mapX: 75,
        mapY: 50,
        type: "forest"
      };
      const monteNuvens = {
        name: "Monte Nuvens",
        description: "Montanha imponente onde o vento sopra forte e os picos tocam as nuvens. Local de poder e mist\xE9rio.",
        mapX: 25,
        mapY: 67,
        type: "shadowlands"
      };
      try {
        const existingLocations = await this.getLocations();
        const hasValaria = existingLocations.some((l) => l.name === valaria.name);
        const hasAether = existingLocations.some((l) => l.name === aethermoor.name);
        const hasMonte = existingLocations.some((l) => l.name === monteNuvens.name);
        if (!hasValaria) await this.createLocation(valaria);
        if (!hasAether) await this.createLocation(aethermoor);
        if (!hasMonte) await this.createLocation(monteNuvens);
      } catch (e) {
        try {
          await this.createLocation(valaria);
          await this.createLocation(aethermoor);
          await this.createLocation(monteNuvens);
        } catch {
        }
      }
      const blogPost1 = {
        title: "Criando os Sistemas M\xE1gicos de Aethermoor",
        slug: "criando-sistemas-magicos",
        content: "Mergulhe na inspira\xE7\xE3o e pesquisa por tr\xE1s do complexo framework m\xE1gico que alimenta esta \xE9pica narrativa. Exploramos como os An\xE9is de Mana funcionam e como diferentes n\xEDveis determinam o poder dos feiticeiros...",
        excerpt: "Mergulhe na inspira\xE7\xE3o e pesquisa por tr\xE1s do complexo framework m\xE1gico que alimenta esta \xE9pica narrativa...",
        category: "world-building",
        publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1e3).toISOString(),
        imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300"
      };
      const blogPost2 = {
        title: "Atualiza\xE7\xF5es do Mundo \u2014 Vers\xE3o 1.2",
        slug: "atualizacoes-v1-2",
        content: "Notas de atualiza\xE7\xE3o que detalham mudan\xE7as recentes no mundo, ajustes de balanceamento e novos conte\xFAdos adicionados.",
        excerpt: "Notas de atualiza\xE7\xE3o: mudan\xE7as recentes no mundo e novos conte\xFAdos.",
        category: "update",
        publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1e3).toISOString(),
        imageUrl: null
      };
      const blogPost3 = {
        title: "Bastidores: Como constru\xEDmos a Fortaleza de Valaria",
        slug: "bastidores-fortaleza-valaria",
        content: "Uma vis\xE3o dos bastidores do design da Fortaleza de Valaria, incluindo rascunhos conceituais, refer\xEAncias e decis\xF5es de arte.",
        excerpt: "Bastidores do design da Fortaleza de Valaria e escolhas art\xEDsticas.",
        category: "behind-scenes",
        publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1e3).toISOString(),
        imageUrl: null
      };
      const blogPost4 = {
        title: "Pesquisa: Geografia M\xE1gica e Fontes de Mana",
        slug: "pesquisa-geografia-mana",
        content: "Resultados preliminares de estudo sobre pontos naturais de mana e como eles afetam ecossistemas m\xE1gicos locais.",
        excerpt: "Estudo sobre pontos naturais de mana e impactos nos ecossistemas.",
        category: "research",
        publishedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1e3).toISOString(),
        imageUrl: null
      };
      try {
        const existingBlog = await this.getBlogPostBySlug(blogPost1.slug);
        if (!existingBlog) {
          await this.createBlogPost(blogPost1);
        }
        try {
          if (!await this.getBlogPostBySlug(blogPost2.slug)) await this.createBlogPost(blogPost2);
        } catch (e) {
        }
        try {
          if (!await this.getBlogPostBySlug(blogPost3.slug)) await this.createBlogPost(blogPost3);
        } catch (e) {
        }
        try {
          if (!await this.getBlogPostBySlug(blogPost4.slug)) await this.createBlogPost(blogPost4);
        } catch (e) {
        }
      } catch (e) {
        console.warn("Blog seed skipped or already exists:", e);
      }
      console.log("Database seeded successfully");
    } catch (error) {
      console.error("Error seeding database:", error);
    }
  }
};
var FileStorage = class {
  baseDir = path3.resolve(process.cwd(), "data");
  constructor() {
    fs3.mkdirSync(this.baseDir, { recursive: true });
  }
  // helper
  async readFile(name, defaultValue) {
    const fp = path3.join(this.baseDir, name);
    try {
      const txt = await fs3.promises.readFile(fp, "utf-8");
      return JSON.parse(txt || "null");
    } catch (e) {
      return defaultValue;
    }
  }
  async writeFile(name, data) {
    const fp = path3.join(this.baseDir, name);
    await fs3.promises.writeFile(fp, JSON.stringify(data, null, 2), "utf-8");
  }
  async getUser(id) {
    const users2 = await this.readFile("offline-users.json", []);
    return users2.find((u) => u.id === id);
  }
  async getUserByEmail(email) {
    const users2 = await this.readFile("offline-users.json", []);
    return users2.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
  }
  async upsertUser(user) {
    const users2 = await this.readFile("offline-users.json", []);
    const idx = users2.findIndex((u) => u.id === user.id);
    if (idx >= 0) users2[idx] = { ...users2[idx], ...user };
    else users2.push(user);
    await this.writeFile("offline-users.json", users2);
    return users2.find((u) => u.id === user.id);
  }
  async createUserIfNotExists(id, email, passwordHash, isAdmin2) {
    const existing = await this.getUser(id);
    if (existing) return existing;
    return this.upsertUser({ id, email, passwordHash, isAdmin: isAdmin2 ? 1 : 0, createdAt: (/* @__PURE__ */ new Date()).toISOString(), updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
  }
  async getChapters() {
    return this.readFile("offline-chapters.json", []);
  }
  async getChapterBySlug(slug) {
    const arr = await this.getChapters();
    return arr.find((c) => c.slug === slug);
  }
  async getChapterById(id) {
    const arr = await this.getChapters();
    return arr.find((c) => c.id === id);
  }
  async createChapter(chapter) {
    chapter.id = chapter.id ?? randomUUID();
    const arr = await this.getChapters();
    arr.push(chapter);
    await this.writeFile("offline-chapters.json", arr);
    return chapter;
  }
  async updateChapter(id, chapter) {
    const arr = await this.getChapters();
    const idx = arr.findIndex((c) => c.id === id);
    if (idx < 0) return void 0;
    arr[idx] = { ...arr[idx], ...chapter };
    await this.writeFile("offline-chapters.json", arr);
    return arr[idx];
  }
  async deleteChapter(id) {
    const arr = await this.getChapters();
    const idx = arr.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    arr.splice(idx, 1);
    await this.writeFile("offline-chapters.json", arr);
    return true;
  }
  async getCharacters() {
    return this.readFile("offline-characters.json", []);
  }
  async getCharacterById(id) {
    const arr = await this.getCharacters();
    return arr.find((c) => c.id === id);
  }
  async getCharacterBySlug(slug) {
    const arr = await this.getCharacters();
    return arr.find((c) => c.slug === slug);
  }
  async createCharacter(character) {
    character.id = character.id ?? randomUUID();
    const arr = await this.getCharacters();
    arr.push(character);
    await this.writeFile("offline-characters.json", arr);
    return character;
  }
  async updateCharacter(id, character) {
    const arr = await this.getCharacters();
    const idx = arr.findIndex((c) => c.id === id);
    if (idx < 0) return void 0;
    arr[idx] = { ...arr[idx], ...character };
    await this.writeFile("offline-characters.json", arr);
    return arr[idx];
  }
  async deleteCharacter(id) {
    const arr = await this.getCharacters();
    const idx = arr.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    arr.splice(idx, 1);
    await this.writeFile("offline-characters.json", arr);
    return true;
  }
  async getLocations() {
    return this.readFile("offline-locations.json", []);
  }
  async getLocationById(id) {
    const arr = await this.getLocations();
    return arr.find((c) => c.id === id);
  }
  async createLocation(location) {
    location.id = location.id ?? randomUUID();
    const arr = await this.getLocations();
    arr.push(location);
    await this.writeFile("offline-locations.json", arr);
    return location;
  }
  async updateLocation(id, location) {
    const arr = await this.getLocations();
    const idx = arr.findIndex((c) => c.id === id);
    if (idx < 0) return void 0;
    arr[idx] = { ...arr[idx], ...location };
    await this.writeFile("offline-locations.json", arr);
    return arr[idx];
  }
  async deleteLocation(id) {
    const arr = await this.getLocations();
    const idx = arr.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    arr.splice(idx, 1);
    await this.writeFile("offline-locations.json", arr);
    return true;
  }
  async getCodexEntries() {
    return this.readFile("offline-codex.json", []);
  }
  async getCodexEntriesByCategory(category) {
    const arr = await this.getCodexEntries();
    return arr.filter((e) => e.category === category);
  }
  async getCodexEntryById(id) {
    const arr = await this.getCodexEntries();
    return arr.find((c) => c.id === id);
  }
  async createCodexEntry(entry) {
    entry.id = entry.id ?? randomUUID();
    const arr = await this.getCodexEntries();
    arr.push(entry);
    await this.writeFile("offline-codex.json", arr);
    return entry;
  }
  async updateCodexEntry(id, entry) {
    const arr = await this.getCodexEntries();
    const idx = arr.findIndex((c) => c.id === id);
    if (idx < 0) return void 0;
    arr[idx] = { ...arr[idx], ...entry };
    await this.writeFile("offline-codex.json", arr);
    return arr[idx];
  }
  async deleteCodexEntry(id) {
    const arr = await this.getCodexEntries();
    const idx = arr.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    arr.splice(idx, 1);
    await this.writeFile("offline-codex.json", arr);
    return true;
  }
  async getBlogPosts() {
    return this.readFile("offline-blog.json", []);
  }
  async getBlogPostBySlug(slug) {
    const arr = await this.getBlogPosts();
    return arr.find((c) => c.slug === slug);
  }
  async getBlogPostById(id) {
    const arr = await this.getBlogPosts();
    return arr.find((c) => c.id === id);
  }
  async createBlogPost(post) {
    post.id = post.id ?? randomUUID();
    const arr = await this.getBlogPosts();
    arr.push(post);
    await this.writeFile("offline-blog.json", arr);
    return post;
  }
  async updateBlogPost(id, post) {
    const arr = await this.getBlogPosts();
    const idx = arr.findIndex((c) => c.id === id);
    if (idx < 0) return void 0;
    arr[idx] = { ...arr[idx], ...post };
    await this.writeFile("offline-blog.json", arr);
    return arr[idx];
  }
  async deleteBlogPost(id) {
    const arr = await this.getBlogPosts();
    const idx = arr.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    arr.splice(idx, 1);
    await this.writeFile("offline-blog.json", arr);
    return true;
  }
  async getReadingProgress(sessionId, chapterId) {
    const arr = await this.readFile("offline-progress.json", []);
    return arr.find((p) => p.sessionId === sessionId && p.chapterId === chapterId);
  }
  async updateReadingProgress(sessionId, chapterId, progress) {
    const arr = await this.readFile("offline-progress.json", []);
    let p = arr.find((x) => x.sessionId === sessionId && x.chapterId === chapterId);
    if (p) {
      p.progress = progress;
      p.lastReadAt = (/* @__PURE__ */ new Date()).toISOString();
    } else {
      p = { id: randomUUID(), sessionId, chapterId, progress, lastReadAt: (/* @__PURE__ */ new Date()).toISOString() };
      arr.push(p);
    }
    await this.writeFile("offline-progress.json", arr);
    return p;
  }
  // Audio storage (offline simple JSON persistence)
  async readAudioTracks() {
    return this.readFile("offline-audio-tracks.json", []);
  }
  async writeAudioTracks(list) {
    return this.writeFile("offline-audio-tracks.json", list);
  }
  async readAudioAssignments() {
    return this.readFile("offline-audio-assignments.json", []);
  }
  async writeAudioAssignments(list) {
    return this.writeFile("offline-audio-assignments.json", list);
  }
  async getAudioTracks() {
    return this.readAudioTracks();
  }
  async getAudioTrack(id) {
    const arr = await this.readAudioTracks();
    return arr.find((t) => t.id === id);
  }
  async createAudioTrack(track) {
    const arr = await this.readAudioTracks();
    const payload = { ...track, id: track.id || randomUUID(), createdAt: (/* @__PURE__ */ new Date()).toISOString(), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    arr.push(payload);
    await this.writeAudioTracks(arr);
    return payload;
  }
  async updateAudioTrack(id, patch) {
    const arr = await this.readAudioTracks();
    const idx = arr.findIndex((t) => t.id === id);
    if (idx < 0) return void 0;
    arr[idx] = { ...arr[idx], ...patch, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    await this.writeAudioTracks(arr);
    return arr[idx];
  }
  async deleteAudioTrack(id) {
    const arr = await this.readAudioTracks();
    const idx = arr.findIndex((t) => t.id === id);
    if (idx < 0) return false;
    arr.splice(idx, 1);
    await this.writeAudioTracks(arr);
    const assigns = await this.readAudioAssignments();
    const filtered = assigns.filter((a) => a.trackId !== id);
    await this.writeAudioAssignments(filtered);
    return true;
  }
  async getAudioAssignments() {
    return this.readAudioAssignments();
  }
  async getAudioAssignment(id) {
    const arr = await this.readAudioAssignments();
    return arr.find((a) => a.id === id);
  }
  async createAudioAssignment(assign) {
    const arr = await this.readAudioAssignments();
    const payload = { ...assign, id: assign.id || randomUUID(), createdAt: (/* @__PURE__ */ new Date()).toISOString(), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    arr.push(payload);
    await this.writeAudioAssignments(arr);
    return payload;
  }
  async updateAudioAssignment(id, patch) {
    const arr = await this.readAudioAssignments();
    const idx = arr.findIndex((a) => a.id === id);
    if (idx < 0) return void 0;
    arr[idx] = { ...arr[idx], ...patch, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    await this.writeAudioAssignments(arr);
    return arr[idx];
  }
  async deleteAudioAssignment(id) {
    const arr = await this.readAudioAssignments();
    const idx = arr.findIndex((a) => a.id === id);
    if (idx < 0) return false;
    arr.splice(idx, 1);
    await this.writeAudioAssignments(arr);
    return true;
  }
  async resolveAudio(params) {
    const assignments = await this.getAudioAssignments();
    const candidates = [];
    for (const a of assignments) {
      if (!a.active) continue;
      switch (a.entityType) {
        case "chapter":
          if (params.chapterId && a.entityId === params.chapterId) candidates.push(a);
          break;
        case "character":
          if (params.characterId && a.entityId === params.characterId) candidates.push(a);
          break;
        case "codex":
          if (params.codexId && a.entityId === params.codexId) candidates.push(a);
          break;
        case "location":
          if (params.locationId && a.entityId === params.locationId) candidates.push(a);
          break;
        case "page":
          if (params.page && a.entityId === params.page) candidates.push(a);
          break;
        case "global":
          candidates.push(a);
          break;
      }
    }
    if (candidates.length === 0) return void 0;
    const specificityRank = (t) => ["chapter", "character", "codex", "location"].includes(t) ? 3 : t === "page" ? 2 : 1;
    candidates.sort((a, b) => {
      const s = specificityRank(b.entityType) - specificityRank(a.entityType);
      if (s !== 0) return s;
      return (b.priority || 0) - (a.priority || 0);
    });
    const track = await this.getAudioTrack(candidates[0].trackId);
    return track;
  }
};
var storageInstance;
try {
  storageInstance = new DatabaseStorage();
} catch (err) {
  console.warn("DatabaseStorage initialization failed, falling back to FileStorage:", err);
  storageInstance = new FileStorage();
}
var storage = storageInstance;

// server/replitAuth.ts
import session from "express-session";
import connectPg from "connect-pg-simple";

// server/devToken.ts
import crypto from "crypto";
var SECRET = process.env.SESSION_SECRET || "dev-secret";
function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function signDevToken(payload) {
  const body = { ...payload, ts: Date.now() };
  const json2 = JSON.stringify(body);
  const sig = crypto.createHmac("sha256", SECRET).update(json2).digest();
  return `${b64url(json2)}.${b64url(sig)}`;
}
function verifyDevToken(token) {
  try {
    const [dataB64, sigB64] = token.split(".");
    if (!dataB64 || !sigB64) return null;
    const json2 = Buffer.from(dataB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
    const expectedSig = crypto.createHmac("sha256", SECRET).update(json2).digest();
    const actualSig = Buffer.from(sigB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;
    const parsed = JSON.parse(json2);
    return parsed;
  } catch {
    return null;
  }
}
function getDevTokenFromReq(req) {
  const h = req.headers["authorization"];
  if (!h) return null;
  const parts = String(h).split(" ");
  if (parts.length !== 2) return null;
  const scheme = parts[0].toLowerCase();
  const token = parts[1];
  if (scheme === "bearer" || scheme === "dev") return token;
  return null;
}

// server/replitAuth.ts
import path4 from "path";
import fs4 from "fs";
var allowedAdminsCache = null;
function parseCsvEnv(name) {
  const raw = (process.env[name] || "").trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
function loadAllowedAdmins() {
  if (allowedAdminsCache) return allowedAdminsCache;
  const emails = /* @__PURE__ */ new Set();
  const ids = /* @__PURE__ */ new Set();
  const idsFromEnv = parseCsvEnv("ADMIN_IDS");
  const requireIdMatch = idsFromEnv.length > 0;
  for (const e of parseCsvEnv("ADMIN_EMAILS")) emails.add(e.toLowerCase());
  for (const i of idsFromEnv) ids.add(i.toLowerCase());
  if (emails.size === 0) emails.add("jeova.herminio@gmail.com");
  try {
    const candidates = [
      path4.resolve(process.cwd(), "server", "dev-admins.json"),
      path4.resolve(process.cwd(), "dev-admins.json")
    ];
    const fp = candidates.find((p) => fs4.existsSync(p));
    if (fp) {
      const txt = fs4.readFileSync(fp, "utf-8");
      const parsed = JSON.parse(txt || "[]");
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.email === "string" && item.email.includes("@")) {
            emails.add(item.email.toLowerCase());
          }
        }
      }
    }
  } catch {
  }
  allowedAdminsCache = { emails, ids, requireIdMatch };
  return allowedAdminsCache;
}
function isAllowedAdminIdentity(identity) {
  if (!identity) return false;
  const { emails, ids, requireIdMatch } = loadAllowedAdmins();
  const email = (identity.email || "").trim().toLowerCase();
  const id = (identity.id || "").trim().toLowerCase();
  const emailOk = email ? emails.has(email) : false;
  const idOk = id ? ids.has(id) : false;
  if (emailOk) return requireIdMatch && id ? idOk : true;
  return idOk;
}
var isDevAdmin = (req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    req.adminUser = { id: "dev-admin", isAdmin: true };
    return next();
  }
  return isAdmin(req, res, next);
};
async function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1e3;
  if (process.env.NODE_ENV === "development") {
    const MemoryStore = session.MemoryStore;
    return session({
      name: process.env.SESSION_COOKIE_NAME || "sorcerer.sid",
      store: new MemoryStore(),
      secret: process.env.SESSION_SECRET || "dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,
        // Secure must be false for localhost HTTP
        sameSite: "lax",
        maxAge: sessionTtl
      }
    });
  }
  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl || !dbUrl.startsWith("postgres://") && !dbUrl.startsWith("postgresql://")) {
    throw new Error("DATABASE_URL must be set to a Postgres connection string for sessions.");
  }
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions"
  });
  return session({
    name: process.env.SESSION_COOKIE_NAME || "sorcerer.sid",
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: sessionTtl
    }
  });
}
async function setupAuth(app2) {
  app2.set("trust proxy", 1);
  app2.use(await getSession());
}
var isAuthenticated = (req, res, next) => {
  if (req.session?.user) return next();
  if (process.env.NODE_ENV === "development") {
    const tok = getDevTokenFromReq(req);
    if (tok) {
      const payload = verifyDevToken(tok);
      if (payload && payload.id) {
        req.session = req.session || {};
        req.session.user = {
          id: payload.id,
          email: payload.email,
          isAdmin: !!payload.isAdmin,
          firstName: payload.firstName,
          lastName: payload.lastName,
          profileImageUrl: payload.profileImageUrl
        };
        return next();
      }
    }
  }
  res.status(401).json({ message: "Unauthorized" });
};
var isAdmin = async (req, res, next) => {
  let sessionUser = req.session?.user;
  if (!sessionUser?.id && process.env.NODE_ENV === "development") {
    const tok = getDevTokenFromReq(req);
    if (tok) {
      const payload = verifyDevToken(tok);
      if (payload && payload.id) {
        req.session = req.session || {};
        req.session.user = {
          id: payload.id,
          email: payload.email,
          isAdmin: !!payload.isAdmin,
          firstName: payload.firstName,
          lastName: payload.lastName,
          profileImageUrl: payload.profileImageUrl
        };
        sessionUser = req.session.user;
      }
    }
  }
  if (!sessionUser?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    let identity = { id: sessionUser.id, email: sessionUser.email };
    try {
      const dbUser = await storage.getUser(sessionUser.id);
      if (dbUser) identity = { id: dbUser.id, email: dbUser.email };
    } catch {
    }
    if (isAllowedAdminIdentity(identity)) {
      req.adminUser = { ...identity, isAdmin: true };
      return next();
    }
    return res.status(403).json({ message: "Admin access required" });
  } catch (error) {
    console.error("Error checking admin status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// server/routes.ts
import fs5 from "fs";
import path5 from "path";
import { randomUUID as randomUUID2 } from "crypto";
import { ZodError } from "zod";
import bcrypt2 from "bcryptjs";
import { z } from "zod";
async function saveTranslations(_resource, _id, _translations) {
  return;
}
async function registerRoutes(app2) {
  await setupAuth(app2);
  async function readOfflineUsers() {
    try {
      const dir = path5.resolve(process.cwd(), "data");
      const fp = path5.join(dir, "offline-users.json");
      if (!fs5.existsSync(dir)) fs5.mkdirSync(dir, { recursive: true });
      if (!fs5.existsSync(fp)) return [];
      const txt = await fs5.promises.readFile(fp, "utf-8");
      return JSON.parse(txt || "[]");
    } catch {
      return [];
    }
  }
  async function writeOfflineUsers(users2) {
    const dir = path5.resolve(process.cwd(), "data");
    const fp = path5.join(dir, "offline-users.json");
    if (!fs5.existsSync(dir)) fs5.mkdirSync(dir, { recursive: true });
    await fs5.promises.writeFile(fp, JSON.stringify(users2, null, 2), "utf-8");
  }
  async function upsertOfflineUser(user) {
    const list = await readOfflineUsers();
    const idx = list.findIndex((u) => u.id === user.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...user };
    else list.push(user);
    await writeOfflineUsers(list);
    return list.find((u) => u.id === user.id);
  }
  app2.post("/api/login", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Vary", "Cookie");
      const bodySchema = z.object({ id: z.string().min(1), password: z.string().min(6).max(200) });
      const { id, password } = bodySchema.parse(req.body || {});
      try {
        const ipRaw = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress || "unknown";
        const ip = Array.isArray(ipRaw) ? ipRaw[0] : String(ipRaw);
        const now = Date.now();
        const g = global;
        g.__loginAttempts = g.__loginAttempts || {};
        const attempts = g.__loginAttempts[ip] || [];
        const recent = attempts.filter((t) => now - t < 15 * 60 * 1e3);
        if (recent.length >= 20) return res.status(429).json({ message: "Too many login attempts, try later" });
        recent.push(now);
        g.__loginAttempts[ip] = recent;
      } catch (e) {
      }
      let user;
      try {
        user = await storage.getUser(id);
        if (!user && id.includes("@")) user = await storage.getUserByEmail(id);
      } catch (e) {
        console.warn("DB error on getUser, trying offline users:", e && e.code ? e.code : String(e));
      }
      if (!user) {
        const offlineUsers = await readOfflineUsers();
        user = offlineUsers.find((u) => u.id === id);
      }
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      const hash = user.passwordHash || user.password_hash;
      if (!hash) return res.status(401).json({ message: "Invalid credentials" });
      const ok = await bcrypt2.compare(password, hash);
      if (!ok) return res.status(401).json({ message: "Invalid credentials" });
      req.session.regenerate?.((err) => {
        if (err) {
          console.warn("Session regenerate failed on login:", err);
        }
        const sessionUser = {
          id: user.id,
          email: user.email,
          isAdmin: isAllowedAdminIdentity({ id: user.id, email: user.email }),
          firstName: user.firstName ?? user.first_name ?? void 0,
          lastName: user.lastName ?? user.last_name ?? void 0,
          profileImageUrl: user.profileImageUrl ?? user.profile_image_url ?? void 0
        };
        req.session.user = sessionUser;
        const extra = {};
        if (process.env.NODE_ENV === "development") {
          extra.devToken = signDevToken(sessionUser);
        }
        return res.json({ ok: true, user: sessionUser, ...extra });
      });
    } catch (e) {
      console.error("Login error:", e);
      return res.status(500).json({ message: "Login failed" });
    }
  });
  app2.post("/api/logout", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Vary", "Cookie");
      req.session.destroy?.((err) => {
        if (err) {
          console.warn("Session destroy failed on logout:", err);
        }
        try {
          const cookieName = process.env.SESSION_COOKIE_NAME || "sorcerer.sid";
          res.clearCookie(cookieName, {
            path: "/",
            sameSite: "lax",
            secure: process.env.NODE_ENV !== "development",
            httpOnly: true
          });
        } catch (e) {
        }
        return res.json({ ok: true });
      });
    } catch (e) {
      console.error("Logout error:", e);
      return res.status(500).json({ message: "Logout failed" });
    }
  });
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const bodySchema = z.object({
        id: z.string().min(3).max(64),
        email: z.string().email().optional(),
        password: z.string().min(8).max(200),
        firstName: z.string().min(1).max(120).optional(),
        lastName: z.string().max(120).optional()
      });
      const { id, email, password, firstName, lastName } = bodySchema.parse(req.body || {});
      try {
        const existsById = await storage.getUser(id);
        if (existsById) return res.status(409).json({ message: "Usu\xE1rio j\xE1 existe" });
        if (email) {
          const existsByEmail = await storage.getUserByEmail(email);
          if (existsByEmail) return res.status(409).json({ message: "Email j\xE1 cadastrado" });
        }
      } catch {
      }
      const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
      const hash = await bcrypt2.hash(password, rounds);
      let user = null;
      try {
        user = await storage.upsertUser({ id, email: email ?? `${id}@local.dev`, firstName: firstName ?? "", lastName: lastName ?? "", profileImageUrl: void 0, isAdmin: 0, passwordHash: hash });
      } catch (e) {
        console.warn("Could not upsert user to DB (continuing with session only):", e && e.stack ? e.stack : e);
        if (process.env.NODE_ENV === "development") {
          console.error("Register request body:", JSON.stringify(req.body));
        }
        try {
          const offline = await upsertOfflineUser({
            id,
            email: email ?? `${id}@local.dev`,
            first_name: firstName ?? "",
            last_name: lastName ?? "",
            profile_image_url: null,
            is_admin: 0,
            password_hash: hash,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          });
          user = { id: offline.id, email: offline.email, isAdmin: !!offline.is_admin };
        } catch (w) {
          console.warn("Failed to write offline user on register, session-only fallback:", w);
          user = { id, email: email ?? `${id}@local.dev`, isAdmin: false };
        }
      }
      if (!user || !user.id) {
        user = { id, email: email ?? `${id}@local.dev`, isAdmin: false };
      }
      try {
        const session2 = req.session;
        const sendResponse = () => {
          try {
            const sessionUser = {
              id: user.id,
              email: user.email,
              isAdmin: isAllowedAdminIdentity({ id: user.id, email: user.email }),
              firstName: user.firstName ?? user.first_name ?? (firstName ?? void 0),
              lastName: user.lastName ?? user.last_name ?? (lastName ?? void 0),
              profileImageUrl: user.profileImageUrl ?? user.profile_image_url ?? void 0
            };
            return res.json({ ok: true, user: sessionUser });
          } catch (e) {
            console.error("Failed to send register response:", e);
          }
        };
        if (session2 && typeof session2.regenerate === "function") {
          session2.regenerate((err) => {
            if (err) console.warn("Session regenerate failed on register:", err);
            try {
              session2.user = {
                id: user.id,
                email: user.email,
                isAdmin: isAllowedAdminIdentity({ id: user.id, email: user.email }),
                firstName: user.firstName ?? user.first_name ?? (firstName ?? void 0),
                lastName: user.lastName ?? user.last_name ?? (lastName ?? void 0),
                profileImageUrl: user.profileImageUrl ?? user.profile_image_url ?? void 0
              };
            } catch (e) {
              console.warn("Failed to write session.user after register:", e);
            }
            return sendResponse();
          });
        } else {
          try {
            if (session2) session2.user = {
              id: user.id,
              email: user.email,
              isAdmin: isAllowedAdminIdentity({ id: user.id, email: user.email }),
              firstName: user.firstName ?? user.first_name ?? (firstName ?? void 0),
              lastName: user.lastName ?? user.last_name ?? (lastName ?? void 0),
              profileImageUrl: user.profileImageUrl ?? user.profile_image_url ?? void 0
            };
          } catch (e) {
            console.warn("Failed to write session.user after register (no regenerate):", e);
          }
          return sendResponse();
        }
      } catch (e) {
        console.error("Register session handling failed:", e);
        return res.status(500).json({ message: "Registration failed" });
      }
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.error("Register error (development):", e && e.stack ? e.stack : e);
        try {
          console.error("Register request body (dev):", JSON.stringify(req.body));
        } catch (er) {
        }
      } else {
        console.error("Register error:", e && e.stack ? e.stack : e);
      }
      return res.status(500).json({ message: "Registration failed" });
    }
  });
  app2.post("/api/auth/change-password", isAuthenticated, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) return res.status(400).json({ message: "currentPassword and newPassword required" });
      const sessionUser = req.session?.user;
      if (!sessionUser?.id) return res.status(401).json({ message: "Unauthorized" });
      const dbUser = await storage.getUser(sessionUser.id);
      if (!dbUser) return res.status(404).json({ message: "User not found" });
      const storedHash = dbUser.passwordHash || dbUser.password_hash;
      if (!storedHash) return res.status(400).json({ message: "No password set for account" });
      const ok = await bcrypt2.compare(currentPassword, storedHash);
      if (!ok) return res.status(401).json({ message: "Current password incorrect" });
      const newHash = await bcrypt2.hash(newPassword, 10);
      await storage.upsertUser({ id: dbUser.id, passwordHash: newHash });
      return res.json({ ok: true });
    } catch (e) {
      console.error("Change password error:", e);
      return res.status(500).json({ message: "Failed to change password" });
    }
  });
  app2.get("/api/codex/:id", async (req, res) => {
    try {
      const entry = await storage.getCodexEntryById(req.params.id);
      if (!entry) {
        res.status(404).json({ message: "Codex entry not found" });
        return;
      }
      res.json(entry);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch codex entry" });
    }
  });
  app2.get("/api/auth/user", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Vary", "Cookie");
      let sessionUser = req.session?.user || null;
      if (!sessionUser && process.env.NODE_ENV === "development") {
        const tok = getDevTokenFromReq(req);
        if (tok) {
          const payload = verifyDevToken(tok);
          if (payload && payload.id) sessionUser = { ...payload };
        }
      }
      if (sessionUser) {
        sessionUser.isAdmin = isAllowedAdminIdentity({ id: sessionUser.id, email: sessionUser.email });
      }
      return res.json(sessionUser || null);
    } catch (err) {
      console.error("Auth user error:", err);
      return res.status(500).json({ message: "Failed to get user info" });
    }
  });
  app2.get("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
      const sessionUser = req.session?.user || null;
      if (!sessionUser?.id) return res.status(401).json({ message: "Unauthorized" });
      const dbUser = await storage.getUser(sessionUser.id);
      if (!dbUser) return res.status(404).json({ message: "User not found" });
      const safe = {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName ?? dbUser.first_name ?? void 0,
        lastName: dbUser.lastName ?? dbUser.last_name ?? void 0,
        profileImageUrl: dbUser.profileImageUrl ?? dbUser.profile_image_url ?? void 0,
        isAdmin: !!dbUser.isAdmin,
        createdAt: dbUser.createdAt ?? dbUser.created_at ?? void 0,
        updatedAt: dbUser.updatedAt ?? dbUser.updated_at ?? void 0
      };
      return res.json(safe);
    } catch (e) {
      console.error("Get profile error:", e);
      return res.status(500).json({ message: "Failed to get profile" });
    }
  });
  app2.put("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
      const sessionUser = req.session?.user || null;
      if (!sessionUser?.id) return res.status(401).json({ message: "Unauthorized" });
      const { firstName, lastName, email, profileImageUrl } = req.body || {};
      const patch = { id: sessionUser.id };
      if (typeof firstName === "string") patch.firstName = firstName;
      if (typeof lastName === "string") patch.lastName = lastName;
      if (typeof email === "string" && email.includes("@")) patch.email = email;
      if (typeof profileImageUrl === "string") patch.profileImageUrl = profileImageUrl;
      const updated = await storage.upsertUser(patch);
      try {
        req.session.user = {
          ...req.session.user,
          firstName: updated.firstName ?? updated.first_name ?? firstName ?? req.session.user?.firstName,
          lastName: updated.lastName ?? updated.last_name ?? lastName ?? req.session.user?.lastName,
          email: updated.email ?? email ?? req.session.user?.email,
          profileImageUrl: updated.profileImageUrl ?? updated.profile_image_url ?? profileImageUrl ?? req.session.user?.profileImageUrl
        };
      } catch {
      }
      return res.json({ ok: true });
    } catch (e) {
      console.error("Update profile error:", e);
      return res.status(500).json({ message: "Failed to update profile" });
    }
  });
  app2.post("/api/user/upload", isAuthenticated, async (req, res) => {
    try {
      if (process.env.NODE_ENV === "development") {
        try {
          console.log("DEBUG /api/user/upload hit, content-type:", req.headers["content-type"]);
        } catch {
        }
      }
      const { filename, data } = req.body;
      if (!filename || !data) return res.status(400).json({ message: "filename and data (base64) are required" });
      const base64 = data.includes("base64,") ? data.split("base64,")[1] : data;
      const ext = path5.extname(filename) || "";
      const name = `${randomUUID2()}${ext}`;
      const uploadsDir = path5.resolve(process.cwd(), "uploads", "avatars");
      await fs5.promises.mkdir(uploadsDir, { recursive: true });
      const filePath = path5.join(uploadsDir, name);
      await fs5.promises.writeFile(filePath, Buffer.from(base64, "base64"));
      const url = `/uploads/avatars/${name}`;
      res.setHeader("Content-Type", "application/json");
      return res.json({ url });
    } catch (e) {
      console.error("User upload error:", e);
      return res.status(500).json({ message: "Failed to upload file" });
    }
  });
  app2.get("/api/chapters", async (req, res) => {
    try {
      const chapters2 = await storage.getChapters();
      res.json(chapters2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chapters" });
    }
  });
  app2.get("/api/chapters/:slug", async (req, res) => {
    try {
      const chapter = await storage.getChapterBySlug(req.params.slug);
      if (!chapter) {
        res.status(404).json({ message: "Chapter not found" });
        return;
      }
      res.json(chapter);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chapter" });
    }
  });
  app2.get("/api/characters", async (req, res) => {
    try {
      const characters2 = await storage.getCharacters();
      if (req.query.uploadsFallback === "true" && (!characters2 || characters2.length === 0)) {
        try {
          const uploadsFile = path5.resolve(process.cwd(), "uploads", "codex_return_of_the_first_sorcerer.json");
          if (fs5.existsSync(uploadsFile)) {
            const raw = await fs5.promises.readFile(uploadsFile, "utf-8");
            const parsed = JSON.parse(raw || "{}");
            if (Array.isArray(parsed.characters) && parsed.characters.length > 0) {
              const mapped = parsed.characters.map((c) => ({
                id: c.id || randomUUID2(),
                name: c.name || c.id || "Character",
                title: c.position || c.title || void 0,
                description: c.notes || c.description || void 0,
                imageUrl: c.imageUrl || null,
                role: c.role || "unknown"
              }));
              return res.json(mapped);
            }
          }
        } catch (e) {
          console.warn("Failed to read uploaded characters JSON (explicit fallback):", e);
        }
      }
      res.json(characters2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch characters" });
    }
  });
  app2.get("/api/characters/slug/:slug", async (req, res) => {
    try {
      const character = await storage.getCharacterBySlug(req.params.slug);
      if (!character) {
        res.status(404).json({ message: "Character not found" });
        return;
      }
      res.json(character);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch character by slug" });
    }
  });
  app2.get("/api/characters/:id", async (req, res) => {
    try {
      const character = await storage.getCharacterById(req.params.id);
      if (!character) {
        res.status(404).json({ message: "Character not found" });
        return;
      }
      res.json(character);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch character" });
    }
  });
  app2.get("/api/locations", async (req, res) => {
    try {
      const locations2 = await storage.getLocations();
      res.json(locations2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });
  app2.get("/api/locations/:id", async (req, res) => {
    try {
      const location = await storage.getLocationById(req.params.id);
      if (!location) {
        res.status(404).json({ message: "Location not found" });
        return;
      }
      res.json(location);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch location" });
    }
  });
  app2.get("/api/codex", async (req, res) => {
    try {
      const { category } = req.query;
      const requestedCategory = category ? String(category) : void 0;
      const allowed = /* @__PURE__ */ new Set(["magic", "creatures", "items", "other"]);
      const raw = await storage.getCodexEntries();
      const normalized = (raw || []).map((e) => {
        const cat = String(e.category || "").toLowerCase();
        let mapped;
        if (cat === "characters") mapped = "creatures";
        else if (cat === "locations") mapped = "other";
        else if (allowed.has(cat)) mapped = cat;
        else mapped = "other";
        return { ...e, category: mapped };
      }).filter((e) => allowed.has(e.category));
      const filtered = requestedCategory ? normalized.filter((e) => e.category === requestedCategory) : normalized;
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch codex entries" });
    }
  });
  app2.get("/api/blog", async (req, res) => {
    try {
      const posts = await storage.getBlogPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch blog posts" });
    }
  });
  app2.get("/api/blog/:slug", async (req, res) => {
    try {
      const post = await storage.getBlogPostBySlug(req.params.slug);
      if (!post) {
        res.status(404).json({ message: "Blog post not found" });
        return;
      }
      res.json(post);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch blog post" });
    }
  });
  app2.get("/api/reading-progress/:sessionId/:chapterId", async (req, res) => {
    try {
      const { sessionId, chapterId } = req.params;
      const progress = await storage.getReadingProgress(sessionId, chapterId);
      if (!progress) {
        res.status(404).json({ message: "No reading progress found" });
        return;
      }
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reading progress" });
    }
  });
  app2.put("/api/reading-progress", async (req, res) => {
    try {
      const { sessionId, chapterId, progress } = req.body;
      if (!sessionId || !chapterId || typeof progress !== "number") {
        res.status(400).json({ message: "Missing sessionId, chapterId or progress" });
        return;
      }
      const updatedProgress = await storage.updateReadingProgress(sessionId, chapterId, progress);
      res.json(updatedProgress);
    } catch (error) {
      console.error("Reading progress error:", error);
      res.status(400).json({ message: "Invalid reading progress data" });
    }
  });
  app2.post("/api/newsletter", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !email.includes("@")) {
        res.status(400).json({ message: "Valid email address required" });
        return;
      }
      res.json({ message: "Successfully subscribed to newsletter" });
    } catch (error) {
      res.status(500).json({ message: "Failed to subscribe to newsletter" });
    }
  });
  app2.post("/api/translate", async (_req, res) => {
    return res.status(501).json({ message: "Translation provider disabled" });
  });
  app2.get("/api/admin/audio/tracks", isAdmin, async (_req, res) => {
    try {
      const list = await storage.getAudioTracks();
      return res.json(list);
    } catch (e) {
      console.error("List audio tracks error:", e);
      return res.status(500).json({ message: "Failed to list audio tracks" });
    }
  });
  app2.post("/api/admin/audio/tracks", isAdmin, async (req, res) => {
    try {
      let { data } = req.body || {};
      if (!data) data = req.body;
      if (!data) return res.status(400).json({ message: "Missing track data" });
      if (!data.title) data.title = "Untitled Track";
      if (!data.kind) data.kind = "music";
      const validated = insertAudioTrackSchema.parse(data);
      const track = await storage.createAudioTrack(validated);
      return res.status(201).json(track);
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: "Validation failed", issues: e.errors });
      console.error("Create audio track error:", e);
      return res.status(500).json({ message: "Failed to create audio track" });
    }
  });
  app2.put("/api/admin/audio/tracks/:id", isAdmin, async (req, res) => {
    try {
      let { data } = req.body || {};
      if (!data) data = req.body;
      if (!data) return res.status(400).json({ message: "Missing update payload" });
      const patch = insertAudioTrackSchema.partial().parse(data);
      const updated = await storage.updateAudioTrack(req.params.id, patch);
      if (!updated) return res.status(404).json({ message: "Track not found" });
      return res.json(updated);
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: "Validation failed", issues: e.errors });
      console.error("Update audio track error:", e);
      return res.status(500).json({ message: "Failed to update audio track" });
    }
  });
  app2.delete("/api/admin/audio/tracks/:id", isAdmin, async (req, res) => {
    try {
      const ok = await storage.deleteAudioTrack(req.params.id);
      if (!ok) return res.status(404).json({ message: "Track not found" });
      return res.json({ ok: true });
    } catch (e) {
      console.error("Delete audio track error:", e);
      return res.status(500).json({ message: "Failed to delete audio track" });
    }
  });
  app2.get("/api/admin/audio/assignments", isAdmin, async (_req, res) => {
    try {
      const list = await storage.getAudioAssignments();
      return res.json(list);
    } catch (e) {
      console.error("List audio assignments error:", e);
      return res.status(500).json({ message: "Failed to list audio assignments" });
    }
  });
  app2.post("/api/admin/audio/assignments", isAdmin, async (req, res) => {
    try {
      let { data } = req.body || {};
      if (!data) data = req.body;
      if (!data) return res.status(400).json({ message: "Missing assignment data" });
      if (!data.entityType) data.entityType = "global";
      const validated = insertAudioAssignmentSchema.parse(data);
      const created = await storage.createAudioAssignment(validated);
      return res.status(201).json(created);
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: "Validation failed", issues: e.errors });
      console.error("Create audio assignment error:", e);
      return res.status(500).json({ message: "Failed to create audio assignment" });
    }
  });
  app2.put("/api/admin/audio/assignments/:id", isAdmin, async (req, res) => {
    try {
      let { data } = req.body || {};
      if (!data) data = req.body;
      if (!data) return res.status(400).json({ message: "Missing update payload" });
      const patch = insertAudioAssignmentSchema.partial().parse(data);
      const updated = await storage.updateAudioAssignment(req.params.id, patch);
      if (!updated) return res.status(404).json({ message: "Assignment not found" });
      return res.json(updated);
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: "Validation failed", issues: e.errors });
      console.error("Update audio assignment error:", e);
      return res.status(500).json({ message: "Failed to update audio assignment" });
    }
  });
  app2.delete("/api/admin/audio/assignments/:id", isAdmin, async (req, res) => {
    try {
      const ok = await storage.deleteAudioAssignment(req.params.id);
      if (!ok) return res.status(404).json({ message: "Assignment not found" });
      return res.json({ ok: true });
    } catch (e) {
      console.error("Delete audio assignment error:", e);
      return res.status(500).json({ message: "Failed to delete audio assignment" });
    }
  });
  app2.get("/api/audio/resolve", async (req, res) => {
    try {
      const page = typeof req.query.page === "string" ? req.query.page : void 0;
      const chapterId = typeof req.query.chapterId === "string" ? req.query.chapterId : void 0;
      const characterId = typeof req.query.characterId === "string" ? req.query.characterId : void 0;
      const codexId = typeof req.query.codexId === "string" ? req.query.codexId : void 0;
      const locationId = typeof req.query.locationId === "string" ? req.query.locationId : void 0;
      const track = await storage.resolveAudio({ page, chapterId, characterId, codexId, locationId });
      if (!track) return res.json(null);
      return res.json(track);
    } catch (e) {
      console.error("Resolve audio error:", e);
      return res.status(500).json({ message: "Failed to resolve audio" });
    }
  });
  app2.post("/api/admin/chapters", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = req.body || {};
        const chapterKeys = ["title", "excerpt", "content", "chapterNumber", "arcNumber", "arcTitle", "readingTime", "slug", "publishedAt", "imageUrl"];
        if (Object.keys(possible).some((k) => chapterKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: "Request body must include chapter fields (wrap in { data } or send raw keys)" });
      if (!data.title) {
        const fallbackTitle = data.slug || "Untitled Chapter";
        console.warn("Chapter payload missing title, defaulting to:", fallbackTitle);
        data.title = fallbackTitle;
      }
      const slugify = (input) => {
        const s = (input || "").toString().trim().toLowerCase();
        const normalized = s.normalize ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : s;
        return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^[\-]+|[\-]+$/g, "");
      };
      const ensureUniqueChapterSlug = async (desired) => {
        let base = slugify(desired) || "capitulo";
        let attempt = base;
        let i = 1;
        while (true) {
          const exists = await storage.getChapterBySlug(attempt);
          if (!exists) return attempt;
          i += 1;
          attempt = `${base}-${i}`;
          if (i > 50) return `${base}-${Date.now()}`;
        }
      };
      const html = String(data.content || "");
      const plain = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (!data.excerpt) {
        data.excerpt = plain.slice(0, 300);
      }
      if (!data.readingTime) {
        const words = plain.split(/\s+/).filter(Boolean).length;
        data.readingTime = Math.max(1, Math.ceil(words / 250));
      }
      if (!data.publishedAt) {
        data.publishedAt = (/* @__PURE__ */ new Date()).toISOString();
      }
      if (!data.slug || String(data.slug).trim() === "") {
        const desired = data.title || `capitulo-${data.chapterNumber || ""}`;
        data.slug = await ensureUniqueChapterSlug(desired);
      }
      if (!data.imageUrl) {
        data.imageUrl = "/FinalMap.png";
      }
      if (!data.chapterNumber || data.chapterNumber <= 0) {
        data.chapterNumber = 1;
      }
      const validatedData = insertChapterSchema.parse(data);
      const chapter = await storage.createChapter(validatedData);
      if (chapter?.id && translations) {
        await saveTranslations("chapters", chapter.id, translations);
      }
      res.status(201).json(chapter);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Chapter validation error:", error.errors);
        return res.status(400).json({ message: "Validation failed", issues: error.errors });
      }
      console.error("Create chapter error:", error);
      res.status(500).json({ message: "Failed to create chapter", error: String(error) });
    }
  });
  app2.put("/api/admin/chapters/:id", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = req.body || {};
        const chapterKeys = ["title", "excerpt", "content", "readingTime", "publishedAt", "imageUrl"];
        if (Object.keys(possible).some((k) => chapterKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: "Request body must include update fields (wrap in { data } or send raw keys)" });
      const patch = insertChapterSchema.partial().parse(data);
      if (patch?.publishedAt) {
        patch.publishedAt = new Date(String(patch.publishedAt)).toISOString();
      }
      if (typeof patch.content === "string" && patch.readingTime == null) {
        const plain = patch.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        const words = plain.split(/\s+/).filter(Boolean).length;
        patch.readingTime = Math.max(1, Math.ceil(words / 250));
        if (!patch.excerpt) {
          patch.excerpt = plain.slice(0, 300);
        }
      }
      const chapter = await storage.updateChapter(req.params.id, patch);
      if (!chapter) {
        res.status(404).json({ message: "Chapter not found" });
        return;
      }
      if (chapter?.id && translations) {
        await saveTranslations("chapters", chapter.id, translations);
      }
      res.json(chapter);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Chapter validation error:", error.errors);
        return res.status(400).json({ message: "Validation failed", issues: error.errors });
      }
      console.error("Update chapter error:", error);
      res.status(500).json({ message: "Failed to update chapter", error: String(error) });
    }
  });
  app2.delete("/api/admin/chapters/:id", isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteChapter(req.params.id);
      if (!success) {
        res.status(404).json({ message: "Chapter not found" });
        return;
      }
      res.json({ message: "Chapter deleted successfully" });
    } catch (error) {
      console.error("Delete chapter error:", error);
      res.status(500).json({ message: "Failed to delete chapter" });
    }
  });
  app2.post("/api/admin/characters", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = req.body || {};
        const charKeys = ["name", "title", "description", "imageUrl", "role", "slug"];
        if (Object.keys(possible).some((k) => charKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: "Request body must include character fields (wrap in { data } or send raw keys)" });
      try {
        console.log("ADMIN CREATE CHARACTER translations keys:", translations ? Object.keys(translations) : "(none)", "translations sample:", translations ? Object.keys(translations).slice(0, 3).reduce((acc, k) => ({ ...acc, [k]: Object.keys(translations[k] || {}).slice(0, 3) }), {}) : null);
      } catch (e) {
      }
      const validatedData = insertCharacterSchema.parse(data);
      const character = await storage.createCharacter(validatedData);
      if (character?.id && translations) {
        await saveTranslations("characters", character.id, translations);
      }
      res.status(201).json(character);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Character validation error:", error.errors);
        return res.status(400).json({ message: "Validation failed", issues: error.errors });
      }
      console.error("Create character error:", error);
      res.status(500).json({ message: "Failed to create character", error: String(error) });
    }
  });
  app2.put("/api/admin/characters/:id", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = req.body || {};
        const charKeys = ["name", "title", "description", "imageUrl", "role"];
        if (Object.keys(possible).some((k) => charKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: "Request body must include character update fields (wrap in { data } or send raw keys)" });
      try {
        console.log("ADMIN UPDATE CHARACTER id=", req.params.id, "translations keys:", translations ? Object.keys(translations) : "(none)", "translations sample:", translations ? Object.keys(translations).slice(0, 3).reduce((acc, k) => ({ ...acc, [k]: Object.keys(translations[k] || {}).slice(0, 3) }), {}) : null);
      } catch (e) {
      }
      const validatedData = insertCharacterSchema.partial().parse(data);
      const character = await storage.updateCharacter(req.params.id, validatedData);
      if (!character) {
        res.status(404).json({ message: "Character not found" });
        return;
      }
      if (character?.id && translations) {
        await saveTranslations("characters", character.id, translations);
      }
      res.json(character);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Character validation error:", error.errors);
        return res.status(400).json({ message: "Validation failed", issues: error.errors });
      }
      console.error("Update character error:", error);
      res.status(500).json({ message: "Failed to update character", error: String(error) });
    }
  });
  app2.delete("/api/admin/characters/:id", isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteCharacter(req.params.id);
      if (!success) {
        res.status(404).json({ message: "Character not found" });
        return;
      }
      res.json({ message: "Character deleted successfully" });
    } catch (error) {
      console.error("Delete character error:", error);
      res.status(500).json({ message: "Failed to delete character" });
    }
  });
  app2.post("/api/admin/locations", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = req.body || {};
        const locKeys = ["name", "description", "mapX", "mapY", "type"];
        if (Object.keys(possible).some((k) => locKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: "Request body must include location fields (wrap in { data } or send raw keys)" });
      const validatedData = insertLocationSchema.parse(data);
      const location = await storage.createLocation(validatedData);
      if (location?.id && translations) {
        await saveTranslations("locations", location.id, translations);
      }
      res.status(201).json(location);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Location validation error:", error.errors);
        return res.status(400).json({ message: "Validation failed", issues: error.errors });
      }
      console.error("Create location error:", error);
      res.status(500).json({ message: "Failed to create location", error: String(error) });
    }
  });
  app2.put("/api/admin/locations/:id", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = req.body || {};
        const locKeys = ["name", "description", "mapX", "mapY", "type"];
        if (Object.keys(possible).some((k) => locKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      try {
        console.log("ADMIN UPDATE LOCATION called for id=", req.params.id, "sessionUser=", req.session?.user, "adminUser=", req.adminUser, "bodyKeys=", Object.keys(req.body || {}));
        if (process.env.NODE_ENV === "development") console.log("ADMIN UPDATE LOCATION body=", JSON.stringify(req.body));
      } catch (e) {
      }
      if (!data) return res.status(400).json({ message: "Request body must include location update fields (wrap in { data } or send raw keys)" });
      const validatedData = insertLocationSchema.partial().parse(data);
      const location = await storage.updateLocation(req.params.id, validatedData);
      if (!location) {
        res.status(404).json({ message: "Location not found" });
        return;
      }
      if (location?.id && translations) {
        await saveTranslations("locations", location.id, translations);
      }
      res.json(location);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Location validation error:", error.errors);
        return res.status(400).json({ message: "Validation failed", issues: error.errors });
      }
      console.error("Update location error:", error);
      res.status(500).json({ message: "Failed to update location", error: String(error) });
    }
  });
  app2.delete("/api/admin/locations/:id", isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteLocation(req.params.id);
      if (!success) {
        res.status(404).json({ message: "Location not found" });
        return;
      }
      res.json({ message: "Location deleted successfully" });
    } catch (error) {
      console.error("Delete location error:", error);
      res.status(500).json({ message: "Failed to delete location" });
    }
  });
  app2.post("/api/admin/codex", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = req.body || {};
        const codexKeys = ["title", "description", "content", "category", "imageUrl"];
        if (Object.keys(possible).some((k) => codexKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: "Request body must include codex entry fields (wrap in { data } or send raw keys)" });
      const validatedData = insertCodexEntrySchema.parse(data);
      try {
        const entry = await storage.createCodexEntry(validatedData);
        if (entry?.id && translations) {
          await saveTranslations("codex", entry.id, translations);
        }
        return res.status(201).json(entry);
      } catch (err) {
        console.warn("Codex create failed, attempting fallback (content -> description):", String(err));
        try {
          const fallback = { ...validatedData };
          const html = String(fallback.content || "");
          const plain = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          fallback.description = fallback.description && String(fallback.description).trim().length > 0 ? fallback.description : plain.slice(0, 300);
          delete fallback.content;
          const entry2 = await storage.createCodexEntry(fallback);
          if (entry2?.id && translations) {
            await saveTranslations("codex", entry2.id, translations);
          }
          return res.status(201).json(entry2);
        } catch (err2) {
          console.error("Fallback codex create also failed:", String(err2));
          throw err2;
        }
      }
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Codex validation error:", error.errors);
        return res.status(400).json({ message: "Validation failed", issues: error.errors });
      }
      console.error("Create codex entry error:", error);
      res.status(500).json({ message: "Failed to create codex entry", error: String(error) });
    }
  });
  app2.put("/api/admin/codex/:id", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = req.body || {};
        const codexKeys = ["title", "description", "content", "category", "imageUrl"];
        if (Object.keys(possible).some((k) => codexKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: "Request body must include codex update fields (wrap in { data } or send raw keys)" });
      const validatedData = insertCodexEntrySchema.partial().parse(data);
      try {
        const entry = await storage.updateCodexEntry(req.params.id, validatedData);
        if (!entry) {
          res.status(404).json({ message: "Codex entry not found" });
          return;
        }
        if (entry?.id && translations) {
          await saveTranslations("codex", entry.id, translations);
        }
        return res.json(entry);
      } catch (err) {
        console.warn("Codex update failed, attempting fallback (content -> description):", String(err));
        try {
          const fallback = { ...validatedData };
          const html = String(fallback.content || "");
          const plain = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          fallback.description = fallback.description && String(fallback.description).trim().length > 0 ? fallback.description : plain.slice(0, 300);
          delete fallback.content;
          const entry2 = await storage.updateCodexEntry(req.params.id, fallback);
          if (!entry2) {
            res.status(404).json({ message: "Codex entry not found" });
            return;
          }
          if (entry2?.id && translations) {
            await saveTranslations("codex", entry2.id, translations);
          }
          return res.json(entry2);
        } catch (err2) {
          console.error("Fallback codex update also failed:", String(err2));
          throw err2;
        }
      }
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Codex validation error:", error.errors);
        return res.status(400).json({ message: "Validation failed", issues: error.errors });
      }
      console.error("Update codex entry error:", error);
      res.status(500).json({ message: "Failed to update codex entry", error: String(error) });
    }
  });
  app2.delete("/api/admin/codex/:id", isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteCodexEntry(req.params.id);
      if (!success) {
        res.status(404).json({ message: "Codex entry not found" });
        return;
      }
      res.json({ message: "Codex entry deleted successfully" });
    } catch (error) {
      console.error("Delete codex entry error:", error);
      res.status(500).json({ message: "Failed to delete codex entry" });
    }
  });
  app2.post("/api/admin/blog", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = req.body || {};
        const blogKeys = ["title", "excerpt", "content", "category", "slug", "publishedAt", "imageUrl"];
        if (Object.keys(possible).some((k) => blogKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: "Request body must include blog post fields (wrap in { data } or send raw keys)" });
      const validatedData = insertBlogPostSchema.parse(data);
      if (validatedData?.publishedAt) {
        validatedData.publishedAt = new Date(String(validatedData.publishedAt)).toISOString();
      }
      const post = await storage.createBlogPost(validatedData);
      if (post?.id && translations) {
        await saveTranslations("blog", post.id, translations);
      }
      res.status(201).json(post);
    } catch (error) {
      console.error("Create blog post error:", error);
      res.status(400).json({ message: "Invalid blog post data", error: String(error) });
    }
  });
  app2.post("/api/admin/upload", isAdmin, async (req, res) => {
    try {
      const { filename, data } = req.body;
      if (!filename || !data) {
        res.status(400).json({ message: "filename and data (base64) are required" });
        return;
      }
      const base64 = data.includes("base64,") ? data.split("base64,")[1] : data;
      const ext = path5.extname(filename) || "";
      const name = `${randomUUID2()}${ext}`;
      const uploadsDir = path5.resolve(process.cwd(), "uploads");
      await fs5.promises.mkdir(uploadsDir, { recursive: true });
      const filePath = path5.join(uploadsDir, name);
      await fs5.promises.writeFile(filePath, Buffer.from(base64, "base64"));
      const url = `/uploads/${name}`;
      res.json({ url });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });
  app2.post("/api/maps", async (req, res) => {
    try {
      const { svg, markers, masks, name } = req.body || {};
      if (!markers || !Array.isArray(markers)) return res.status(400).json({ message: "markers array required" });
      const id = randomUUID2();
      const uploadsDir = path5.resolve(process.cwd(), "uploads", "maps");
      await fs5.promises.mkdir(uploadsDir, { recursive: true });
      const out = {
        id,
        name: name || `map-${id}`,
        svg: svg || null,
        markers,
        masks: masks || [],
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const filePath = path5.join(uploadsDir, `${id}.json`);
      await fs5.promises.writeFile(filePath, JSON.stringify(out, null, 2), "utf8");
      return res.json({ id, url: `/uploads/maps/${id}.json` });
    } catch (err) {
      console.error("Save map error:", err);
      return res.status(500).json({ message: "Failed to save map" });
    }
  });
  app2.get("/api/maps/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const filePath = path5.resolve(process.cwd(), "uploads", "maps", `${id}.json`);
      if (!fs5.existsSync(filePath)) return res.status(404).json({ message: "Map not found" });
      const content = await fs5.promises.readFile(filePath, "utf8");
      return res.type("application/json").send(content);
    } catch (err) {
      console.error("Get map error:", err);
      return res.status(500).json({ message: "Failed to read map" });
    }
  });
  app2.get("/api/maps/latest", async (req, res) => {
    try {
      const uploadsDir = path5.resolve(process.cwd(), "uploads", "maps");
      if (!fs5.existsSync(uploadsDir)) return res.status(404).json({ message: "No maps found" });
      const files = await fs5.promises.readdir(uploadsDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      if (jsonFiles.length === 0) return res.status(404).json({ message: "No maps found" });
      let newest = null;
      for (const fname of jsonFiles) {
        const fp = path5.join(uploadsDir, fname);
        try {
          const txt = await fs5.promises.readFile(fp, "utf8");
          const parsed = JSON.parse(txt || "{}");
          const createdAt = parsed?.createdAt || null;
          if (!newest) newest = { path: fp, createdAt };
          else {
            if (createdAt && newest.createdAt) {
              if (new Date(createdAt) > new Date(newest.createdAt)) newest = { path: fp, createdAt };
            } else {
              const a = (await fs5.promises.stat(fp)).mtime;
              const b = newest.path ? (await fs5.promises.stat(newest.path)).mtime : /* @__PURE__ */ new Date(0);
              if (a > b) newest = { path: fp, createdAt };
            }
          }
        } catch (e) {
        }
      }
      if (!newest) return res.status(404).json({ message: "No maps found" });
      const content = await fs5.promises.readFile(newest.path, "utf8");
      return res.type("application/json").send(content);
    } catch (err) {
      console.error("Get latest map error:", err);
      return res.status(500).json({ message: "Failed to read maps" });
    }
  });
  app2.put("/api/admin/blog/:id", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = req.body || {};
        const blogKeys = ["title", "excerpt", "content", "category", "publishedAt", "imageUrl"];
        if (Object.keys(possible).some((k) => blogKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: "Request body must include blog update fields (wrap in { data } or send raw keys)" });
      const validatedData = insertBlogPostSchema.partial().parse(data);
      if (validatedData?.publishedAt) {
        validatedData.publishedAt = new Date(String(validatedData.publishedAt)).toISOString();
      }
      const post = await storage.updateBlogPost(req.params.id, validatedData);
      if (!post) {
        res.status(404).json({ message: "Blog post not found" });
        return;
      }
      if (post?.id && translations) {
        await saveTranslations("blog", post.id, translations);
      }
      res.json(post);
    } catch (error) {
      console.error("Update blog post error:", error);
      res.status(400).json({ message: "Invalid blog post data", error: String(error) });
    }
  });
  app2.delete("/api/admin/blog/:id", isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteBlogPost(req.params.id);
      if (!success) {
        res.status(404).json({ message: "Blog post not found" });
        return;
      }
      res.json({ message: "Blog post deleted successfully" });
    } catch (error) {
      console.error("Delete blog post error:", error);
      res.status(500).json({ message: "Failed to delete blog post" });
    }
  });
  if (process.env.NODE_ENV === "development") {
    app2.post("/api/dev/seed-arc1", isDevAdmin, async (_req, res) => {
      try {
        const seeds = [
          {
            slug: "arco-1-o-limiar-capitulo-1",
            title: "Cap\xEDtulo 1 \u2014 O Limiar",
            excerpt: "\xC0 beira do desconhecido, uma porta antiga se abre \u2014 mas s\xF3 para quem ousa pagar o pre\xE7o.",
            content: "<p>O vento cantava pelos corredores de pedra enquanto a luz p\xE1lida da aurora arranhava o ch\xE3o. Diante do Port\xE3o Velado, Kael sentiu o frio do mundo antigo tocar sua pele como um juramento esquecido.</p>\n<p>As runas no arco vibraram, t\xEDmidas a princ\xEDpio, depois firmes \u2014 reconhecendo nele algo que nem ele compreendia totalmente. O Limiar n\xE3o julgava coragem. Julgava verdade.</p>\n<p>\u2014 Se cruzar, n\xE3o volta o mesmo \u2014 avisou Lyra, mantendo os olhos na dobra de luz. \u2014 Muitos entram. Poucos retornam. Nenhum retorna inteiro.</p>\n<p>Kael inspirou. E deu o passo.</p>",
            chapterNumber: 1,
            arcNumber: 1,
            arcTitle: "O Limiar",
            readingTime: 7,
            publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1e3).toISOString(),
            imageUrl: "/FinalMap.png"
          },
          {
            slug: "arco-1-o-limiar-capitulo-2",
            title: "Cap\xEDtulo 2 \u2014 Ecos da Porta",
            excerpt: "Cada porta cobra um ped\xE1gio. A primeira, mem\xF3ria. A segunda, nome.",
            content: "<p>Do outro lado, o mundo n\xE3o obedecia mapas. O c\xE9u dobrava, a terra respirava, e as sombras tinham \xE2ngulos que n\xE3o pertenciam a lugar nenhum.</p>\n<p>Kael ouviu sua voz cham\xE1-lo \u2014 mas a voz vinha de tr\xE1s de si, de um tempo anterior, de quando ele ainda n\xE3o carregava o s\xEDmbolo ardendo no pulso.</p>\n<p>\u2014 O Limiar n\xE3o abre caminho. Ele abre voc\xEA \u2014 sussurrou a guardi\xE3. \u2014 S\xF3 ent\xE3o o caminho aparece.</p>\n<p>As palavras ecoaram como \xE1gua em pedra antiga. E algo dentro dele come\xE7ou a ceder.</p>",
            chapterNumber: 2,
            arcNumber: 1,
            arcTitle: "O Limiar",
            readingTime: 8,
            publishedAt: new Date(Date.now() - 36 * 60 * 60 * 1e3).toISOString(),
            imageUrl: "/FinalMap.png"
          },
          {
            slug: "arco-1-o-limiar-capitulo-3",
            title: "Cap\xEDtulo 3 \u2014 O Pre\xE7o da Travessia",
            excerpt: "Toda travessia leva algo. S\xF3 os tolos acreditam que \xE9 poss\xEDvel atravessar ileso.",
            content: "<p>Quando a luz fechou atr\xE1s deles, o sil\xEAncio pesou como ferro molhado. Kael tentou lembrar o nome do seu mestre \u2014 e falhou.</p>\n<p>N\xE3o era esquecimento comum. Era uma aus\xEAncia limpa, cir\xFArgica. Algo havia sido tomado.</p>\n<p>\u2014 A porta levou? \u2014 Lyra perguntou, a voz curta.</p>\n<p>\u2014 Levou \u2014 disse Kael, sentindo, junto ao vazio, um fio de poder novo, cru e afiado. \u2014 E deixou isso no lugar.</p>",
            chapterNumber: 3,
            arcNumber: 1,
            arcTitle: "O Limiar",
            readingTime: 9,
            publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1e3).toISOString(),
            imageUrl: "/FinalMap.png"
          }
        ];
        const created = [];
        for (const s of seeds) {
          const exists = await storage.getChapterBySlug(s.slug);
          if (!exists) {
            created.push(await storage.createChapter(s));
          }
        }
        return res.json({ ok: true, created: created.map((c) => c.slug) });
      } catch (e) {
        console.error("seed-arc1 error:", e);
        return res.status(500).json({ ok: false, error: String(e) });
      }
    });
    app2.post("/api/dev/import-uploads", isDevAdmin, async (req, res) => {
      try {
        const uploadsFile = path5.resolve(process.cwd(), "uploads", "codex_return_of_the_first_sorcerer.json");
        if (!fs5.existsSync(uploadsFile)) return res.status(404).json({ message: "uploads file not found" });
        const raw = await fs5.promises.readFile(uploadsFile, "utf-8");
        const parsed = JSON.parse(raw || "{}");
        const created = { characters: [], locations: [], codex: [] };
        if (Array.isArray(parsed.characters)) {
          for (const c of parsed.characters) {
            try {
              const payload = {
                name: c.name || c.id,
                title: c.position || c.title || void 0,
                description: c.notes || c.description || void 0,
                imageUrl: c.imageUrl || void 0,
                role: c.role || "unknown"
              };
              const record = await storage.createCharacter(payload);
              created.characters.push(record);
            } catch (e) {
              console.warn("Failed to create character from upload:", e);
            }
          }
        }
        if (Array.isArray(parsed.locations)) {
          for (const l of parsed.locations) {
            try {
              const payload = {
                name: l.name || l.id,
                description: l.description || void 0,
                mapX: l.mapX || void 0,
                mapY: l.mapY || void 0,
                type: l.type || void 0
              };
              const record = await storage.createLocation(payload);
              created.locations.push(record);
            } catch (e) {
              console.warn("Failed to create location from upload:", e);
            }
          }
        }
        res.json({ ok: true, created });
      } catch (err) {
        console.error("Import uploads failed:", err);
        res.status(500).json({ message: "Import failed", error: String(err) });
      }
    });
    app2.post("/api/dev/import-uploads-force", async (_req, res) => {
      if (process.env.NODE_ENV !== "development") return res.status(403).json({ message: "Not allowed" });
      try {
        const uploadsFile = path5.resolve(process.cwd(), "uploads", "codex_return_of_the_first_sorcerer.json");
        if (!fs5.existsSync(uploadsFile)) return res.status(404).json({ message: "uploads file not found" });
        const raw = await fs5.promises.readFile(uploadsFile, "utf-8");
        const parsed = JSON.parse(raw || "{}");
        const created = { characters: [], locations: [], codex: [] };
        if (Array.isArray(parsed.characters)) {
          for (const c of parsed.characters) {
            try {
              const payload = {
                name: c.name || c.id,
                title: c.position || c.title || void 0,
                description: c.notes || c.description || void 0,
                imageUrl: c.imageUrl || void 0,
                role: c.role || "unknown"
              };
              const record = await storage.createCharacter(payload);
              created.characters.push(record);
            } catch (e) {
              console.warn("Failed to create character from upload:", e);
            }
          }
        }
        if (Array.isArray(parsed.locations)) {
          for (const l of parsed.locations) {
            try {
              const payload = {
                name: l.name || l.id,
                description: l.description || void 0,
                mapX: l.mapX || void 0,
                mapY: l.mapY || void 0,
                type: l.type || void 0
              };
              const record = await storage.createLocation(payload);
              created.locations.push(record);
            } catch (e) {
              console.warn("Failed to create location from upload:", e);
            }
          }
        }
        res.json({ ok: true, created });
      } catch (err) {
        console.error("Import uploads failed (force):", err);
        res.status(500).json({ message: "Import failed", error: String(err) });
      }
    });
    app2.post("/api/dev/login", (req, res) => {
      try {
        const { id, email, isAdmin: isAdmin2 = true } = req.body || {};
        if (!id) return res.status(400).json({ message: "id is required" });
        req.session.user = { id, email: email ?? `${id}@local.dev`, isAdmin: isAdmin2 };
        return res.json({ ok: true, user: req.session.user });
      } catch (error) {
        console.error("Dev login error:", error);
        return res.status(500).json({ message: "Failed to login (dev)" });
      }
    });
    app2.post("/api/dev/import-fullnovel", isDevAdmin, async (req, res) => {
      try {
        const parsed = parseFullNovelMarkdown();
        const created = [];
        const updated = [];
        for (const ch of parsed) {
          const exists = await storage.getChapterBySlug(ch.slug);
          const readingTime = Math.max(1, Math.ceil(ch.contentHtml.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length / 250));
          const payload = {
            title: ch.title,
            slug: ch.slug,
            excerpt: ch.excerpt,
            content: ch.contentHtml,
            chapterNumber: ch.chapterNumber,
            arcNumber: ch.arcNumber,
            arcTitle: ch.arcTitle,
            readingTime,
            publishedAt: (/* @__PURE__ */ new Date()).toISOString(),
            imageUrl: "/FinalMap.png"
          };
          if (!exists) {
            await storage.createChapter(payload);
            created.push(ch.slug);
          } else {
            await storage.updateChapter(exists.id, {
              title: payload.title,
              excerpt: payload.excerpt,
              content: payload.content,
              readingTime: payload.readingTime
            });
            updated.push(ch.slug);
          }
        }
        return res.json({ ok: true, created, updated, count: parsed.length });
      } catch (e) {
        console.error("import-fullnovel error:", e);
        return res.status(500).json({ ok: false, error: String(e) });
      }
    });
    app2.post("/api/dev/import-fullnovel-force", async (_req, res) => {
      if (process.env.NODE_ENV !== "development") return res.status(403).json({ message: "Not allowed" });
      try {
        const parsed = parseFullNovelMarkdown();
        const created = [];
        const updated = [];
        for (const ch of parsed) {
          const exists = await storage.getChapterBySlug(ch.slug);
          const readingTime = Math.max(1, Math.ceil(ch.contentHtml.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length / 250));
          const payload = {
            title: ch.title,
            slug: ch.slug,
            excerpt: ch.excerpt,
            content: ch.contentHtml,
            chapterNumber: ch.chapterNumber,
            arcNumber: ch.arcNumber,
            arcTitle: ch.arcTitle,
            readingTime,
            publishedAt: (/* @__PURE__ */ new Date()).toISOString(),
            imageUrl: "/FinalMap.png"
          };
          if (!exists) {
            await storage.createChapter(payload);
            created.push(ch.slug);
          } else {
            await storage.updateChapter(exists.id, {
              title: payload.title,
              excerpt: payload.excerpt,
              content: payload.content,
              readingTime: payload.readingTime
            });
            updated.push(ch.slug);
          }
        }
        return res.json({ ok: true, created, updated, count: parsed.length });
      } catch (e) {
        console.error("import-fullnovel-force error:", e);
        return res.status(500).json({ ok: false, error: String(e) });
      }
    });
    app2.get("/api/dev/login", (req, res) => {
      try {
        req.session.user = {
          id: "dev-admin",
          email: "dev-admin@local.dev",
          isAdmin: true
        };
        return res.redirect("/#/admin");
      } catch (error) {
        console.error("Dev admin error:", error);
        return res.status(500).json({ message: "Failed to access admin (dev)" });
      }
    });
    app2.post("/api/dev/create-admin", async (req, res) => {
      try {
        const { id = `dev-${randomUUID2()}`, email, displayName, isAdmin: isAdmin2 = true } = req.body || {};
        const userRecord = await storage.upsertUser({
          id,
          email: email ?? `${id}@local.dev`,
          firstName: displayName ?? "Dev",
          lastName: "",
          profileImageUrl: void 0,
          isAdmin: !!isAdmin2
        });
        return res.json({ ok: true, user: userRecord });
      } catch (error) {
        console.error("Dev create-admin error:", error);
        return res.status(500).json({ message: "Failed to create admin user" });
      }
    });
    app2.post("/api/dev/promote-self", isAuthenticated, async (req, res) => {
      try {
        if (process.env.NODE_ENV !== "development") return res.status(403).json({ message: "Not allowed" });
        const sessionUser = req.session?.user || null;
        if (!sessionUser?.id) return res.status(401).json({ message: "Unauthorized" });
        const dbUser = await storage.getUser(sessionUser.id);
        if (!dbUser) return res.status(404).json({ message: "User not found" });
        if (!dbUser.isAdmin) {
          await storage.upsertUser({ id: dbUser.id, isAdmin: 1 });
        }
        try {
          req.session.user = { ...req.session.user, isAdmin: true };
        } catch {
        }
        return res.json({ ok: true });
      } catch (err) {
        console.error("Dev promote-self error:", err);
        return res.status(500).json({ message: "Failed to promote user" });
      }
    });
    app2.get("/api/dev/debug", (req, res) => {
      try {
        const sessionUser = req.session?.user || null;
        const info = {
          sessionUser,
          headers: {
            host: req.headers.host,
            origin: req.headers.origin,
            referer: req.headers.referer,
            cookie: req.headers.cookie,
            ua: req.headers["user-agent"],
            forwarded: req.headers["x-forwarded-for"] || null
          },
          url: req.originalUrl
        };
        return res.json(info);
      } catch (err) {
        console.error("Dev debug error:", err);
        return res.status(500).json({ message: "Dev debug failed" });
      }
    });
    app2.get("/api/dev/translations/:resource/:id", async (req, res) => {
      return res.json({ ok: true, translation: null });
    });
    app2.post("/api/dev/translations/:resource/:id", async (req, res) => {
      return res.json({ ok: true });
    });
  }
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs6 from "fs";
import path7 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path6 from "path";
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path6.resolve(import.meta.dirname, "client", "src"),
      "@shared": path6.resolve(import.meta.dirname, "shared"),
      "@assets": path6.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path6.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path6.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    proxy: {
      "/api": {
        // allow overriding backend port via BACKEND_PORT or PORT env when running dev
        target: `http://localhost:${process.env.BACKEND_PORT || process.env.PORT || 5e3}`,
        changeOrigin: true,
        secure: false
      }
    },
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        try {
          console.error("[vite] error:", typeof msg === "string" ? msg : JSON.stringify(msg));
        } catch (e) {
          console.error("[vite] error (unknown)");
        }
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use((req, res, next) => {
    const url = req.originalUrl || req.url || "";
    if (url.startsWith("/api") || url.startsWith("/uploads")) {
      return next();
    }
    return vite.middlewares(req, res, next);
  });
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    if (req.method !== "GET" || url.startsWith("/api") || url.startsWith("/uploads")) {
      return next();
    }
    try {
      const clientTemplate = path7.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs6.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path7.resolve(import.meta.dirname, "public");
  if (!fs6.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path7.resolve(distPath, "index.html"));
  });
}

// server/index.ts
import fs7 from "fs";
import path8 from "path";
var app = express2();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    // Allow requests from the Vite dev server
    credentials: true
    // Allow cookies to be sent
  })
);
app.use(compression({ threshold: 0 }));
app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();
  const noStore = () => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  };
  const alwaysNoStorePrefixes = [
    "/api/auth",
    "/api/login",
    "/api/logout",
    "/api/user",
    "/api/dev",
    "/api/admin"
  ];
  if (alwaysNoStorePrefixes.some((p) => req.path.startsWith(p)) || req.method !== "GET") {
    noStore();
    return next();
  }
  const cacheablePattern = /^\/api\/(chapters|characters|locations|codex|blog|maps)(\/|$)/;
  if (cacheablePattern.test(req.path)) {
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.setHeader("Vary", "Accept-Encoding");
  } else {
    noStore();
  }
  next();
});
app.use(express2.json({ limit: process.env.BODY_LIMIT || "25mb" }));
app.use(express2.urlencoded({ extended: true, limit: process.env.BODY_LIMIT || "25mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  const path9 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path9.startsWith("/api")) {
      let logLine = `${req.method} ${path9} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  await dbInit().catch((e) => {
    console.error("DB init failed:", e?.message || e);
  });
  const server = await registerRoutes(app);
  app.use("/api", (req, res, next) => {
    if (!res.headersSent) {
      return res.status(404).json({ message: "Not Found" });
    }
    return next();
  });
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (err.type === "entity.too.large") {
      const limit = process.env.BODY_LIMIT || "25mb";
      return res.status(413).json({ message: `Arquivo muito grande. Limite: ${limit}.` });
    }
    const message = err.message || "Internal Server Error";
    if (!res.headersSent) {
      res.status(status).json({ message });
    } else {
      console.warn("Error after headers sent:", message);
    }
    console.error(err);
  });
  app.get("/live", (_req, res) => res.status(200).send("ok"));
  app.get("/ready", async (_req, res) => {
    if (dbCircuitOpen()) return res.status(503).send("db-circuit-open");
    const ok = await dbReadyPing();
    return ok ? res.status(200).send("ready") : res.status(503).send("db-down");
  });
  const uploadsPath = process.env.UPLOADS_DIR ? path8.resolve(process.env.UPLOADS_DIR) : path8.resolve(process.cwd(), "uploads");
  if (!fs7.existsSync(uploadsPath)) {
    fs7.mkdirSync(uploadsPath, { recursive: true });
  }
  app.use("/uploads", express2.static(uploadsPath, { maxAge: "30d", immutable: true }));
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.on("error", (err) => {
    console.error("Server listen error:", err?.code || err?.message || err);
    if (err?.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Set PORT to another value or stop the other process.`);
    }
    process.exit(1);
  });
  const host = process.env.RENDER ? "0.0.0.0" : void 0;
  server.listen(port, host, () => {
    log(`serving on port ${port}${host ? ` (host: ${host})` : ""}`);
  });
})();
