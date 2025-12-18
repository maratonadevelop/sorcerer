// Load env from local or parent workspace before anything else
import './env';
import express, { type Request, Response, NextFunction } from "express";
import compression from 'compression';
import cors from "cors";
import { registerRoutes } from "./routes";
import { dbInit, dbReadyPing, dbCircuitOpen } from './db';
import { setupVite, serveStatic, log } from "./vite";
import fs from 'fs';
import path from 'path';

const app = express();
// Keep ETag enabled for cacheable public resources (we'll selectively set cache headers)
// Disable default weak etag generation for the whole app would hurt public caching, so we leave it ON.
// (If needed we can customize later.)
// app.set('etag', false);

// Enable CORS for development
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173", // Allow requests from the Vite dev server
    credentials: true, // Allow cookies to be sent
  })
);

// Compression: apply to all responses (threshold 0 so small JSON also benefits)
app.use(compression({ threshold: 0 }));

// Conditional caching for API:
// - Public GET collections & detail endpoints (chapters, characters, locations, codex, blog, maps) get short-lived cache
// - Auth/session/user/profile and any state-changing routes remain no-store
// - Non-GET or unspecified routes remain no-store to be safe
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  const noStore = () => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  };

  // Paths that should NEVER be cached (auth & mutations)
  const alwaysNoStorePrefixes = [
    '/api/auth', '/api/login', '/api/logout', '/api/user', '/api/dev', '/api/admin'
  ];
  if (alwaysNoStorePrefixes.some(p => req.path.startsWith(p)) || req.method !== 'GET') {
    noStore();
    return next();
  }

  // Public cacheable GET endpoints
  const cacheablePattern = /^\/api\/(chapters|characters|locations|codex|blog|maps)(\/|$)/;
  if (cacheablePattern.test(req.path)) {
    // 60s edge/browser cache; allow stale while revalidate
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.setHeader('Vary', 'Accept-Encoding');
  } else {
    noStore();
  }
  next();
});

// Increase body size limits to support base64 image uploads from the editor/UI
// Default is 100kb which is too small for typical images
app.use(express.json({ limit: process.env.BODY_LIMIT || '25mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.BODY_LIMIT || '25mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize DB pools and apply session settings
  await dbInit().catch((e) => {
    console.error('DB init failed:', e?.message || e);
  });

  const server = await registerRoutes(app);

  // Ensure unmatched /api paths return JSON 404 instead of SPA HTML
  app.use('/api', (req, res, next) => {
    if (!res.headersSent) {
      return res.status(404).json({ message: 'Not Found' });
    }
    return next();
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // Provide a clearer error for oversized payloads
    if (err.type === 'entity.too.large') {
      const limit = process.env.BODY_LIMIT || '25mb';
      return res.status(413).json({ message: `Arquivo muito grande. Limite: ${limit}.` });
    }
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    } else {
      console.warn('Error after headers sent:', message);
    }

    // log the error and do not re-throw to avoid crashing dev server
    console.error(err);
  });

  // Health endpoints
  app.get('/live', (_req, res) => res.status(200).send('ok'));
  app.get('/ready', async (_req, res) => {
    if (dbCircuitOpen()) return res.status(503).send('db-circuit-open');
    const ok = await dbReadyPing();
    return ok ? res.status(200).send('ready') : res.status(503).send('db-down');
  });

  // serve uploaded files from /uploads
  const uploadsPath = process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  // Set a sensible cache for uploads; filenames are UUID-based so safe to cache longer
  app.use('/uploads', express.static(uploadsPath, { maxAge: '30d', immutable: true }));

  // importantly only setup Vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  // Ensure listen errors are surfaced clearly (e.g., EADDRINUSE) instead of crashing
  // with an unhandled 'error' event.
  server.on('error', (err: any) => {
    console.error('Server listen error:', err?.code || err?.message || err);
    if (err?.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Set PORT to another value or stop the other process.`);
    }
    process.exit(1);
  });
  // On some platforms (Windows) the `reusePort` option is not supported.
  // Use the simpler listen signature for cross-platform compatibility.
  // Omit the explicit host so Node can bind to the system's default
  // unspecified address. This improves compatibility when `localhost`
  // resolves to an IPv6 address (::1) in some environments (VS Code
  // Simple Browser may prefer IPv6), avoiding "connection refused"
  // errors that occur when the server only listens on IPv4 (0.0.0.0).
  server.listen(port, () => {
    log(`serving on port ${port}`);
  });
})();


