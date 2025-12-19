import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { getDevTokenFromReq, verifyDevToken } from './devToken';
// connect-sqlite3 is lazy-loaded only when needed (not on Render production)
// import connectSqlite3 from 'connect-sqlite3';
import path from 'path';
import fs from 'fs';

type AllowedAdmins = { emails: Set<string>; ids: Set<string>; requireIdMatch: boolean };
let allowedAdminsCache: AllowedAdmins | null = null;

function parseCsvEnv(name: string): string[] {
  const raw = (process.env[name] || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function loadAllowedAdmins(): AllowedAdmins {
  if (allowedAdminsCache) return allowedAdminsCache;

  const emails = new Set<string>();
  const ids = new Set<string>();

  // Only enforce id matching if ADMIN_IDS is explicitly configured.
  const idsFromEnv = parseCsvEnv('ADMIN_IDS');
  const requireIdMatch = idsFromEnv.length > 0;

  // Prefer explicit env vars for production
  for (const e of parseCsvEnv('ADMIN_EMAILS')) emails.add(e.toLowerCase());
  for (const i of idsFromEnv) ids.add(i.toLowerCase());

  // Reasonable defaults for this project (requested: only jeova)
  if (emails.size === 0) emails.add('jeova.herminio@gmail.com');

  // Optional file-based allowlist (legacy/dev). We only use the email field.
  try {
    const candidates = [
      path.resolve(process.cwd(), 'server', 'dev-admins.json'),
      path.resolve(process.cwd(), 'dev-admins.json'),
    ];
    const fp = candidates.find((p) => fs.existsSync(p));
    if (fp) {
      const txt = fs.readFileSync(fp, 'utf-8');
      const parsed = JSON.parse(txt || '[]');
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.email === 'string' && item.email.includes('@')) {
            emails.add(item.email.toLowerCase());
          }
        }
      }
    }
  } catch {
    // ignore
  }

  allowedAdminsCache = { emails, ids, requireIdMatch };
  return allowedAdminsCache;
}

export function isAllowedAdminIdentity(identity: { id?: string; email?: string } | null | undefined): boolean {
  if (!identity) return false;
  const { emails, ids, requireIdMatch } = loadAllowedAdmins();
  const email = (identity.email || '').trim().toLowerCase();
  const id = (identity.id || '').trim().toLowerCase();

  const emailOk = email ? emails.has(email) : false;
  const idOk = id ? ids.has(id) : false;

  // If email is allowlisted, grant admin. Optionally require id match when ADMIN_IDS is set.
  if (emailOk) return requireIdMatch && id ? idOk : true;

  // Fallback: if we have no email, allow by ID.
  return idOk;
}

// A simplified admin check for local development that doesn't rely on sessions
export const isDevAdmin: RequestHandler = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    (req as any).adminUser = { id: 'dev-admin', isAdmin: true };
    return next();
  }
  // Fallback to the standard isAdmin check for production
  return isAdmin(req, res, next);
};

