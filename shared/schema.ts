import { sql } from "drizzle-orm";
import { pgTable, text, integer, index, varchar, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const chapters = pgTable("chapters", {
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
  readingTime: integer("reading_time").notNull(), // in minutes
  publishedAt: text("published_at").notNull(),
  imageUrl: text("image_url"),
});

export const characters = pgTable("characters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameI18n: text("name_i18n"),
  title: text("title").notNull(),
  titleI18n: text("title_i18n"),
  description: text("description").notNull(),
  story: text("story"),
  slug: text("slug").notNull().unique(),
  imageUrl: text("image_url"),
  role: text("role").notNull(), // protagonist, antagonist, supporting
});

export const locations = pgTable("locations", {
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
  mapX: integer("map_x").notNull(), // x coordinate on map (percentage)
  mapY: integer("map_y").notNull(), // y coordinate on map (percentage)
  type: text("type").notNull(), // kingdom, forest, ruins, etc.
});

export const codexEntries = pgTable("codex_entries", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  titleI18n: text("title_i18n"),
  description: text("description").notNull(),
  descriptionI18n: text("description_i18n"),
  // Full rich HTML content (detailed story). New column added 2025-09 to separate
  // the brief card description from the detailed page content.
  content: text("content"),
  category: text("category").notNull(), // magic, creatures, items, other
  imageUrl: text("image_url"),
});

export const blogPosts = pgTable("blog_posts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  titleI18n: text("title_i18n"),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  contentI18n: text("content_i18n"),
  excerpt: text("excerpt").notNull(),
  excerptI18n: text("excerpt_i18n"),
  category: text("category").notNull(), // update, world-building, behind-scenes, research
  publishedAt: text("published_at").notNull(),
  imageUrl: text("image_url"),
});

export const readingProgress = pgTable("reading_progress", {
  id: text("id").primaryKey(),
  chapterId: text("chapter_id").notNull().references(() => chapters.id),
  sessionId: text("session_id").notNull(), // browser session
  progress: integer("progress").notNull().default(0), // percentage read
  lastReadAt: text("last_read_at").notNull(),
});

// Audio system tables (initial minimal design)
// Tracks are uploaded audio assets (music, ambient loops, etc.).
export const audioTracks = pgTable("audio_tracks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  // classification for UI filtering: music | ambient | sfx
  kind: text("kind").notNull(),
  fileUrl: text("file_url").notNull(),
  loop: integer("loop").notNull().default(1), // 1=true 0=false
  volumeDefault: integer("volume_default").notNull().default(70), // 0-100 suggested
  // Max volume the end user slider is allowed to reach for this track (0-100)
  volumeUserMax: integer("volume_user_max").notNull().default(70),
  fadeInMs: integer("fade_in_ms"),
  fadeOutMs: integer("fade_out_ms"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// Assignments map a track to an entity (chapter, character, codex entry, location) or a page/global.
// Resolution order will consider specificity & priority.
export const audioAssignments = pgTable("audio_assignments", {
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
  updatedAt: text("updated_at"),
});

// Insert schemas
export const insertChapterSchema = ((createInsertSchema(chapters) as any).omit({
  id: true,
}) as any);

export const insertCharacterSchema = ((createInsertSchema(characters) as any).omit({
  id: true,
}) as any);

export const insertLocationSchema = ((createInsertSchema(locations) as any).omit({
  id: true,
}) as any);

export const insertCodexEntrySchema = ((createInsertSchema(codexEntries) as any).omit({
  id: true,
}) as any);

export const insertBlogPostSchema = ((createInsertSchema(blogPosts) as any).omit({
  id: true,
}) as any);

export const insertReadingProgressSchema = ((createInsertSchema(readingProgress) as any).omit({
  id: true,
}) as any);

export const insertAudioTrackSchema = ((createInsertSchema(audioTracks) as any).omit({
  id: true,
}) as any);

export const insertAudioAssignmentSchema = ((createInsertSchema(audioAssignments) as any).omit({
  id: true,
}) as any);

// Types
export type Chapter = typeof chapters.$inferSelect;
export type InsertChapter = z.infer<typeof insertChapterSchema>;

export type Character = typeof characters.$inferSelect;
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;

export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;

export type CodexEntry = typeof codexEntries.$inferSelect;
export type InsertCodexEntry = z.infer<typeof insertCodexEntrySchema>;

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;

export type ReadingProgress = typeof readingProgress.$inferSelect;
export type InsertReadingProgress = z.infer<typeof insertReadingProgressSchema>;

export type AudioTrack = typeof audioTracks.$inferSelect;
export type InsertAudioTrack = z.infer<typeof insertAudioTrackSchema>;

export type AudioAssignment = typeof audioAssignments.$inferSelect;
export type InsertAudioAssignment = z.infer<typeof insertAudioAssignmentSchema>;

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid", { length: 255 }).primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  // Password hash for server-side authentication (bcrypt)
  passwordHash: text("password_hash"),
  isAdmin: integer("is_admin").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Simple key-value metadata table for feature flags and one-time markers
export const meta = pgTable("meta", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: text("updated_at"),
});

export type Meta = typeof meta.$inferSelect;


