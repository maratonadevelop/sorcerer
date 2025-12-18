const Database = require('better-sqlite3');
const path = require('path');
const root = path.resolve(__dirname, '..');
const dbPath = path.join(root, 'dev.sqlite');
console.log('DB path:', dbPath);
const db = new Database(dbPath, { readonly: true });
try {
  const rows = db.prepare("SELECT id, name, description, map_x, map_y, type FROM locations").all();
  console.log('Rows:', JSON.stringify(rows, null, 2));
  console.log('Count:', rows.length);
} catch (e) {
  console.error('Query failed:', e.message);
  process.exit(1);
} finally {
  db.close();
}
