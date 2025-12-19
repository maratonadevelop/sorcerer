import { 
  type Chapter, type InsertChapter,
  type Character, type InsertCharacter,
  type Location, type InsertLocation,
  type CodexEntry, type InsertCodexEntry,
  type BlogPost, type InsertBlogPost,
  type ReadingProgress, type InsertReadingProgress,
  type AudioTrack, type InsertAudioTrack,
  type AudioAssignment, type InsertAudioAssignment,
  type User, type UpsertUser,
  chapters, characters, locations, codexEntries, blogPosts, readingProgress, users,
  audioTracks, audioAssignments
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, and } from "drizzle-orm";
import fs from 'fs';
import path from 'path';
import { randomUUID } from "crypto";
import { parseFullNovelMarkdown } from './importers/fullnovel';
import bcrypt from 'bcryptjs';

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Chapter operations
  getChapters(): Promise<Chapter[]>;
  getChapterBySlug(slug: string): Promise<Chapter | undefined>;
  getChapterById(id: string): Promise<Chapter | undefined>;
  createChapter(chapter: InsertChapter): Promise<Chapter>;
  updateChapter(id: string, chapter: Partial<InsertChapter>): Promise<Chapter | undefined>;
  deleteChapter(id: string): Promise<boolean>;

  // Character operations
  getCharacters(): Promise<Character[]>;
  getCharacterById(id: string): Promise<Character | undefined>;
  getCharacterBySlug(slug: string): Promise<Character | undefined>;
  createCharacter(character: InsertCharacter): Promise<Character>;
  updateCharacter(id: string, character: Partial<InsertCharacter>): Promise<Character | undefined>;
  deleteCharacter(id: string): Promise<boolean>;

  // Location operations
  getLocations(): Promise<Location[]>;
  getLocationById(id: string): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: string, location: Partial<InsertLocation>): Promise<Location | undefined>;
  deleteLocation(id: string): Promise<boolean>;

  // Codex operations
  getCodexEntries(): Promise<CodexEntry[]>;
  getCodexEntriesByCategory(category: string): Promise<CodexEntry[]>;
  getCodexEntryById(id: string): Promise<CodexEntry | undefined>;
  createCodexEntry(entry: InsertCodexEntry): Promise<CodexEntry>;
  updateCodexEntry(id: string, entry: Partial<InsertCodexEntry>): Promise<CodexEntry | undefined>;
  deleteCodexEntry(id: string): Promise<boolean>;

  // Blog operations
  getBlogPosts(): Promise<BlogPost[]>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  getBlogPostById(id: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: string, post: Partial<InsertBlogPost>): Promise<BlogPost | undefined>;
  deleteBlogPost(id: string): Promise<boolean>;

  // Reading progress operations
  getReadingProgress(sessionId: string, chapterId: string): Promise<ReadingProgress | undefined>;
  updateReadingProgress(sessionId: string, chapterId: string, progress: number): Promise<ReadingProgress>;

  // Audio system operations
  getAudioTracks(): Promise<AudioTrack[]>;
  getAudioTrack(id: string): Promise<AudioTrack | undefined>;
  createAudioTrack(track: InsertAudioTrack): Promise<AudioTrack>;
  updateAudioTrack(id: string, patch: Partial<InsertAudioTrack>): Promise<AudioTrack | undefined>;
  deleteAudioTrack(id: string): Promise<boolean>;

  getAudioAssignments(): Promise<AudioAssignment[]>;
  getAudioAssignment(id: string): Promise<AudioAssignment | undefined>;
  createAudioAssignment(assign: InsertAudioAssignment): Promise<AudioAssignment>;
  updateAudioAssignment(id: string, patch: Partial<InsertAudioAssignment>): Promise<AudioAssignment | undefined>;
  deleteAudioAssignment(id: string): Promise<boolean>;
  // Resolve best track for a given context
  resolveAudio(params: { page?: string; chapterId?: string; characterId?: string; codexId?: string; locationId?: string }): Promise<AudioTrack | undefined>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Run async seeding/migrations in background. seedData() is async and will
    // perform safe, idempotent actions for Postgres.
    // We intentionally don't await here to avoid blocking construction.
    this.seedData();
  }

  // Helper: create a filesystem-safe, url-friendly slug
  private slugify(input?: string) {
    const s = (input || "").toString().trim().toLowerCase();
    // remove diacritics
    const normalized = s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
    return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^[-]+|[-]+$/g, '');
  }

  // Ensure the slug is unique in `characters`. If `ignoreId` is provided, that row is excluded
  private async ensureUniqueCharacterSlug(desiredSlug: string, ignoreId?: string) {
    let base = this.slugify(desiredSlug) || this.slugify(desiredSlug) || 'char';
    let slug = base;
    let i = 0;
    // loop until we find a slug that isn't taken
    while (true) {
      const rows: any[] = await db.select().from(characters).where(eq(characters.slug, slug));
      const existing = rows.find((r) => (ignoreId ? r.id !== ignoreId : true));
      if (!existing) return slug;
      i += 1;
      slug = `${base}-${i}`;
      // safety: avoid infinite loops
      if (i > 50) return `${base}-${Date.now()}`;
    }
  }

  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();
    return user;
  }

  // Helper: create user by email (used for admin seed) if not present
  async createUserIfNotExists(id: string, email: string, passwordHash: string, isAdmin: boolean) {
    const existing = await this.getUser(id);
    if (existing) return existing;
    return this.upsertUser({ id, email, passwordHash, isAdmin: isAdmin ? 1 : 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any);
  }

  // Chapter methods
  async getChapters(): Promise<Chapter[]> {
    try {
      return await db.select().from(chapters).orderBy(chapters.chapterNumber);
    } catch (error) {
      console.error('DB error in getChapters:', error);
      return [];
    }
  }

  async getChapterBySlug(slug: string): Promise<Chapter | undefined> {
    try {
      const [chapter] = await db.select().from(chapters).where(eq(chapters.slug, slug));
      return chapter;
    } catch (error) {
      console.error('DB error in getChapterBySlug:', error);
      return undefined;
    }
  }

  async getChapterById(id: string): Promise<Chapter | undefined> {
    try {
      const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id));
      return chapter;
    } catch (error) {
      console.error('DB error in getChapterById:', error);
      return undefined;
    }
  }

  async createChapter(chapter: InsertChapter): Promise<Chapter> {
    // Ensure we have an id so we can reliably read back the inserted row
    const payload: any = { ...chapter };
    if (!payload.id) payload.id = randomUUID();

    try {
      const [newChapter] = await db.insert(chapters).values(payload).returning();
      if (newChapter) return newChapter;
    } catch (e) {
      // Some drivers/adapters (or SQLite builds) may not support returning();
      // fallthrough to SELECT-based fallback below.
      console.warn('Insert returning not supported or failed for chapters, falling back to SELECT:', e);
    }

    // Fallback: select by id
    const [f] = await db.select().from(chapters).where(eq(chapters.id, payload.id));
    if (f) return f;
    // As a last resort, return the payload (best-effort)
    return payload as Chapter;
  }

  async updateChapter(id: string, chapter: Partial<InsertChapter>): Promise<Chapter | undefined> {
    try {
      const [updatedChapter] = await db
        .update(chapters)
        .set(chapter)
        .where(eq(chapters.id, id))
        .returning();
      if (updatedChapter) return updatedChapter;
    } catch (e) {
      console.warn('Update returning not supported or failed for chapters, falling back to SELECT:', e);
    }

    const [f] = await db.select().from(chapters).where(eq(chapters.id, id));
    return f;
  }

  async deleteChapter(id: string): Promise<boolean> {
    // Pre-check existence to provide correct boolean on SQLite (rowCount unsupported)
    const [existing] = await db.select().from(chapters).where(eq(chapters.id, id));
    if (!existing) return false;
    await db.delete(chapters).where(eq(chapters.id, id));
    return true;
  }

  // Character methods
  async getCharacters(): Promise<Character[]> {
    try {
      return await db.select().from(characters);
    } catch (error) {
      console.error('DB error in getCharacters:', error);
      // Fallback: return any offline-cached characters saved while DB was down
      try {
        const offlineFile = path.resolve(process.cwd(), 'data', 'offline-characters.json');
        const data = await fs.promises.readFile(offlineFile, 'utf-8');
        const arr = JSON.parse(data || '[]');
        return arr as Character[];
      } catch (fileErr) {
        // no offline cache available
        return [];
      }
    }
  }

  async getCharacterById(id: string): Promise<Character | undefined> {
    try {
      const [character] = await db.select().from(characters).where(eq(characters.id, id));
      return character;
    } catch (error) {
      console.error('DB error in getCharacterById:', error);
      // Fallback to offline cache
      try {
        const offlineFile = path.resolve(process.cwd(), 'data', 'offline-characters.json');
        const data = await fs.promises.readFile(offlineFile, 'utf-8');
        const arr = JSON.parse(data || '[]');
        return arr.find((c: any) => c.id === id) as Character | undefined;
      } catch (fileErr) {
        return undefined;
      }
    }
  }

  async getCharacterBySlug(slug: string): Promise<Character | undefined> {
    const [character] = await db.select().from(characters).where(eq(characters.slug, slug));
    return character;
  }

  async createCharacter(character: InsertCharacter): Promise<Character> {
    const payload: any = { ...character };
    if (!payload.id) payload.id = randomUUID();
    // Ensure slug exists and is unique
    try {
      payload.slug = await this.ensureUniqueCharacterSlug(payload.slug || payload.name || payload.id);
    } catch (e) {
      // best-effort: fallback to slugify
      payload.slug = this.slugify(payload.slug || payload.name || payload.id);
    }
    try {
      const [newCharacter] = await db.insert(characters).values(payload).returning();
      if (newCharacter) return newCharacter;
    } catch (e) {
      console.warn('Insert returning not supported or failed for characters, falling back to SELECT:', e);
    }
    const [f] = await db.select().from(characters).where(eq(characters.id, payload.id));
    if (f) return f;
    return payload as Character;
  }

  async updateCharacter(id: string, character: Partial<InsertCharacter>): Promise<Character | undefined> {
    // If slug provided (or name changed), ensure uniqueness ignoring this id
    const toUpdate: any = { ...character };
    if (toUpdate.slug || toUpdate.name) {
      try {
        toUpdate.slug = await this.ensureUniqueCharacterSlug(toUpdate.slug || toUpdate.name || id, id);
      } catch (e) {
        toUpdate.slug = this.slugify(toUpdate.slug || toUpdate.name || id);
      }
    }

    try {
      const [updatedCharacter] = await db
        .update(characters)
        .set(toUpdate)
        .where(eq(characters.id, id))
        .returning();
      if (updatedCharacter) return updatedCharacter;
    } catch (e) {
      console.warn('Update returning not supported or failed for characters, falling back to SELECT:', e);
    }
    const [f] = await db.select().from(characters).where(eq(characters.id, id));
    return f;
  }

  async deleteCharacter(id: string): Promise<boolean> {
    const [existing] = await db.select().from(characters).where(eq(characters.id, id));
    if (!existing) return false;
    await db.delete(characters).where(eq(characters.id, id));
    return true;
  }

  // Location methods
  async getLocations(): Promise<Location[]> {
    try {
      return await db.select().from(locations);
    } catch (error) {
      console.error('DB error in getLocations:', error);
      // Fallback: read offline locations
      try {
        const offlineFile = path.resolve(process.cwd(), 'data', 'offline-locations.json');
        const data = await fs.promises.readFile(offlineFile, 'utf-8');
        const arr = JSON.parse(data || '[]');
        return arr as Location[];
      } catch (fileErr) {
        return [];
      }
    }
  }

  async getLocationById(id: string): Promise<Location | undefined> {
    try {
      const [location] = await db.select().from(locations).where(eq(locations.id, id));
      return location;
    } catch (error) {
      console.error('DB error in getLocationById:', error);
      return undefined;
    }
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const payload: any = { ...location };
    if (!payload.id) payload.id = randomUUID();
    try {
      const [newLocation] = await db.insert(locations).values(payload).returning();
      if (newLocation) return newLocation;
    } catch (e) {
      console.warn('Insert returning not supported or failed for locations, falling back to SELECT:', e);
    }
    const [f] = await db.select().from(locations).where(eq(locations.id, payload.id));
    if (f) return f;
    return payload as Location;
  }

  async updateLocation(id: string, location: Partial<InsertLocation>): Promise<Location | undefined> {
    try {
      console.log('storage.updateLocation id=', id, 'payload=', JSON.stringify(location));
      const [updatedLocation] = await db
        .update(locations)
        .set(location)
        .where(eq(locations.id, id))
        .returning();
      if (updatedLocation) {
        console.log('storage.updateLocation returning updated row for id=', id);
        return updatedLocation;
      }
    } catch (e) {
      console.warn('Update returning not supported or failed for locations, falling back to SELECT:', e);
    }
    // Fallback: select the row after attempted update so we can see persisted values
    try {
      const [f] = await db.select().from(locations).where(eq(locations.id, id));
      console.log('storage.updateLocation SELECT fallback result for id=', id, f ? JSON.stringify(f) : '(not found)');
      return f;
    } catch (e) {
      console.error('storage.updateLocation SELECT fallback failed for id=', id, e);
      return undefined;
    }
  }

  async deleteLocation(id: string): Promise<boolean> {
    const [existing] = await db.select().from(locations).where(eq(locations.id, id));
    if (!existing) return false;
    await db.delete(locations).where(eq(locations.id, id));
    return true;
  }

  // Codex methods
  async getCodexEntries(): Promise<CodexEntry[]> {
    try {
      return await db.select().from(codexEntries);
    } catch (error) {
      console.error('DB error in getCodexEntries:', error);
      // Fallback: read offline codex entries
      try {
        const offlineFile = path.resolve(process.cwd(), 'data', 'offline-codex.json');
        const data = await fs.promises.readFile(offlineFile, 'utf-8');
        const arr = JSON.parse(data || '[]');
        return arr as CodexEntry[];
      } catch (fileErr) {
        return [];
      }
    }
  }

  async getCodexEntriesByCategory(category: string): Promise<CodexEntry[]> {
    try {
      return await db.select().from(codexEntries).where(eq(codexEntries.category, category));
    } catch (error) {
      console.error('DB error in getCodexEntriesByCategory:', error);
      return [];
    }
  }

  async getCodexEntryById(id: string): Promise<CodexEntry | undefined> {
    try {
      const [entry] = await db.select().from(codexEntries).where(eq(codexEntries.id, id));
      return entry;
    } catch (error) {
      console.error('DB error in getCodexEntryById:', error);
      return undefined;
    }
  }

  async createCodexEntry(entry: InsertCodexEntry): Promise<CodexEntry> {
    const payload: any = { ...entry };
    if (!payload.id) payload.id = randomUUID();
    try {
      const [newEntry] = await db.insert(codexEntries).values(payload).returning();
      if (newEntry) return newEntry;
    } catch (e) {
      console.warn('Insert returning not supported or failed for codex entries, falling back to SELECT:', e);
    }
    const [f] = await db.select().from(codexEntries).where(eq(codexEntries.id, payload.id));
    if (f) return f;
    return payload as CodexEntry;
  }

  async updateCodexEntry(id: string, entry: Partial<InsertCodexEntry>): Promise<CodexEntry | undefined> {
    try {
      const [updatedEntry] = await db
        .update(codexEntries)
        .set(entry)
        .where(eq(codexEntries.id, id))
        .returning();
      if (updatedEntry) return updatedEntry;
    } catch (e) {
      console.warn('Update returning not supported or failed for codex entries, falling back to SELECT:', e);
    }
    const [f] = await db.select().from(codexEntries).where(eq(codexEntries.id, id));
    return f;
  }

  async deleteCodexEntry(id: string): Promise<boolean> {
    const [existing] = await db.select().from(codexEntries).where(eq(codexEntries.id, id));
    if (!existing) return false;
    await db.delete(codexEntries).where(eq(codexEntries.id, id));
    return true;
  }

  // Blog methods
  async getBlogPosts(): Promise<BlogPost[]> {
    try {
      return await db.select().from(blogPosts).orderBy(blogPosts.publishedAt);
    } catch (error) {
      console.error('DB error in getBlogPosts:', error);
      return [];
    }
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    try {
      const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
      return post;
    } catch (error) {
      console.error('DB error in getBlogPostBySlug:', error);
      return undefined;
    }
  }

  async getBlogPostById(id: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }

  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const payload: any = { ...post };
    if (!payload.id) payload.id = randomUUID();
    // Ensure slug exists and is unique for blog posts
    try {
      payload.slug = await this.ensureUniqueCharacterSlug(payload.slug || payload.title || payload.id);
    } catch (e) {
      payload.slug = this.slugify(payload.slug || payload.title || payload.id);
    }
    try {
      const [newPost] = await db.insert(blogPosts).values(payload).returning();
      if (newPost) return newPost;
    } catch (e) {
      console.warn('Insert returning not supported or failed for blog posts, falling back to SELECT:', e);
    }
    const [f] = await db.select().from(blogPosts).where(eq(blogPosts.id, payload.id));
    if (f) return f;
    return payload as BlogPost;
  }

  async updateBlogPost(id: string, post: Partial<InsertBlogPost>): Promise<BlogPost | undefined> {
    const toUpdate: any = { ...post };
    if (toUpdate.slug || toUpdate.title) {
      try {
        toUpdate.slug = await this.ensureUniqueCharacterSlug(toUpdate.slug || toUpdate.title || id, id);
      } catch (e) {
        toUpdate.slug = this.slugify(toUpdate.slug || toUpdate.title || id);
      }
    }

    try {
      const [updatedPost] = await db
        .update(blogPosts)
        .set(toUpdate)
        .where(eq(blogPosts.id, id))
        .returning();
      if (updatedPost) return updatedPost;
    } catch (e) {
      console.warn('Update returning not supported or failed for blog posts, falling back to SELECT:', e);
    }
    const [f] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return f;
  }

  async deleteBlogPost(id: string): Promise<boolean> {
    const [existing] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    if (!existing) return false;
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
    return true;
  }

  // Reading progress methods
  async getReadingProgress(sessionId: string, chapterId: string): Promise<ReadingProgress | undefined> {
    const [progress] = await db
      .select()
      .from(readingProgress)
      .where(and(eq(readingProgress.sessionId, sessionId), eq(readingProgress.chapterId, chapterId)));
    return progress;
  }

  async updateReadingProgress(sessionId: string, chapterId: string, progress: number): Promise<ReadingProgress> {
    try {
      // Try to update existing record first
      const [existingProgress] = await db
        .update(readingProgress)
        .set({
          progress,
          lastReadAt: new Date().toISOString(),
        } as any)
        .where(and(eq(readingProgress.sessionId, sessionId), eq(readingProgress.chapterId, chapterId)))
        .returning();

      if (existingProgress) {
        return existingProgress;
      }

      // Create new record if it doesn't exist
      const [newProgress] = await db
        .insert(readingProgress)
        .values({
          sessionId,
          chapterId,
          progress,
          lastReadAt: new Date().toISOString(),
        } as any)
        .returning();

      return newProgress;
    } catch (error) {
      console.error('DB error in updateReadingProgress:', error);
      throw error;
    }
  }

  // Audio system methods
  async getAudioTracks(): Promise<AudioTrack[]> {
    try { return await db.select().from(audioTracks); } catch (e) { console.error('DB error getAudioTracks:', e); return []; }
  }
  async getAudioTrack(id: string): Promise<AudioTrack | undefined> {
    try { const [row] = await db.select().from(audioTracks).where(eq(audioTracks.id, id)); return row; } catch (e) { return undefined; }
  }
  async createAudioTrack(track: InsertAudioTrack): Promise<AudioTrack> {
    const payload: any = { ...track };
    if (!payload.id) payload.id = randomUUID();
    const now = new Date().toISOString();
    payload.createdAt = payload.createdAt || now;
    payload.updatedAt = now;
    try { const [row] = await db.insert(audioTracks).values(payload).returning(); if (row) return row; } catch (e) { console.warn('Insert audioTracks returning failed, fallback SELECT:', e); }
    const [f] = await db.select().from(audioTracks).where(eq(audioTracks.id, payload.id));
    return (f || payload) as AudioTrack;
  }
  async updateAudioTrack(id: string, patch: Partial<InsertAudioTrack>): Promise<AudioTrack | undefined> {
    const toUpdate: any = { ...patch, updatedAt: new Date().toISOString() };
    try { const [row] = await db.update(audioTracks).set(toUpdate).where(eq(audioTracks.id, id)).returning(); if (row) return row; } catch (e) { console.warn('Update audioTracks returning failed, fallback SELECT:', e); }
    const [f] = await db.select().from(audioTracks).where(eq(audioTracks.id, id)); return f;
  }
  async deleteAudioTrack(id: string): Promise<boolean> {
    const [existing] = await db.select().from(audioTracks).where(eq(audioTracks.id, id)); if (!existing) return false;
    await db.delete(audioTracks).where(eq(audioTracks.id, id));
    // Also delete assignments referencing this track
    try { await db.delete(audioAssignments).where(eq(audioAssignments.trackId, id)); } catch {}
    return true;
  }

  async getAudioAssignments(): Promise<AudioAssignment[]> {
    try { return await db.select().from(audioAssignments); } catch (e) { console.error('DB error getAudioAssignments:', e); return []; }
  }
  async getAudioAssignment(id: string): Promise<AudioAssignment | undefined> {
    try { const [row] = await db.select().from(audioAssignments).where(eq(audioAssignments.id, id)); return row; } catch { return undefined; }
  }
  async createAudioAssignment(assign: InsertAudioAssignment): Promise<AudioAssignment> {
    const payload: any = { ...assign };
    if (!payload.id) payload.id = randomUUID();
    const now = new Date().toISOString();
    payload.createdAt = payload.createdAt || now;
    payload.updatedAt = now;
    try { const [row] = await db.insert(audioAssignments).values(payload).returning(); if (row) return row; } catch (e) { console.warn('Insert audioAssignments returning failed, fallback SELECT:', e); }
    const [f] = await db.select().from(audioAssignments).where(eq(audioAssignments.id, payload.id));
    return (f || payload) as AudioAssignment;
  }
  async updateAudioAssignment(id: string, patch: Partial<InsertAudioAssignment>): Promise<AudioAssignment | undefined> {
    const toUpdate: any = { ...patch, updatedAt: new Date().toISOString() };
    try { const [row] = await db.update(audioAssignments).set(toUpdate).where(eq(audioAssignments.id, id)).returning(); if (row) return row; } catch (e) { console.warn('Update audioAssignments returning failed, fallback SELECT:', e); }
    const [f] = await db.select().from(audioAssignments).where(eq(audioAssignments.id, id)); return f;
  }
  async deleteAudioAssignment(id: string): Promise<boolean> {
    const [existing] = await db.select().from(audioAssignments).where(eq(audioAssignments.id, id)); if (!existing) return false;
    await db.delete(audioAssignments).where(eq(audioAssignments.id, id));
    return true;
  }

  async resolveAudio(params: { page?: string; chapterId?: string; characterId?: string; codexId?: string; locationId?: string }): Promise<AudioTrack | undefined> {
    try {
      const wants: Array<{ type: string; id?: string }> = [];
      if (params.chapterId) wants.push({ type: 'chapter', id: params.chapterId });
      if (params.characterId) wants.push({ type: 'character', id: params.characterId });
      if (params.codexId) wants.push({ type: 'codex', id: params.codexId });
      if (params.locationId) wants.push({ type: 'location', id: params.locationId });
      if (params.page) wants.push({ type: 'page', id: params.page });
      // Always consider global
      wants.push({ type: 'global' });

      const list = await this.getAudioAssignments();
      const filtered = (list || []).filter((a) => {
        if (!a.active) return false;
        if (a.entityType === 'chapter' && params.chapterId) return a.entityId === params.chapterId;
        if (a.entityType === 'character' && params.characterId) return a.entityId === params.characterId;
        if (a.entityType === 'codex' && params.codexId) return a.entityId === params.codexId;
        if (a.entityType === 'location' && params.locationId) return a.entityId === params.locationId;
        if (a.entityType === 'page' && params.page) return a.entityId === params.page;
        if (a.entityType === 'global') return true;
        return false;
      });
      if (filtered.length === 0) return undefined;
      const specRank = (t: string) => ['chapter','character','codex','location'].includes(t) ? 3 : (t === 'global' ? 2 : 1);
      filtered.sort((a,b) => {
        const s = specRank(b.entityType) - specRank(a.entityType);
        if (s !== 0) return s;
        return (b.priority || 0) - (a.priority || 0);
      });
      return await this.getAudioTrack(filtered[0].trackId);
    } catch (e) {
      console.warn('resolveAudio failed:', e);
      return undefined;
    }
  }

  private async seedData() {
    try {
      const getMeta = async (key: string): Promise<string | undefined> => {
        try {
          const rows = await (pool as any)`SELECT value FROM meta WHERE key=${key} LIMIT 1`;
          return rows && rows[0] ? rows[0].value : undefined;
        } catch {
          return undefined;
        }
      };

      const setMeta = async (key: string, value: string) => {
        const iso = new Date().toISOString();
        try {
          await (pool as any)`INSERT INTO meta(key, value, updated_at) VALUES(${key}, ${value}, ${iso}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at`;
          return;
        } catch (e) {
          try {
            await (pool as any)`DELETE FROM meta WHERE key=${key}`;
            await (pool as any)`INSERT INTO meta(key, value, updated_at) VALUES(${key}, ${value}, ${iso})`;
            return;
          } catch {}
        }
      };
      // Always ensure Codex has at least one entry (independent of chapters)
      try {
        const existingCodex = await this.getCodexEntries();
        if (!existingCodex || existingCodex.length === 0) {
          const manaHtml = `<h2>Sistema de Anéis de Mana</h2><h3>Sistema de Conexão de Anéis de Mana</h3><p>O Sistema de Conexão de Anéis de Mana é uma estrutura de desenvolvimento arcano que organiza o domínio de mana em sete níveis ascendentes. Cada \"anel\" representa um estágio de habilidade e controle, do contato inicial com mana à transcendência cósmica. Este sistema guia praticantes em uma jornada de evolução mágica, de manipulações básicas à criação de novas realidades.</p><p><strong>Para Cada Subnível</strong>: Código de Identificação: [X.Y] (X = Anel, Y = Subnível)</p><p><strong>Indicadores de Domínio</strong>: [Sinais de Progresso]</p><p><strong>Falhas Comuns</strong>: [Indicadores de problemas no uso e magia daquele anel]</p><hr/><h3>Conexão de Anel de Mana 1: Anel do Despertar</h3><p><em>Descrição</em>: Primeiro contato e manipulação inicial de mana.</p><p><em>Riscos</em>: Exaustão mental, confusão sensorial.</p><p><em>Marca</em>: Aura visível fraca.</p><h4>[1.1] Percepção de Mana</h4><ul><li><strong>Habilidade</strong>: Sentir a presença de mana.</li><li><strong>Desafios</strong>: Ajustar-se a uma nova sensação, Mana.</li><li><strong>Indicadores de Domínio</strong>: Identificação consistente de fontes de mana.</li><li><strong>Falhas Comuns</strong>: Sobrecarga sensorial, dormência.</li></ul><h4>[1.2] Controle Inicial</h4><ul><li><strong>Habilidade</strong>: Manipulação básica de mana interna.</li><li><strong>Desafios</strong>: Resiliência mental e física.</li><li><strong>Indicadores de Domínio</strong>: Canalizar mana sem desgaste excessivo.</li><li><strong>Falhas Comuns</strong>: Fluxo de energia ineficiente, fadiga excessiva.</li></ul><h4>[1.3] Primeiras Manipulações</h4><ul><li><strong>Habilidade</strong>: Gerar manifestações simples.</li><li><strong>Desafios</strong>: Manter controle constante.</li><li><strong>Indicadores de Domínio</strong>: Criar pulsos de aura estáveis.</li><li><strong>Falhas Comuns</strong>: Desconexão súbita, dissipação rápida.</li></ul><hr/><h3>Conexão de Anel de Mana 2: Anel da Forja Interna</h3><p><em>Descrição</em>: Domínio corporal e infusão de mana em objetos.</p><p><em>Riscos</em>: Desequilíbrio físico, sobrecarga de objetos.</p><p><em>Marca</em>: Fortalecimento físico visível.</p><h4>[2.1] Fortificação Física</h4><ul><li><strong>Habilidade</strong>: Aprimoramento físico com mana.</li><li><strong>Desafios</strong>: Equilibrar aprimoramento pelo corpo.</li><li><strong>Indicadores de Domínio</strong>: Fortificação corporal uniforme.</li><li><strong>Falhas Comuns</strong>: Desequilíbrio entre membros.</li></ul><h4>[2.2] Infusão Básica</h4><ul><li><strong>Habilidade</strong>: Carregar objetos com mana.</li><li><strong>Desafios</strong>: Manter infusão estável.</li><li><strong>Indicadores de Domínio</strong>: Infusão de longa duração.</li><li><strong>Falhas Comuns</strong>: Deterioração de objetos, radiação mágica.</li></ul><h4>[2.3] Domínio Interno de Mana</h4><ul><li><strong>Habilidade</strong>: Controle completo de mana interna pessoal.</li><li><strong>Desafios</strong>: Manter amplificações estáveis.</li><li><strong>Indicadores de Domínio</strong>: Encantamentos contínuos.</li><li><strong>Falhas Comuns</strong>: Instabilidade sob estresse.</li></ul><hr/><h3>Conexão de Anel de Mana 3: Anel da Expansão</h3><p><em>Descrição</em>: Manipulação de mana além do corpo.</p><p><em>Riscos</em>: Desequilíbrio ambiental, esgotamento de mana.</p><p><em>Marca</em>: Aura mais densa.</p><h4>[3.1] Manipulação Externa</h4><ul><li><strong>Habilidade</strong>: Afetar o ambiente com mana; concentrar quantidade significativa de energia fora do corpo.</li><li><strong>Desafios</strong>: Controle sobre grandes quantidades de energia.</li><li><strong>Indicadores de Domínio</strong>: Manipulação precisa de mana.</li><li><strong>Falhas Comuns</strong>: Perda de controle, resistência mental.</li></ul><h4>[3.2] Sentinela Elemental</h4><ul><li><strong>Habilidade</strong>: Controle básico de elementos externos e internos.</li><li><strong>Desafios</strong>: Efeitos colaterais de elementos, como superaquecimento com fogo.</li><li><strong>Indicadores de Domínio</strong>: Harmonia entre mana interna e externa.</li><li><strong>Falhas Comuns</strong>: Esgotamento excessivo de mana.</li></ul><h4>[3.3] Consolidação Elemental</h4><ul><li><strong>Habilidade</strong>: Controle efetivo de elementos.</li><li><strong>Desafios</strong>: Equilíbrio ambiental.</li><li><strong>Indicadores de Domínio</strong>: Interação harmoniosa com elementos.</li><li><strong>Falhas Comuns</strong>: Drenagem ambiental excessiva.</li></ul><hr/><h3>Conexão de Anel de Mana 4: Anel da Harmonia</h3><p><em>Descrição</em>: Domínio elemental avançado e harmonia suprema com mana interna e externa.</p><p><em>Riscos</em>: Instabilidade ambiental, alterações climáticas.</p><p><em>Marca</em>: Manifestações elementais poderosas.</p><h4>[4.1] Coordenação Elemental</h4><ul><li><strong>Habilidade</strong>: Manipular múltiplos elementos simultaneamente.</li><li><strong>Desafios</strong>: Manter equilíbrio natural.</li><li><strong>Indicadores de Domínio</strong>: Controle multi-elemental.</li><li><strong>Falhas Comuns</strong>: Mudanças climáticas não intencionais.</li></ul><h4>[4.2] Controle Destrutivo</h4><ul><li><strong>Habilidade</strong>: Magia em larga escala.</li><li><strong>Desafios</strong>: Estabilidade do ecossistema.</li><li><strong>Indicadores de Domínio</strong>: Destruição controlada.</li><li><strong>Falhas Comuns</strong>: Desequilíbrio regional de mana.</li></ul><h4>[4.3] Manipulação Avançada</h4><ul><li><strong>Habilidade</strong>: Transformação ambiental.</li><li><strong>Desafios</strong>: Controle absoluto.</li><li><strong>Indicadores de Domínio</strong>: Criação de ecossistemas.</li><li><strong>Falhas Comuns</strong>: Alterações climáticas permanentes.</li></ul><hr/><h3>Conexão de Anel de Mana 5: Anel do Domínio</h3><p><em>Descrição</em>: Domínio absoluto de mana.</p><p><em>Riscos</em>: Desconexão da realidade, paradoxos.</p><p><em>Marca</em>: Alteração da realidade.</p><h4>[5.1] Criação de Realidade</h4><ul><li><strong>Habilidade</strong>: Gerar realidades alternativas.</li><li><strong>Desafios</strong>: Manter conexão com a realidade.</li><li><strong>Indicadores de Domínio</strong>: Criações estáveis.</li><li><strong>Falhas Comuns</strong>: Distorção temporal-espacial.</li></ul><h4>[5.2] Manipulação da Essência</h4><ul><li><strong>Habilidade</strong>: Alterar os próprios conceitos de mana.</li><li><strong>Desafios</strong>: Estabilidade universal.</li><li><strong>Indicadores de Domínio</strong>: Transformação controlada.</li><li><strong>Falhas Comuns</strong>: Ruptura do anel.</li></ul><h4>[5.3] Domínio Completo</h4><ul><li><strong>Habilidade</strong>: Controle universal.</li><li><strong>Desafios</strong>: Reter humanidade.</li><li><strong>Indicadores de Domínio</strong>: Harmonia com o universo.</li><li><strong>Falhas Comuns</strong>: Tirania mágica, isolamento.</li></ul><hr/><h3>Conexão de Anel de Mana 6: Anel da Criação</h3><p><em>\"Os Criadores de Mana, Forjadores de Novas Realidades\"</em> — Neste nível, o praticante não apenas manipula mana, mas a cria com suas próprias regras e conceitos. Podem gerar feitiços e encantamentos nunca vistos antes, moldando o mundo com imenso poder criativo. Deuses antigos e seres primordiais residem aqui.</p><hr/><h3>Conexão de Anel de Mana 7: Anel da Transcendência</h3><p><em>\"Os Guardiões da Essência\"</em> — Este anel é o ápice da jornada na conexão com mana, um estado de absoluta transcendência que nenhum mortal jamais alcançou. Aqui, o praticante torna-se uma entidade de mana pura, capaz de moldar o universo e a própria realidade em escala cósmica.</p>`;
          await this.createCodexEntry({
            title: 'Sistema de Conexão de Anéis de Mana',
            description: manaHtml,
            category: 'magic',
            imageUrl: null as any,
          });
          console.log('Seeded Codex: Sistema de Conexão de Anéis de Mana');
        }
      } catch (e) {
        console.warn('Codex seed skipped due to error:', e);
      }

      // Check if data already exists for initial demo set
      const existingChapters = await this.getChapters();
      if (existingChapters.length === 0) {
        // Seed initial demo chapters (only when DB is empty)
        const chapter1: InsertChapter = {
          title: "O Despertar dos Poderes Antigos",
          slug: "despertar-poderes-antigos",
          content: `As brumas do tempo se separaram como cortinas antigas, revelando um mundo que Eldric mal reconhecia. Onde antes a Grande Espiral de Luminar perfurava os céus, agora apenas ruínas permaneciam, tomadas por vinhas espinhosas que pulsavam com escuridão antinatural.

Ele deu um passo à frente, suas botas desgastadas esmagando fragmentos cristalinos que antes eram janelas para outros reinos. Três séculos. Era esse o tempo que ele havia ficado selado no Vazio Entre Mundos, e em sua ausência, tudo o que ele havia lutado para proteger havia desmoronado.

"Os selos estão quebrados", ele sussurrou, sua voz carregando poder que fez o próprio ar tremer. Atrás dele, a realidade se curvou e torceu conforme sua aura mágica despertava após seu longo sono. "E a escuridão criou raízes onde a luz antes floresceu."

O Primeiro Feiticeiro havia retornado, mas o mundo que ele conhecia se foi para sempre. Em seu lugar estava um reino consumido pelas sombras, onde o próprio tecido da magia havia sido corrompido. Ainda assim, dentro dessa corrupção, Eldric sentiu algo mais - uma presença familiar, antiga e malévola.

"Malachar", ele suspirou, o nome tendo gosto de cinzas em sua língua. Seu antigo aprendiz, aquele em quem havia confiado acima de todos os outros, aquele cuja traição havia levado ao seu aprisionamento. O Rei das Sombras não apenas havia sobrevivido aos séculos; ele havia prosperado.`,
          excerpt: "Eldric desperta em um mundo arruinado pela escuridão e sente o rastro de um inimigo antigo...",
          chapterNumber: 15,
          arcNumber: 2,
          arcTitle: "Ascensão das Sombras",
          readingTime: 12,
          publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250",
        };

        const chapter2: InsertChapter = {
          title: "Sombras no Horizonte",
          slug: "sombras-no-horizonte",
          content: "Os exércitos dos Reinos do Norte se reúnem enquanto presságios sombrios aparecem pelo céu. A guerra parece inevitável...",
          excerpt: "Os exércitos se movem enquanto presságios no céu anunciam um conflito inevitável...",
          chapterNumber: 14,
          arcNumber: 2,
          arcTitle: "Ascensão das Sombras",
          readingTime: 15,
          publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250",
        };

        const chapter3: InsertChapter = {
          title: "Os Bosques Sussurrantes",
          slug: "bosques-sussurrantes",
          content: "Lyanna se aventura na floresta proibida, guiada apenas por profecias antigas e suas crescentes habilidades mágicas...",
          excerpt: "Lyanna entra na floresta proibida guiada por profecias e novos poderes...",
          chapterNumber: 13,
          arcNumber: 1,
          arcTitle: "O Despertar",
          readingTime: 18,
          publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250",
        };

        await this.createChapter(chapter1);
        await this.createChapter(chapter2);
        await this.createChapter(chapter3);
      }

      // Ensure DB schema contains the `content` column for codex entries.
      // Perform a safe ALTER TABLE depending on DB type. Errors are ignored
      // (idempotent behavior).
      try {
        try { await (pool as any)`ALTER TABLE codex_entries ADD COLUMN content TEXT`; } catch {}
      } catch {}

      // Ensure audio_tracks has volume_user_max column (per-track user volume ceiling)
      try {
        try { await (pool as any)`ALTER TABLE audio_tracks ADD COLUMN volume_user_max INTEGER DEFAULT 70 NOT NULL`; } catch {}
        try { await (pool as any)`CREATE INDEX IF NOT EXISTS idx_audio_assignments_entity ON audio_assignments(entity_type, entity_id, active, priority)`; } catch {}
      } catch {}

      // FullNOVEL.md import on startup
      // Behavior:
      // - Default: run only once (records a marker in meta table)
      // - Force on every startup: set IMPORT_FULLNOVEL_ON_STARTUP=true
      const forceImport = process.env.IMPORT_FULLNOVEL_ON_STARTUP === 'true';
      let alreadyImported = false;
      try {
        const rowVal = await getMeta('fullnovel_imported');
        alreadyImported = rowVal === 'true';
      } catch (e) {
        alreadyImported = false;
      }
      if (forceImport || !alreadyImported) {
        try {
          // Collect available images from /uploads to avoid repeated map image across cards
          let uploadImages: string[] = [];
          try {
            const uploadsDir = path.resolve(process.cwd(), 'uploads');
            const entries = await fs.promises.readdir(uploadsDir, { withFileTypes: true });
            const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp']);
            uploadImages = entries
              .filter((e) => e.isFile())
              .map((e) => e.name)
              .filter((name) => allowed.has(path.extname(name).toLowerCase()))
              .map((name) => `/uploads/${name}`);
          } catch {}

          const parsed = parseFullNovelMarkdown();
          if (parsed.length > 0) {
            // If all parsed slugs already exist, skip import to avoid noise
            const existence = await Promise.all(parsed.map(async (ch) => !!(await this.getChapterBySlug(ch.slug))));
            const allExist = existence.every(Boolean);
            if (allExist && !forceImport) {
              console.log('Arc 1 chapters already present; skipping FullNOVEL import');
            } else {
              let imgIndex = 0;
              for (const ch of parsed) {
                const exists = await this.getChapterBySlug(ch.slug);
                const readingTime = Math.max(1, Math.ceil(ch.contentHtml.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length / 250));
                const chosenImage = uploadImages.length > 0
                  ? uploadImages[imgIndex++ % uploadImages.length]
                  : '/FinalMap.png';
                const payload: InsertChapter = {
                  title: ch.title,
                  slug: ch.slug,
                  excerpt: ch.excerpt,
                  content: ch.contentHtml,
                  chapterNumber: ch.chapterNumber,
                  arcNumber: ch.arcNumber,
                  arcTitle: ch.arcTitle,
                  readingTime,
                  publishedAt: new Date().toISOString(),
                  imageUrl: chosenImage,
                } as any;
                if (!exists) {
                  const created = await this.createChapter(payload);
                  console.log('Imported Arc1 chapter from FullNOVEL.md:', created.slug);
                } else if (forceImport) {
                  await this.updateChapter(exists.id, {
                    title: payload.title,
                    excerpt: payload.excerpt,
                    content: payload.content,
                    readingTime: payload.readingTime,
                    // Update image during force import to spread unique images too
                    imageUrl: payload.imageUrl,
                  });
                  console.log('Arc 1 chapter exists, updated from FullNOVEL.md:', ch.slug);
                }
              }
            }
          } else {
            console.log('FullNOVEL.md not found or empty, skipping import');
          }
          // Save marker if successful (or even if empty to avoid noise) unless forced mode
          if (!forceImport) {
            try { await setMeta('fullnovel_imported', 'true'); } catch {}
          }
        } catch (e) {
          console.warn('Arc 1 chapters seed skipped due to error:', e);
        }
      }

      // (end Arc 1 ensure)

      // Ensure users table has password_hash column (idempotent runtime migration)
      try {
        try { await (pool as any)`ALTER TABLE users ADD COLUMN password_hash TEXT`; } catch {}
      } catch (e) {}

      // Seed characters (idempotent by slug) — run only once unless FORCE_SEED_CHARACTERS=true
  const forceSeedCharacters = process.env.FORCE_SEED_CHARACTERS === 'true';
  const charactersSeeded = (await getMeta('seed_characters_done')) === 'true';
      const seeds: Array<{ baseSlug: string; data: InsertCharacter }> = [
        {
          baseSlug: this.slugify("Aslam Arianthe"),
          data: {
            name: "Aslam Arianthe",
            title: "O Primeiro Feiticeiro",
            description: "Antigo e poderoso, Aslam retorna após séculos para encontrar seu mundo transformado pela guerra e escuridão. Gentil e compassivo, apesar de seu poder imenso, carrega uma solidão por ser 'diferente'.",
            imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=400",
            role: "protagonist",
            slug: this.slugify("Aslam Arianthe"),
          },
        },
        // Also seed Aslam Radianthe (alternate canonical name requested)
        {
          baseSlug: this.slugify("Aslam Radianthe"),
          data: {
            name: "Aslam Radianthe",
            title: "O Primeiro Mestre da Mana",
            description: "Primeiro mestre da magia humana, conhecido por criar os Anéis de Conexão e por sua missão de reatar a humanidade à mana.",
            // store detailed biography in 'story' so UIs that read 'story' can show the long text
            story: `Aslam Radianthe nasceu no continente de Luminah, em uma aldeia simples cercada por rios e florestas. Diferente de todas as crianças ao seu redor, veio ao mundo em silêncio, observando o ambiente como se já compreendesse algo invisível aos olhos humanos. Desde o início a mana, essência que permeia toda a criação, respondeu à sua presença de forma única. Árvores mortas floresciam com um toque, o vento se curvava ao seu redor e até as chuvas pareciam respeitar seus passos.

Durante a infância, enquanto outras crianças brincavam sem preocupações, Aslam contemplava o céu e os rios. Seus pais, lavradores humildes, viam nele um mistério, mas escolheram não interferir em seu destino. Aos sete anos trouxe vida a um tronco seco apenas com o toque e, a partir desse evento, iniciou sozinho sua jornada de descobertas.

Na juventude dominava os elementos básicos da natureza e aos dezesseis já era capaz de controlar água, terra e vento. Sua fama se espalhou quando conteve uma tempestade colossal que ameaçava destruir sua aldeia. Reis e senhores enviaram emissários oferecendo riquezas, terras e poder em troca de sua lealdade, mas Aslam recusou a todos. O que buscava não era dominação, mas compreensão.

Sua jornada o levou muito além das fronteiras humanas. Nos desertos escaldantes de Karang-Thûl em Ferros ergueu um oásis que floresceu em meio à morte. Nas ilhas de Aquarius aprendeu com sereias segredos ocultos das marés. Em Silvanum, os elfos compartilharam antigos ensinamentos, e nas montanhas dracônicas encontrou criaturas tão antigas quanto o mundo, que viam nele tanto promessa quanto ameaça.

Foi então que entendeu sua verdadeira missão. Não deveria apenas usar a mana para si, mas ensinar os humanos a se reconectarem com ela. Criou os Anéis de Conexão como guia, abrindo caminho para que a humanidade pudesse trilhar a mesma jornada. Reis, camponeses, guerreiros e estudiosos o reconheceram como o primeiro mestre da magia humana.

No entanto, ao aprofundar-se nos segredos da mana descobriu que os humanos eram limitados não por natureza, mas por um selamento imposto por forças primordiais. Determinado a libertar sua espécie, confrontou uma entidade tão antiga quanto o próprio cosmos. A batalha devastou terras e céus e terminou com sua derrota. Aslam foi aprisionado em um vazio fora do tempo e do espaço.

Mil anos se passaram. Seu nome esmaeceu até se tornar mito. No entanto, o destino ainda o aguardava. Selado em trevas, resistiu até despertar em um novo corpo, o do jovem nobre Kaelus Rhys Sylvaris, da Casa Sylvaris em Calonia. Assim voltou ao mundo, renascido e ao mesmo tempo estrangeiro em sua própria terra.

Aslam carrega uma essência marcada pela compaixão e pela solidão de quem já foi diferente de todos. Apesar do imenso poder, fala com suavidade e prefere ensinar em vez de dominar. Hoje reconstrói seu caminho a partir do início, equilibrando a sabedoria milenar de sua vida passada com o fardo de viver a vida de outro. Seu propósito permanece inabalável: ensinar, proteger e libertar a humanidade do selo que a aprisiona.
`,
            imageUrl: null,
            role: "protagonist",
            slug: this.slugify("Aslam Radianthe"),
          },
        },
        {
          baseSlug: this.slugify("Lyra Stormweaver"),
          data: {
            name: "Lyra Stormweaver",
            title: "Conjuradora de Tempestades",
            description: "Uma jovem maga com cabelos negros e túnica azul adornada com runas antigas. Seus olhos brilhantes sugerem suas habilidades mágicas, determinada mas tensa.",
            imageUrl: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=400",
            role: "protagonist",
            slug: this.slugify("Lyra Stormweaver"),
          },
        },
        {
          baseSlug: this.slugify("Lorde Aldrich Sylvaris"),
          data: {
            name: "Lorde Aldrich Sylvaris",
            title: "Cabeça da Casa Sylvaris",
            description: "Senhor imponente de tom ébano profundo e cabelo raspado com barba cheia. Líder da poderosa Casa Sylvaris, com 46 anos e nível de anel de mana 3.1.",
            imageUrl: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=400",
            role: "supporting",
            slug: this.slugify("Lorde Aldrich Sylvaris"),
          },
        },
        {
          baseSlug: this.slugify("Kellen Aurelio"),
          data: {
            name: "Kellen Aurelio",
            title: "Guerreiro Experiente",
            description: "Alto e musculoso, com cabelos negros e olhos intensos. Veste uma armadura marcada por batalhas que contam histórias de combates passados.",
            imageUrl: "https://images.unsplash.com/photo-1566492031773-4f4e44671d66?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=400",
            role: "supporting",
            slug: this.slugify("Kellen Aurelio"),
          },
        },
      ];

      if (forceSeedCharacters || !charactersSeeded) {
        for (const s of seeds) {
          try {
            const exists = await this.getCharacterBySlug(s.baseSlug);
            if (!exists) {
              await this.createCharacter(s.data);
            }
          } catch (e) {
            console.warn('Seed character insert skipped:', s.baseSlug, e);
          }
        }

        // Deduplicate previously seeded characters that gained -1/-2 suffixes
        try {
          const current = await this.getCharacters();
          for (const s of seeds) {
            const group = current.filter(c => c.slug === s.baseSlug || c.slug.startsWith(`${s.baseSlug}-`));
            if (group.length > 1) {
              const keep = group.find(c => c.slug === s.baseSlug) || group[0];
              for (const g of group) {
                if (g.id !== keep.id) {
                  await this.deleteCharacter(g.id);
                }
              }
              console.log(`Deduplicated characters for slug '${s.baseSlug}': kept ${keep.slug}, removed ${group.length - 1}`);
            }
          }
        } catch (e) {
          console.warn('Character dedup pass skipped:', e);
        }

  if (!forceSeedCharacters) await setMeta('seed_characters_done', 'true');
      }

      // Admin seed & upgrade via environment variables (secure, idempotent).
      // Behavior:
      //  - If ADMIN_EMAIL+ADMIN_PASSWORD set and user does NOT exist: create new admin (id = ADMIN_ID || 'admin-root').
      //  - If user exists with that email: ensure isAdmin=1 and optionally update password hash when ADMIN_FORCE_UPDATE_PASSWORD='true'.
      //  - Never downgrade an existing admin.
      //  Set ADMIN_EMAIL and ADMIN_PASSWORD (and optional ADMIN_ID, ADMIN_FORCE_UPDATE_PASSWORD) before startup.
      try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (adminEmail && adminPassword) {
          const adminId = process.env.ADMIN_ID || 'admin-root';
          const existingByEmail = await this.getUserByEmail(adminEmail);
          const rounds = Number(process.env.ADMIN_BCRYPT_ROUNDS || process.env.BCRYPT_ROUNDS || 12);
          const forcePwdUpdate = process.env.ADMIN_FORCE_UPDATE_PASSWORD === 'true';
          if (!existingByEmail) {
            const hash = bcrypt.hashSync(adminPassword, rounds);
            await this.createUserIfNotExists(adminId, adminEmail, hash, true);
            console.log(`Seeded admin user '${adminEmail}' (id=${adminId}) via env vars.`);
          } else {
            // Upgrade path: promote to admin if not already. Update password if explicitly forced.
            let needsUpdate = false;
            const updatePayload: any = { ...existingByEmail };
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
              console.log(`Upgraded existing user '${adminEmail}' to admin${forcePwdUpdate ? ' + updated password' : ''}.`);
            } else {
              console.log(`Admin user '${adminEmail}' already present; no upgrade needed.`);
            }
          }
        } else {
          console.log('Admin seed skipped (ADMIN_EMAIL or ADMIN_PASSWORD not set).');
        }
      } catch (e) {
        console.warn('Admin seed failed:', e);
      }

      // Seed locations
      const valaria: InsertLocation = {
        name: "Reino de Valaria",
        description: "Capital próspera onde residem nobres e artesãos. Centro político e cultural com arquitetura majestosa.",
        mapX: 33,
        mapY: 25,
        type: "capital",
      };

      const aethermoor: InsertLocation = {
        name: "Cidade Flutuante de Aethermoor",
        description: "Maravilha da engenharia mágica, suspensa no ar por cristais encantados. Centro de conhecimento arcano.",
        mapX: 75,
        mapY: 50,
        type: "forest",
      };

      const monteNuvens: InsertLocation = {
        name: "Monte Nuvens",
        description: "Montanha imponente onde o vento sopra forte e os picos tocam as nuvens. Local de poder e mistério.",
        mapX: 25,
        mapY: 67,
        type: "shadowlands",
      };

      // Ensure locations are only seeded if they don't already exist to avoid duplicates on restart
      try {
        const existingLocations = await this.getLocations();
        const hasValaria = existingLocations.some(l => l.name === valaria.name);
        const hasAether = existingLocations.some(l => l.name === aethermoor.name);
        const hasMonte = existingLocations.some(l => l.name === monteNuvens.name);
        if (!hasValaria) await this.createLocation(valaria);
        if (!hasAether) await this.createLocation(aethermoor);
        if (!hasMonte) await this.createLocation(monteNuvens);
      } catch (e) {
        // if the check fails, fall back to best-effort creation but avoid crashing startup
        try { await this.createLocation(valaria); await this.createLocation(aethermoor); await this.createLocation(monteNuvens); } catch {}
      }

      // Seed blog posts
      const blogPost1: InsertBlogPost = {
        title: "Criando os Sistemas Mágicos de Aethermoor",
        slug: "criando-sistemas-magicos",
        content: "Mergulhe na inspiração e pesquisa por trás do complexo framework mágico que alimenta esta épica narrativa. Exploramos como os Anéis de Mana funcionam e como diferentes níveis determinam o poder dos feiticeiros...",
        excerpt: "Mergulhe na inspiração e pesquisa por trás do complexo framework mágico que alimenta esta épica narrativa...",
  category: "world-building",
  publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300",
      };
      const blogPost2: InsertBlogPost = {
        title: "Atualizações do Mundo — Versão 1.2",
        slug: "atualizacoes-v1-2",
        content: "Notas de atualização que detalham mudanças recentes no mundo, ajustes de balanceamento e novos conteúdos adicionados.",
        excerpt: "Notas de atualização: mudanças recentes no mundo e novos conteúdos.",
        category: "update",
        publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        imageUrl: null,
      };

      const blogPost3: InsertBlogPost = {
        title: "Bastidores: Como construímos a Fortaleza de Valaria",
        slug: "bastidores-fortaleza-valaria",
        content: "Uma visão dos bastidores do design da Fortaleza de Valaria, incluindo rascunhos conceituais, referências e decisões de arte.",
        excerpt: "Bastidores do design da Fortaleza de Valaria e escolhas artísticas.",
        category: "behind-scenes",
        publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        imageUrl: null,
      };

      const blogPost4: InsertBlogPost = {
        title: "Pesquisa: Geografia Mágica e Fontes de Mana",
        slug: "pesquisa-geografia-mana",
        content: "Resultados preliminares de estudo sobre pontos naturais de mana e como eles afetam ecossistemas mágicos locais.",
        excerpt: "Estudo sobre pontos naturais de mana e impactos nos ecossistemas.",
        category: "research",
        publishedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        imageUrl: null,
      };
      try {
        const existingBlog = await this.getBlogPostBySlug(blogPost1.slug);
        if (!existingBlog) {
          await this.createBlogPost(blogPost1);
        }
        // seed the additional sample posts too (if not present)
        try { if (!(await this.getBlogPostBySlug(blogPost2.slug))) await this.createBlogPost(blogPost2); } catch (e) {}
        try { if (!(await this.getBlogPostBySlug(blogPost3.slug))) await this.createBlogPost(blogPost3); } catch (e) {}
        try { if (!(await this.getBlogPostBySlug(blogPost4.slug))) await this.createBlogPost(blogPost4); } catch (e) {}
      } catch (e) {
        console.warn('Blog seed skipped or already exists:', e);
      }

      console.log("Database seeded successfully");
    } catch (error) {
      console.error("Error seeding database:", error);
    }
  }
}

