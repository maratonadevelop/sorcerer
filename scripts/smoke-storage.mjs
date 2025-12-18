import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

(async () => {
  // Load environment from repo root first so DATABASE_URL and SUPABASE keys
  // from `.env.local` are applied before the storage module initializes.
  try {
    const repoRoot = path.resolve(process.cwd(), '..');
    const envLocal = path.join(repoRoot, '.env.local');
    const envDefault = path.join(repoRoot, '.env');
    if (fs.existsSync(envLocal)) {
      dotenv.config({ path: envLocal });
      console.log('Loaded env from .env.local');
    } else if (fs.existsSync(envDefault)) {
      dotenv.config({ path: envDefault });
      console.log('Loaded env from .env');
    } else {
      console.log('No .env.local or .env found at repo root; using process.env');
    }
  } catch (e) {
    // ignore
  }

  // Import storage after env is set
  const { storage } = await import('../server/storage.js');

  console.log('Running storage smoke test (sorcerer workspace)...');
  try {
    const chapters = await storage.getChapters();
    console.log('getChapters() returned:', Array.isArray(chapters) ? chapters.length + ' rows' : typeof chapters);
    const chars = await storage.getCharacters();
    console.log('getCharacters() returned:', Array.isArray(chars) ? chars.length + ' rows' : typeof chars);
    // Attempt a no-op create (with id) and delete to check write path
    const tmp = await storage.createChapter({ id: 'smoke-test-id', title: 'smoke', slug: 'smoke-test-' + Date.now(), content: 'x', excerpt: 'x', chapterNumber: 9999, readingTime: 1, publishedAt: new Date().toISOString() });
    console.log('createChapter() returned id=', tmp?.id || '(no id)');
    const deleted = await storage.deleteChapter(tmp.id);
    console.log('deleteChapter() result=', deleted);
    console.log('Storage smoke test finished successfully');
  } catch (e) {
    console.error('Storage smoke test failed:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
