var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import "dotenv/config";
import express2 from "express";
import cors from "cors";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  blogPosts: () => blogPosts,
  chapters: () => chapters,
  characters: () => characters,
  codexEntries: () => codexEntries,
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
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
var chapters = sqliteTable("chapters", {
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
var characters = sqliteTable("characters", {
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
var locations = sqliteTable("locations", {
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
var codexEntries = sqliteTable("codex_entries", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  titleI18n: text("title_i18n"),
  description: text("description").notNull(),
  descriptionI18n: text("description_i18n"),
  // Full rich HTML content (detailed story). New column added 2025-09 to separate
  // the brief card description from the detailed page content.
  content: text("content"),
  category: text("category").notNull(),
  // magic, creatures, locations
  imageUrl: text("image_url")
});
var blogPosts = sqliteTable("blog_posts", {
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
var readingProgress = sqliteTable("reading_progress", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  chapterId: text("chapter_id").notNull().references(() => chapters.id),
  sessionId: text("session_id").notNull(),
  // browser session
  progress: integer("progress").notNull().default(0),
  // percentage read
  lastReadAt: text("last_read_at").notNull()
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
var sessions = sqliteTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: text("sess").notNull(),
    expire: text("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
var users = sqliteTable("users", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  isAdmin: integer("is_admin").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at")
});
var meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: text("updated_at")
});

// server/db.ts
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
var dbUrl = process.env.DATABASE_URL || "file:./dev.sqlite";
console.log(`Using database at: ${dbUrl}`);
var sqliteDb = new Database(dbUrl.replace("file:", ""));
try {
  sqliteDb.function("gen_random_uuid", () => randomUUID());
} catch (e) {
  console.warn("Could not register gen_random_uuid function:", e);
}
var ensureSqliteSchema = (dbInst) => {
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
      title TEXT NOT NULL,
  description TEXT NOT NULL,
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
    `CREATE TABLE IF NOT EXISTS reading_progress (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      last_read_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expire TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
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
    );`
  ];
  dbInst.transaction((statements) => {
    for (const stmt of statements) {
      dbInst.prepare(stmt).run();
    }
  })(stmts);
  console.log("SQLite schema verified.");
};
try {
  ensureSqliteSchema(sqliteDb);
} catch (e) {
  console.error("Fatal: Failed to ensure SQLite schema:", e);
  process.exit(1);
}
try {
  const cols = sqliteDb.prepare("PRAGMA table_info('characters');").all();
  const hasStory = cols.some((c) => c.name === "story");
  if (!hasStory) {
    console.log("Adding missing 'story' column to characters table");
    try {
      sqliteDb.prepare("ALTER TABLE characters ADD COLUMN story TEXT;").run();
    } catch (e) {
      console.warn("Could not add 'story' column to characters table:", e);
    }
  }
  const hasSlug = cols.some((c) => c.name === "slug");
  if (!hasSlug) {
    console.log("Adding missing 'slug' column to characters table");
    try {
      sqliteDb.prepare("ALTER TABLE characters ADD COLUMN slug TEXT;").run();
      sqliteDb.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_slug ON characters(slug);").run();
    } catch (e) {
      console.warn("Could not add 'slug' column to characters table:", e);
    }
  }
  const chapterCols = sqliteDb.prepare("PRAGMA table_info('chapters');").all();
  const hasArcNumber = chapterCols.some((c) => c.name === "arc_number");
  if (!hasArcNumber) {
    try {
      console.log("Adding missing 'arc_number' column to chapters table");
      sqliteDb.prepare("ALTER TABLE chapters ADD COLUMN arc_number INTEGER;").run();
    } catch (e) {
      console.warn("Could not add 'arc_number' column to chapters table:", e);
    }
  }
  const hasArcTitle = chapterCols.some((c) => c.name === "arc_title");
  if (!hasArcTitle) {
    try {
      console.log("Adding missing 'arc_title' column to chapters table");
      sqliteDb.prepare("ALTER TABLE chapters ADD COLUMN arc_title TEXT;").run();
    } catch (e) {
      console.warn("Could not add 'arc_title' column to chapters table:", e);
    }
  }
  try {
    const locCols = sqliteDb.prepare("PRAGMA table_info('locations');").all();
    const hasImage = locCols.some((c) => c.name === "image_url");
    if (!hasImage) {
      console.log("Adding missing 'image_url' column to locations table");
      try {
        sqliteDb.prepare("ALTER TABLE locations ADD COLUMN image_url TEXT;").run();
      } catch (e) {
        console.warn("Could not add 'image_url' column to locations table:", e);
      }
    }
    const hasDetails = locCols.some((c) => c.name === "details");
    if (!hasDetails) {
      console.log("Adding missing 'details' column to locations table");
      try {
        sqliteDb.prepare("ALTER TABLE locations ADD COLUMN details TEXT;").run();
      } catch (e) {
        console.warn("Could not add 'details' column to locations table:", e);
      }
    }
    const hasSlug2 = locCols.some((c) => c.name === "slug");
    if (!hasSlug2) {
      console.log("Adding missing 'slug' column to locations table");
      try {
        sqliteDb.prepare("ALTER TABLE locations ADD COLUMN slug TEXT;").run();
      } catch (e) {
        console.warn("Could not add 'slug' column to locations table:", e);
      }
    }
    const hasTags = locCols.some((c) => c.name === "tags");
    if (!hasTags) {
      console.log("Adding missing 'tags' column to locations table");
      try {
        sqliteDb.prepare("ALTER TABLE locations ADD COLUMN tags TEXT;").run();
      } catch (e) {
        console.warn("Could not add 'tags' column to locations table:", e);
      }
    }
  } catch (e) {
    console.warn("Could not verify/alter locations table schema:", e);
  }
} catch (e) {
  console.warn("Could not verify/alter characters table schema:", e);
}
var db = drizzle(sqliteDb, { schema: schema_exports });
var pool = sqliteDb;

// server/storage.ts
import { eq, and } from "drizzle-orm";
import fs2 from "fs";
import path2 from "path";
import { randomUUID as randomUUID2 } from "crypto";

// server/importers/fullnovel.ts
import fs from "fs";
import path from "path";
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
    filePath ? path.resolve(filePath) : "",
    path.resolve(process.cwd(), "sorcerer", "attached_assets", "FullNOVEL.md"),
    path.resolve(process.cwd(), "attached_assets", "FullNOVEL.md")
  ].filter(Boolean);
  const fp = candidates.find((p) => fs.existsSync(p));
  if (!fp) return [];
  const raw = fs.readFileSync(fp, "utf8");
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
var DatabaseStorage = class {
  constructor() {
    try {
      const poolPath = global.__dirname || process.cwd();
      try {
        pool.prepare("ALTER TABLE codex_entries ADD COLUMN content TEXT;").run();
      } catch (e) {
      }
    } catch (e) {
    }
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
    if (!payload.id) payload.id = randomUUID2();
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
        const offlineFile = path2.resolve(process.cwd(), "data", "offline-characters.json");
        const data = await fs2.promises.readFile(offlineFile, "utf-8");
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
        const offlineFile = path2.resolve(process.cwd(), "data", "offline-characters.json");
        const data = await fs2.promises.readFile(offlineFile, "utf-8");
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
    if (!payload.id) payload.id = randomUUID2();
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
        const offlineFile = path2.resolve(process.cwd(), "data", "offline-locations.json");
        const data = await fs2.promises.readFile(offlineFile, "utf-8");
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
    if (!payload.id) payload.id = randomUUID2();
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
        const offlineFile = path2.resolve(process.cwd(), "data", "offline-codex.json");
        const data = await fs2.promises.readFile(offlineFile, "utf-8");
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
    if (!payload.id) payload.id = randomUUID2();
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
    if (!payload.id) payload.id = randomUUID2();
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
  async seedData() {
    try {
      const getMeta = (key) => {
        try {
          const row = pool.prepare("SELECT value FROM meta WHERE key = ? LIMIT 1").get(key);
          return row?.value;
        } catch {
          return void 0;
        }
      };
      const setMeta = (key, value) => {
        try {
          const iso = (/* @__PURE__ */ new Date()).toISOString();
          pool.prepare("INSERT INTO meta(key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").run(key, value, iso);
        } catch {
          try {
            const isoFallback = (/* @__PURE__ */ new Date()).toISOString();
            pool.prepare("INSERT OR REPLACE INTO meta(key, value, updated_at) VALUES (?, ?, ?)").run(key, value, isoFallback);
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
      const forceImport = process.env.IMPORT_FULLNOVEL_ON_STARTUP === "true";
      let alreadyImported = false;
      try {
        const stmt = pool.prepare("SELECT value FROM meta WHERE key = ? LIMIT 1");
        const row = stmt.get("fullnovel_imported");
        alreadyImported = !!(row && row.value === "true");
      } catch (e) {
        alreadyImported = false;
      }
      if (forceImport || !alreadyImported) {
        try {
          let uploadImages = [];
          try {
            const uploadsDir = path2.resolve(process.cwd(), "uploads");
            const entries = await fs2.promises.readdir(uploadsDir, { withFileTypes: true });
            const allowed = /* @__PURE__ */ new Set([".jpg", ".jpeg", ".png", ".webp"]);
            uploadImages = entries.filter((e) => e.isFile()).map((e) => e.name).filter((name) => allowed.has(path2.extname(name).toLowerCase())).map((name) => `/uploads/${name}`);
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
              const iso = (/* @__PURE__ */ new Date()).toISOString();
              pool.prepare("INSERT INTO meta(key, value, updated_at) VALUES ('fullnovel_imported', 'true', ?) ON CONFLICT(key) DO UPDATE SET value='true', updated_at=excluded.updated_at").run(iso);
            } catch (e) {
              try {
                const iso = (/* @__PURE__ */ new Date()).toISOString();
                pool.prepare("INSERT OR REPLACE INTO meta(key, value, updated_at) VALUES ('fullnovel_imported', 'true', ?)").run(iso);
              } catch {
              }
            }
          }
        } catch (e) {
          console.warn("Arc 1 chapters seed skipped due to error:", e);
        }
      }
      const forceSeedCharacters = process.env.FORCE_SEED_CHARACTERS === "true";
      const charactersSeeded = getMeta("seed_characters_done") === "true";
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
        if (!forceSeedCharacters) setMeta("seed_characters_done", "true");
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
        category: "constru\xE7\xE3o-de-mundo",
        publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1e3).toISOString(),
        imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300"
      };
      try {
        const existingBlog = await this.getBlogPostBySlug(blogPost1.slug);
        if (!existingBlog) {
          await this.createBlogPost(blogPost1);
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
  baseDir = path2.resolve(process.cwd(), "data");
  constructor() {
    fs2.mkdirSync(this.baseDir, { recursive: true });
  }
  // helper
  async readFile(name, defaultValue) {
    const fp = path2.join(this.baseDir, name);
    try {
      const txt = await fs2.promises.readFile(fp, "utf-8");
      return JSON.parse(txt || "null");
    } catch (e) {
      return defaultValue;
    }
  }
  async writeFile(name, data) {
    const fp = path2.join(this.baseDir, name);
    await fs2.promises.writeFile(fp, JSON.stringify(data, null, 2), "utf-8");
  }
  async getUser(id) {
    const users2 = await this.readFile("offline-users.json", []);
    return users2.find((u) => u.id === id);
  }
  async upsertUser(user) {
    const users2 = await this.readFile("offline-users.json", []);
    const idx = users2.findIndex((u) => u.id === user.id);
    if (idx >= 0) users2[idx] = { ...users2[idx], ...user };
    else users2.push(user);
    await this.writeFile("offline-users.json", users2);
    return users2.find((u) => u.id === user.id);
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
    chapter.id = chapter.id ?? randomUUID2();
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
    character.id = character.id ?? randomUUID2();
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
    location.id = location.id ?? randomUUID2();
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
    entry.id = entry.id ?? randomUUID2();
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
    post.id = post.id ?? randomUUID2();
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
      p = { id: randomUUID2(), sessionId, chapterId, progress, lastReadAt: (/* @__PURE__ */ new Date()).toISOString() };
      arr.push(p);
    }
    await this.writeFile("offline-progress.json", arr);
    return p;
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
import connectSqlite3 from "connect-sqlite3";
import path3 from "path";
var isDevAdmin = (req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    req.adminUser = { id: "dev-admin", isAdmin: true };
    return next();
  }
  return isAdmin(req, res, next);
};
function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1e3;
  if (process.env.NODE_ENV === "development") {
    const MemoryStore = session.MemoryStore;
    return session({
      store: new MemoryStore(),
      secret: process.env.SESSION_SECRET || "dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,
        // Secure must be false for localhost HTTP
        maxAge: sessionTtl
      }
    });
  }
  if (process.env.DATABASE_URL) {
    try {
      const pgStore = connectPg(session);
      const sessionStore = new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: false,
        ttl: sessionTtl,
        tableName: "sessions"
      });
      return session({
        secret: process.env.SESSION_SECRET,
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: true,
          maxAge: sessionTtl
        }
      });
    } catch (err) {
      console.warn("Postgres session store initialization failed, falling back to SQLite store:", err);
    }
  }
  const SQLiteStore = connectSqlite3(session);
  return session({
    store: new SQLiteStore({
      db: "dev.sqlite",
      dir: path3.resolve(process.cwd()),
      table: "sessions"
    }),
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      // Secure must be false for localhost HTTP
      maxAge: sessionTtl
    }
  });
}
async function setupAuth(app2) {
  app2.set("trust proxy", 1);
  app2.use(getSession());
}
var isAdmin = async (req, res, next) => {
  const sessionUser = req.session?.user;
  if (!sessionUser?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    if (sessionUser.isAdmin) {
      req.adminUser = sessionUser;
      return next();
    }
    const dbUser = await storage.getUser(sessionUser.id);
    if (dbUser?.isAdmin) {
      req.adminUser = dbUser;
      return next();
    }
    return res.status(403).json({ message: "Admin access required" });
  } catch (error) {
    console.error("Error checking admin status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// server/routes.ts
import fs3 from "fs";
import path4 from "path";
import { randomUUID as randomUUID3 } from "crypto";
import { ZodError } from "zod";
async function saveTranslations(_resource, _id, _translations) {
  return;
}
async function registerRoutes(app2) {
  await setupAuth(app2);
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
      const sessionUser = req.session?.user || null;
      return res.json(sessionUser);
    } catch (err) {
      console.error("Auth user error:", err);
      return res.status(500).json({ message: "Failed to get user info" });
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
          const uploadsFile = path4.resolve(process.cwd(), "uploads", "codex_return_of_the_first_sorcerer.json");
          if (fs3.existsSync(uploadsFile)) {
            const raw = await fs3.promises.readFile(uploadsFile, "utf-8");
            const parsed = JSON.parse(raw || "{}");
            if (Array.isArray(parsed.characters) && parsed.characters.length > 0) {
              const mapped = parsed.characters.map((c) => ({
                id: c.id || randomUUID3(),
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
  app2.post("/api/admin/chapters", isDevAdmin, async (req, res) => {
    try {
      const { data, translations } = req.body;
      if (!data) return res.status(400).json({ message: 'Request body must have "data" and "translations" properties' });
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
  app2.put("/api/admin/chapters/:id", isDevAdmin, async (req, res) => {
    try {
      const { data, translations } = req.body;
      if (!data) return res.status(400).json({ message: 'Request body must have "data" property' });
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
  app2.delete("/api/admin/chapters/:id", isDevAdmin, async (req, res) => {
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
  app2.post("/api/admin/characters", isDevAdmin, async (req, res) => {
    try {
      const { data, translations } = req.body;
      if (!data) return res.status(400).json({ message: 'Request body must have "data" property' });
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
  app2.put("/api/admin/characters/:id", isDevAdmin, async (req, res) => {
    try {
      const { data, translations } = req.body;
      if (!data) return res.status(400).json({ message: 'Request body must have "data" property' });
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
  app2.delete("/api/admin/characters/:id", isDevAdmin, async (req, res) => {
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
  app2.post("/api/admin/locations", isDevAdmin, async (req, res) => {
    try {
      const { data, translations } = req.body;
      if (!data) return res.status(400).json({ message: 'Request body must have "data" property' });
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
  app2.put("/api/admin/locations/:id", isDevAdmin, async (req, res) => {
    try {
      const { data, translations } = req.body;
      try {
        console.log("ADMIN UPDATE LOCATION called for id=", req.params.id, "sessionUser=", req.session?.user, "adminUser=", req.adminUser, "bodyKeys=", Object.keys(req.body || {}));
        if (process.env.NODE_ENV === "development") console.log("ADMIN UPDATE LOCATION body=", JSON.stringify(req.body));
      } catch (e) {
      }
      if (!data) return res.status(400).json({ message: 'Request body must have "data" property' });
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
  app2.delete("/api/admin/locations/:id", isDevAdmin, async (req, res) => {
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
  app2.post("/api/admin/codex", isDevAdmin, async (req, res) => {
    try {
      const { data, translations } = req.body;
      if (!data) return res.status(400).json({ message: 'Request body must have "data" property' });
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
  app2.put("/api/admin/codex/:id", isDevAdmin, async (req, res) => {
    try {
      const { data, translations } = req.body;
      if (!data) return res.status(400).json({ message: 'Request body must have "data" property' });
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
  app2.delete("/api/admin/codex/:id", isDevAdmin, async (req, res) => {
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
  app2.post("/api/admin/blog", isDevAdmin, async (req, res) => {
    try {
      const { data, translations } = req.body;
      if (!data) return res.status(400).json({ message: 'Request body must have "data" property' });
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
  app2.post("/api/admin/upload", isDevAdmin, async (req, res) => {
    try {
      const { filename, data } = req.body;
      if (!filename || !data) {
        res.status(400).json({ message: "filename and data (base64) are required" });
        return;
      }
      const base64 = data.includes("base64,") ? data.split("base64,")[1] : data;
      const ext = path4.extname(filename) || "";
      const name = `${randomUUID3()}${ext}`;
      const uploadsDir = path4.resolve(process.cwd(), "uploads");
      await fs3.promises.mkdir(uploadsDir, { recursive: true });
      const filePath = path4.join(uploadsDir, name);
      await fs3.promises.writeFile(filePath, Buffer.from(base64, "base64"));
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
      const id = randomUUID3();
      const uploadsDir = path4.resolve(process.cwd(), "uploads", "maps");
      await fs3.promises.mkdir(uploadsDir, { recursive: true });
      const out = {
        id,
        name: name || `map-${id}`,
        svg: svg || null,
        markers,
        masks: masks || [],
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const filePath = path4.join(uploadsDir, `${id}.json`);
      await fs3.promises.writeFile(filePath, JSON.stringify(out, null, 2), "utf8");
      return res.json({ id, url: `/uploads/maps/${id}.json` });
    } catch (err) {
      console.error("Save map error:", err);
      return res.status(500).json({ message: "Failed to save map" });
    }
  });
  app2.get("/api/maps/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const filePath = path4.resolve(process.cwd(), "uploads", "maps", `${id}.json`);
      if (!fs3.existsSync(filePath)) return res.status(404).json({ message: "Map not found" });
      const content = await fs3.promises.readFile(filePath, "utf8");
      return res.type("application/json").send(content);
    } catch (err) {
      console.error("Get map error:", err);
      return res.status(500).json({ message: "Failed to read map" });
    }
  });
  app2.get("/api/maps/latest", async (req, res) => {
    try {
      const uploadsDir = path4.resolve(process.cwd(), "uploads", "maps");
      if (!fs3.existsSync(uploadsDir)) return res.status(404).json({ message: "No maps found" });
      const files = await fs3.promises.readdir(uploadsDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      if (jsonFiles.length === 0) return res.status(404).json({ message: "No maps found" });
      let newest = null;
      for (const fname of jsonFiles) {
        const fp = path4.join(uploadsDir, fname);
        try {
          const txt = await fs3.promises.readFile(fp, "utf8");
          const parsed = JSON.parse(txt || "{}");
          const createdAt = parsed?.createdAt || null;
          if (!newest) newest = { path: fp, createdAt };
          else {
            if (createdAt && newest.createdAt) {
              if (new Date(createdAt) > new Date(newest.createdAt)) newest = { path: fp, createdAt };
            } else {
              const a = (await fs3.promises.stat(fp)).mtime;
              const b = newest.path ? (await fs3.promises.stat(newest.path)).mtime : /* @__PURE__ */ new Date(0);
              if (a > b) newest = { path: fp, createdAt };
            }
          }
        } catch (e) {
        }
      }
      if (!newest) return res.status(404).json({ message: "No maps found" });
      const content = await fs3.promises.readFile(newest.path, "utf8");
      return res.type("application/json").send(content);
    } catch (err) {
      console.error("Get latest map error:", err);
      return res.status(500).json({ message: "Failed to read maps" });
    }
  });
  app2.put("/api/admin/blog/:id", isDevAdmin, async (req, res) => {
    try {
      const { data, translations } = req.body;
      if (!data) return res.status(400).json({ message: 'Request body must have "data" property' });
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
  app2.delete("/api/admin/blog/:id", isDevAdmin, async (req, res) => {
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
        const uploadsFile = path4.resolve(process.cwd(), "uploads", "codex_return_of_the_first_sorcerer.json");
        if (!fs3.existsSync(uploadsFile)) return res.status(404).json({ message: "uploads file not found" });
        const raw = await fs3.promises.readFile(uploadsFile, "utf-8");
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
        const uploadsFile = path4.resolve(process.cwd(), "uploads", "codex_return_of_the_first_sorcerer.json");
        if (!fs3.existsSync(uploadsFile)) return res.status(404).json({ message: "uploads file not found" });
        const raw = await fs3.promises.readFile(uploadsFile, "utf-8");
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
        const { id, email, isAdmin: isAdmin3 = true } = req.body || {};
        if (!id) return res.status(400).json({ message: "id is required" });
        req.session.user = { id, email: email ?? `${id}@local.dev`, isAdmin: isAdmin3 };
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
        const { id = `dev-${randomUUID3()}`, email, displayName, isAdmin: isAdmin3 = true } = req.body || {};
        const userRecord = await storage.upsertUser({
          id,
          email: email ?? `${id}@local.dev`,
          firstName: displayName ?? "Dev",
          lastName: "",
          profileImageUrl: void 0,
          isAdmin: !!isAdmin3
        });
        return res.json({ ok: true, user: userRecord });
      } catch (error) {
        console.error("Dev create-admin error:", error);
        return res.status(500).json({ message: "Failed to create admin user" });
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
import fs4 from "fs";
import path6 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path5 from "path";
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path5.resolve(import.meta.dirname, "client", "src"),
      "@shared": path5.resolve(import.meta.dirname, "shared"),
      "@assets": path5.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path5.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path5.resolve(import.meta.dirname, "dist/public"),
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
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path6.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs4.promises.readFile(clientTemplate, "utf-8");
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
  const distPath = path6.resolve(import.meta.dirname, "public");
  if (!fs4.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path6.resolve(distPath, "index.html"));
  });
}

// server/index.ts
import fs5 from "fs";
import path7 from "path";
var app = express2();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    // Allow requests from the Vite dev server
    credentials: true
    // Allow cookies to be sent
  })
);
app.use(express2.json({ limit: process.env.BODY_LIMIT || "25mb" }));
app.use(express2.urlencoded({ extended: true, limit: process.env.BODY_LIMIT || "25mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  const path8 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path8.startsWith("/api")) {
      let logLine = `${req.method} ${path8} ${res.statusCode} in ${duration}ms`;
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
  const server = await registerRoutes(app);
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
  const uploadsPath = path7.resolve(process.cwd(), "uploads");
  if (!fs5.existsSync(uploadsPath)) {
    fs5.mkdirSync(uploadsPath, { recursive: true });
  }
  app.use("/uploads", express2.static(uploadsPath));
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, () => {
    log(`serving on port ${port}`);
  });
})();