export async function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  // In development prefer a simple in-memory session store to avoid
  // attempting to connect to Postgres or rely on an existing SQLite schema.
  // MemoryStore is fine for local dev and tests.
  if (process.env.NODE_ENV === 'development') {
    const MemoryStore = session.MemoryStore;
    return session({
      name: process.env.SESSION_COOKIE_NAME || 'sorcerer.sid',
      store: new MemoryStore(),
      secret: process.env.SESSION_SECRET || 'dev-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false, // Secure must be false for localhost HTTP
        sameSite: 'lax',
        maxAge: sessionTtl,
      },
    });
  }

  // If DATABASE_URL is provided and it's NOT SQLite, prefer a Postgres-backed session store in non-dev envs.
  const dbUrl = process.env.DATABASE_URL || '';
  const dbLooksSqlite = dbUrl.startsWith('file:') || dbUrl.toLowerCase().includes('sqlite');

  // Render free tier has no persistent disk for SQLite. Require Postgres sessions in production.
  const runningOnRender = !!process.env.RENDER || !!process.env.RENDER_EXTERNAL_URL;
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production' && runningOnRender) {
    if (!dbUrl || dbLooksSqlite) {
      throw new Error('Render production requires Postgres DATABASE_URL (SQLite session store is not supported without a disk).');
    }
  }

  if (dbUrl && !dbLooksSqlite) {
    try {
      const pgStore = connectPg(session);
      const sessionStore = new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,  // Let connect-pg-simple create the table if needed
        ttl: sessionTtl,
        tableName: "sessions",
      });
      return session({
        name: process.env.SESSION_COOKIE_NAME || 'sorcerer.sid',
        secret: process.env.SESSION_SECRET!,
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: sessionTtl,
        },
      });
    } catch (err) {
      // On Render production, DO NOT fallback to SQLite - fail fast instead
      if ((process.env.NODE_ENV || '').toLowerCase() === 'production' && runningOnRender) {
        console.error('Fatal: Postgres session store initialization failed on Render production:', err);
        throw new Error('Postgres session store is required on Render production (no SQLite fallback).');
      }
      console.warn('Postgres session store initialization failed, falling back to SQLite store:', err);
    }
  }

  // On Render production, NEVER fallback to SQLite - fail fast if we reached here
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production' && runningOnRender) {
    throw new Error('Fatal: Reached SQLite fallback on Render production. Ensure DATABASE_URL points to a valid Postgres instance.');
  }

  // Local fallback if nothing else matched: sqlite-backed session store
  // Dynamic import to avoid loading connect-sqlite3/better-sqlite3 on Render production
  const { default: connectSqlite3 } = await import('connect-sqlite3');
  const SQLiteStore = connectSqlite3(session);
  // Allow separate auth DB file if AUTH_DB_FILE is set (default dev.sqlite)
  const authDbFile = process.env.AUTH_DB_FILE || process.env.DB_PATH || 'dev.sqlite';
  const resolvedAuthDbFile = path.isAbsolute(authDbFile)
    ? authDbFile
    : path.resolve(process.cwd(), authDbFile);
  return session({
    name: process.env.SESSION_COOKIE_NAME || 'sorcerer.sid',
    store: new SQLiteStore({
      db: path.basename(resolvedAuthDbFile),
      dir: path.dirname(resolvedAuthDbFile),
      table: 'sessions'
    }) as any,
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Secure must be false for localhost HTTP
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(await getSession());
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  // Session cookie-based
  if ((req.session as any)?.user) return next();
  // Dev token fallback (development only)
  if (process.env.NODE_ENV === 'development') {
    const tok = getDevTokenFromReq(req);
    if (tok) {
      const payload = verifyDevToken(tok);
      if (payload && payload.id) {
        (req as any).session = (req as any).session || {};
        (req as any).session.user = {
          id: payload.id,
          email: payload.email,
          isAdmin: !!payload.isAdmin,
          firstName: payload.firstName,
          lastName: payload.lastName,
          profileImageUrl: payload.profileImageUrl,
        };
        return next();
      }
    }
  }
  res.status(401).json({ message: "Unauthorized" });
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  let sessionUser = (req as any).session?.user as { id?: string; email?: string; isAdmin?: boolean } | undefined;

  // Dev token fallback (development only). This is important for environments
  // where session cookies don't persist (e.g. embedded browsers).
  if (!sessionUser?.id && process.env.NODE_ENV === 'development') {
    const tok = getDevTokenFromReq(req);
    if (tok) {
      const payload = verifyDevToken(tok);
      if (payload && payload.id) {
        (req as any).session = (req as any).session || {};
        (req as any).session.user = {
          id: payload.id,
          email: payload.email,
          isAdmin: !!payload.isAdmin,
          firstName: payload.firstName,
          lastName: payload.lastName,
          profileImageUrl: payload.profileImageUrl,
        };
        sessionUser = (req as any).session.user;
      }
    }
  }

  if (!sessionUser?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Never trust session/db isAdmin flags for production security.
    // Admin is granted only to the allowlisted identity.
    let identity: { id?: string; email?: string } = { id: sessionUser.id, email: sessionUser.email };
    try {
      const dbUser = await storage.getUser(sessionUser.id);
      if (dbUser) identity = { id: (dbUser as any).id, email: (dbUser as any).email };
    } catch {
      // ignore DB failures; fall back to session identity
    }

    if (isAllowedAdminIdentity(identity)) {
      (req as any).adminUser = { ...identity, isAdmin: true };
      return next();
    }

    return res.status(403).json({ message: 'Admin access required' });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

