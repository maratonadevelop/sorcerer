const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const dbPath = path.join(root, 'dev.sqlite');
if (!fs.existsSync(dbPath)) {
  console.error('Database not found at', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);
const continents = [
  { id: 'luminah', name: 'Luminah', description: 'O berço da luz ancestral — cidades de cristal e torres onde o estudo dos anéis de mana floresce.', mapX: 20, mapY: 20, type: 'kingdom' },
  { id: 'akeli', name: 'Akeli', description: 'Região de mares tempestuosos e academias de navegadores de correntes mágicas.', mapX: 70, mapY: 30, type: 'ocean' },
  { id: 'umbra', name: 'Umbra', description: 'Terras de sombras e ruínas vivas — onde o véu entre mundos é mais tênue.', mapX: 50, mapY: 55, type: 'ruins' },
  { id: 'aquario', name: 'Aquario', description: 'Ilhas e recifes que guardam antigas pedras cantantes.', mapX: 80, mapY: 70, type: 'islands' },
  { id: 'ferros', name: 'Ferros', description: 'Montes de ferro e forjas de golem — Ferros é o coração industrial do mundo.', mapX: 40, mapY: 80, type: 'mountains' },
  { id: 'silvanum', name: 'Silvanum', description: 'Florestas imponentes e círculos de pedras vivas — Silvanum é antiga e sábia.', mapX: 25, mapY: 60, type: 'forest' },
];

for (const c of continents) {
  const exists = db.prepare('SELECT COUNT(*) as c FROM locations WHERE id = ?').get(c.id).c;
  if (exists) {
    db.prepare('UPDATE locations SET name = ?, description = ?, map_x = ?, map_y = ?, type = ? WHERE id = ?')
      .run(c.name, c.description, c.mapX, c.mapY, c.type, c.id);
    console.log('Updated', c.id);
  } else {
    db.prepare('INSERT INTO locations (id, name, description, map_x, map_y, type) VALUES (?, ?, ?, ?, ?, ?)')
      .run(c.id, c.name, c.description, c.mapX, c.mapY, c.type);
    console.log('Inserted', c.id);
  }
}

db.close();
console.log('Done inserting continents.');