// Simple file-based storage fallback for local development when DB is unavailable.
class FileStorage implements IStorage {
  private baseDir = path.resolve(process.cwd(), 'data');

  constructor() {
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  // helper
  private async readFile<T>(name: string, defaultValue: T): Promise<T> {
    const fp = path.join(this.baseDir, name);
    try {
      const txt = await fs.promises.readFile(fp, 'utf-8');
      return JSON.parse(txt || 'null') as T;
    } catch (e) {
      return defaultValue;
    }
  }

  private async writeFile(name: string, data: any) {
    const fp = path.join(this.baseDir, name);
    await fs.promises.writeFile(fp, JSON.stringify(data, null, 2), 'utf-8');
  }

  async getUser(id: string) {
    const users = await this.readFile<any[]>('offline-users.json', []);
    return users.find((u) => u.id === id);
  }

  async getUserByEmail(email: string) {
    const users = await this.readFile<any[]>('offline-users.json', []);
    return users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  }

  async upsertUser(user: any) {
    const users = await this.readFile<any[]>('offline-users.json', []);
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx >= 0) users[idx] = { ...users[idx], ...user };
    else users.push(user);
    await this.writeFile('offline-users.json', users);
    return users.find((u) => u.id === user.id);
  }

  async createUserIfNotExists(id: string, email: string, passwordHash: string, isAdmin: boolean) {
    const existing = await this.getUser(id);
    if (existing) return existing;
    return this.upsertUser({ id, email, passwordHash, isAdmin: isAdmin ? 1 : 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  async getChapters() { return this.readFile<any[]>('offline-chapters.json', []); }
  async getChapterBySlug(slug: string) { const arr = await this.getChapters(); return arr.find((c) => c.slug === slug); }
  async getChapterById(id: string) { const arr = await this.getChapters(); return arr.find((c) => c.id === id); }
  async createChapter(chapter: any) { chapter.id = chapter.id ?? randomUUID(); const arr = await this.getChapters(); arr.push(chapter); await this.writeFile('offline-chapters.json', arr); return chapter; }
  async updateChapter(id: string, chapter: any) { const arr = await this.getChapters(); const idx = arr.findIndex((c) => c.id === id); if (idx < 0) return undefined; arr[idx] = { ...arr[idx], ...chapter }; await this.writeFile('offline-chapters.json', arr); return arr[idx]; }
  async deleteChapter(id: string) { const arr = await this.getChapters(); const idx = arr.findIndex((c) => c.id === id); if (idx < 0) return false; arr.splice(idx, 1); await this.writeFile('offline-chapters.json', arr); return true; }

  async getCharacters() { return this.readFile<any[]>('offline-characters.json', []); }
  async getCharacterById(id: string) { const arr = await this.getCharacters(); return arr.find((c) => c.id === id); }
  async getCharacterBySlug(slug: string) { const arr = await this.getCharacters(); return arr.find((c) => c.slug === slug); }
  async createCharacter(character: any) { character.id = character.id ?? randomUUID(); const arr = await this.getCharacters(); arr.push(character); await this.writeFile('offline-characters.json', arr); return character; }
  async updateCharacter(id: string, character: any) { const arr = await this.getCharacters(); const idx = arr.findIndex((c) => c.id === id); if (idx < 0) return undefined; arr[idx] = { ...arr[idx], ...character }; await this.writeFile('offline-characters.json', arr); return arr[idx]; }
  async deleteCharacter(id: string) { const arr = await this.getCharacters(); const idx = arr.findIndex((c) => c.id === id); if (idx < 0) return false; arr.splice(idx, 1); await this.writeFile('offline-characters.json', arr); return true; }

  async getLocations() { return this.readFile<any[]>('offline-locations.json', []); }
  async getLocationById(id: string) { const arr = await this.getLocations(); return arr.find((c) => c.id === id); }
  async createLocation(location: any) { location.id = location.id ?? randomUUID(); const arr = await this.getLocations(); arr.push(location); await this.writeFile('offline-locations.json', arr); return location; }
  async updateLocation(id: string, location: any) { const arr = await this.getLocations(); const idx = arr.findIndex((c) => c.id === id); if (idx < 0) return undefined; arr[idx] = { ...arr[idx], ...location }; await this.writeFile('offline-locations.json', arr); return arr[idx]; }
  async deleteLocation(id: string) { const arr = await this.getLocations(); const idx = arr.findIndex((c) => c.id === id); if (idx < 0) return false; arr.splice(idx, 1); await this.writeFile('offline-locations.json', arr); return true; }

  async getCodexEntries() { return this.readFile<any[]>('offline-codex.json', []); }
  async getCodexEntriesByCategory(category: string) { const arr = await this.getCodexEntries(); return arr.filter((e) => e.category === category); }
  async getCodexEntryById(id: string) { const arr = await this.getCodexEntries(); return arr.find((c) => c.id === id); }
  async createCodexEntry(entry: any) { entry.id = entry.id ?? randomUUID(); const arr = await this.getCodexEntries(); arr.push(entry); await this.writeFile('offline-codex.json', arr); return entry; }
  async updateCodexEntry(id: string, entry: any) { const arr = await this.getCodexEntries(); const idx = arr.findIndex((c) => c.id === id); if (idx < 0) return undefined; arr[idx] = { ...arr[idx], ...entry }; await this.writeFile('offline-codex.json', arr); return arr[idx]; }
  async deleteCodexEntry(id: string) { const arr = await this.getCodexEntries(); const idx = arr.findIndex((c) => c.id === id); if (idx < 0) return false; arr.splice(idx, 1); await this.writeFile('offline-codex.json', arr); return true; }

  async getBlogPosts() { return this.readFile<any[]>('offline-blog.json', []); }
  async getBlogPostBySlug(slug: string) { const arr = await this.getBlogPosts(); return arr.find((c) => c.slug === slug); }
  async getBlogPostById(id: string) { const arr = await this.getBlogPosts(); return arr.find((c) => c.id === id); }
  async createBlogPost(post: any) { post.id = post.id ?? randomUUID(); const arr = await this.getBlogPosts(); arr.push(post); await this.writeFile('offline-blog.json', arr); return post; }
  async updateBlogPost(id: string, post: any) { const arr = await this.getBlogPosts(); const idx = arr.findIndex((c) => c.id === id); if (idx < 0) return undefined; arr[idx] = { ...arr[idx], ...post }; await this.writeFile('offline-blog.json', arr); return arr[idx]; }
  async deleteBlogPost(id: string) { const arr = await this.getBlogPosts(); const idx = arr.findIndex((c) => c.id === id); if (idx < 0) return false; arr.splice(idx, 1); await this.writeFile('offline-blog.json', arr); return true; }

  async getReadingProgress(sessionId: string, chapterId: string) { const arr = await this.readFile<any[]>('offline-progress.json', []); return arr.find((p) => p.sessionId === sessionId && p.chapterId === chapterId); }
  async updateReadingProgress(sessionId: string, chapterId: string, progress: number) { const arr = await this.readFile<any[]>('offline-progress.json', []); let p = arr.find((x) => x.sessionId === sessionId && x.chapterId === chapterId); if (p) { p.progress = progress; p.lastReadAt = new Date().toISOString(); } else { p = { id: randomUUID(), sessionId, chapterId, progress, lastReadAt: new Date().toISOString() }; arr.push(p); } await this.writeFile('offline-progress.json', arr); return p; }

  // Audio storage (offline simple JSON persistence)
  private async readAudioTracks() { return this.readFile<any[]>('offline-audio-tracks.json', []); }
  private async writeAudioTracks(list: any[]) { return this.writeFile('offline-audio-tracks.json', list); }
  private async readAudioAssignments() { return this.readFile<any[]>('offline-audio-assignments.json', []); }
  private async writeAudioAssignments(list: any[]) { return this.writeFile('offline-audio-assignments.json', list); }

  async getAudioTracks() { return this.readAudioTracks(); }
  async getAudioTrack(id: string) { const arr = await this.readAudioTracks(); return arr.find(t => t.id === id); }
  async createAudioTrack(track: any) { const arr = await this.readAudioTracks(); const payload = { ...track, id: track.id || randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; arr.push(payload); await this.writeAudioTracks(arr); return payload; }
  async updateAudioTrack(id: string, patch: any) { const arr = await this.readAudioTracks(); const idx = arr.findIndex(t => t.id === id); if (idx < 0) return undefined; arr[idx] = { ...arr[idx], ...patch, updatedAt: new Date().toISOString() }; await this.writeAudioTracks(arr); return arr[idx]; }
  async deleteAudioTrack(id: string) { const arr = await this.readAudioTracks(); const idx = arr.findIndex(t => t.id === id); if (idx < 0) return false; arr.splice(idx,1); await this.writeAudioTracks(arr); // delete assignments referencing
    const assigns = await this.readAudioAssignments(); const filtered = assigns.filter(a => a.trackId !== id); await this.writeAudioAssignments(filtered); return true; }

  async getAudioAssignments() { return this.readAudioAssignments(); }
  async getAudioAssignment(id: string) { const arr = await this.readAudioAssignments(); return arr.find(a => a.id === id); }
  async createAudioAssignment(assign: any) { const arr = await this.readAudioAssignments(); const payload = { ...assign, id: assign.id || randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; arr.push(payload); await this.writeAudioAssignments(arr); return payload; }
  async updateAudioAssignment(id: string, patch: any) { const arr = await this.readAudioAssignments(); const idx = arr.findIndex(a => a.id === id); if (idx < 0) return undefined; arr[idx] = { ...arr[idx], ...patch, updatedAt: new Date().toISOString() }; await this.writeAudioAssignments(arr); return arr[idx]; }
  async deleteAudioAssignment(id: string) { const arr = await this.readAudioAssignments(); const idx = arr.findIndex(a => a.id === id); if (idx < 0) return false; arr.splice(idx,1); await this.writeAudioAssignments(arr); return true; }
  async resolveAudio(params: { page?: string; chapterId?: string; characterId?: string; codexId?: string; locationId?: string }) {
    const assignments = await this.getAudioAssignments();
    const candidates: any[] = [];
    for (const a of assignments) {
      if (!a.active) continue;
      switch (a.entityType) {
        case 'chapter': if (params.chapterId && a.entityId === params.chapterId) candidates.push(a); break;
        case 'character': if (params.characterId && a.entityId === params.characterId) candidates.push(a); break;
        case 'codex': if (params.codexId && a.entityId === params.codexId) candidates.push(a); break;
        case 'location': if (params.locationId && a.entityId === params.locationId) candidates.push(a); break;
        case 'page': if (params.page && a.entityId === params.page) candidates.push(a); break;
        case 'global': candidates.push(a); break;
      }
    }
    if (candidates.length === 0) return undefined;
    const specificityRank = (t: string) => ['chapter','character','codex','location'].includes(t) ? 3 : (t === 'page' ? 2 : 1);
    candidates.sort((a,b) => {
      const s = specificityRank(b.entityType) - specificityRank(a.entityType);
      if (s !== 0) return s;
      return (b.priority || 0) - (a.priority || 0);
    });
    const track = await this.getAudioTrack(candidates[0].trackId);
    return track;
  }
}

let storageInstance: IStorage;
try {
  storageInstance = new DatabaseStorage();
} catch (err) {
  console.warn('DatabaseStorage initialization failed, falling back to FileStorage:', err);
  storageInstance = new FileStorage();
}

export const storage = storageInstance;


