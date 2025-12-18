import React, { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  uploadFile?: (file: File) => Promise<string | undefined>;
  placeholder?: string;
}

export default function RichEditor({ value, onChange, uploadFile, placeholder }: RichEditorProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const colorRef = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [cropStart, setCropStart] = useState<{x:number;y:number} | null>(null);
  const [cropRect, setCropRect] = useState<{x:number;y:number;w:number;h:number} | null>(null);
  const cropActionRef = useRef<{ mode: 'none'|'draw'|'move'|'resize'; handle?: 'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw'; startX:number; startY:number; startRect?: {x:number;y:number;w:number;h:number} }>({ mode: 'none', startX: 0, startY: 0 });
  const [aspect, setAspect] = useState<'free'|'1:1'|'4:3'|'16:9'>('free');
  const [isCroppingAction, setIsCroppingAction] = useState(false);
  const cropRectRef = useRef<typeof cropRect>(null);
  const cropRafRef = useRef<number | null>(null);
  const cropWinMoveRef = useRef<((ev: MouseEvent) => void) | null>(null);
  const cropWinUpRef = useRef<((ev: MouseEvent) => void) | null>(null);

  useEffect(() => { cropRectRef.current = cropRect; }, [cropRect]);

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const sanitizePastedHtml = (html: string) => {
    try {
      const cleaned = DOMPurify.sanitize(html, {
        // Keep a tight set of tags so pasted content looks consistent with existing chapters.
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
          'blockquote', 'pre', 'code',
          'h1', 'h2', 'h3', 'h4',
          'ul', 'ol', 'li',
          'a',
          'img', 'figure', 'figcaption',
          'hr',
          // Some sources paste as div/span; we keep them but strip styles/attrs below.
          'div', 'span',
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title'],
        KEEP_CONTENT: true,
      });

      const parser = new DOMParser();
      const doc = parser.parseFromString(String(cleaned || ''), 'text/html');
      const root = doc.body;

      // Convert headings (often pasted from Google Docs "Title/Heading" styles) into normal paragraphs
      // so chapter text doesn't become gigantic.
      const headings = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6'));
      for (const h of headings) {
        const p = doc.createElement('p');
        while (h.firstChild) p.appendChild(h.firstChild);
        h.replaceWith(p);
      }

      // Unwrap generic containers; keeps structure but prevents extra block styling.
      const divs = Array.from(root.querySelectorAll('div'));
      for (const d of divs) {
        const parent = d.parentNode;
        if (!parent) continue;
        while (d.firstChild) parent.insertBefore(d.firstChild, d);
        parent.removeChild(d);
      }

      // Strip styles/classes/ids from everything so fonts/sizes don't leak in.
      const all = Array.from(root.querySelectorAll('*')) as HTMLElement[];
      for (const el of all) {
        // remove the usual junk from Google Docs/Word
        el.removeAttribute('style');
        el.removeAttribute('class');
        el.removeAttribute('id');

        // Remove any remaining non-essential attributes.
        const attrs = Array.from(el.attributes);
        for (const attr of attrs) {
          const name = attr.name.toLowerCase();
          const tag = el.tagName.toLowerCase();
          const isAllowed =
            (tag === 'a' && (name === 'href' || name === 'target' || name === 'rel' || name === 'title')) ||
            (tag === 'img' && (name === 'src' || name === 'alt' || name === 'title'));
          if (!isAllowed) el.removeAttribute(attr.name);
        }

        if (el.tagName === 'A') {
          const a = el as HTMLAnchorElement;
          if (a.target === '_blank') {
            const rel = (a.getAttribute('rel') || '').toLowerCase();
            const parts = new Set(rel.split(/\s+/).filter(Boolean));
            parts.add('noopener');
            parts.add('noreferrer');
            a.setAttribute('rel', Array.from(parts).join(' '));
          }
        }
      }

      // Unwrap spans that survive the sanitizer (avoid inline wrappers changing typography).
      const spans = Array.from(root.querySelectorAll('span'));
      for (const span of spans) {
        const parent = span.parentNode;
        if (!parent) continue;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
      }

      // Wrap any stray top-level text nodes into paragraphs.
      const topNodes = Array.from(root.childNodes);
      for (const n of topNodes) {
        if (n.nodeType === Node.TEXT_NODE) {
          const txt = (n.nodeValue || '').trim();
          if (!txt) { root.removeChild(n); continue; }
          const p = doc.createElement('p');
          p.textContent = txt;
          root.replaceChild(p, n);
        }
      }

      return root.innerHTML;
    } catch {
      return '';
    }
  };

  const scheduleCropRect = (next: {x:number;y:number;w:number;h:number}) => {
    cropRectRef.current = next;
    if (cropRafRef.current != null) return;
    cropRafRef.current = requestAnimationFrame(() => {
      cropRafRef.current = null;
      if (cropRectRef.current) setCropRect(cropRectRef.current);
    });
  };

  const updateCropFromPointer = (clientX: number, clientY: number) => {
    if (!cropMode || !selectedImg || !wrapperRef.current) return;
    const action = cropActionRef.current.mode;
    if (action === 'none') return;
    const wrapRect = wrapperRef.current.getBoundingClientRect();
    const imgRect = selectedImg.getBoundingClientRect();
    const imgLeft = imgRect.left - wrapRect.left;
    const imgTop = imgRect.top - wrapRect.top;
    const imgRight = imgLeft + imgRect.width;
    const imgBottom = imgTop + imgRect.height;
    let x2 = Math.min(Math.max(clientX - wrapRect.left, imgLeft), imgRight);
    let y2 = Math.min(Math.max(clientY - wrapRect.top, imgTop), imgBottom);
    const r = aspectValue(aspect);
    if (action === 'draw' && cropStart) {
      const x1 = cropStart.x; const y1 = cropStart.y;
      let left = Math.min(x1, x2); let top = Math.min(y1, y2);
      let w = Math.max(1, Math.abs(x2 - x1)); let h = Math.max(1, Math.abs(y2 - y1));
      if (r) {
        if (w / h > r) { h = Math.round(w / r); } else { w = Math.round(h * r); }
        if (x2 < x1) left = x1 - w; if (y2 < y1) top = y1 - h;
      }
      if (left < imgLeft) { const dx = imgLeft - left; left = imgLeft; w = Math.max(1, w - dx); }
      if (top < imgTop) { const dy = imgTop - top; top = imgTop; h = Math.max(1, h - dy); }
      if (left + w > imgRight) { w = imgRight - left; }
      if (top + h > imgBottom) { h = imgBottom - top; }
      scheduleCropRect({ x: left, y: top, w, h });
      return;
    }
    if (action === 'move' && cropRectRef.current) {
      const sr = cropActionRef.current.startRect!;
      const dx = x2 - cropActionRef.current.startX;
      const dy = y2 - cropActionRef.current.startY;
      let nx = sr.x + dx; let ny = sr.y + dy;
      nx = Math.min(Math.max(imgLeft, nx), imgRight - sr.w);
      ny = Math.min(Math.max(imgTop, ny), imgBottom - sr.h);
      scheduleCropRect({ x: nx, y: ny, w: sr.w, h: sr.h });
      return;
    }
    if (action === 'resize' && cropRectRef.current) {
      const sr = cropActionRef.current.startRect!;
      let { x, y, w, h } = sr;
      const handle = cropActionRef.current.handle!;
      const minSize = 8;
      if (!r) {
        if (handle.includes('e')) { w = Math.max(minSize, Math.min(imgRight - x, x2 - x)); }
        if (handle.includes('s')) { h = Math.max(minSize, Math.min(imgBottom - y, y2 - y)); }
        if (handle.includes('w')) { const nx = Math.max(imgLeft, Math.min(x + w - minSize, x2)); w = (x + w) - nx; x = nx; }
        if (handle.includes('n')) { const ny = Math.max(imgTop, Math.min(y + h - minSize, y2)); h = (y + h) - ny; y = ny; }
      } else {
        if (handle === 'e' || handle === 'w') {
          if (handle === 'e') { w = Math.max(minSize, Math.min(imgRight - x, x2 - x)); }
          else { const nx = Math.max(imgLeft, Math.min(x + w - minSize, x2)); w = (x + w) - nx; x = nx; }
          let nh = Math.round(w / r);
          const cy = y + h/2; y = Math.max(imgTop, Math.min(imgBottom - nh, cy - nh/2)); h = nh;
        } else if (handle === 'n' || handle === 's') {
          if (handle === 's') { h = Math.max(minSize, Math.min(imgBottom - y, y2 - y)); }
          else { const ny = Math.max(imgTop, Math.min(y + h - minSize, y2)); h = (y + h) - ny; y = ny; }
          let nw = Math.round(h * r);
          const cx = x + w/2; x = Math.max(imgLeft, Math.min(imgRight - nw, cx - nw/2)); w = nw;
        } else {
          let xe = x, ye = y, we = w, he = h;
          if (handle.includes('e')) we = Math.max(minSize, Math.min(imgRight - x, x2 - x));
          if (handle.includes('s')) he = Math.max(minSize, Math.min(imgBottom - y, y2 - y));
          if (handle.includes('w')) { const nx = Math.max(imgLeft, Math.min(x + w - minSize, x2)); we = (x + w) - nx; xe = nx; }
          if (handle.includes('n')) { const ny = Math.max(imgTop, Math.min(y + h - minSize, y2)); he = (y + h) - ny; ye = ny; }
          if (we / he > r) { he = Math.round(we / r); } else { we = Math.round(he * r); }
          if (handle.includes('w')) { xe = Math.max(imgLeft, Math.min(x + w - we, xe)); }
          if (handle.includes('n')) { ye = Math.max(imgTop, Math.min(y + h - he, ye)); }
          if (xe + we > imgRight) we = imgRight - xe;
          if (ye + he > imgBottom) he = imgBottom - ye;
          x = xe; y = ye; w = we; h = he;
        }
      }
      scheduleCropRect({ x, y, w, h });
    }
  };

  const startGlobalCropListeners = () => {
    if (cropWinMoveRef.current || cropWinUpRef.current) return;
    const move = (ev: MouseEvent) => { updateCropFromPointer(ev.clientX, ev.clientY); };
    const up = (ev: MouseEvent) => {
      cropActionRef.current.mode = 'none';
      setIsCroppingAction(false);
      window.removeEventListener('mousemove', move, true);
      window.removeEventListener('mouseup', up, true);
      cropWinMoveRef.current = null; cropWinUpRef.current = null;
    };
    cropWinMoveRef.current = move; cropWinUpRef.current = up;
    window.addEventListener('mousemove', move, true);
    window.addEventListener('mouseup', up, true);
  };
  // Guarda/restaura a posição do cursor para inserir conteúdo exatamente onde o usuário parou
  const savedRangeRef = useRef<Range | null>(null);
  const dragFigRef = useRef<HTMLElement | null>(null);
  const [overlayRect, setOverlayRect] = useState<{left:number; top:number; width:number; height:number} | null>(null);
  const resizingRef = useRef<{
    startX: number;
    startY: number;
    startWpx: number;
    startHpx: number;
    orientation: 'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw';
    aspect: number;
    containerW: number;
  } | null>(null);

  // Envolve <img> "solta" em um <figure.re-figure> com legenda e desativa drag nativo da imagem
  const wrapBareImage = (img: HTMLImageElement): HTMLElement => {
    const existingFig = img.closest('figure.re-figure') as HTMLElement | null;
    if (existingFig) {
      // garantir que a imagem não seja arrastável nativamente
      try { img.draggable = false; } catch {}
      if (!img.style.maxWidth) img.style.maxWidth = '100%';
      if (!img.style.height) img.style.height = 'auto';
      if (!img.style.display) img.style.display = 'block';
      if (!img.style.borderRadius) img.style.borderRadius = '4px';
      if (!img.style.width) img.style.width = '100%';
      return existingFig;
    }

    const fig = document.createElement('figure');
    fig.className = 're-figure';
    fig.setAttribute('contenteditable', 'false');
    fig.setAttribute('draggable', 'true');

    try { img.draggable = false; } catch {}
    if (!img.style.maxWidth) img.style.maxWidth = '100%';
    if (!img.style.width) img.style.width = '100%';
    if (!img.style.height) img.style.height = 'auto';
    if (!img.style.display) img.style.display = 'block';
    if (!img.style.borderRadius) img.style.borderRadius = '4px';

    const cap = document.createElement('figcaption');
    cap.className = 're-caption';
    cap.setAttribute('contenteditable', 'true');
    cap.setAttribute('style', 'font-size:0.9em;color:#9ca3af;text-align:center;margin-top:4px;');
    cap.textContent = 'Legenda (opcional)';

    // substitui a imagem pelo figure contendo a imagem e a legenda
    const parent = img.parentNode;
    if (parent) {
      parent.replaceChild(fig, img);
      fig.appendChild(img);
      fig.appendChild(cap);
    }
    return fig;
  };

  // Normaliza todas as imagens dentro do editor
  const normalizeImages = (root: HTMLElement | null): boolean => {
    if (!root) return false;
    let changed = false;
    const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
    for (const img of imgs) {
      const beforeHtml = img.outerHTML;
      const fig = wrapBareImage(img);
      // assegura que figure seja arrastável, e img não
      if (fig && fig.getAttribute('draggable') !== 'true') { fig.setAttribute('draggable', 'true'); changed = true; }
      if (img.draggable !== false) { try { img.draggable = false; } catch {}; }
      if (img.outerHTML !== beforeHtml) changed = true;
    }
    return changed;
  };

  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
      // Após definir o conteúdo vindo de fora, normaliza imagens "soltas"
      const changed = normalizeImages(ref.current);
      if (changed) {
        onChange(ref.current.innerHTML);
      }
    }
  }, [value]);

  // Observa mutações no conteúdo para normalizar <img> recém-inseridas/alteradas
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new MutationObserver(() => {
      const changed = normalizeImages(ref.current);
      if (changed) {
        onChange(ref.current?.innerHTML ?? '');
      }
    });
    obs.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    return () => obs.disconnect();
  }, []);

  const restoreSelection = () => {
    const sel = window.getSelection?.();
    if (!sel) return;
    if (savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    } else if (ref.current) {
      // Se nada salvo, move o cursor para o fim do editor
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  const saveSelection = () => {
    const sel = window.getSelection?.();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const exec = (command: string, valueArg?: string) => {
    try {
      restoreSelection();
      document.execCommand(command, false, valueArg as any);
    } catch (e) {
      // execCommand may be deprecated in some browsers but works for now
    }
    onChange(ref.current?.innerHTML ?? '');
    ref.current?.focus();
  };

  const onInput = () => {
    // Remove caret placeholder chars (ZWSP) used for style-at-caret behavior.
    // Keeps saved HTML clean and avoids invisible characters accumulating.
    try {
      const root = ref.current;
      if (root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node: Node | null = walker.nextNode();
        while (node) {
          const textNode = node as Text;
          if (textNode.data.includes('\u200B')) {
            textNode.data = textNode.data.replace(/\u200B/g, '');
          }
          node = walker.nextNode();
        }
      }
    } catch {}

    // Normaliza sempre que houver entrada (ex.: colar ou arrastar imagem externa)
    const changed = normalizeImages(ref.current);
    if (changed) {
      // atualização já refletirá imagens envolvidas em <figure>
      onChange(ref.current?.innerHTML ?? '');
    } else {
      onChange(ref.current?.innerHTML ?? '');
    }
  };

  // Atualiza posição do overlay (handle de resize) relativo ao wrapper
  const updateOverlayRect = () => {
    if (!selectedImg || !wrapperRef.current) { setOverlayRect(null); return; }
    const imgRect = selectedImg.getBoundingClientRect();
    const wrapRect = wrapperRef.current.getBoundingClientRect();
    setOverlayRect({
      left: imgRect.left - wrapRect.left,
      top: imgRect.top - wrapRect.top,
      width: imgRect.width,
      height: imgRect.height,
    });
  };

  // Garante classe visual de seleção e acompanha posição do handle em resize/scroll/resize window
  useEffect(() => {
    if (!ref.current) return;
    ref.current.querySelectorAll('img.selected').forEach((el) => el.classList.remove('selected'));
    if (selectedImg) {
      selectedImg.classList.add('selected');
      updateOverlayRect();
    } else {
      setOverlayRect(null);
    }
  }, [selectedImg]);

  useEffect(() => {
    if (!selectedImg) return;
    const onScrollOrResize = () => updateOverlayRect();
    window.addEventListener('resize', onScrollOrResize);
    // use capture to react to any ancestor scrolls
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [selectedImg]);

  // Cancel crop with Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cropMode) {
        setCropMode(false);
        setCropRect(null);
        setCropStart(null);
      } else if ((e.key === 'Enter' || e.key === 'NumpadEnter') && cropMode && cropRect) {
        e.preventDefault();
        performCrop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cropMode]);

  const insertImageAtCaret = (src: string, alt?: string) => {
    // Insere figura com imagem e legenda opcional; permite fácil redimensionamento/alinhamento depois
    const altAttr = (alt || '').replace(/"/g, '&quot;');
    const html = `
      <figure class="re-figure" contenteditable="false" draggable="true">
        <img src="${src}" alt="${altAttr}" draggable="false" style="max-width:100%;width:100%;height:auto;display:block;border-radius:4px;" />
        <figcaption contenteditable="true" class="re-caption" style="font-size:0.9em;color:#9ca3af;text-align:center;margin-top:4px;">Legenda (opcional)</figcaption>
      </figure>
      <p><br/></p>
    `;
    exec('insertHTML', html);
  };

  // Perform cropping on selectedImg using cropRect (in editor coordinates)
  const performCrop = async () => {
    if (!selectedImg || !cropRect || !wrapperRef.current) return;
    const wrapRect = wrapperRef.current.getBoundingClientRect();
    const imgRect = selectedImg.getBoundingClientRect();
    // Image rect in wrapper coordinates
    const imgLeft = imgRect.left - wrapRect.left;
    const imgTop = imgRect.top - wrapRect.top;
    const displayW = imgRect.width;
    const displayH = imgRect.height;
    const naturalW = selectedImg.naturalWidth || displayW;
    const naturalH = selectedImg.naturalHeight || displayH;
    const scaleX = naturalW / displayW;
    const scaleY = naturalH / displayH;
    // Crop rect to image coordinates
    let cx = Math.max(0, Math.min(cropRect.x, imgLeft + displayW) - imgLeft);
    let cy = Math.max(0, Math.min(cropRect.y, imgTop + displayH) - imgTop);
    let cw = Math.min(cropRect.w, (imgLeft + displayW) - (imgLeft + cx));
    let ch = Math.min(cropRect.h, (imgTop + displayH) - (imgTop + cy));
    cx = Math.max(0, cx); cy = Math.max(0, cy);
    cw = Math.max(1, cw); ch = Math.max(1, ch);

    const sx = Math.round(cx * scaleX);
    const sy = Math.round(cy * scaleY);
    const sw = Math.max(1, Math.round(cw * scaleX));
    const sh = Math.max(1, Math.round(ch * scaleY));

    // Use a fresh Image to avoid CORS-taint when possible
    const source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      // Try CORS-friendly load; if same-origin, this is harmless
      try { im.crossOrigin = 'anonymous'; } catch {}
      im.onload = () => resolve(im);
      im.onerror = () => resolve(selectedImg); // fallback to existing element
      im.src = selectedImg.src;
    });

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      selectedImg.src = dataUrl;
      setCropMode(false); setCropRect(null); setCropStart(null);
      onChange(ref.current?.innerHTML ?? '');
    } catch (err) {
      console.error('Crop failed:', err);
      alert('Não foi possível cortar esta imagem devido a restrições de origem (CORS). Tente fazer upload antes de cortar.');
    }
  };

  // Helper: map aspect key to numeric ratio W/H
  const aspectValue = (a: typeof aspect): number | null => {
    if (a === '1:1') return 1;
    if (a === '4:3') return 4/3;
    if (a === '16:9') return 16/9;
    return null;
  };

  // Create an initial crop rectangle (80% of image or fit to aspect)
  const makeInitialCrop = () => {
    if (!selectedImg || !wrapperRef.current) return null;
    const wrap = wrapperRef.current.getBoundingClientRect();
    const img = selectedImg.getBoundingClientRect();
    const imgLeft = img.left - wrap.left;
    const imgTop = img.top - wrap.top;
    const W = img.width; const H = img.height;
    const r = aspectValue(aspect);
    if (!r) {
      const w = Math.round(W * 0.82);
      const h = Math.round(H * 0.82);
      const x = Math.round(imgLeft + (W - w)/2);
      const y = Math.round(imgTop + (H - h)/2);
      return { x, y, w, h };
    } else {
      // fit largest rect with ratio r inside image at ~82% scale
      let w = W * 0.86;
      let h = w / r;
      if (h > H * 0.86) { h = H * 0.86; w = h * r; }
      const x = Math.round(imgLeft + (W - w)/2);
      const y = Math.round(imgTop + (H - h)/2);
      return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    }
  };

  const handleInsertImage = async (file?: File) => {
    restoreSelection();
    if (file && uploadFile) {
      const url = await uploadFile(file);
      if (url) {
        const alt = file?.name?.split('.')?.[0] ?? '';
        insertImageAtCaret(url, alt);
      }
      return;
    }
    if (file && !uploadFile) {
      const url = URL.createObjectURL(file);
      const alt = file?.name?.split('.')?.[0] ?? '';
      insertImageAtCaret(url, alt);
      return;
    }
    const url = window.prompt('URL da imagem');
    if (url) {
      const alt = window.prompt('Texto alternativo (alt) da imagem?') ?? '';
      insertImageAtCaret(url, alt);
    }
  };

  const handleCreateLink = () => {
    const url = window.prompt('URL do link (https://...)');
    if (!url) return;
    try {
      exec('createLink', url);
      // Força links a abrirem em nova aba
      if (ref.current) {
        const links = ref.current.querySelectorAll('a[href]');
        links.forEach((a) => {
          if (!a.getAttribute('target')) a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        });
      }
    } catch {}
  };

  const handleUnlink = () => {
    try { exec('unlink'); } catch {}
  };

  // Aplica estilo inline envolvendo a seleção com <span style="...">
  const applySpanStyleToSelection = (styleText: string) => {
    try {
      restoreSelection();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);

      // If there's no selection (caret only), insert a styled span and place the caret inside.
      // This makes font changes feel like they “work” even when the user didn't highlight text.
      if (range.collapsed) {
        const span = document.createElement('span');
        span.setAttribute('style', styleText);
        const zwsp = document.createTextNode('\u200B');
        span.appendChild(zwsp);
        range.insertNode(span);

        const nextRange = document.createRange();
        nextRange.setStart(zwsp, 1);
        nextRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nextRange);
        savedRangeRef.current = nextRange.cloneRange();

        onChange(ref.current?.innerHTML ?? '');
        ref.current?.focus();
        return;
      }

      const span = document.createElement('span');
      span.setAttribute('style', styleText);
      try {
        range.surroundContents(span);
      } catch {
        // Se não for possível (ex.: seleção cruza múltiplos nós), usa insertHTML
        const div = document.createElement('div');
        div.appendChild(range.cloneContents());
        const safeStyle = styleText.replace(/"/g, '&quot;');
        const html = `<span style="${safeStyle}">${div.innerHTML}</span>`;
        document.execCommand('insertHTML', false, html);
      }
      onChange(ref.current?.innerHTML ?? '');
      ref.current?.focus();
    } catch {}
  };

  const FONT_FAMILIES: { label: string; value: string }[] = [
    { label: 'Padrão', value: '' },
    { label: 'Cinzel', value: "'Cinzel', serif" },
    { label: 'Crimson Text', value: "'Crimson Text', serif" },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Garamond', value: 'Garamond, serif' },
    { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
    { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
    { label: 'Montserrat', value: 'Montserrat, Arial, sans-serif' },
    { label: 'Fira Code (mono)', value: "'Fira Code', monospace" },
  ];

  const FONT_SIZES: { label: string; value: string }[] = [
    { label: '10px', value: '10px' },
    { label: '11px', value: '11px' },
    { label: '12px', value: '12px' },
    { label: '14px', value: '14px' },
    { label: '16px', value: '16px' },
    { label: '18px', value: '18px' },
    { label: '20px', value: '20px' },
    { label: '24px', value: '24px' },
    { label: '28px', value: '28px' },
    { label: '32px', value: '32px' },
  ];

  return (
    <div className="rich-editor" ref={wrapperRef} style={{ position: 'relative' }}>
      <div
        className="mb-2 flex flex-wrap gap-2 items-center"
        onMouseDown={() => {
          // Salva a seleção antes de qualquer clique de toolbar abrir diálogo (ex.: input file)
          saveSelection();
        }}
      >
        {/* Font family */}
        <label className="text-xs text-muted-foreground">Fonte</label>
        <select
          aria-label="Fonte"
          title="Fonte"
          className="h-8 px-2 rounded-md bg-white text-black border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-700"
          onChange={(e) => {
            const val = e.target.value;
            // "Padrão" resets to inherited font (app default).
            applySpanStyleToSelection(val ? `font-family: ${val}` : 'font-family: inherit');
          }}
          onFocus={saveSelection}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Font size */}
        <label className="text-xs text-muted-foreground">Tamanho</label>
        <select
          aria-label="Tamanho do texto"
          title="Tamanho do texto"
          className="h-8 px-2 rounded-md bg-white text-black border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-700"
          onChange={(e) => {
            const val = e.target.value;
            if (!val) return;
            applySpanStyleToSelection(`font-size: ${val}`);
          }}
          onFocus={saveSelection}
        >
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <button aria-label="Título H1" title="Título H1" type="button" onClick={() => exec('formatBlock', 'H1')} className="px-3 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 shadow-sm">H1</button>
        <button aria-label="Título H2" title="Título H2" type="button" onClick={() => exec('formatBlock', 'H2')} className="px-3 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 shadow-sm">H2</button>
        <button aria-label="Título H3" title="Título H3" type="button" onClick={() => exec('formatBlock', 'H3')} className="px-3 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 shadow-sm">H3</button>
        <button aria-label="Título H4" title="Título H4" type="button" onClick={() => exec('formatBlock', 'H4')} className="px-3 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 shadow-sm">H4</button>
        <button aria-label="Negrito (Ctrl+B)" title="Negrito (Ctrl+B)" type="button" onClick={() => exec('bold')} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 font-bold">B</button>
        <button aria-label="Itálico (Ctrl+I)" title="Itálico (Ctrl+I)" type="button" onClick={() => exec('italic')} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 italic">I</button>
        <button aria-label="Sublinhado" title="Sublinhado" type="button" onClick={() => exec('underline')} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700">U</button>
        <button aria-label="Tachado" title="Tachado" type="button" onClick={() => exec('strikeThrough')} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700">S</button>
        <button aria-label="Lista ordenada" title="Lista ordenada" type="button" onClick={() => exec('insertOrderedList')} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700">1.</button>
        <button aria-label="Lista" title="Lista" type="button" onClick={() => exec('insertUnorderedList')} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700">•</button>
        <button aria-label="Citação" title="Citação" type="button" onClick={() => exec('formatBlock', 'BLOCKQUOTE')} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700">❝</button>
        <button aria-label="Código" title="Código" type="button" onClick={() => exec('formatBlock', 'PRE')} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700">{`</>`}</button>
        <button aria-label="Alinhar esquerda" title="Alinhar esquerda" type="button" onClick={() => exec('justifyLeft')} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700">⟸</button>
        <button aria-label="Centralizar" title="Centralizar" type="button" onClick={() => exec('justifyCenter')} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700">↔</button>
        <button aria-label="Alinhar direita" title="Alinhar direita" type="button" onClick={() => exec('justifyRight')} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700">⟹</button>
        <button aria-label="Inserir link" title="Inserir link" type="button" onClick={handleCreateLink} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700">🔗</button>
        <button aria-label="Remover link" title="Remover link" type="button" onClick={handleUnlink} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700">✕</button>
        <button aria-label="Remover formatação" title="Remover formatação" type="button" onClick={() => exec('removeFormat')} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700">Clear</button>
        <button aria-label="Adicionar imagem" title="Adicionar imagem" type="button" onClick={() => fileRef.current?.click()} className="ml-2 px-3 py-1 rounded-md bg-blue-600 text-white border border-blue-700 hover:bg-blue-700 dark:bg-blue-500 dark:border-blue-600">Inserir imagem</button>
        {/* Aspect presets (shown when crop mode is ON) */}
        {cropMode && (
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-muted-foreground">Aspecto:</span>
            {(['free','1:1','4:3','16:9'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                className={`px-2 py-1 rounded-md border text-xs ${aspect===opt?'bg-blue-600 text-white border-blue-700':'bg-white text-black border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700'}`}
                onClick={() => {
                  setAspect(opt);
                  // When changing aspect, conform current rect if exists
                  if (cropRect && selectedImg && wrapperRef.current && opt!=='free') {
                    const r = aspectValue(opt)!;
                    const wrap = wrapperRef.current.getBoundingClientRect();
                    const img = selectedImg.getBoundingClientRect();
                    const imgLeft = img.left - wrap.left, imgTop = img.top - wrap.top;
                    const imgRight = imgLeft + img.width, imgBottom = imgTop + img.height;
                    let { x, y, w, h } = cropRect;
                    // adjust to target aspect while keeping center
                    const cx = x + w/2, cy = y + h/2;
                    const w1 = Math.min(imgRight - (cx - 0), (cx + 0) - imgLeft, Math.min(w, h*r)) * 2; // conservative
                    let ww = w1; let hh = ww / r;
                    if (hh > h) { hh = h; ww = hh * r; }
                    x = Math.max(imgLeft, Math.min(imgRight - ww, cx - ww/2));
                    y = Math.max(imgTop, Math.min(imgBottom - hh, cy - hh/2));
                    setCropRect({ x: Math.round(x), y: Math.round(y), w: Math.round(ww), h: Math.round(hh) });
                  }
                }}
              >{opt}</button>
            ))}
          </div>
        )}
        {/* Crop is controlled via overlay buttons next to the X */}
        <input ref={colorRef} type="color" title="Cor do texto" aria-label="Cor do texto" className="h-8 w-8 p-0 border border-gray-300 rounded-md" onChange={(e) => exec('foreColor', e.target.value)} />
        <button aria-label="Linha horizontal" title="Linha horizontal" type="button" onClick={() => exec('insertHorizontalRule')} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700">―</button>
        <button aria-label="Desfazer" title="Desfazer" type="button" onClick={() => exec('undo')} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700">↶</button>
        <button aria-label="Refazer" title="Refazer" type="button" onClick={() => exec('redo')} className="px-2 py-1 rounded-md bg-white text-black border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700">↷</button>
        <div className="ml-auto text-xs text-muted-foreground">Dicas: Ctrl+B = Negrito, Ctrl+I = Itálico</div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0];
        if (f) await handleInsertImage(f);
        (e.target as HTMLInputElement).value = '';
      }} />

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        onBlur={() => { setFocused(false); onChange(ref.current?.innerHTML ?? ''); saveSelection(); setSelectedImg(null); }}
        onFocus={() => { setFocused(true); saveSelection(); }}
        onKeyUp={saveSelection}
        onMouseUp={(e) => {
          // Unificado: finaliza ações de crop e também gerencia seleção de imagem
          if (cropMode) {
            // Finaliza qualquer ação (draw/move/resize)
            cropActionRef.current.mode = 'none';
            if (cropStart && cropRect) setCropStart(null);
            setIsCroppingAction(false);
          }
          saveSelection();
          const target = e.target as HTMLElement;
          if (target && target.tagName === 'IMG') {
            const img = target as HTMLImageElement;
            wrapBareImage(img);
            onChange(ref.current?.innerHTML ?? '');
            try { img.draggable = false; } catch {}
            setSelectedImg(img);
          } else if (target && target.closest('figure.re-figure')) {
            const img = (target.closest('figure.re-figure') as HTMLElement).querySelector('img');
            setSelectedImg((img as HTMLImageElement) || null);
          } else if (!cropMode) {
            // Fora do modo corte, permitir limpar seleção
            setSelectedImg(null);
          }
          updateOverlayRect();
        }
        }
        onMouseDown={(e) => {
          if (!cropMode || !selectedImg || !wrapperRef.current) return;
          e.preventDefault(); e.stopPropagation();
          const wrapRect = wrapperRef.current.getBoundingClientRect();
          const imgRect = selectedImg.getBoundingClientRect();
          const x = e.clientX - wrapRect.left;
          const y = e.clientY - wrapRect.top;
          const imgLeft = imgRect.left - wrapRect.left;
          const imgTop = imgRect.top - wrapRect.top;
          const imgRight = imgLeft + imgRect.width;
          const imgBottom = imgTop + imgRect.height;
          const insideImg = x >= imgLeft && x <= imgRight && y >= imgTop && y <= imgBottom;
          // Start drawing a new rect if click inside image and not on handles
          const target = e.target as HTMLElement;
          const isHandle = target?.dataset?.cropHandle === '1' || target?.closest('[data-crop-handle="1"]');
          const isRect = target?.dataset?.cropRect === '1';
          if (insideImg && !isHandle && !isRect) {
            cropActionRef.current = { mode: 'draw', startX: x, startY: y };
            setIsCroppingAction(true);
            setCropStart({ x, y });
            if (aspectValue(aspect)) {
              // start small with constrained aspect
              const r = aspectValue(aspect)!;
              const w = 40; const h = Math.round(w / r);
              const nx = Math.min(Math.max(imgLeft, x - w/2), imgRight - w);
              const ny = Math.min(Math.max(imgTop, y - h/2), imgBottom - h);
              scheduleCropRect({ x: nx, y: ny, w, h });
            } else {
              scheduleCropRect({ x, y, w: 1, h: 1 });
            }
            startGlobalCropListeners();
          }
        }}
        onMouseMove={(e) => {
          if (!cropMode || !selectedImg || !wrapperRef.current) return;
          const action = cropActionRef.current.mode;
          if (action === 'none') return;
          e.preventDefault(); e.stopPropagation();
          const wrapRect = wrapperRef.current.getBoundingClientRect();
          const imgRect = selectedImg.getBoundingClientRect();
          const imgLeft = imgRect.left - wrapRect.left;
          const imgTop = imgRect.top - wrapRect.top;
          const imgRight = imgLeft + imgRect.width;
          const imgBottom = imgTop + imgRect.height;
          let x2 = Math.min(Math.max(e.clientX - wrapRect.left, imgLeft), imgRight);
          let y2 = Math.min(Math.max(e.clientY - wrapRect.top, imgTop), imgBottom);
          if (action === 'draw' && cropStart) {
            const x1 = cropStart.x; const y1 = cropStart.y;
            let left = Math.min(x1, x2); let top = Math.min(y1, y2);
            let w = Math.max(1, Math.abs(x2 - x1)); let h = Math.max(1, Math.abs(y2 - y1));
            const r = aspectValue(aspect);
            if (r) {
              // Enforce aspect by adjusting h to w/r, then clamp to bounds
              if (w / h > r) { h = Math.round(w / r); } else { w = Math.round(h * r); }
              // keep top-left anchored by drag direction
              if (x2 < x1) left = x1 - w; if (y2 < y1) top = y1 - h;
            }
            // Clamp to image bounds
            if (left < imgLeft) { const dx = imgLeft - left; left = imgLeft; w = Math.max(1, w - dx); }
            if (top < imgTop) { const dy = imgTop - top; top = imgTop; h = Math.max(1, h - dy); }
            if (left + w > imgRight) { w = imgRight - left; }
            if (top + h > imgBottom) { h = imgBottom - top; }
            scheduleCropRect({ x: left, y: top, w, h });
          } else if (action === 'move' && cropRect) {
            const dx = x2 - cropActionRef.current.startX;
            const dy = y2 - cropActionRef.current.startY;
            const sr = cropActionRef.current.startRect!;
            let nx = sr.x + dx; let ny = sr.y + dy;
            nx = Math.min(Math.max(imgLeft, nx), imgRight - sr.w);
            ny = Math.min(Math.max(imgTop, ny), imgBottom - sr.h);
            scheduleCropRect({ x: nx, y: ny, w: sr.w, h: sr.h });
          } else if (action === 'resize' && cropRect) {
            const sr = cropActionRef.current.startRect!;
            let { x, y, w, h } = sr;
            const handle = cropActionRef.current.handle!;
            const minSize = 8;
            const r = aspectValue(aspect);
            if (!r) {
              if (handle.includes('e')) { w = Math.max(minSize, Math.min(imgRight - x, x2 - x)); }
              if (handle.includes('s')) { h = Math.max(minSize, Math.min(imgBottom - y, y2 - y)); }
              if (handle.includes('w')) { const nx = Math.max(imgLeft, Math.min(x + w - minSize, x2)); w = (x + w) - nx; x = nx; }
              if (handle.includes('n')) { const ny = Math.max(imgTop, Math.min(y + h - minSize, y2)); h = (y + h) - ny; y = ny; }
            } else {
              // Maintain aspect r = w/h
              if (handle === 'e' || handle === 'w') {
                if (handle === 'e') { w = Math.max(minSize, Math.min(imgRight - x, x2 - x)); }
                else { const nx = Math.max(imgLeft, Math.min(x + w - minSize, x2)); w = (x + w) - nx; x = nx; }
                let nh = Math.round(w / r);
                // center vertically while resizing horizontally
                const cy = y + h/2; y = Math.max(imgTop, Math.min(imgBottom - nh, cy - nh/2)); h = nh;
              } else if (handle === 'n' || handle === 's') {
                if (handle === 's') { h = Math.max(minSize, Math.min(imgBottom - y, y2 - y)); }
                else { const ny = Math.max(imgTop, Math.min(y + h - minSize, y2)); h = (y + h) - ny; y = ny; }
                let nw = Math.round(h * r);
                const cx = x + w/2; x = Math.max(imgLeft, Math.min(imgRight - nw, cx - nw/2)); w = nw;
              } else {
                // corners
                let xe = x, ye = y, we = w, he = h;
                if (handle.includes('e')) we = Math.max(minSize, Math.min(imgRight - x, x2 - x));
                if (handle.includes('s')) he = Math.max(minSize, Math.min(imgBottom - y, y2 - y));
                if (handle.includes('w')) { const nx = Math.max(imgLeft, Math.min(x + w - minSize, x2)); we = (x + w) - nx; xe = nx; }
                if (handle.includes('n')) { const ny = Math.max(imgTop, Math.min(y + h - minSize, y2)); he = (y + h) - ny; ye = ny; }
                // adjust to aspect by prioritizing the most changed dimension
                if (we / he > r) { he = Math.round(we / r); }
                else { we = Math.round(he * r); }
                // keep within bounds
                if (handle.includes('w')) { xe = Math.max(imgLeft, Math.min(x + w - we, xe)); }
                if (handle.includes('n')) { ye = Math.max(imgTop, Math.min(y + h - he, ye)); }
                if (xe + we > imgRight) we = imgRight - xe;
                if (ye + he > imgBottom) he = imgBottom - ye;
                x = xe; y = ye; w = we; h = he;
              }
            }
            scheduleCropRect({ x, y, w, h });
          }
        }}
        
        onDragStart={(e) => {
          const fig = (e.target as HTMLElement)?.closest('figure.re-figure') as HTMLElement | null;
          if (fig) {
            dragFigRef.current = fig;
            e.dataTransfer?.setData('text/plain', '__re_drag');
            try { e.dataTransfer?.setData('application/x-re-figure', '1'); } catch {}
            // Optional: ghost image smaller
            try { e.dataTransfer?.setDragImage(fig, fig.clientWidth/2, fig.clientHeight/2); } catch {}
          }
        }}
        onDragOver={(e) => {
          // Permite mover figura ou soltar arquivos de imagem
          const isInternal = dragFigRef.current || e.dataTransfer?.types?.includes('application/x-re-figure');
          if (isInternal || e.dataTransfer?.types?.includes('Files')) {
            e.preventDefault();
          }
        }}
        onDrop={async (e) => {
          const internalDrag = !!dragFigRef.current || e.dataTransfer?.getData('application/x-re-figure') === '1' || e.dataTransfer?.getData('text/plain') === '__re_drag';
          if (internalDrag) {
            // move figura existente primeiro, não tratar como upload
            e.preventDefault();
            let range: Range | null = null;
            if ((document as any).caretRangeFromPoint) {
              range = (document as any).caretRangeFromPoint(e.clientX, e.clientY);
            } else if ((document as any).caretPositionFromPoint) {
              const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
              if (pos) {
                range = document.createRange();
                range.setStart(pos.offsetNode, Math.min(pos.offset, (pos.offsetNode as any)?.length ?? pos.offset));
                range.collapse(true);
              }
            }
            const fig = dragFigRef.current;
            dragFigRef.current = null;
            if (range && fig && ref.current && ref.current.contains(range.startContainer)) {
              const sel = window.getSelection();
              if (sel) { sel.removeAllRanges(); sel.addRange(range); }
              try {
                fig.remove();
                range.insertNode(fig);
                const p = document.createElement('p'); p.innerHTML = '<br/>';
                fig.after(p);
              } catch {}
              onChange(ref.current?.innerHTML ?? '');
            }
            return;
          }

          const hasFiles = !!e.dataTransfer && Array.from(e.dataTransfer.files || []).some((f) => f.type.startsWith('image/'));
          if (hasFiles) {
            if (!e.dataTransfer) return;
            const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
            if (files.length > 0) {
              e.preventDefault();
              // Posiciona o cursor onde o usuário soltou o arquivo
              let range: Range | null = null;
              if ((document as any).caretRangeFromPoint) {
                range = (document as any).caretRangeFromPoint(e.clientX, e.clientY);
              } else if ((document as any).caretPositionFromPoint) {
                const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
                if (pos && ref.current) {
                  range = document.createRange();
                  range.setStart(pos.offsetNode, Math.min(pos.offset, (pos.offsetNode as any)?.length ?? pos.offset));
                  range.collapse(true);
                }
              }
              if (range) {
                const sel = window.getSelection();
                if (sel) { sel.removeAllRanges(); sel.addRange(range); savedRangeRef.current = range.cloneRange(); }
              } else {
                saveSelection();
              }
              for (const f of files) {
                await handleInsertImage(f);
              }
            }
            return;
          }
          // Caso contrário, trata mover figura existente
          if (!dragFigRef.current) return;
          e.preventDefault();
          let range: Range | null = null;
          if ((document as any).caretRangeFromPoint) {
            range = (document as any).caretRangeFromPoint(e.clientX, e.clientY);
          } else if ((document as any).caretPositionFromPoint) {
            const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
            if (pos) {
              range = document.createRange();
              range.setStart(pos.offsetNode, Math.min(pos.offset, (pos.offsetNode as any)?.length ?? pos.offset));
              range.collapse(true);
            }
          }
          const fig = dragFigRef.current;
          dragFigRef.current = null;
          if (range && fig && ref.current && ref.current.contains(range.startContainer)) {
            const sel = window.getSelection();
            if (sel) { sel.removeAllRanges(); sel.addRange(range); }
            try {
              fig.remove();
              range.insertNode(fig);
              const p = document.createElement('p'); p.innerHTML = '<br/>';
              fig.after(p);
            } catch {}
            onChange(ref.current?.innerHTML ?? '');
          }
        }}
        onPaste={async (e) => {
          const items = e.clipboardData?.items;
          if (!items) return;

          // 1) If pasting images, keep the existing image-upload behavior.
          const images: File[] = [];
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it.kind === 'file') {
              const f = it.getAsFile();
              if (f && f.type.startsWith('image/')) images.push(f);
            }
          }
          if (images.length > 0) {
            e.preventDefault();
            saveSelection();
            for (const img of images) {
              await handleInsertImage(img);
            }
            return;
          }

          // 2) Otherwise, standardize pasted text so chapters keep consistent typography.
          const html = e.clipboardData?.getData('text/html') || '';
          const text = e.clipboardData?.getData('text/plain') || '';
          if (!html && !text) return;

          e.preventDefault();
          saveSelection();
          restoreSelection();

          if (html) {
            const sanitized = sanitizePastedHtml(html);
            if (sanitized) {
              try { document.execCommand('insertHTML', false, sanitized); } catch {}
              onInput();
              return;
            }
          }

          // Fallback: paste as clean paragraphs.
          const normalized = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          const parts = normalized.split(/\n{2,}/g).map((p) => p.replace(/\n/g, '<br/>'));
          const safe = parts.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
          try { document.execCommand('insertHTML', false, safe); } catch {}
          onInput();
        }}
        
        className={`min-h-[360px] lg:min-h-[520px] p-4 rounded-md border ${focused ? 'border-primary' : 'border-gray-200'} bg-white dark:bg-gray-800 text-muted-foreground text-base leading-relaxed ${isCroppingAction ? 'select-none' : ''}`} 
        data-placeholder={placeholder}
        data-testid="rich-editor-content"
        style={{ outline: 'none' }}
      />

      <style>{`
        .rich-editor [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        .rich-editor img { max-width: 100%; height: auto; display: block; margin: 0.75rem auto; border-radius: 0.25rem; }
        .rich-editor figure.re-figure { margin: 0.75rem auto; }
        .rich-editor figure.re-figure.align-left { float: left; margin: 0.5rem 1rem 0.5rem 0; }
        .rich-editor figure.re-figure.align-right { float: right; margin: 0.5rem 0 0.5rem 1rem; }
        .rich-editor figure.re-figure.align-center { margin-left: auto; margin-right: auto; }
        .rich-editor figure.re-figure img.selected { outline: 2px solid var(--primary); outline-offset: 2px; }
        .rich-editor .re-caption { user-select: text; }
        .rich-editor a { color: var(--primary); text-decoration: underline; }
        .rich-editor [contenteditable] { color: var(--muted-foreground); }
        .rich-editor [contenteditable] strong, .rich-editor [contenteditable] b { color: var(--foreground); }
        .rich-editor [contenteditable] em, .rich-editor [contenteditable] i { font-style: italic; }
        .rich-editor [contenteditable] h1, .rich-editor [contenteditable] h2, .rich-editor [contenteditable] h3, .rich-editor [contenteditable] h4, .rich-editor [contenteditable] h5, .rich-editor [contenteditable] h6 { font-size: 1em; margin: 0 0 1em 0; }
        .rich-editor hr { border: none; border-top: 1px solid var(--border); margin: 1rem 0; }
        .rich-editor .re-resize-handle { position: absolute; width: 12px; height: 12px; background: var(--primary); border-radius: 2px; box-shadow: 0 0 0 2px rgba(0,0,0,0.2); z-index: 1000; }
        .rich-editor .re-delete-btn { position: absolute; width: 22px; height: 22px; background: #ef4444; color: #fff; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: bold; box-shadow: 0 0 0 2px rgba(0,0,0,0.2); cursor: pointer; z-index: 1000; }
        .rich-editor .re-crop-btn { position: absolute; height: 22px; padding: 0 8px; background: #2563eb; color: #fff; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: 600; box-shadow: 0 0 0 2px rgba(0,0,0,0.2); cursor: pointer; z-index: 1000; }
        .rich-editor .re-apply-btn { position: absolute; height: 22px; padding: 0 8px; background: #16a34a; color: #fff; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: 600; box-shadow: 0 0 0 2px rgba(0,0,0,0.2); cursor: pointer; z-index: 1000; }
        .select-none { user-select: none; -webkit-user-select: none; }
      `}</style>

      {selectedImg && (
        <div className="mt-2 p-2 rounded-md border bg-muted/30 text-sm flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground">Imagem selecionada</span>
          <label className="flex items-center gap-2">Largura
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={Math.round(parseFloat((selectedImg.style.width || '100%').replace('%','')) || 100)}
              onChange={(e) => {
                const v = Number(e.target.value);
                selectedImg.style.width = `${v}%`;
                onChange(ref.current?.innerHTML ?? '');
              }}
            />
          </label>
          <div className="flex items-center gap-1">
            <button type="button" className="px-2 py-1 rounded border" onClick={() => {
              const fig = selectedImg.closest('figure.re-figure');
              if (fig) { fig.classList.remove('align-center','align-right'); fig.classList.add('align-left'); }
              onChange(ref.current?.innerHTML ?? '');
            }}>Esq</button>
            <button type="button" className="px-2 py-1 rounded border" onClick={() => {
              const fig = selectedImg.closest('figure.re-figure');
              if (fig) { fig.classList.remove('align-left','align-right'); fig.classList.add('align-center'); }
              onChange(ref.current?.innerHTML ?? '');
            }}>Centro</button>
            <button type="button" className="px-2 py-1 rounded border" onClick={() => {
              const fig = selectedImg.closest('figure.re-figure');
              if (fig) { fig.classList.remove('align-left','align-center'); fig.classList.add('align-right'); }
              onChange(ref.current?.innerHTML ?? '');
            }}>Dir</button>
          </div>
          <button type="button" className="px-2 py-1 rounded border" onClick={() => {
            // Alterna legenda
            const fig = selectedImg.closest('figure.re-figure');
            if (fig) {
              const cap = fig.querySelector('figcaption');
              if (cap) {
                (cap as HTMLElement).style.display = (cap as HTMLElement).style.display === 'none' ? '' : 'none';
                onChange(ref.current?.innerHTML ?? '');
              }
            }
          }}>Legenda</button>
          <button type="button" className="px-2 py-1 rounded border" onClick={() => {
            // Ajuste rápido: Pequena / Média / Grande
            selectedImg.style.width = '40%'; onChange(ref.current?.innerHTML ?? '');
          }}>Pequena</button>
          <button type="button" className="px-2 py-1 rounded border" onClick={() => { selectedImg.style.width = '60%'; onChange(ref.current?.innerHTML ?? ''); }}>Média</button>
          <button type="button" className="px-2 py-1 rounded border" onClick={() => { selectedImg.style.width = '100%'; onChange(ref.current?.innerHTML ?? ''); }}>Grande</button>
        </div>
      )}

      {/* Delete button + 8 resize handles (corners + sides) */}
      {selectedImg && overlayRect && (
        <>
          <div
            className="re-delete-btn"
            style={{ left: overlayRect.left + overlayRect.width - 11, top: overlayRect.top - 11 }}
            title="Remover imagem"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={(e) => {
              e.preventDefault(); e.stopPropagation();
              const fig = selectedImg.closest('figure.re-figure');
              if (fig) {
                fig.remove();
                setSelectedImg(null);
                setOverlayRect(null);
                onChange(ref.current?.innerHTML ?? '');
              }
            }}
          >×</div>

          {/* Crop toggle button (blue) next to delete */}
          <div
            className="re-crop-btn"
            style={{ left: overlayRect.left + overlayRect.width - 11 - 56, top: overlayRect.top - 11 }}
            title={cropMode ? 'Sair do modo cortar (Esc)' : 'Cortar imagem'}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={(e) => { 
              e.preventDefault(); e.stopPropagation(); 
              setCropMode((m) => {
                const next = !m; 
                if (next) {
                  const init = makeInitialCrop();
                  if (init) setCropRect(init); else setCropRect(null);
                } else {
                  setCropRect(null);
                }
                setCropStart(null); 
                return next; 
              }); 
            }}
          >{cropMode ? 'Corte ON' : 'Cortar'}</div>

          {/* Apply button appears in crop mode */}
          {cropMode && (
            <>
              <div
                className="re-apply-btn"
                style={{ left: overlayRect.left + overlayRect.width - 11 - 56 - 66, top: overlayRect.top - 11 }}
                title="Aplicar corte (Enter)"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); performCrop(); }}
              >Aplicar</div>
              <div
                className="re-crop-btn"
                style={{ left: overlayRect.left + overlayRect.width - 11 - 56 - 66 - 72, top: overlayRect.top - 11 }}
                title="Cancelar corte (Esc)"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCropMode(false); setCropRect(null); setCropStart(null); }}
              >Cancelar</div>
            </>
          )}

          {(() => {
            if (cropMode) return null; // desativa handles durante o corte
            const startResize = (e: React.MouseEvent, orientation: 'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw') => {
              e.preventDefault(); e.stopPropagation();
              const rect = selectedImg!.getBoundingClientRect();
              const containerW = wrapperRef.current!.getBoundingClientRect().width;
              resizingRef.current = { startX: e.clientX, startY: e.clientY, startWpx: rect.width, startHpx: rect.height, orientation, aspect: rect.width/rect.height, containerW };
              const onMove = (ev: MouseEvent) => {
                if (!resizingRef.current || !selectedImg) return;
                const st = resizingRef.current;
                let newW = st.startWpx;
                if (st.orientation === 'e' || st.orientation === 'ne' || st.orientation === 'se') {
                  const dx = ev.clientX - st.startX; newW = st.startWpx + dx;
                } else if (st.orientation === 'w' || st.orientation === 'nw' || st.orientation === 'sw') {
                  const dx = ev.clientX - st.startX; newW = st.startWpx - dx;
                } else if (st.orientation === 'n' || st.orientation === 's') {
                  const dy = ev.clientY - st.startY; const newH = st.orientation === 'n' ? (st.startHpx - dy) : (st.startHpx + dy); newW = newH * st.aspect;
                }
                newW = Math.max(40, newW);
                const pct = Math.min(100, Math.max(20, (newW / st.containerW) * 100));
                selectedImg.style.width = pct.toFixed(0) + '%';
                onChange(ref.current?.innerHTML ?? '');
                updateOverlayRect();
              };
              const onUp = () => { resizingRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            };

            return (
              <>
                <div className="re-resize-handle" style={{ left: overlayRect.left - 6, top: overlayRect.top - 6, cursor: 'nwse-resize' }} onMouseDown={(e) => startResize(e, 'nw')} />
                <div className="re-resize-handle" style={{ left: overlayRect.left + overlayRect.width/2 - 6, top: overlayRect.top - 6, cursor: 'ns-resize' }} onMouseDown={(e) => startResize(e, 'n')} />
                <div className="re-resize-handle" style={{ left: overlayRect.left + overlayRect.width - 6, top: overlayRect.top - 6, cursor: 'nesw-resize' }} onMouseDown={(e) => startResize(e, 'ne')} />
                <div className="re-resize-handle" style={{ left: overlayRect.left - 6, top: overlayRect.top + overlayRect.height/2 - 6, cursor: 'ew-resize' }} onMouseDown={(e) => startResize(e, 'w')} />
                <div className="re-resize-handle" style={{ left: overlayRect.left + overlayRect.width - 6, top: overlayRect.top + overlayRect.height/2 - 6, cursor: 'ew-resize' }} onMouseDown={(e) => startResize(e, 'e')} />
                <div className="re-resize-handle" style={{ left: overlayRect.left - 6, top: overlayRect.top + overlayRect.height - 6, cursor: 'nesw-resize' }} onMouseDown={(e) => startResize(e, 'sw')} />
                <div className="re-resize-handle" style={{ left: overlayRect.left + overlayRect.width/2 - 6, top: overlayRect.top + overlayRect.height - 6, cursor: 'ns-resize' }} onMouseDown={(e) => startResize(e, 's')} />
                <div className="re-resize-handle" style={{ left: overlayRect.left + overlayRect.width - 6, top: overlayRect.top + overlayRect.height - 6, cursor: 'nwse-resize' }} onMouseDown={(e) => startResize(e, 'se')} />
              </>
            );
          })()}
        </>
      )}

      {cropMode && cropRect && selectedImg && (
        <>
          {/* Shaded mask around crop rect within image bounds */}
          {(() => {
            if (!wrapperRef.current) return null;
            const wrap = wrapperRef.current.getBoundingClientRect();
            const img = selectedImg.getBoundingClientRect();
            const imgLeft = img.left - wrap.left;
            const imgTop = img.top - wrap.top;
            const imgW = img.width; const imgH = img.height;
            const regions = [
              // top
              { left: imgLeft, top: imgTop, width: imgW, height: Math.max(0, cropRect.y - imgTop) },
              // left
              { left: imgLeft, top: cropRect.y, width: Math.max(0, cropRect.x - imgLeft), height: cropRect.h },
              // right
              { left: cropRect.x + cropRect.w, top: cropRect.y, width: Math.max(0, (imgLeft + imgW) - (cropRect.x + cropRect.w)), height: cropRect.h },
              // bottom
              { left: imgLeft, top: cropRect.y + cropRect.h, width: imgW, height: Math.max(0, (imgTop + imgH) - (cropRect.y + cropRect.h)) },
            ];
            return (
              <>
                {regions.map((r, i) => (
                  <div key={i} className="absolute bg-black/40 z-40" style={{ left: r.left, top: r.top, width: r.width, height: r.height }} />
                ))}
              </>
            );
          })()}

          <div
            className="absolute border-2 border-blue-500 bg-blue-500/20 z-50"
            data-crop-rect="1"
            style={{ left: cropRect.x, top: cropRect.y, width: cropRect.w, height: cropRect.h }}
            onMouseDown={(e) => {
              if (!cropMode || !cropRect) return;
              e.preventDefault(); e.stopPropagation();
              setIsCroppingAction(true);
              cropActionRef.current = { mode: 'move', startX: e.clientX - wrapperRef.current!.getBoundingClientRect().left, startY: e.clientY - wrapperRef.current!.getBoundingClientRect().top, startRect: { ...cropRect } };
              startGlobalCropListeners();
            }}
          />
          {/* HUD with pixel size */}
          {(() => {
            if (!wrapperRef.current) return null;
            const img = selectedImg.getBoundingClientRect();
            const displayW = img.width; const displayH = img.height;
            const naturalW = selectedImg.naturalWidth || displayW;
            const naturalH = selectedImg.naturalHeight || displayH;
            const scaleX = naturalW / displayW;
            const scaleY = naturalH / displayH;
            const pxW = Math.max(1, Math.round(cropRect.w * scaleX));
            const pxH = Math.max(1, Math.round(cropRect.h * scaleY));
            return (
              <div className="absolute z-50 text-xs px-2 py-1 rounded bg-blue-600 text-white" style={{ left: cropRect.x, top: Math.max(0, cropRect.y - 22) }}>
                {pxW}×{pxH}{aspect !== 'free' ? ` • ${aspect}` : ''}
              </div>
            );
          })()}

          {['nw','n','ne','e','se','s','sw','w'].map(handle => {
            const size = 12;
            const half = size/2;
            const pos:any = {};
            if (handle.includes('n')) pos.top = cropRect.y - half;
            if (handle.includes('s')) pos.top = cropRect.y + cropRect.h - half;
            if (!handle.includes('n') && !handle.includes('s')) pos.top = cropRect.y + cropRect.h/2 - half;
            if (handle.includes('w')) pos.left = cropRect.x - half;
            if (handle.includes('e')) pos.left = cropRect.x + cropRect.w - half;
            if (!handle.includes('w') && !handle.includes('e')) pos.left = cropRect.x + cropRect.w/2 - half;
            let cursor = 'nwse-resize';
            if (handle === 'n' || handle === 's') cursor = 'ns-resize';
            if (handle === 'e' || handle === 'w') cursor = 'ew-resize';
            if (handle === 'ne' || handle === 'sw') cursor = 'nesw-resize';
            if (handle === 'nw' || handle === 'se') cursor = 'nwse-resize';
            return (
              <div
                key={handle}
                data-crop-handle="1"
                className="absolute z-50 bg-white border border-blue-600 rounded-full"
                style={{ width: size, height: size, ...pos, cursor, boxShadow: '0 0 0 2px rgba(0,0,0,0.2)' }}
                onMouseDown={(e) => {
                  if (!cropMode || !cropRect) return;
                  e.preventDefault(); e.stopPropagation();
                  setIsCroppingAction(true);
                  cropActionRef.current = { mode: 'resize', handle: handle as any, startX: e.clientX - wrapperRef.current!.getBoundingClientRect().left, startY: e.clientY - wrapperRef.current!.getBoundingClientRect().top, startRect: { ...cropRect } };
                  startGlobalCropListeners();
                }}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
