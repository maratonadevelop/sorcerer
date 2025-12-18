import dotenv from 'dotenv';
import path from 'path';
import { storage } from '../server/storage.js';
import bcrypt from 'bcryptjs';

const repoRoot = path.resolve(process.cwd(), '..');
if (await (async () => { try { return !!(await import('fs')).existsSync(path.join(repoRoot, '.env.local')); } catch { return false; } })()) {
  dotenv.config({ path: path.join(repoRoot, '.env.local') });
} else {
  dotenv.config({ path: path.join(repoRoot, '.env') });
}

(async () => {
  try {
    const admin = await storage.getUser('admin123');
    if (!admin) return console.error('Admin user not found');
    const hash = admin.passwordHash || admin.password_hash;
    if (!hash) return console.error('Admin has no password hash');
    const ok = await bcrypt.compare('admin123', hash);
    console.log('Admin password match:', ok);
  } catch (e) {
    console.error('Test admin login failed:', e);
  }
})();
