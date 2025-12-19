import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin, isDevAdmin, isAllowedAdminIdentity } from "./replitAuth";
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { ZodError } from 'zod';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { 
  insertChapterSchema, 
  insertCharacterSchema, 
  insertLocationSchema,
  insertCodexEntrySchema,
  insertBlogPostSchema, 
  insertReadingProgressSchema 
} from "@shared/schema";
import { insertAudioTrackSchema, insertAudioAssignmentSchema } from '@shared/schema';
import { parseFullNovelMarkdown } from './importers/fullnovel';
import { signDevToken, verifyDevToken, getDevTokenFromReq } from './devToken';

async function saveTranslations(_resource: string, _id: string, _translations: Record<string, any>) {
  // Translation system intentionally disabled.
  // This function is kept as a no-op to avoid breaking callers that still send
  // translation payloads from the client. If translations are reintroduced
  // later, restore the original implementation.
  return;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Offline user helpers (for dev / DB-down fallback)
  async function readOfflineUsers(): Promise<any[]> {
    try {
      const dir = path.resolve(process.cwd(), 'data');
      const fp = path.join(dir, 'offline-users.json');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(fp)) return [];
      const txt = await fs.promises.readFile(fp, 'utf-8');
      return JSON.parse(txt || '[]');
    } catch {
      return [];
    }
  }
  async function writeOfflineUsers(users: any[]): Promise<void> {
    const dir = path.resolve(process.cwd(), 'data');
    const fp = path.join(dir, 'offline-users.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await fs.promises.writeFile(fp, JSON.stringify(users, null, 2), 'utf-8');
  }
  async function upsertOfflineUser(user: any): Promise<any> {
    const list = await readOfflineUsers();
    const idx = list.findIndex((u) => u.id === user.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...user };
    else list.push(user);
    await writeOfflineUsers(list);
    return list.find((u) => u.id === user.id);
  }

  // Auth routes
  // POST /api/login - body: { id: string, password: string }
  app.post('/api/login', async (req, res) => {
    try {
      // Never cache auth responses
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Vary', 'Cookie');
      const bodySchema = z.object({ id: z.string().min(1), password: z.string().min(6).max(200) });
      const { id, password } = bodySchema.parse(req.body || {});
      // Basic in-memory rate limit by IP to slow down brute-force attempts
      try {
        const ipRaw = (req.ip || req.headers['x-forwarded-for'] || (req as any).connection?.remoteAddress || 'unknown') as string | string[];
        const ip = Array.isArray(ipRaw) ? ipRaw[0] : String(ipRaw);
        const now = Date.now();
        const g: any = global as any;
        g.__loginAttempts = g.__loginAttempts || {} as Record<string, number[]>;
        const attempts: number[] = (g.__loginAttempts[ip] as number[]) || [];
        // remove older than 15 minutes
        const recent = attempts.filter((t) => now - t < 15 * 60 * 1000);
        if (recent.length >= 20) return res.status(429).json({ message: 'Too many login attempts, try later' });
        recent.push(now);
        g.__loginAttempts[ip] = recent;
      } catch (e) {
        // ignore rate limiter failures
      }
      let user: any | undefined;
      try {
        // Allow login by id OR email
        user = await storage.getUser(id);
        if (!user && id.includes('@')) user = await storage.getUserByEmail(id);
      } catch (e) {
        console.warn('DB error on getUser, trying offline users:', e && (e as any).code ? (e as any).code : String(e));
      }
      if (!user) {
        // Try offline users fallback
        const offlineUsers = await readOfflineUsers();
        user = offlineUsers.find((u: any) => u.id === id);
      }
      if (!user) return res.status(401).json({ message: 'Invalid credentials' });
      const hash = (user as any).passwordHash || (user as any).password_hash;
      if (!hash) return res.status(401).json({ message: 'Invalid credentials' });
      const ok = await bcrypt.compare(password, hash);
      if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
      // regenerate session on login to prevent session fixation
      (req as any).session.regenerate?.((err: any) => {
        if (err) {
          console.warn('Session regenerate failed on login:', err);
        }
        const sessionUser = {
          id: user.id,
          email: user.email,
          isAdmin: isAllowedAdminIdentity({ id: user.id, email: user.email }),
          firstName: (user as any).firstName ?? (user as any).first_name ?? undefined,
          lastName: (user as any).lastName ?? (user as any).last_name ?? undefined,
          profileImageUrl: (user as any).profileImageUrl ?? (user as any).profile_image_url ?? undefined,
        };
        (req as any).session.user = sessionUser;
        const extra: any = {};
        if (process.env.NODE_ENV === 'development') {
          // Provide a token for environments where cookies are blocked (VS Code Simple Browser)
          extra.devToken = signDevToken(sessionUser as any);
        }
        return res.json({ ok: true, user: sessionUser, ...extra });
      });
    } catch (e) {
      console.error('Login error:', e);
      return res.status(500).json({ message: 'Login failed' });
    }
  });

  // POST /api/logout - destroys session
  app.post('/api/logout', async (req, res) => {
    try {
      // Never cache auth responses
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Vary', 'Cookie');
      // destroy session and clear cookie
      (req as any).session.destroy?.((err: any) => {
        if (err) {
          console.warn('Session destroy failed on logout:', err);
        }
        try {
          const cookieName = process.env.SESSION_COOKIE_NAME || 'sorcerer.sid';
          res.clearCookie(cookieName, {
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV !== 'development',
            httpOnly: true,
          });
        } catch (e) {}
        return res.json({ ok: true });
      });
    } catch (e) {
      console.error('Logout error:', e);
      return res.status(500).json({ message: 'Logout failed' });
    }
  });

  // POST /api/auth/register - create account with password (returns session)
  app.post('/api/auth/register', async (req, res) => {
    try {
      const bodySchema = z.object({
        id: z.string().min(3).max(64),
        email: z.string().email().optional(),
        password: z.string().min(8).max(200),
        firstName: z.string().min(1).max(120).optional(),
        lastName: z.string().max(120).optional(),
      });
      const { id, email, password, firstName, lastName } = bodySchema.parse(req.body || {});

      // Check duplicates by id or email
      try {
        const existsById = await storage.getUser(id);
        if (existsById) return res.status(409).json({ message: 'Usuário já existe' });
        if (email) {
          const existsByEmail = await storage.getUserByEmail(email);
          if (existsByEmail) return res.status(409).json({ message: 'Email já cadastrado' });
        }
      } catch {}

      const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
      const hash = await bcrypt.hash(password, rounds);
      let user: any = null;
      try {
        user = await storage.upsertUser({ id, email: email ?? `${id}@local.dev`, firstName: firstName ?? '', lastName: lastName ?? '', profileImageUrl: undefined, isAdmin: 0, passwordHash: hash } as any);
      } catch (e) {
        // DB may be down (e.g., trying to use Postgres when it's not available).
        // Fall back to session-only registration so the user can be immediately logged in
        // during development or when DB is temporarily unreachable.
        console.warn('Could not upsert user to DB (continuing with session only):', e && e.stack ? e.stack : e);
        if (process.env.NODE_ENV === 'development') {
          console.error('Register request body:', JSON.stringify(req.body));
        }
        // Persist to offline users so subsequent logins can validate passwords
        try {
          const offline = await upsertOfflineUser({
            id,
            email: email ?? `${id}@local.dev`,
            first_name: firstName ?? '',
            last_name: lastName ?? '',
            profile_image_url: null,
            is_admin: 0,
            password_hash: hash,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          user = { id: offline.id, email: offline.email, isAdmin: !!offline.is_admin } as any;
        } catch (w) {
          console.warn('Failed to write offline user on register, session-only fallback:', w);
          user = { id, email: email ?? `${id}@local.dev`, isAdmin: false } as any;
        }
      }

      // Ensure we always have a minimal user object
      if (!user || !user.id) {
        user = { id, email: email ?? `${id}@local.dev`, isAdmin: false } as any;
      }

      // regenerate session after register if available. Be defensive to avoid throwing
      try {
        const session = (req as any).session;
        const sendResponse = () => {
          try {
            const sessionUser = {
              id: user.id,
              email: user.email,
              isAdmin: isAllowedAdminIdentity({ id: user.id, email: user.email }),
              firstName: (user as any).firstName ?? (user as any).first_name ?? (firstName ?? undefined),
              lastName: (user as any).lastName ?? (user as any).last_name ?? (lastName ?? undefined),
              profileImageUrl: (user as any).profileImageUrl ?? (user as any).profile_image_url ?? undefined,
            };
            return res.json({ ok: true, user: sessionUser });
          } catch (e) {
            console.error('Failed to send register response:', e);
          }
        };

        if (session && typeof session.regenerate === 'function') {
          session.regenerate((err: any) => {
            if (err) console.warn('Session regenerate failed on register:', err);
            try {
              session.user = {
                id: user.id,
                email: user.email,
                isAdmin: isAllowedAdminIdentity({ id: user.id, email: user.email }),
                firstName: (user as any).firstName ?? (user as any).first_name ?? (firstName ?? undefined),
                lastName: (user as any).lastName ?? (user as any).last_name ?? (lastName ?? undefined),
                profileImageUrl: (user as any).profileImageUrl ?? (user as any).profile_image_url ?? undefined,
              };
            } catch (e) {
              console.warn('Failed to write session.user after register:', e);
            }
            return sendResponse();
          });
        } else {
          // no session regeneration available (e.g., simple in-memory), write and respond
          try {
            if (session) session.user = {
              id: user.id,
              email: user.email,
              isAdmin: isAllowedAdminIdentity({ id: user.id, email: user.email }),
              firstName: (user as any).firstName ?? (user as any).first_name ?? (firstName ?? undefined),
              lastName: (user as any).lastName ?? (user as any).last_name ?? (lastName ?? undefined),
              profileImageUrl: (user as any).profileImageUrl ?? (user as any).profile_image_url ?? undefined,
            };
          } catch (e) {
            console.warn('Failed to write session.user after register (no regenerate):', e);
          }
          return sendResponse();
        }
      } catch (e) {
        console.error('Register session handling failed:', e);
        return res.status(500).json({ message: 'Registration failed' });
      }
    } catch (e) {
      // Provide extra debug logging in development so we can see what's failing
      if (process.env.NODE_ENV === 'development') {
        console.error('Register error (development):', e && e.stack ? e.stack : e);
        try { console.error('Register request body (dev):', JSON.stringify(req.body)); } catch (er) {}
      } else {
        console.error('Register error:', e && e.stack ? e.stack : e);
      }
      return res.status(500).json({ message: 'Registration failed' });
    }
  });

  // POST /api/auth/change-password - body: { currentPassword, newPassword }
  app.post('/api/auth/change-password', isAuthenticated, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) return res.status(400).json({ message: 'currentPassword and newPassword required' });
      const sessionUser = (req as any).session?.user as { id?: string } | undefined;
      if (!sessionUser?.id) return res.status(401).json({ message: 'Unauthorized' });
      const dbUser = await storage.getUser(sessionUser.id);
      if (!dbUser) return res.status(404).json({ message: 'User not found' });
      const storedHash = (dbUser as any).passwordHash || (dbUser as any).password_hash;
      if (!storedHash) return res.status(400).json({ message: 'No password set for account' });
      const ok = await bcrypt.compare(currentPassword, storedHash);
      if (!ok) return res.status(401).json({ message: 'Current password incorrect' });
      const newHash = await bcrypt.hash(newPassword, 10);
      await storage.upsertUser({ id: dbUser.id, passwordHash: newHash } as any);
      return res.json({ ok: true });
    } catch (e) {
      console.error('Change password error:', e);
      return res.status(500).json({ message: 'Failed to change password' });
    }
  });
  
  // Public Route - single Codex entry by id
  app.get("/api/codex/:id", async (req, res) => {
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
  // Return current authenticated user information or null
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Prevent caches from serving stale unauthenticated responses
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Vary', 'Cookie');
      // Accept Authorization bearer dev token (dev only) as fallback
      let sessionUser = (req.session?.user as any) || null;
      if (!sessionUser && process.env.NODE_ENV === 'development') {
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
      console.error('Auth user error:', err);
      return res.status(500).json({ message: 'Failed to get user info' });
    }
  });

  // User profile: fetch full profile for the authenticated user
  app.get('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const sessionUser = (req.session?.user as any) || null;
      if (!sessionUser?.id) return res.status(401).json({ message: 'Unauthorized' });
      const dbUser = await storage.getUser(sessionUser.id);
      if (!dbUser) return res.status(404).json({ message: 'User not found' });
      const safe = {
        id: dbUser.id,
        email: (dbUser as any).email,
        firstName: (dbUser as any).firstName ?? (dbUser as any).first_name ?? undefined,
        lastName: (dbUser as any).lastName ?? (dbUser as any).last_name ?? undefined,
        profileImageUrl: (dbUser as any).profileImageUrl ?? (dbUser as any).profile_image_url ?? undefined,
        isAdmin: !!(dbUser as any).isAdmin,
        createdAt: (dbUser as any).createdAt ?? (dbUser as any).created_at ?? undefined,
        updatedAt: (dbUser as any).updatedAt ?? (dbUser as any).updated_at ?? undefined,
      };
      return res.json(safe);
    } catch (e) {
      console.error('Get profile error:', e);
      return res.status(500).json({ message: 'Failed to get profile' });
    }
  });

  // Update profile: { firstName?, lastName?, email?, profileImageUrl? }
  app.put('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const sessionUser = (req.session?.user as any) || null;
      if (!sessionUser?.id) return res.status(401).json({ message: 'Unauthorized' });
      const { firstName, lastName, email, profileImageUrl } = req.body || {};
      const patch: any = { id: sessionUser.id };
      if (typeof firstName === 'string') patch.firstName = firstName;
      if (typeof lastName === 'string') patch.lastName = lastName;
      if (typeof email === 'string' && email.includes('@')) patch.email = email;
      if (typeof profileImageUrl === 'string') patch.profileImageUrl = profileImageUrl;
      const updated = await storage.upsertUser(patch);
      // Update session cache too
      try {
        (req.session as any).user = {
          ...(req.session as any).user,
          firstName: updated.firstName ?? (updated as any).first_name ?? firstName ?? (req.session as any).user?.firstName,
          lastName: updated.lastName ?? (updated as any).last_name ?? lastName ?? (req.session as any).user?.lastName,
          email: updated.email ?? email ?? (req.session as any).user?.email,
          profileImageUrl: updated.profileImageUrl ?? (updated as any).profile_image_url ?? profileImageUrl ?? (req.session as any).user?.profileImageUrl,
        };
      } catch {}
      return res.json({ ok: true });
    } catch (e) {
      console.error('Update profile error:', e);
      return res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  // Authenticated user upload (base64) to update avatar or other assets
  app.post('/api/user/upload', isAuthenticated, async (req: any, res) => {
    try {
      if (process.env.NODE_ENV === 'development') {
        try { console.log('DEBUG /api/user/upload hit, content-type:', req.headers['content-type']); } catch {}
      }
      const { filename, data } = req.body as { filename?: string; data?: string };
      if (!filename || !data) return res.status(400).json({ message: 'filename and data (base64) are required' });
      const base64 = data.includes('base64,') ? data.split('base64,')[1] : data;
      const ext = path.extname(filename) || '';
      const name = `${randomUUID()}${ext}`;
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'avatars');
      await fs.promises.mkdir(uploadsDir, { recursive: true });
      const filePath = path.join(uploadsDir, name);
      await fs.promises.writeFile(filePath, Buffer.from(base64, 'base64'));
      const url = `/uploads/avatars/${name}`;
      res.setHeader('Content-Type', 'application/json');
      return res.json({ url });
    } catch (e) {
      console.error('User upload error:', e);
      return res.status(500).json({ message: 'Failed to upload file' });
    }
  });

  // Public Routes - Chapters
  app.get("/api/chapters", async (req, res) => {
    try {
      const chapters = await storage.getChapters();
      res.json(chapters);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chapters" });
    }
  });

  app.get("/api/chapters/:slug", async (req, res) => {
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

  // Public Routes - Characters
  app.get("/api/characters", async (req, res) => {
    try {
      const characters = await storage.getCharacters();
      // Note: We intentionally removed the automatic JSON uploads fallback here to avoid
      // confusing behavior in Admin where deleted characters appeared to "recreate".
      // If a uploads-based fallback is ever needed for demos, use the explicit
      // /api/characters?uploadsFallback=true query below.
      // Explicit dev-only fallback (opt-in) — helpful during demos without DB content
      if (req.query.uploadsFallback === 'true' && (!characters || characters.length === 0)) {
        try {
          const uploadsFile = path.resolve(process.cwd(), 'uploads', 'codex_return_of_the_first_sorcerer.json');
          if (fs.existsSync(uploadsFile)) {
            const raw = await fs.promises.readFile(uploadsFile, 'utf-8');
            const parsed = JSON.parse(raw || '{}');
            if (Array.isArray(parsed.characters) && parsed.characters.length > 0) {
              const mapped = parsed.characters.map((c: any) => ({
                id: c.id || randomUUID(),
                name: c.name || c.id || 'Character',
                title: c.position || c.title || undefined,
                description: c.notes || c.description || undefined,
                imageUrl: c.imageUrl || null,
                role: c.role || 'unknown',
              }));
              return res.json(mapped);
            }
          }
        } catch (e) {
          console.warn('Failed to read uploaded characters JSON (explicit fallback):', e);
        }
      }

      res.json(characters);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch characters" });
    }
  });

  // Public Route - single Character by id
  // Public Route - single Character by slug
  app.get("/api/characters/slug/:slug", async (req, res) => {
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

  // Public Route - single Character by id
  app.get("/api/characters/:id", async (req, res) => {
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

  // Public Routes - Locations
  app.get("/api/locations", async (req, res) => {
    try {
      const locations = await storage.getLocations();
      res.json(locations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  // Public Route - single Location by id
  app.get("/api/locations/:id", async (req, res) => {
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

  // Public Routes - Codex
  app.get("/api/codex", async (req, res) => {
    try {
      const { category } = req.query;
      const requestedCategory = category ? String(category) : undefined;
      const allowed = new Set(["magic", "creatures", "items", "other"]);

      // Fetch all then normalize categories; this lets us map characters->creatures, locations->other
      const raw = await storage.getCodexEntries();
      const normalized = (raw || []).map((e: any) => {
        const cat = String(e.category || '').toLowerCase();
        let mapped: string;
        if (cat === 'characters') mapped = 'creatures';
        else if (cat === 'locations') mapped = 'other';
        else if (allowed.has(cat)) mapped = cat;
        else mapped = 'other';
        return { ...e, category: mapped };
      }).filter((e: any) => allowed.has(e.category));

      const filtered = requestedCategory
        ? normalized.filter((e: any) => e.category === requestedCategory)
        : normalized;

      res.json(filtered);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch codex entries" });
    }
  });

  // Public Routes - Blog
  app.get("/api/blog", async (req, res) => {
    try {
      const posts = await storage.getBlogPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch blog posts" });
    }
  });

  app.get("/api/blog/:slug", async (req, res) => {
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

  // Reading Progress (no auth required, uses session)
  app.get("/api/reading-progress/:sessionId/:chapterId", async (req, res) => {
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

  app.put("/api/reading-progress", async (req, res) => {
    try {
      const { sessionId, chapterId, progress } = req.body;
      if (!sessionId || !chapterId || typeof progress !== 'number' || !Number.isFinite(progress)) {
        res.status(400).json({ message: "Missing sessionId, chapterId or progress" });
        return;
      }

      // DB schema stores progress as INTEGER; client may send floats.
      // Clamp to 0..100 and round to nearest int to avoid Postgres 22P02.
      const normalizedProgress = Math.max(0, Math.min(100, Math.round(progress)));

      const updatedProgress = await storage.updateReadingProgress(sessionId, chapterId, normalizedProgress);
      res.json(updatedProgress);
    } catch (error) {
      console.error("Reading progress error:", error);
      res.status(400).json({ message: "Invalid reading progress data" });
    }
  });

  // Newsletter signup
  app.post("/api/newsletter", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !email.includes("@")) {
        res.status(400).json({ message: "Valid email address required" });
        return;
      }
      // In a real app, this would integrate with an email service
      res.json({ message: "Successfully subscribed to newsletter" });
    } catch (error) {
      res.status(500).json({ message: "Failed to subscribe to newsletter" });
    }
  });

  // Translation service disabled: return a clear 501 so callers know it's not available.
  app.post('/api/translate', async (_req, res) => {
    return res.status(501).json({ message: 'Translation provider disabled' });
  });

  // ADMIN ROUTES - All require admin authentication
  // ---------------- Audio Management ----------------
  // List audio tracks
  app.get('/api/admin/audio/tracks', isAdmin, async (_req, res) => {
    try { const list = await storage.getAudioTracks(); return res.json(list); } catch (e) { console.error('List audio tracks error:', e); return res.status(500).json({ message: 'Failed to list audio tracks' }); }
  });
  // Create audio track { data }
  app.post('/api/admin/audio/tracks', isAdmin, async (req, res) => {
    try {
      let { data } = req.body || {};
      if (!data) data = req.body; // allow raw body
      if (!data) return res.status(400).json({ message: 'Missing track data' });
      // Basic fallback defaults
      if (!data.title) data.title = 'Untitled Track';
      if (!data.kind) data.kind = 'music';
      const validated = insertAudioTrackSchema.parse(data);
      const track = await storage.createAudioTrack(validated as any);
      return res.status(201).json(track);
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ message: 'Validation failed', issues: e.errors });
      console.error('Create audio track error:', e); return res.status(500).json({ message: 'Failed to create audio track' });
    }
  });
  app.put('/api/admin/audio/tracks/:id', isAdmin, async (req, res) => {
    try {
      let { data } = req.body || {}; if (!data) data = req.body; if (!data) return res.status(400).json({ message: 'Missing update payload' });
      const patch = insertAudioTrackSchema.partial().parse(data);
      const updated = await storage.updateAudioTrack(req.params.id, patch as any);
      if (!updated) return res.status(404).json({ message: 'Track not found' });
      return res.json(updated);
    } catch (e) { if (e instanceof ZodError) return res.status(400).json({ message: 'Validation failed', issues: e.errors }); console.error('Update audio track error:', e); return res.status(500).json({ message: 'Failed to update audio track' }); }
  });
  app.delete('/api/admin/audio/tracks/:id', isAdmin, async (req, res) => {
    try { const ok = await storage.deleteAudioTrack(req.params.id); if (!ok) return res.status(404).json({ message: 'Track not found' }); return res.json({ ok: true }); } catch (e) { console.error('Delete audio track error:', e); return res.status(500).json({ message: 'Failed to delete audio track' }); }
  });

  // Audio assignments
  app.get('/api/admin/audio/assignments', isAdmin, async (_req, res) => {
    try { const list = await storage.getAudioAssignments(); return res.json(list); } catch (e) { console.error('List audio assignments error:', e); return res.status(500).json({ message: 'Failed to list audio assignments' }); }
  });
  app.post('/api/admin/audio/assignments', isAdmin, async (req, res) => {
    try { let { data } = req.body || {}; if (!data) data = req.body; if (!data) return res.status(400).json({ message: 'Missing assignment data' });
      if (!data.entityType) data.entityType = 'global';
      const validated = insertAudioAssignmentSchema.parse(data);
      const created = await storage.createAudioAssignment(validated as any);
      return res.status(201).json(created);
    } catch (e) { if (e instanceof ZodError) return res.status(400).json({ message: 'Validation failed', issues: e.errors }); console.error('Create audio assignment error:', e); return res.status(500).json({ message: 'Failed to create audio assignment' }); }
  });
  app.put('/api/admin/audio/assignments/:id', isAdmin, async (req, res) => {
    try { let { data } = req.body || {}; if (!data) data = req.body; if (!data) return res.status(400).json({ message: 'Missing update payload' });
      const patch = insertAudioAssignmentSchema.partial().parse(data);
      const updated = await storage.updateAudioAssignment(req.params.id, patch as any);
      if (!updated) return res.status(404).json({ message: 'Assignment not found' });
      return res.json(updated);
    } catch (e) { if (e instanceof ZodError) return res.status(400).json({ message: 'Validation failed', issues: e.errors }); console.error('Update audio assignment error:', e); return res.status(500).json({ message: 'Failed to update audio assignment' }); }
  });
  app.delete('/api/admin/audio/assignments/:id', isAdmin, async (req, res) => {
    try { const ok = await storage.deleteAudioAssignment(req.params.id); if (!ok) return res.status(404).json({ message: 'Assignment not found' }); return res.json({ ok: true }); } catch (e) { console.error('Delete audio assignment error:', e); return res.status(500).json({ message: 'Failed to delete audio assignment' }); }
  });

  // Public audio resolution endpoint
  app.get('/api/audio/resolve', async (req, res) => {
    try {
      const page = typeof req.query.page === 'string' ? req.query.page : undefined;
      const chapterId = typeof req.query.chapterId === 'string' ? req.query.chapterId : undefined;
      const characterId = typeof req.query.characterId === 'string' ? req.query.characterId : undefined;
      const codexId = typeof req.query.codexId === 'string' ? req.query.codexId : undefined;
      const locationId = typeof req.query.locationId === 'string' ? req.query.locationId : undefined;
      const track = await storage.resolveAudio({ page, chapterId, characterId, codexId, locationId });
      if (!track) return res.json(null);
      return res.json(track);
    } catch (e) { console.error('Resolve audio error:', e); return res.status(500).json({ message: 'Failed to resolve audio' }); }
  });
  
  // Admin Chapters
  app.post("/api/admin/chapters", isAdmin, async (req, res) => {
    try {
      // Backward compatibility: client may send raw fields without wrapping in { data }
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = (req.body || {});
        // Heuristic: if common chapter keys exist, treat entire body as data
        const chapterKeys = ['title','excerpt','content','chapterNumber','arcNumber','arcTitle','readingTime','slug','publishedAt','imageUrl'];
        if (Object.keys(possible).some(k => chapterKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: 'Request body must include chapter fields (wrap in { data } or send raw keys)' });

  // NOTE: do not convert publishedAt to Date before validation (Zod expects strings)
  // Keep publishedAt as string for validation; normalize to ISO after validation if present.
      // Provide sensible defaults if UI fails to send title/excerpt so validation doesn't fail silently
      if (!data.title) {
        const fallbackTitle = data.slug || 'Untitled Chapter';
        console.warn('Chapter payload missing title, defaulting to:', fallbackTitle);
        data.title = fallbackTitle;
      }
      // Derive helper: slugify similar to storage implementation (kept here for chapters)
      const slugify = (input?: string) => {
        const s = (input || '').toString().trim().toLowerCase();
        const normalized = s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
        return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^[\-]+|[\-]+$/g, '');
      };
      const ensureUniqueChapterSlug = async (desired: string) => {
        let base = slugify(desired) || 'capitulo';
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

      const html = String(data.content || '');
      const plain = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!data.excerpt) {
        // excerpt: first ~300 chars of plain text
        data.excerpt = plain.slice(0, 300);
      }
      if (!data.readingTime) {
        const words = plain.split(/\s+/).filter(Boolean).length;
        data.readingTime = Math.max(1, Math.ceil(words / 250));
      }
      if (!data.publishedAt) {
        data.publishedAt = new Date().toISOString();
      }
      if (!data.slug || String(data.slug).trim() === '') {
        const desired = data.title || `capitulo-${data.chapterNumber || ''}`;
        data.slug = await ensureUniqueChapterSlug(desired);
      }
      if (!data.imageUrl) {
        data.imageUrl = '/FinalMap.png';
      }
      if (!data.chapterNumber || data.chapterNumber <= 0) {
        data.chapterNumber = 1;
      }
      const validatedData = insertChapterSchema.parse(data);
      const chapter = await storage.createChapter(validatedData);

      // Save translations
      if (chapter?.id && translations) {
        await saveTranslations('chapters', chapter.id, translations);
      }

      res.status(201).json(chapter);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error('Chapter validation error:', error.errors);
        return res.status(400).json({ message: 'Validation failed', issues: error.errors });
      }
      console.error("Create chapter error:", error);
      res.status(500).json({ message: "Failed to create chapter", error: String(error) });
    }
  });

  app.put("/api/admin/chapters/:id", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = (req.body || {});
        const chapterKeys = ['title','excerpt','content','readingTime','publishedAt','imageUrl'];
        if (Object.keys(possible).some(k => chapterKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: 'Request body must include update fields (wrap in { data } or send raw keys)' });

      // Auto-derive on update (non-destructive):
      // - If content provided and readingTime not explicitly provided, recalc readingTime
      // - If excerpt missing but content provided, derive excerpt
      // - Do NOT change slug automatically on title change to avoid breaking links
      const patch: any = insertChapterSchema.partial().parse(data);
      if (patch?.publishedAt) {
        patch.publishedAt = new Date(String(patch.publishedAt)).toISOString();
      }
      if (typeof patch.content === 'string' && (patch.readingTime == null)) {
        const plain = patch.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
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

      // Save translations
      if (chapter?.id && translations) {
        await saveTranslations('chapters', chapter.id, translations);
      }
      
      res.json(chapter);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error('Chapter validation error:', error.errors);
        return res.status(400).json({ message: 'Validation failed', issues: error.errors });
      }
      console.error("Update chapter error:", error);
      res.status(500).json({ message: "Failed to update chapter", error: String(error) });
    }
  });

  app.delete("/api/admin/chapters/:id", isAdmin, async (req, res) => {
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

  // Admin Characters
  app.post("/api/admin/characters", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = (req.body || {});
        const charKeys = ['name','title','description','imageUrl','role','slug'];
        if (Object.keys(possible).some(k => charKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: 'Request body must include character fields (wrap in { data } or send raw keys)' });

  // Debug: log translations shape to help diagnose missing EN/ES saves
  try { console.log('ADMIN CREATE CHARACTER translations keys:', translations ? Object.keys(translations) : '(none)', 'translations sample:', translations ? (Object.keys(translations).slice(0,3).reduce((acc, k) => ({ ...acc, [k]: Object.keys(translations[k] || {}).slice(0,3) }), {})) : null); } catch(e) {}

      const validatedData = insertCharacterSchema.parse(data);
      const character = await storage.createCharacter(validatedData);

      if (character?.id && translations) {
        await saveTranslations('characters', character.id, translations);
      }

      res.status(201).json(character);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error('Character validation error:', error.errors);
        return res.status(400).json({ message: 'Validation failed', issues: error.errors });
      }
      console.error("Create character error:", error);
      res.status(500).json({ message: "Failed to create character", error: String(error) });
    }
  });

  app.put("/api/admin/characters/:id", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = (req.body || {});
        const charKeys = ['name','title','description','imageUrl','role'];
        if (Object.keys(possible).some(k => charKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: 'Request body must include character update fields (wrap in { data } or send raw keys)' });

  // Debug: log translations shape to help diagnose missing EN/ES saves on update
  try { console.log('ADMIN UPDATE CHARACTER id=', req.params.id, 'translations keys:', translations ? Object.keys(translations) : '(none)', 'translations sample:', translations ? (Object.keys(translations).slice(0,3).reduce((acc, k) => ({ ...acc, [k]: Object.keys(translations[k] || {}).slice(0,3) }), {})) : null); } catch(e) {}

      const validatedData = insertCharacterSchema.partial().parse(data);
      const character = await storage.updateCharacter(req.params.id, validatedData);
      if (!character) {
        res.status(404).json({ message: "Character not found" });
        return;
      }

      if (character?.id && translations) {
        await saveTranslations('characters', character.id, translations);
      }

      res.json(character);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error('Character validation error:', error.errors);
        return res.status(400).json({ message: 'Validation failed', issues: error.errors });
      }
      console.error("Update character error:", error);
      res.status(500).json({ message: "Failed to update character", error: String(error) });
    }
  });

  app.delete("/api/admin/characters/:id", isAdmin, async (req, res) => {
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

  // Admin Locations (accepts { data, translations } and saves translations like chapters/characters)
  app.post("/api/admin/locations", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = (req.body || {});
        const locKeys = ['name','description','mapX','mapY','type'];
        if (Object.keys(possible).some(k => locKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: 'Request body must include location fields (wrap in { data } or send raw keys)' });

      const validatedData = insertLocationSchema.parse(data);
      const location = await storage.createLocation(validatedData);

      // Save translations if provided
      if (location?.id && translations) {
        await saveTranslations('locations', location.id, translations);
      }

      res.status(201).json(location);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error('Location validation error:', error.errors);
        return res.status(400).json({ message: 'Validation failed', issues: error.errors });
      }
      console.error("Create location error:", error);
      res.status(500).json({ message: "Failed to create location", error: String(error) });
    }
  });

  app.put("/api/admin/locations/:id", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = (req.body || {});
        const locKeys = ['name','description','mapX','mapY','type'];
        if (Object.keys(possible).some(k => locKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      // Debug logging: capture incoming payload and session/admin info to help
      // diagnose why location updates may not be persisting.
      try {
        console.log('ADMIN UPDATE LOCATION called for id=', req.params.id, 'sessionUser=', (req.session as any)?.user, 'adminUser=', (req as any).adminUser, 'bodyKeys=', Object.keys(req.body || {}));
        // Avoid logging full request body in prod to prevent sensitive data leakage
        if (process.env.NODE_ENV === 'development') console.log('ADMIN UPDATE LOCATION body=', JSON.stringify(req.body));
      } catch (e) { /* noop */ }
      if (!data) return res.status(400).json({ message: 'Request body must include location update fields (wrap in { data } or send raw keys)' });

      const validatedData = insertLocationSchema.partial().parse(data);
      const location = await storage.updateLocation(req.params.id, validatedData);
      if (!location) {
        res.status(404).json({ message: "Location not found" });
        return;
      }

      if (location?.id && translations) {
        await saveTranslations('locations', location.id, translations);
      }

      res.json(location);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error('Location validation error:', error.errors);
        return res.status(400).json({ message: 'Validation failed', issues: error.errors });
      }
      console.error("Update location error:", error);
      res.status(500).json({ message: "Failed to update location", error: String(error) });
    }
  });

  app.delete("/api/admin/locations/:id", isAdmin, async (req, res) => {
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

  // Admin Codex Entries (accept { data, translations })
  app.post("/api/admin/codex", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = (req.body || {});
        const codexKeys = ['title','description','content','category','imageUrl'];
        if (Object.keys(possible).some(k => codexKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: 'Request body must include codex entry fields (wrap in { data } or send raw keys)' });
      const validatedData = insertCodexEntrySchema.parse(data);
      try {
        const entry = await storage.createCodexEntry(validatedData);
        if (entry?.id && translations) {
          await saveTranslations('codex', entry.id, translations);
        }
        return res.status(201).json(entry);
      } catch (err) {
        // Fallback: some older SQLite DBs may not have the `content` column.
        // If insertion fails due to a SQL error, fall back to saving the
        // HTML content into the plain `description` (as a short text excerpt)
        // so admin edits are not lost. Log the original error to help
        // diagnose and perform a migration later.
        console.warn('Codex create failed, attempting fallback (content -> description):', String(err));
        try {
          const fallback = { ...validatedData } as any;
          const html = String(fallback.content || '');
          const plain = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          fallback.description = (fallback.description && String(fallback.description).trim().length > 0)
            ? fallback.description
            : plain.slice(0, 300);
          // remove content so insertion won't reference a missing column
          delete fallback.content;
          const entry2 = await storage.createCodexEntry(fallback);
          if (entry2?.id && translations) {
            await saveTranslations('codex', entry2.id, translations);
          }
          return res.status(201).json(entry2);
        } catch (err2) {
          console.error('Fallback codex create also failed:', String(err2));
          throw err2;
        }
      }
    } catch (error) {
      if (error instanceof ZodError) {
        console.error('Codex validation error:', error.errors);
        return res.status(400).json({ message: 'Validation failed', issues: error.errors });
      }
      console.error("Create codex entry error:", error);
      res.status(500).json({ message: "Failed to create codex entry", error: String(error) });
    }
  });

  app.put("/api/admin/codex/:id", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = (req.body || {});
        const codexKeys = ['title','description','content','category','imageUrl'];
        if (Object.keys(possible).some(k => codexKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: 'Request body must include codex update fields (wrap in { data } or send raw keys)' });
      const validatedData = insertCodexEntrySchema.partial().parse(data);
      try {
        const entry = await storage.updateCodexEntry(req.params.id, validatedData);
        if (!entry) {
          res.status(404).json({ message: "Codex entry not found" });
          return;
        }
        if (entry?.id && translations) {
          await saveTranslations('codex', entry.id, translations);
        }
        return res.json(entry);
      } catch (err) {
        // Fallback similar to POST: if DB lacks `content` column, try updating
        // by moving content into description and removing `content` from payload.
        console.warn('Codex update failed, attempting fallback (content -> description):', String(err));
        try {
          const fallback = { ...validatedData } as any;
          const html = String(fallback.content || '');
          const plain = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          fallback.description = (fallback.description && String(fallback.description).trim().length > 0)
            ? fallback.description
            : plain.slice(0, 300);
          delete fallback.content;
          const entry2 = await storage.updateCodexEntry(req.params.id, fallback);
          if (!entry2) {
            res.status(404).json({ message: "Codex entry not found" });
            return;
          }
          if (entry2?.id && translations) {
            await saveTranslations('codex', entry2.id, translations);
          }
          return res.json(entry2);
        } catch (err2) {
          console.error('Fallback codex update also failed:', String(err2));
          throw err2;
        }
      }
    } catch (error) {
      if (error instanceof ZodError) {
        console.error('Codex validation error:', error.errors);
        return res.status(400).json({ message: 'Validation failed', issues: error.errors });
      }
      console.error("Update codex entry error:", error);
      res.status(500).json({ message: "Failed to update codex entry", error: String(error) });
    }
  });

  app.delete("/api/admin/codex/:id", isAdmin, async (req, res) => {
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

  // Admin Blog Posts (accept { data, translations })
  app.post("/api/admin/blog", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = (req.body || {});
        const blogKeys = ['title','excerpt','content','category','slug','publishedAt','imageUrl'];
        if (Object.keys(possible).some(k => blogKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: 'Request body must include blog post fields (wrap in { data } or send raw keys)' });

      const validatedData = insertBlogPostSchema.parse(data);
      if (validatedData?.publishedAt) {
        validatedData.publishedAt = new Date(String(validatedData.publishedAt)).toISOString();
      }
      const post = await storage.createBlogPost(validatedData);

      if (post?.id && translations) {
        await saveTranslations('blog', post.id, translations);
      }

      res.status(201).json(post);
    } catch (error) {
      console.error("Create blog post error:", error);
      res.status(400).json({ message: "Invalid blog post data", error: String(error) });
    }
  });

  // Simple image/file upload endpoint (accepts base64 payload)
  // Body: { filename: string, data: string } where data is base64 or dataURL
  app.post('/api/admin/upload', isAdmin, async (req, res) => {
    try {
      const { filename, data } = req.body as { filename?: string; data?: string };
      if (!filename || !data) {
        res.status(400).json({ message: 'filename and data (base64) are required' });
        return;
      }

      const base64 = data.includes('base64,') ? data.split('base64,')[1] : data;
      const ext = path.extname(filename) || '';
      const name = `${randomUUID()}${ext}`;
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      await fs.promises.mkdir(uploadsDir, { recursive: true });
      const filePath = path.join(uploadsDir, name);
      await fs.promises.writeFile(filePath, Buffer.from(base64, 'base64'));
      const url = `/uploads/${name}`;
      res.json({ url });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ message: 'Failed to upload file' });
    }
  });

  // Public map save endpoint - saves a map package (svg, markers, masks) to uploads/maps/<id>.json
  app.post('/api/maps', async (req, res) => {
    try {
      const { svg, markers, masks, name } = req.body || {};
      if (!markers || !Array.isArray(markers)) return res.status(400).json({ message: 'markers array required' });
      const id = randomUUID();
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'maps');
      await fs.promises.mkdir(uploadsDir, { recursive: true });
      const out = {
        id,
        name: name || `map-${id}`,
        svg: svg || null,
        markers,
        masks: masks || [],
        createdAt: new Date().toISOString(),
      };
      const filePath = path.join(uploadsDir, `${id}.json`);
      await fs.promises.writeFile(filePath, JSON.stringify(out, null, 2), 'utf8');
      return res.json({ id, url: `/uploads/maps/${id}.json` });
    } catch (err) {
      console.error('Save map error:', err);
      return res.status(500).json({ message: 'Failed to save map' });
    }
  });

  // Public map fetch endpoint - returns saved map package
  app.get('/api/maps/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const filePath = path.resolve(process.cwd(), 'uploads', 'maps', `${id}.json`);
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Map not found' });
      const content = await fs.promises.readFile(filePath, 'utf8');
      return res.type('application/json').send(content);
    } catch (err) {
      console.error('Get map error:', err);
      return res.status(500).json({ message: 'Failed to read map' });
    }
  });

  // Public: return the most recently saved map (if any)
  app.get('/api/maps/latest', async (req, res) => {
    try {
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'maps');
      if (!fs.existsSync(uploadsDir)) return res.status(404).json({ message: 'No maps found' });
      const files = await fs.promises.readdir(uploadsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      if (jsonFiles.length === 0) return res.status(404).json({ message: 'No maps found' });
      // determine newest by createdAt inside file (best) or by mtime fallback
      let newest: { path: string; createdAt: string | null } | null = null;
      for (const fname of jsonFiles) {
        const fp = path.join(uploadsDir, fname);
        try {
          const txt = await fs.promises.readFile(fp, 'utf8');
          const parsed = JSON.parse(txt || '{}');
          const createdAt = parsed?.createdAt || null;
          if (!newest) newest = { path: fp, createdAt };
          else {
            if (createdAt && newest.createdAt) {
              if (new Date(createdAt) > new Date(newest.createdAt)) newest = { path: fp, createdAt };
            } else {
              const a = (await fs.promises.stat(fp)).mtime;
              const b = newest.path ? (await fs.promises.stat(newest.path)).mtime : new Date(0);
              if (a > b) newest = { path: fp, createdAt };
            }
          }
        } catch (e) {
          // ignore malformed file
        }
      }
      if (!newest) return res.status(404).json({ message: 'No maps found' });
      const content = await fs.promises.readFile(newest.path, 'utf8');
      return res.type('application/json').send(content);
    } catch (err) {
      console.error('Get latest map error:', err);
      return res.status(500).json({ message: 'Failed to read maps' });
    }
  });

  app.put("/api/admin/blog/:id", isAdmin, async (req, res) => {
    try {
      let { data, translations } = req.body || {};
      if (!data) {
        const { translations: _t, ...possible } = (req.body || {});
        const blogKeys = ['title','excerpt','content','category','publishedAt','imageUrl'];
        if (Object.keys(possible).some(k => blogKeys.includes(k))) {
          data = possible;
          translations = _t;
        }
      }
      if (!data) return res.status(400).json({ message: 'Request body must include blog update fields (wrap in { data } or send raw keys)' });

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
        await saveTranslations('blog', post.id, translations);
      }

      res.json(post);
    } catch (error) {
      console.error("Update blog post error:", error);
      res.status(400).json({ message: "Invalid blog post data", error: String(error) });
    }
  });

  app.delete("/api/admin/blog/:id", isAdmin, async (req, res) => {
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

  // Development-only helpers: create a local admin user and login as session user
  if (process.env.NODE_ENV === 'development') {
    // Trigger Arc 1 seed (idempotent) without restarting the server
    app.post('/api/dev/seed-arc1', isDevAdmin, async (_req, res) => {
      try {
        // Reuse storage methods to insert if missing (same slugs)
        const seeds = [
          {
            slug: 'arco-1-o-limiar-capitulo-1',
            title: 'Capítulo 1 — O Limiar',
            excerpt: 'À beira do desconhecido, uma porta antiga se abre — mas só para quem ousa pagar o preço.',
            content: '<p>O vento cantava pelos corredores de pedra enquanto a luz pálida da aurora arranhava o chão. Diante do Portão Velado, Kael sentiu o frio do mundo antigo tocar sua pele como um juramento esquecido.</p>\n<p>As runas no arco vibraram, tímidas a princípio, depois firmes — reconhecendo nele algo que nem ele compreendia totalmente. O Limiar não julgava coragem. Julgava verdade.</p>\n<p>— Se cruzar, não volta o mesmo — avisou Lyra, mantendo os olhos na dobra de luz. — Muitos entram. Poucos retornam. Nenhum retorna inteiro.</p>\n<p>Kael inspirou. E deu o passo.</p>',
            chapterNumber: 1,
            arcNumber: 1,
            arcTitle: 'O Limiar',
            readingTime: 7,
            publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            imageUrl: '/FinalMap.png',
          },
          {
            slug: 'arco-1-o-limiar-capitulo-2',
            title: 'Capítulo 2 — Ecos da Porta',
            excerpt: 'Cada porta cobra um pedágio. A primeira, memória. A segunda, nome.',
            content: '<p>Do outro lado, o mundo não obedecia mapas. O céu dobrava, a terra respirava, e as sombras tinham ângulos que não pertenciam a lugar nenhum.</p>\n<p>Kael ouviu sua voz chamá-lo — mas a voz vinha de trás de si, de um tempo anterior, de quando ele ainda não carregava o símbolo ardendo no pulso.</p>\n<p>— O Limiar não abre caminho. Ele abre você — sussurrou a guardiã. — Só então o caminho aparece.</p>\n<p>As palavras ecoaram como água em pedra antiga. E algo dentro dele começou a ceder.</p>',
            chapterNumber: 2,
            arcNumber: 1,
            arcTitle: 'O Limiar',
            readingTime: 8,
            publishedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
            imageUrl: '/FinalMap.png',
          },
          {
            slug: 'arco-1-o-limiar-capitulo-3',
            title: 'Capítulo 3 — O Preço da Travessia',
            excerpt: 'Toda travessia leva algo. Só os tolos acreditam que é possível atravessar ileso.',
            content: '<p>Quando a luz fechou atrás deles, o silêncio pesou como ferro molhado. Kael tentou lembrar o nome do seu mestre — e falhou.</p>\n<p>Não era esquecimento comum. Era uma ausência limpa, cirúrgica. Algo havia sido tomado.</p>\n<p>— A porta levou? — Lyra perguntou, a voz curta.</p>\n<p>— Levou — disse Kael, sentindo, junto ao vazio, um fio de poder novo, cru e afiado. — E deixou isso no lugar.</p>',
            chapterNumber: 3,
            arcNumber: 1,
            arcTitle: 'O Limiar',
            readingTime: 9,
            publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            imageUrl: '/FinalMap.png',
          },
        ];
        const created: any[] = [];
        for (const s of seeds) {
          const exists = await storage.getChapterBySlug(s.slug);
          if (!exists) {
            created.push(await storage.createChapter(s as any));
          }
        }
        return res.json({ ok: true, created: created.map(c => c.slug) });
      } catch (e) {
        console.error('seed-arc1 error:', e);
        return res.status(500).json({ ok: false, error: String(e) });
      }
    });
    // Import uploaded codex JSON into the DB (dev only)
    app.post('/api/dev/import-uploads', isDevAdmin, async (req, res) => {
      try {
        const uploadsFile = path.resolve(process.cwd(), 'uploads', 'codex_return_of_the_first_sorcerer.json');
        if (!fs.existsSync(uploadsFile)) return res.status(404).json({ message: 'uploads file not found' });
        const raw = await fs.promises.readFile(uploadsFile, 'utf-8');
        const parsed = JSON.parse(raw || '{}');
        const created: any = { characters: [], locations: [], codex: [] };

        if (Array.isArray(parsed.characters)) {
          for (const c of parsed.characters) {
            try {
              const payload = {
                name: c.name || c.id,
                title: c.position || c.title || undefined,
                description: c.notes || c.description || undefined,
                imageUrl: c.imageUrl || undefined,
                role: c.role || 'unknown',
              } as any;
              const record = await storage.createCharacter(payload as any);
              created.characters.push(record);
            } catch (e) {
              console.warn('Failed to create character from upload:', e);
            }
          }
        }

        if (Array.isArray(parsed.locations)) {
          for (const l of parsed.locations) {
            try {
              const payload = {
                name: l.name || l.id,
                description: l.description || undefined,
                mapX: l.mapX || undefined,
                mapY: l.mapY || undefined,
                type: l.type || undefined,
              } as any;
              const record = await storage.createLocation(payload as any);
              created.locations.push(record);
            } catch (e) {
              console.warn('Failed to create location from upload:', e);
            }
          }
        }

        // No longer auto-create Codex entries from characters/locations to keep scopes separate

        res.json({ ok: true, created });
      } catch (err) {
        console.error('Import uploads failed:', err);
        res.status(500).json({ message: 'Import failed', error: String(err) });
      }
    });
    // Force-import variant (development only) that skips auth so the dev CLI can trigger it.
    app.post('/api/dev/import-uploads-force', async (_req, res) => {
      if (process.env.NODE_ENV !== 'development') return res.status(403).json({ message: 'Not allowed' });
      try {
        const uploadsFile = path.resolve(process.cwd(), 'uploads', 'codex_return_of_the_first_sorcerer.json');
        if (!fs.existsSync(uploadsFile)) return res.status(404).json({ message: 'uploads file not found' });
        const raw = await fs.promises.readFile(uploadsFile, 'utf-8');
        const parsed = JSON.parse(raw || '{}');
        const created: any = { characters: [], locations: [], codex: [] };

        if (Array.isArray(parsed.characters)) {
          for (const c of parsed.characters) {
            try {
              const payload = {
                name: c.name || c.id,
                title: c.position || c.title || undefined,
                description: c.notes || c.description || undefined,
                imageUrl: c.imageUrl || undefined,
                role: c.role || 'unknown',
              } as any;
              const record = await storage.createCharacter(payload as any);
              created.characters.push(record);
            } catch (e) {
              console.warn('Failed to create character from upload:', e);
            }
          }
        }

        if (Array.isArray(parsed.locations)) {
          for (const l of parsed.locations) {
            try {
              const payload = {
                name: l.name || l.id,
                description: l.description || undefined,
                mapX: l.mapX || undefined,
                mapY: l.mapY || undefined,
                type: l.type || undefined,
              } as any;
              const record = await storage.createLocation(payload as any);
              created.locations.push(record);
            } catch (e) {
              console.warn('Failed to create location from upload:', e);
            }
          }
        }

        // No longer auto-create Codex entries from characters/locations (dev force variant)

        res.json({ ok: true, created });
      } catch (err) {
        console.error('Import uploads failed (force):', err);
        res.status(500).json({ message: 'Import failed', error: String(err) });
      }
    });
    // Login as a session user for local dev. Body: { id: string }
    app.post('/api/dev/login', (req, res) => {
      try {
        const { id, email, isAdmin = true } = req.body || {};
        if (!id) return res.status(400).json({ message: 'id is required' });
        (req as any).session.user = { id, email: email ?? `${id}@local.dev`, isAdmin };
        return res.json({ ok: true, user: (req as any).session.user });
      } catch (error) {
        console.error('Dev login error:', error);
        return res.status(500).json({ message: 'Failed to login (dev)' });
      }
    });

    // Re-import chapters from FullNOVEL.md (dev only)
    app.post('/api/dev/import-fullnovel', isDevAdmin, async (req, res) => {
      try {
        const parsed = parseFullNovelMarkdown();
        const created: string[] = [];
        const updated: string[] = [];
        for (const ch of parsed) {
          const exists = await storage.getChapterBySlug(ch.slug);
          const readingTime = Math.max(1, Math.ceil(ch.contentHtml.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length / 250));
          const payload = {
            title: ch.title,
            slug: ch.slug,
            excerpt: ch.excerpt,
            content: ch.contentHtml,
            chapterNumber: ch.chapterNumber,
            arcNumber: ch.arcNumber,
            arcTitle: ch.arcTitle,
            readingTime,
            publishedAt: new Date().toISOString(),
            imageUrl: '/FinalMap.png',
          } as any;
          if (!exists) {
            await storage.createChapter(payload);
            created.push(ch.slug);
          } else {
            await storage.updateChapter(exists.id, {
              title: payload.title,
              excerpt: payload.excerpt,
              content: payload.content,
              readingTime: payload.readingTime,
            });
            updated.push(ch.slug);
          }
        }
        return res.json({ ok: true, created, updated, count: parsed.length });
      } catch (e) {
        console.error('import-fullnovel error:', e);
        return res.status(500).json({ ok: false, error: String(e) });
      }
    });

    // Force variant: dev-only, no auth — helpful for CLI without cookie session
    app.post('/api/dev/import-fullnovel-force', async (_req, res) => {
      if (process.env.NODE_ENV !== 'development') return res.status(403).json({ message: 'Not allowed' });
      try {
        const parsed = parseFullNovelMarkdown();
        const created: string[] = [];
        const updated: string[] = [];
        for (const ch of parsed) {
          const exists = await storage.getChapterBySlug(ch.slug);
          const readingTime = Math.max(1, Math.ceil(ch.contentHtml.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length / 250));
          const payload = {
            title: ch.title,
            slug: ch.slug,
            excerpt: ch.excerpt,
            content: ch.contentHtml,
            chapterNumber: ch.chapterNumber,
            arcNumber: ch.arcNumber,
            arcTitle: ch.arcTitle,
            readingTime,
            publishedAt: new Date().toISOString(),
            imageUrl: '/FinalMap.png',
          } as any;
          if (!exists) {
            await storage.createChapter(payload);
            created.push(ch.slug);
          } else {
            await storage.updateChapter(exists.id, {
              title: payload.title,
              excerpt: payload.excerpt,
              content: payload.content,
              readingTime: payload.readingTime,
            });
            updated.push(ch.slug);
          }
        }
        return res.json({ ok: true, created, updated, count: parsed.length });
      } catch (e) {
        console.error('import-fullnovel-force error:', e);
        return res.status(500).json({ ok: false, error: String(e) });
      }
    });

    // Direct admin access for development - logs in and redirects
    app.get('/api/dev/login', (req, res) => {
      try {
        // Auto-login as admin
        (req as any).session.user = { 
          id: 'dev-admin', 
          email: 'dev-admin@local.dev', 
          isAdmin: true 
        };
        // Redirect to admin page
        return res.redirect('/#/admin');
      } catch (error) {
        console.error('Dev admin error:', error);
        return res.status(500).json({ message: 'Failed to access admin (dev)' });
      }
    });

    // Create or upsert a local admin user. Body: { id?: string, email?: string, displayName?: string, isAdmin?: boolean }
    app.post('/api/dev/create-admin', async (req, res) => {
      try {
        const { id = `dev-${randomUUID()}`, email, displayName, isAdmin = true } = req.body || {};
        const userRecord = await storage.upsertUser({
          id,
          email: email ?? `${id}@local.dev`,
          firstName: displayName ?? 'Dev',
          lastName: '',
          profileImageUrl: undefined,
          isAdmin: !!isAdmin,
        } as any);
        return res.json({ ok: true, user: userRecord });
      } catch (error) {
        console.error('Dev create-admin error:', error);
        return res.status(500).json({ message: 'Failed to create admin user' });
      }
    });

    // Promote the currently authenticated user to admin (development only)
    app.post('/api/dev/promote-self', isAuthenticated, async (req: any, res) => {
      try {
        if (process.env.NODE_ENV !== 'development') return res.status(403).json({ message: 'Not allowed' });
        const sessionUser = (req.session?.user as any) || null;
        if (!sessionUser?.id) return res.status(401).json({ message: 'Unauthorized' });
        const dbUser = await storage.getUser(sessionUser.id);
        if (!dbUser) return res.status(404).json({ message: 'User not found' });
        if (!dbUser.isAdmin) {
          await storage.upsertUser({ id: dbUser.id, isAdmin: 1 } as any);
        }
        try { (req.session as any).user = { ...(req.session as any).user, isAdmin: true }; } catch {}
        return res.json({ ok: true });
      } catch (err) {
        console.error('Dev promote-self error:', err);
        return res.status(500).json({ message: 'Failed to promote user' });
      }
    });

    // Development debug endpoint - returns session and request headers so
    // the developer can compare what the Simple Browser sends vs the system
    // browser. This is intentionally development-only.
    app.get('/api/dev/debug', (req, res) => {
      try {
        const sessionUser = (req.session as any)?.user || null;
        const info = {
          sessionUser,
          headers: {
            host: req.headers.host,
            origin: req.headers.origin,
            referer: req.headers.referer,
            cookie: req.headers.cookie,
            ua: req.headers['user-agent'],
            forwarded: req.headers['x-forwarded-for'] || null,
          },
          url: req.originalUrl,
        };
        return res.json(info);
      } catch (err) {
        console.error('Dev debug error:', err);
        return res.status(500).json({ message: 'Dev debug failed' });
      }
    });

    // Development translation helpers are disabled but kept as harmless stubs so
    // existing client code that tries to read/write translations doesn't fail.
    app.get('/api/dev/translations/:resource/:id', async (req, res) => {
      return res.json({ ok: true, translation: null });
    });

    app.post('/api/dev/translations/:resource/:id', async (req, res) => {
      // Accept the request but don't persist anything.
      return res.json({ ok: true });
    });
  }

  const httpServer = createServer(app);
  return httpServer;
}

