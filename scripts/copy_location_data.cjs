const Database = require('better-sqlite3');
const path = require('path');

// Usage:
//  node copy_location_data.cjs [sourceId] [mode]
// mode: 'all' -> copy to all locations except source
// default: copy to the six special continents (akeli, umbra, aquario, ferros, silvanum)

const sourceId = process.argv[2] || 'luminah';
const mode = process.argv[3] || '';

const dbPath = path.resolve(__dirname, '..', 'dev.sqlite');
console.log('Opening DB at', dbPath);
const db = new Database(dbPath, { readonly: false });

function slugifyName(name) {
  return (name || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const src = db.prepare('SELECT * FROM locations WHERE id = ?').get(sourceId);
if (!src) {
  console.error('Source location not found by id:', sourceId);
  // try find by slugified name
  const all = db.prepare('SELECT * FROM locations').all();
  const byName = all.find(l => slugifyName(l.name) === sourceId || (l.id && String(l.id).toLowerCase() === sourceId));
  if (byName) {
    console.log('Found source by name/slug fallback:', byName.id);
    Object.assign(src, byName);
  } else {
    process.exit(1);
  }
}

const fieldsToCopy = ['details', 'image_url', 'description'];

let targets = [];
if (mode === 'all') {
  targets = db.prepare('SELECT id, name, details FROM locations WHERE id != ?').all(sourceId).map(r => r.id);
} else {
  targets = ['akeli','umbra','aquario','ferros','silvanum'];
}

const allLocations = db.prepare('SELECT id, name FROM locations').all();

// Resolve target ids: if id exists use it, else try match by slugified name
const resolvedTargets = targets.map(t => {
  // exact id
  const found = allLocations.find(l => l.id === t || String(l.id).toLowerCase() === t);
  if (found) return found.id;
  const bySlug = allLocations.find(l => slugifyName(l.name) === String(t).toLowerCase());
  return bySlug ? bySlug.id : null;
}).filter(Boolean);

if (resolvedTargets.length === 0) {
  console.error('No targets resolved. Nothing to do.');
  process.exit(1);
}

console.log('Source id:', src.id);
console.log('Will update targets:', resolvedTargets.join(', '));

const update = db.prepare('UPDATE locations SET details = ?, image_url = ?, description = ? WHERE id = ?');
const txn = db.transaction((rows) => {
  for (const id of rows) {
    update.run(src.details || null, src.image_url || null, src.description || null, id);
  }
});

try {
  txn(resolvedTargets);
  console.log('Update complete.');
  // show results
  for (const id of resolvedTargets) {
    const r = db.prepare('SELECT id, name, description, details, image_url FROM locations WHERE id = ?').get(id);
    console.log('->', r.id, r.name, 'image_url=', r.image_url ? '(set)' : '(null)', 'details_len=', r.details ? r.details.length : 0);
  }
} catch (e) {
  console.error('Update failed:', e);
  process.exit(1);
}

console.log('Done.');
