const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const root = path.resolve(__dirname, '..');
const dbPath = path.join(root, 'dev.sqlite');
const offlinePath = path.join(root, '..', 'data', 'offline-locations.json'); // original data folder is one level up in repo
const backupDir = path.join(root, '..', 'tmp_commit_backup');

function timestamp() {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, '-');
}

if (!fs.existsSync(dbPath)) {
  console.error('Database file not found at', dbPath);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });
const dbBackup = path.join(backupDir, `dev.sqlite.bak.${timestamp()}`);
fs.copyFileSync(dbPath, dbBackup);
console.log('Backed up DB to', dbBackup);

if (fs.existsSync(offlinePath)) {
  const offlineBackup = path.join(backupDir, `offline-locations.json.bak.${timestamp()}`);
  fs.copyFileSync(offlinePath, offlineBackup);
  console.log('Backed up offline JSON to', offlineBackup);
} else {
  console.log('No offline-locations.json found at expected path:', offlinePath);
}

const keepPatterns = ['Luminah','Akeli','Umbra','Aquario','Ferros','Silvanum'];

const db = new Database(dbPath);
try {
  // count before
  const before = db.prepare('SELECT COUNT(*) as c FROM locations').get().c;

  // Build where clause to KEEP rows containing any of the patterns in name or description
  const clauses = keepPatterns.map(p => `(name LIKE '%' || ? || '%' OR description LIKE '%' || ? || '%')`);
  const whereKeep = clauses.join(' OR ');
  const deleteSql = `DELETE FROM locations WHERE NOT (${whereKeep})`;
  const params = [];
  for (const p of keepPatterns) { params.push(p); params.push(p); }

  const delStmt = db.prepare(deleteSql);
  const info = delStmt.run(...params);

  const after = db.prepare('SELECT COUNT(*) as c FROM locations').get().c;
  console.log(`Deleted ${info.changes} locations. Before: ${before}, After: ${after}`);

} catch (e) {
  console.error('Failed to modify DB:', e.message);
  process.exit(1);
} finally {
  db.close();
}

// Update offline file if exists
if (fs.existsSync(offlinePath)) {
  try {
    const raw = fs.readFileSync(offlinePath, 'utf-8');
    let arr = JSON.parse(raw);
    const beforeLen = arr.length;
    arr = arr.filter(item => {
      const txt = `${item.name} ${item.description || ''}`;
      for (const p of keepPatterns) {
        if (txt.includes(p)) return true;
      }
      return false;
    });
    fs.writeFileSync(offlinePath, JSON.stringify(arr, null, 2), 'utf-8');
    console.log(`Offline JSON updated. Before: ${beforeLen}, After: ${arr.length}`);
  } catch (e) {
    console.error('Failed to update offline JSON:', e.message);
    process.exit(1);
  }
}

console.log('Done.');
