import fs from 'fs/promises';

const API = process.env.API_BASE || 'http://127.0.0.1:5000';

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function isoNowOffset(hoursAgo = 0) {
  return new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
}

async function main() {
  try {
    const files = [
      'tmp_import/arc1_ch1.json',
      'tmp_import/arc1_ch2.json',
      'tmp_import/arc1_ch3.json',
    ];
    const payloads = await Promise.all(files.map(async f => {
      const raw = await fs.readFile(new URL(`../${f}`, import.meta.url));
      const j = JSON.parse(String(raw));
      // fill publishedAt placeholders
      const now = Date.now();
      const offsets = { 'arc1_ch1.json': 72, 'arc1_ch2.json': 36, 'arc1_ch3.json': 12 };
      const name = f.split('/').pop();
      if (j?.data?.publishedAt && j.data.publishedAt.startsWith('${')) {
        const hours = offsets[name] ?? 24;
        j.data.publishedAt = new Date(now - hours * 3600 * 1000).toISOString();
      }
      return j;
    }));

    const created = [];
    for (const p of payloads) {
      try {
        const r = await postJSON(`${API}/api/admin/chapters`, p);
        created.push(r.slug || r.id);
      } catch (e) {
        console.warn('Create failed, trying PUT by slug fallback:', e.message);
        // try to find chapter by slug and update instead
        const slug = p?.data?.slug;
        const list = await (await fetch(`${API}/api/chapters`)).json();
        const found = Array.isArray(list) ? list.find(c => c.slug === slug) : null;
        if (found?.id) {
          await fetch(`${API}/api/admin/chapters/${found.id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ data: p.data }),
          });
          created.push(found.slug);
        }
      }
    }
    console.log(JSON.stringify({ ok: true, created }, null, 2));
  } catch (err) {
    console.error('import_arc1 error:', err);
    // last resort: call dev seed endpoint
    try {
      const r = await postJSON(`${API}/api/dev/seed-arc1`, {});
      console.log('seed-arc1 fallback:', r);
    } catch {}
    process.exit(1);
  }
}

main();
