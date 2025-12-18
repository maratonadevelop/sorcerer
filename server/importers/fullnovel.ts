import fs from 'fs';
import path from 'path';

export type ParsedChapter = {
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  chapterNumber: number;
  arcNumber: number;
  arcTitle: string;
};

// Very small markdown-to-HTML subset: paragraphs, bold, italics, headings
function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(' ').trim())}</p>`);
      para = [];
    }
  };
  const inline = (s: string) => s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  for (const line of lines) {
    const l = line.trimEnd();
    if (/^#{1,6}\s+/.test(l)) {
      flush();
      const level = (l.match(/^#+/)?.[0].length) || 1;
      const text = l.replace(/^#{1,6}\s+/, '');
      out.push(`<h${level}>${inline(text)}</h${level}>`);
      continue;
    }
    if (l === '') {
      flush();
      continue;
    }
    para.push(l);
  }
  flush();
  return out.join('\n');
}

export function parseFullNovelMarkdown(filePath?: string): ParsedChapter[] {
  const candidates = [
    filePath ? path.resolve(filePath) : '',
    path.resolve(process.cwd(), 'sorcerer', 'attached_assets', 'FullNOVEL.md'),
    path.resolve(process.cwd(), 'attached_assets', 'FullNOVEL.md'),
  ].filter(Boolean);
  const fp = candidates.find(p => fs.existsSync(p));
  if (!fp) return [];
  const raw = fs.readFileSync(fp, 'utf8');
  const content = raw.replace(/\r\n?/g, '\n');

  // Find headings with global+multiline regex, including start-of-file
  const headingRe = /^##\s*Cap[íi]tulo\s+(\d+)\s*[:\-]\s*(.*)$/gmi;
  const matches: { index: number; length: number; num: number; title: string }[] = [];
  for (const m of content.matchAll(headingRe)) {
    const idx = (m as any).index as number;
    if (typeof idx !== 'number') continue;
    const full = m[0] || '';
    const num = parseInt(m[1], 10);
    const titleRest = (m[2] || '').trim();
    matches.push({ index: idx, length: full.length, num, title: titleRest });
  }

  const chapters: ParsedChapter[] = [];
  for (let i = 0; i < matches.length; i++) {
    const h = matches[i];
    const startBody = h.index + h.length;
    const endBody = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const body = content.slice(startBody, endBody).trim();

    const num = h.num;
    const restTitle = h.title;
    const displayTitle = `Capítulo ${num} — ${restTitle || (num === 1 ? 'Prólogo' : '')}`.trim();
    const slug = `arco-1-o-limiar-capitulo-${num}`;

    const plain = body.replace(/\*\*|\*/g, '').replace(/\n+/g, ' ').trim();
    const sentences = plain.split(/(?<=[.!?])\s+/).filter(Boolean);
    let excerpt = sentences.slice(0, 3).join(' ');
    if (excerpt.length > 300) excerpt = excerpt.slice(0, 300).trim() + '…';

    const contentHtml = mdToHtml(body);

    chapters.push({
      title: displayTitle,
      slug,
      excerpt,
      contentHtml,
      chapterNumber: num,
      arcNumber: 1,
      arcTitle: 'O Limiar',
    });
  }

  return chapters;
}
