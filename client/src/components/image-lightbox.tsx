import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

type OpenFn = (src: string, alt?: string, originEl?: HTMLElement | null) => void;

const ImageLightboxContext = createContext<{ open: OpenFn; close: () => void }>({
  open: () => {},
  close: () => {},
});

export const ImageLightboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [alt, setAlt] = useState<string | undefined>(undefined);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const galleryRef = useRef<string[]>([]);
  const currentIndexRef = useRef<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  // Zoom & pan state
  const [scale, setScale] = useState<number>(1);
  const [tx, setTx] = useState<number>(0);
  const [ty, setTy] = useState<number>(0);
  const draggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [fillView, setFillView] = useState<boolean>(false);

  const clampScale = (s: number) => Math.min(4, Math.max(1, s));
  const resetZoom = () => { setScale(1); setTx(0); setTy(0); };

  const open: OpenFn = (s, a, originEl) => {
    try { lastFocusRef.current = document.activeElement as HTMLElement | null; } catch {}
    try { console.debug('[ImageLightbox] open called', { src: s, alt: a, originEl }); } catch {}

    // find container and build gallery
    let container: HTMLElement | null = null;
    if (originEl) container = originEl.closest('article, .prose, .card, .content, main, .rich-editor') as HTMLElement | null;
    if (!container) {
      try {
        const found = document.querySelector(`img[src="${CSS.escape(s)}"]`) as HTMLElement | null;
        if (found) container = found.closest('article, .prose, .card, .content, main, .rich-editor') as HTMLElement | null;
      } catch { container = null; }
    }

    const imgs: string[] = [];
    let index = 0;
    if (container) {
      const list = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
      for (let i = 0; i < list.length; i++) {
        const u = list[i].src;
        imgs.push(u);
        if (u === s) index = imgs.length - 1;
      }
    }

    galleryRef.current = imgs;
    try { console.debug('[ImageLightbox] gallery built', { imgs, index }); } catch {}
    currentIndexRef.current = index;
    setCurrentIndex(index);

    setSrc(s);
    setAlt(a);
    setIsOpen(true);
    try { document.body.style.overflow = 'hidden'; } catch {}
    resetZoom();
    setFillView(false);
  };

  const close = () => {
    setIsOpen(false);
    setSrc(null);
    setAlt(undefined);
    try { document.body.style.overflow = ''; } catch {}
    try {
      const prev = lastFocusRef.current;
      if (prev && typeof prev.focus === 'function') prev.focus();
    } catch {}
  };

  const go = (idx: number) => {
    const g = galleryRef.current;
    if (!g || g.length === 0) return;
    const n = (idx + g.length) % g.length;
    currentIndexRef.current = n;
    setCurrentIndex(n);
    setSrc(g[n]);
    resetZoom();
    setFillView(false);
  };

  const next = () => go(currentIndexRef.current + 1);
  const prev = () => go(currentIndexRef.current - 1);

  useEffect(() => {
    if (isOpen) {
      // focus the close button for accessibility
      setTimeout(() => {
        try { closeBtnRef.current?.focus(); } catch {}
      }, 0);
    }
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  useEffect(() => {
    (window as any).__openImageLightbox = (s: string, a?: string, el?: HTMLElement | null) => { try { console.debug('[ImageLightbox] global helper called', { s, a, el }); } catch {} ; return open(s, a, el ?? null); };
    return () => { try { delete (window as any).__openImageLightbox; } catch {} };
  }, []);

  return (
    <ImageLightboxContext.Provider value={{ open, close }}>
      {children}
      {isOpen && src && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          onClick={close}
        >
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md transition-opacity" />
          <div className="relative max-w-[92vw] max-h-[86vh] z-10 flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-center relative">
              <button aria-label="Imagem anterior" onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-2 z-20 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 border border-white/10">
                ‹
              </button>

              <div className="relative flex items-center justify-center">
                <button
                  ref={closeBtnRef}
                  aria-label="Fechar imagem"
                  className="absolute -top-6 -right-6 bg-black/80 text-white rounded-full w-10 h-10 flex items-center justify-center z-30 hover:bg-black/90 shadow-lg border border-white/10"
                  onClick={close}
                >
                  ×
                </button>
                <button
                  aria-label={fillView ? 'Sair de tela cheia' : 'Ver em tela cheia'}
                  className="absolute -top-6 right-6 bg-black/70 text-white rounded-full w-10 h-10 flex items-center justify-center z-30 hover:bg-black/90 shadow-lg border border-white/10"
                  onClick={() => { setFillView(v => !v); resetZoom(); }}
                  title={fillView ? 'Sair de tela cheia' : 'Tela cheia'}
                >
                  {fillView ? '⤣' : '⤢'}
                </button>
                <div
                  className="group relative rounded-xl shadow-2xl bg-black/20 backdrop-blur-sm border border-white/10 overflow-hidden"
                  onWheel={(e) => {
                    if (!isOpen || fillView) return;
                    e.preventDefault();
                    const delta = e.deltaY;
                    setScale(s => clampScale(s * (delta > 0 ? 0.9 : 1.1)));
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    if (fillView) return;
                    setScale(s => s === 1 ? 2 : 1);
                    if (scale !== 1) { setTx(0); setTy(0); }
                  }}
                  onPointerDown={(e) => {
                    if (scale === 1 || fillView) return;
                    draggingRef.current = true;
                    dragStartRef.current = { x: e.clientX, y: e.clientY, tx, ty };
                  }}
                  onPointerMove={(e) => {
                    if (!draggingRef.current || scale === 1 || !dragStartRef.current) return;
                    const { x, y, tx: stx, ty: sty } = dragStartRef.current;
                    const dx = e.clientX - x;
                    const dy = e.clientY - y;
                    setTx(stx + dx);
                    setTy(sty + dy);
                  }}
                  onPointerUp={() => { draggingRef.current = false; dragStartRef.current = null; }}
                  onPointerLeave={() => { draggingRef.current = false; dragStartRef.current = null; }}
                  aria-label="Visualização de imagem com suporte a zoom (scroll, duplo clique, arrastar)"
                >
                  <img
                    src={src}
                    alt={alt ?? ''}
                    draggable={false}
                    className={`select-none object-contain transition-all duration-300 ease-out ${fillView ? 'max-w-[96vw] max-h-[90vh]' : 'max-w-[82vw] max-h-[68vh]'} `}
                    style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
                  />
                  {scale > 1 && !fillView && (
                    <div className="absolute bottom-2 right-3 text-xs text-white/80 bg-black/50 px-2 py-1 rounded-md pointer-events-none">
                      Arraste para mover • Duplo clique para reset
                    </div>
                  )}
                </div>
              </div>

              <button aria-label="Próxima imagem" onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-2 z-20 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 border border-white/10">
                ›
              </button>
            </div>

            {/* Thumbnails carousel (show even if there's only one image) */}
            {galleryRef.current && galleryRef.current.length >= 1 && (
              <div className="mt-6 w-full overflow-x-auto px-6">
                <div className="flex gap-2 items-center justify-center w-max mx-auto bg-black/25 backdrop-blur-sm px-3 py-2 rounded-xl border border-white/10 shadow-inner">
                  {galleryRef.current.map((u, i) => (
                    <button
                      key={u + i}
                      onClick={(e) => { e.stopPropagation(); go(i); }}
                      className={`flex-none rounded-md overflow-hidden ring-2 ${i === currentIndex ? 'ring-white/90' : 'ring-transparent'} focus:outline-none transition duration-200`}
                      aria-label={`Ver imagem ${i + 1}`}
                    >
                      <img src={u} alt={`thumb-${i}`} className={`${i === currentIndex ? 'opacity-100' : 'opacity-60 hover:opacity-90'} h-12 w-auto block`} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ImageLightboxContext.Provider>
  );
};

export function useImageLightbox() {
  return useContext(ImageLightboxContext);
}

export default ImageLightboxContext;
