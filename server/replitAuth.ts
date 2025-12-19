import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { getDevTokenFromReq, verifyDevToken } from './devToken';
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

  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl || (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://'))) {
    throw new Error('DATABASE_URL must be set to a Postgres connection string for sessions.');
  }

  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
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

