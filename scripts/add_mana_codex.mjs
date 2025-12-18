import fs from 'fs';

const run = async () => {
  const payload = JSON.parse(fs.readFileSync(new URL('../tmp_mana_codex.json', import.meta.url), 'utf-8'));
  const res = await fetch('http://localhost:5000/api/admin/codex', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const txt = await res.text();
  console.log('status', res.status);
  console.log(txt);

  const listRes = await fetch('http://localhost:5000/api/codex');
  const list = await listRes.json().catch(() => []);
  console.log('codex count', list.length);
  console.log(list.map(e => ({ id: e.id, title: e.title })).slice(0,5));
};

run().catch(err => { console.error(err); process.exit(1); });
