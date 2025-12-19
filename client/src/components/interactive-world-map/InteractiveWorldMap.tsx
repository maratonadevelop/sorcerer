import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';

// Render a handcrafted SVG map with named continents.
export default function InteractiveWorldMap() {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number; visible: boolean }>({ text: '', x: 0, y: 0, visible: false });
  const { isAdmin } = useAuth();
  const canEditMasks = isAdmin;
  const [active, setActive] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const [editMasksMode, setEditMasksMode] = useState(false);

  const [preview, setPreview] = useState<{ open: boolean; id?: string; title?: string; summary?: string; image?: string; x?: number; y?: number }>({ open: false });
  const [previewVisible, setPreviewVisible] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth <= 640 : false);

  
  // vertex dragging
  const vertexDragRef = useRef<{ maskId: string; vertexIndex: number } | null>(null);

  type Point = { xPct: number; yPct: number };
  type Mask = { id: string; name: string; points: Point[] };
  const [masks, setMasks] = useState<Record<string, Mask>>(() => {
    try { const raw = localStorage.getItem('map-masks'); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  const [selectedMask, setSelectedMask] = useState<string | null>(null);
  const [maskEditAction, setMaskEditAction] = useState<'move' | 'add' | 'delete'>('move');
  const [selectedVertex, setSelectedVertex] = useState<{ maskId: string; idx: number } | null>(null);
  const [multiAddMode, setMultiAddMode] = useState(false);
  const [tempAddPoints, setTempAddPoints] = useState<Point[]>([]);

  useEffect(() => {
    if (!canEditMasks && editMasksMode) {
      setEditMasksMode(false);
      setSelectedMask(null);
      setSelectedVertex(null);
      setTempAddPoints([]);
      setMultiAddMode(false);
    }
  }, [canEditMasks, editMasksMode]);

  const onEnter = (name: string) => (e: React.MouseEvent) => {
    setActive(name);
    setTooltip({ text: name, x: e.clientX + 12, y: e.clientY + 12, visible: true });
  };
  const onMove = (e: React.MouseEvent) => setTooltip(t => ({ ...t, x: e.clientX + 12, y: e.clientY + 12 }));
  const onLeave = () => { setActive(null); setTooltip(t => ({ ...t, visible: false })); };

  const startDragOverlay = (e: React.PointerEvent, id: string) => {
  // overlay drag removed - function kept as noop in case called elsewhere
  return;
  };

  // mask vertex handlers
  const startDragVertex = (e: React.PointerEvent, maskId: string, idx: number) => {
    if (!canEditMasks || !editMasksMode) return;
    e.preventDefault();
    vertexDragRef.current = { maskId, vertexIndex: idx };
    setSelectedVertex({ maskId, idx });

    // attach window-level listeners so dragging continues even if pointer leaves the circle
    const onMove = (ev: PointerEvent) => {
      // reuse move logic
      const mapEl = document.querySelector('.interactive-svg-wrapper') as HTMLElement | null;
      if (!mapEl || !vertexDragRef.current) return;
      const bounds = (mapEl.querySelector('svg') as SVGSVGElement).getBoundingClientRect();
      const x = ev.clientX - bounds.left;
      const y = ev.clientY - bounds.top;
      const xPct = Math.max(0, Math.min(100, (x / bounds.width) * 100));
      const yPct = Math.max(0, Math.min(100, (y / bounds.height) * 100));
      const { maskId: mId, vertexIndex } = vertexDragRef.current;
      setMasks(prev => {
        const m = prev[mId];
        if (!m) return prev;
        const newPoints = m.points.map((p, i) => i === vertexIndex ? { xPct, yPct } : p);
        return { ...prev, [mId]: { ...m, points: newPoints } };
      });
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      vertexDragRef.current = null;
      setSelectedVertex(null);
      try { localStorage.setItem('map-masks', JSON.stringify(masks)); } catch {}
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // moveVertex/endDrag handled by window listeners attached in startDragVertex; keep no-op functions for event props
  const moveVertex = (_e: React.PointerEvent) => { /* noop, window handles movement */ };
  const endDragVertex = (_e: React.PointerEvent) => { /* noop, window handles up */ };

  // helpers: coordinate conversions and geometry
  const clientToPct = (clientX: number, clientY: number) => {
    const mapEl = document.querySelector('.interactive-svg-wrapper') as HTMLElement | null;
    if (!mapEl) return null;
    const svg = mapEl.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return null;
    const bounds = svg.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    return { xPct: Math.max(0, Math.min(100, (x / bounds.width) * 100)), yPct: Math.max(0, Math.min(100, (y / bounds.height) * 100)), pxX: x, pxY: y, svgW: bounds.width, svgH: bounds.height };
  };

  const pctToSvg = (p: Point) => ({ x: (p.xPct / 100) * 1000, y: (p.yPct / 100) * 600 });

  const distPointToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    const dx = px - xx; const dy = py - yy; return Math.sqrt(dx * dx + dy * dy);
  };

  const centroidOf = (pts: Point[]) => {
    if (!pts || pts.length === 0) return { x: 0, y: 0 };
    const sum = pts.reduce((acc, p) => ({ x: acc.x + (p.xPct / 100) * 1000, y: acc.y + (p.yPct / 100) * 600 }), { x: 0, y: 0 });
    return { x: sum.x / pts.length, y: sum.y / pts.length };
  };

  const themeColorForName = (name: string) => {
    const n = (name || '').toLowerCase();
    if (n.includes('luminah')) return '#ffb84d'; // orange/gold
    if (n.includes('silvanum')) return '#29a745'; // green
    if (n.includes('aquario')) return '#4da6ff'; // light blue
    if (n.includes('akeli')) return '#1f7fbf'; // akeli blue
    if (n.includes('ferros')) return '#9aa0a6'; // steel gray
    return '#ffd77a';
  };

  // add vertex at nearest segment of currently selected mask
  const addVertexAtClient = (clientX: number, clientY: number) => {
    if (!canEditMasks) return;
    if (!selectedMask) return;
    const coords = clientToPct(clientX, clientY);
    if (!coords) return;
    const mask = masks[selectedMask];
    if (!mask) return;
    const ptPx = { x: coords.pxX * (1000 / coords.svgW), y: coords.pxY * (600 / coords.svgH) };
    let bestIdx = 0; let bestDist = Infinity;
    for (let i = 0; i < mask.points.length; i++) {
      const j = (i + 1) % mask.points.length;
      const p1 = pctToSvg(mask.points[i]);
      const p2 = pctToSvg(mask.points[j]);
      const d = distPointToSegment(ptPx.x, ptPx.y, p1.x, p1.y, p2.x, p2.y);
      if (d < bestDist) { bestDist = d; bestIdx = j; }
    }
    // insert before bestIdx
    const newPt: Point = { xPct: coords.xPct, yPct: coords.yPct };
    setMasks(prev => {
      const cur = prev[selectedMask]; if (!cur) return prev;
      const pts = [...cur.points.slice(0, bestIdx), newPt, ...cur.points.slice(bestIdx)];
      const next = { ...prev, [selectedMask]: { ...cur, points: pts } };
      try { localStorage.setItem('map-masks', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const deleteNearestVertexAtClient = (clientX: number, clientY: number) => {
    if (!canEditMasks) return;
    if (!selectedMask) return;
    const coords = clientToPct(clientX, clientY);
    if (!coords) return;
    const mask = masks[selectedMask]; if (!mask) return;
    const ptPx = { x: coords.pxX * (1000 / coords.svgW), y: coords.pxY * (600 / coords.svgH) };
    let bestIdx = -1; let bestDist = Infinity;
    for (let i = 0; i < mask.points.length; i++) {
      const p = pctToSvg(mask.points[i]);
      const dx = p.x - ptPx.x; const dy = p.y - ptPx.y; const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    // if within 18px, remove
    if (bestIdx >= 0 && bestDist < 18) {
      setMasks(prev => {
        const cur = prev[selectedMask]; if (!cur) return prev;
        if (cur.points.length <= 3) return prev; // keep min 3
        const pts = cur.points.filter((_, i) => i !== bestIdx);
        const next = { ...prev, [selectedMask]: { ...cur, points: pts } };
        try { localStorage.setItem('map-masks', JSON.stringify(next)); } catch {}
        return next;
      });
    }
  };

  const onSvgClick = (e: React.MouseEvent) => {
    // If not editing masks, clicking the background should reset any camera zoom
    if (!canEditMasks || !editMasksMode) {
      resetZoom();
      return;
    }
    if (!selectedMask) return;
    if (maskEditAction === 'add') {
      if (multiAddMode) {
        // accumulate preview points
        const coords = clientToPct(e.clientX, e.clientY);
        if (!coords) return;
        setTempAddPoints(list => [...list, { xPct: coords.xPct, yPct: coords.yPct }]);
      } else {
        addVertexAtClient(e.clientX, e.clientY);
      }
    } else if (maskEditAction === 'delete') {
      deleteNearestVertexAtClient(e.clientX, e.clientY);
    }
  };

  const commitMultiAdd = () => {
    if (!canEditMasks) return;
    if (!selectedMask || tempAddPoints.length === 0) return;
    // insert each temp point into mask at nearest segment, updating mask sequentially
    setMasks(prev => {
      const cur = prev[selectedMask]; if (!cur) return prev;
      let pts = [...cur.points];
      for (const tp of tempAddPoints) {
        // compute point in svg px for distance
        const tpSvg = { x: (tp.xPct / 100) * 1000, y: (tp.yPct / 100) * 600 };
        let bestIdx = 0; let bestDist = Infinity;
        for (let i = 0; i < pts.length; i++) {
          const j = (i + 1) % pts.length;
          const p1 = pctToSvg(pts[i]); const p2 = pctToSvg(pts[j]);
          const d = distPointToSegment(tpSvg.x, tpSvg.y, p1.x, p1.y, p2.x, p2.y);
          if (d < bestDist) { bestDist = d; bestIdx = j; }
        }
        // insert at bestIdx
        pts = [...pts.slice(0, bestIdx), { xPct: tp.xPct, yPct: tp.yPct }, ...pts.slice(bestIdx)];
      }
      const next = { ...prev, [selectedMask]: { ...cur, points: pts } };
      try { localStorage.setItem('map-masks', JSON.stringify(next)); } catch {}
      return next;
    });
    setTempAddPoints([]);
    setMultiAddMode(false);
  };

  const cancelMultiAdd = () => { setTempAddPoints([]); setMultiAddMode(false); };

  // backup / export helpers
  const [saving, setSaving] = useState(false);
  // keep a ref to masks so external event handlers can resolve names without re-attaching listeners
  const masksRef = useRef<Record<string, Mask>>(masks);
  useEffect(() => { masksRef.current = masks; }, [masks]);

  // Listen for global continent hover events dispatched from other parts of the page
  useEffect(() => {
    const onHover = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent)?.detail || {};
        const slug = (detail?.slug || '').toString().toLowerCase();
        const x = Number(detail?.x) || 0;
        const y = Number(detail?.y) || 0;
        const found = Object.values(masksRef.current).find(m => (m.id === slug) || ((m.name || '').toLowerCase().includes(slug)));
        const name = found ? found.name : (detail?.name || slug || '');
        setActive(name || null);
        setTooltip({ text: name || '', x: x || (window.innerWidth / 2), y: y || 0, visible: true });
      } catch (err) {
        // ignore
      }
    };
    const onMoveEvent = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent)?.detail || {};
        const x = Number(detail?.x) || 0;
        const y = Number(detail?.y) || 0;
        setTooltip(t => ({ ...t, x: x || t.x, y: y || t.y }));
      } catch (err) {}
    };
    const onLeave = () => { setActive(null); setTooltip(t => ({ ...t, visible: false })); };

    window.addEventListener('continent-hover', onHover as EventListener);
    window.addEventListener('continent-move', onMoveEvent as EventListener);
    window.addEventListener('continent-leave', onLeave as EventListener);
    // external continent-click handled by separate effect (needs openPreview in scope)
    return () => {
      window.removeEventListener('continent-hover', onHover as EventListener);
      window.removeEventListener('continent-move', onMoveEvent as EventListener);
      window.removeEventListener('continent-leave', onLeave as EventListener);
    };
  }, []);

  // listen for external continent-click events and open preview (this effect runs after openPreview is defined)
  useEffect(() => {
    const handler = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent)?.detail || {};
        const slug = (detail?.slug || '').toString().toLowerCase();
        const found = Object.values(masksRef.current).find(m => (m.id === slug) || ((m.name || '').toLowerCase().includes(slug)));
        if (found) openPreview(found);
      } catch (err) {}
    };
    window.addEventListener('continent-click', handler as EventListener);
    return () => window.removeEventListener('continent-click', handler as EventListener);
  }, []);

  // zoom state and helpers
  const ZOOM_IN_DURATION = 900; // ms, zoom-in speed (kept)
  const ZOOM_OUT_DURATION = 1400; // ms, zoom-out slower for smooth return
  const ZOOM_HOLD = 3000; // ms the map remains zoomed before returning
  const [zoom, setZoom] = useState<{ scale: number; tx: number; ty: number }>({ scale: 1, tx: 0, ty: 0 });
  const zoomTimeout = useRef<number | null>(null);
  const resetZoom = (animated = true) => {
    if (zoomTimeout.current) { window.clearTimeout(zoomTimeout.current); zoomTimeout.current = null; }
    setZoom({ scale: 1, tx: 0, ty: 0 });
  };

  const zoomToMask = (mask: Mask, scale = 1.18) => {
    try {
      const svgEl = document.querySelector('.interactive-svg-wrapper svg') as SVGSVGElement | null;
      if (!svgEl) return;
      const bounds = svgEl.getBoundingClientRect();
      const centroid = centroidOf(mask.points); // returns SVG units (0..1000, 0..600)
      const p = { x: centroid.x * (bounds.width / 1000), y: centroid.y * (bounds.height / 600) };
  // We'll perform the transform with transform-origin at the center of the svg's
  // bounding box so we compute translation that keeps the centroid at the same
  // screen coordinates while scaling around the center.
  const cx = bounds.width / 2; const cy = bounds.height / 2;
  // Position of centroid relative to center
  const relX = p.x - cx;
  const relY = p.y - cy;
  // After scaling around center, the new relative position becomes rel * scale.
  // To keep the centroid visually fixed, the svg must be translated by the delta
  // between scaled and unscaled relative positions: tx = cx - (cx + rel * scale) = -rel*(scale-1)
  const tx = -relX * (scale - 1);
  const ty = -relY * (scale - 1);
  setZoom({ scale, tx, ty });
      // auto-reset after a longer hold
      if (zoomTimeout.current) { window.clearTimeout(zoomTimeout.current); }
      zoomTimeout.current = window.setTimeout(() => { setZoom({ scale: 1, tx: 0, ty: 0 }); zoomTimeout.current = null; }, ZOOM_HOLD);
    } catch (err) { }
  };

  // compute screen position (viewport px) for a mask centroid
  const screenPosForMask = (mask: Mask) => {
    try {
      const svgEl = document.querySelector('.interactive-svg-wrapper svg') as SVGSVGElement | null;
      if (!svgEl) return null;
      const bounds = svgEl.getBoundingClientRect();
      const centroid = centroidOf(mask.points);
      const p = { x: centroid.x * (bounds.width / 1000), y: centroid.y * (bounds.height / 600) };
      return { x: Math.round(bounds.left + p.x), y: Math.round(bounds.top + p.y) };
    } catch (err) { return null; }
  };

  const fetchSummaryForMask = async (maskId: string) => {
    try {
      const res = await fetch(`/api/locations/${encodeURIComponent(maskId)}`);
      if (!res.ok) return null;
      const json = await res.json();
      return {
        summary: (json?.description || json?.summary || null) as string | null,
        image: json?.imageUrl || json?.image || null,
      };
    } catch (err) { return null; }
  };

  const fetchFullStoryForMask = async (maskId: string) => {
    try {
      const res = await fetch(`/api/locations/${encodeURIComponent(maskId)}`);
      if (!res.ok) return null;
      const json = await res.json();
      return (json?.descriptionFull || json?.fullText || json?.description || null) as string | null;
    } catch (err) { return null; }
  };

  const openPreview = async (mask: Mask) => {
    // compute screen pos and fetch a short summary then open the floating card
    const rawPos = screenPosForMask(mask) || { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) };
    // improved placement: try to keep card within viewport; if mobile, open as bottom sheet
    const cardW = 360; const cardH = 160;
    const margin = 8;
    const mobile = window.innerWidth <= 640;
    const left = mobile ? margin : Math.min(Math.max(margin, rawPos.x - Math.round(cardW / 2)), Math.max(margin, window.innerWidth - cardW - margin));
    const top = mobile ? undefined : Math.min(Math.max(margin, rawPos.y - Math.round(cardH / 2)), Math.max(margin, window.innerHeight - cardH - margin));
  // set initial preview and make invisible for animation
  setIsMobile(mobile);
    setPreview({ open: true, id: mask.id, title: mask.name, x: left, y: top, summary: 'Carregando...', image: undefined });
    setPreviewVisible(false);
    // zoom camera to mask
    zoomToMask(mask);
    const data = await fetchSummaryForMask(mask.id);
    setPreview(p => ({ ...p, summary: (data?.summary) || 'Uma lenda antiga envolve este continente. Explore para saber mais.', image: data?.image || undefined }));
    // show with animation
    window.setTimeout(() => setPreviewVisible(true), 12);
  };

  // share / favorite / story helpers removed — simplified UI

  const closePreview = () => {
    // animate out then hide
    setPreviewVisible(false);
    window.setTimeout(() => setPreview({ open: false }), 220);
  };

  useEffect(() => {
    if (!preview.open) return;
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') closePreview(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview.open]);

  const downloadMasksBackup = () => {
    try {
      const payload = { masks: Object.values(masks), exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const name = `map-masks-backup-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download backup failed', err); window.alert('Falha ao gerar backup local.');
    }
  };

  const saveMapsToServer = async () => {
    try {
      setSaving(true);
      const payload = { svg: null, markers: [], masks: Object.values(masks), name: `masks-backup-${new Date().toISOString()}` };
      const res = await fetch('/api/maps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `status ${res.status}`);
      }
      const body = await res.json();
      const returnedUrl = body?.url || (body?.id ? `/uploads/maps/${body.id}.json` : null);
      const absoluteUrl = returnedUrl && returnedUrl.startsWith('/') ? window.location.origin + returnedUrl : returnedUrl;
      // attempt automatic download of the saved JSON
      try {
        if (absoluteUrl) {
          const r = await fetch(absoluteUrl);
          if (r.ok) {
            const blob = await r.blob();
            const dlUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const fname = (body?.id ? `${body.id}` : `maps-backup`) + '.json';
            a.href = dlUrl; a.download = fname; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(dlUrl);
            window.alert(`Mapa salvo no servidor e baixado localmente: ${returnedUrl}`);
          } else {
            window.alert(`Mapa salvo no servidor: ${returnedUrl} (falha ao baixar automaticamente)`);
          }
        } else {
          window.alert('Mapa salvo no servidor (sem URL retornada)');
        }
      } catch (err) {
        console.error('Auto-download failed', err);
        window.alert(`Mapa salvo no servidor: ${returnedUrl} (falha ao baixar automaticamente)`);
      }
    } catch (err) {
      console.error('Save map failed', err);
      window.alert('Falha ao salvar no servidor. Veja o console para detalhes.');
    } finally { setSaving(false); }
  };

  const moveOverlay = () => { /* removed */ };
  const endDragOverlay = () => { /* removed */ };

  // initialize masks from server or SVG bboxes on first mount
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      // if we already have masks in localStorage, prefer them and skip server/SVG
      try {
        const existing = localStorage.getItem('map-masks');
        if (existing) {
          const parsed = JSON.parse(existing || '{}') as Record<string, Mask>;
          if (mounted && Object.keys(parsed).length > 0) {
            setMasks(parsed);
            return;
          }
        }
      } catch (e) {
        // ignore localStorage parse errors
      }

      // Try server first
      try {
        const res = await fetch('/api/maps/latest');
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.masks) && json.masks.length > 0) {
            const loaded: Record<string, Mask> = {};
            for (const m of json.masks) {
              if (!m.id) continue;
              loaded[m.id] = { id: m.id, name: m.name || m.id, points: Array.isArray(m.points) ? m.points.map((p: any) => ({ xPct: Number(p.xPct), yPct: Number(p.yPct) })) : [] };
            }
            if (mounted && Object.keys(loaded).length > 0) {
              setMasks(loaded);
              try { localStorage.setItem('map-masks', JSON.stringify(loaded)); } catch {}
              return; // loaded from server, skip SVG bbox fallback
            }
          }
        }
      } catch (err) {
        // ignore fetch errors and fallback to SVG bbox generation
      }

      // Secondary fallback: try loading the known static map file from /uploads
      // This helps when the dev proxy isn't forwarding /api to the backend port.
      try {
        const staticRes = await fetch('/uploads/maps/2a63653b-5811-47aa-b532-029b7690ffcc.json');
        if (staticRes.ok) {
          const json = await staticRes.json();
          if (json && Array.isArray(json.masks) && json.masks.length > 0) {
            const loaded: Record<string, Mask> = {};
            for (const m of json.masks) {
              if (!m.id) continue;
              loaded[m.id] = { id: m.id, name: m.name || m.id, points: Array.isArray(m.points) ? m.points.map((p: any) => ({ xPct: Number(p.xPct), yPct: Number(p.yPct) })) : [] };
            }
            if (mounted && Object.keys(loaded).length > 0) {
              setMasks(loaded);
              try { localStorage.setItem('map-masks', JSON.stringify(loaded)); } catch {}
              return; // loaded from static file
            }
          }
        }
      } catch (e) {
        // ignore
      }

      // fallback: compute simple bbox-based masks from SVG
      const svg = document.querySelector('.interactive-svg-wrapper svg') as SVGSVGElement | null;
      if (!svg) return;
      const conts = svg.querySelectorAll('[data-name]');
      const next: Record<string, Mask> = {};
      conts.forEach((el) => {
        try {
          const name = (el as Element).getAttribute('data-name') || 'region';
          const id = name.toLowerCase();
          // get bbox and create a simple 4-point inset polygon
          const g = el as SVGGraphicsElement;
          if (typeof g.getBBox === 'function') {
            const b = g.getBBox();
            const padX = Math.max(8, b.width * 0.08);
            const padY = Math.max(8, b.height * 0.08);
            const x1 = b.x + padX;
            const x2 = b.x + b.width - padX;
            const y1 = b.y + padY;
            const y2 = b.y + b.height - padY;
            const points: Point[] = [
              { xPct: (x1 / 1000) * 100, yPct: (y1 / 600) * 100 },
              { xPct: (x2 / 1000) * 100, yPct: (y1 / 600) * 100 },
              { xPct: (x2 / 1000) * 100, yPct: (y2 / 600) * 100 },
              { xPct: (x1 / 1000) * 100, yPct: (y2 / 600) * 100 },
            ];
            next[id] = { id, name, points };
          }
        } catch (err) {}
      });
      if (mounted && Object.keys(next).length > 0) {
        setMasks(next);
        try { localStorage.setItem('map-masks', JSON.stringify(next)); } catch {}
      }
    };

    load();

    return () => { mounted = false; };
  }, []);
  const transformTransitionMs = (zoom.scale && zoom.scale > 1) ? ZOOM_IN_DURATION : ZOOM_OUT_DURATION;
  const inv = zoom.scale && zoom.scale > 0 ? 1 / zoom.scale : 1;

  return (
    <div className="interactive-svg-wrapper relative w-full">
      {/* smoother card animations: keyframes for appear/disappear */}
      <style>{`
        /* Card entrance: spring-like overshoot for a pleasant "camera" pop */
        @keyframes card-appear {
          0% { opacity: 0; transform: translateY(20px) scale(0.985); }
          58% { opacity: 1; transform: translateY(-6px) scale(1.03); }
          85% { transform: translateY(3px) scale(0.995); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes card-disappear {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(18px) scale(0.985); }
        }

        /* Layered child animations (staggered): thumb -> title -> body -> cta */
        @keyframes fade-slide-up {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .card-thumb, .card-title, .card-body, .card-cta { opacity: 0; transform: translateY(8px); }
        .card-thumb.animate { animation: fade-slide-up 420ms cubic-bezier(.2,.9,.2,1) forwards; animation-delay: 140ms; }
        .card-title.animate { animation: fade-slide-up 420ms cubic-bezier(.16,.86,.24,1) forwards; animation-delay: 220ms; }
        .card-body.animate { animation: fade-slide-up 420ms cubic-bezier(.16,.86,.24,1) forwards; animation-delay: 300ms; }
        .card-cta.animate { animation: fade-slide-up 420ms cubic-bezier(.16,.86,.24,1) forwards; animation-delay: 380ms; }

        /* Respect reduced motion preferences */
        @media (prefers-reduced-motion: reduce) {
          .card-thumb.animate, .card-title.animate, .card-body.animate, .card-cta.animate { animation: none !important; opacity: 1; transform: none !important; }
          .interactive-svg-wrapper > div[style] { transition: none !important; }
          @keyframes card-appear { 100% { transform: none; opacity: 1; } }
          @keyframes card-disappear { 100% { opacity: 0; } }
        }
      `}</style>
      {/* subtle entrance handled by inline transitions; particles removed */}
      {/* keep a fixed aspect ratio matching the SVG (1000x600 -> 60%) */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '60%' }}>
  {/* transform container: both image and svg are children so they scale together and stay aligned */}
  <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', transformOrigin: 'center center', transition: `transform ${transformTransitionMs}ms cubic-bezier(.16,.86,.24,1)`, transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})` }}>
          {/* background map image */}
          <img src="/uploads/FinalMap.png" alt="Mapa" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

          {/* SVG overlay (scales together with the image so outlines stay aligned) */}
          <svg
            viewBox="0 0 1000 600"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Mapa"
            onClick={onSvgClick}
            style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'auto' }}
          >
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000" floodOpacity="0.45"/></filter>
        </defs>

  {/* handcrafted continent shapes removed per user request; only generated mask rectangles remain */}

        {/* render masks (editable) */}
        {Object.values(masks).map(mask => {
          const isActive = active === mask.name;
          return (
            <g key={mask.id}>
              <polygon
                points={mask.points.map(p => `${(p.xPct/100)*1000},${(p.yPct/100)*600}`).join(' ')}
                fill={isActive ? `${themeColorForName(mask.name)}22` : 'transparent'}
                stroke={isActive ? themeColorForName(mask.name) : 'transparent'}
                strokeWidth={isActive ? 2 * inv : 0}
                style={{ transition: 'all 160ms ease', filter: isActive ? `drop-shadow(0 6px 18px ${themeColorForName(mask.name)}22)` : undefined, pointerEvents: 'auto', cursor: 'pointer' }}
                onMouseEnter={onEnter(mask.name)}
                onMouseMove={onMove}
                onMouseLeave={onLeave}
                onClick={(e) => { e.stopPropagation(); if (!editMasksMode) openPreview(mask); else zoomToMask(mask); }}
              />

              {mask.points.length > 0 && (
                <>
                  {/* single golden label with hover glow */}
                  <text
                    x={centroidOf(mask.points).x}
                    y={centroidOf(mask.points).y}
                    fill={isActive ? '#fff9e0' : '#ffdf6b'}
                    fontSize={20 * inv}
                    fontWeight={800}
                    textAnchor="middle"
                    style={{ pointerEvents: 'auto', fontFamily: 'var(--font-map)', letterSpacing: '0.08em', userSelect: 'none', textTransform: 'uppercase', transition: 'fill 180ms ease, filter 180ms ease', fontVariant: 'all-small-caps', filter: isActive ? `drop-shadow(0 12px 32px rgba(255,200,80,0.98)) drop-shadow(0 0 22px rgba(255,230,140,0.72))` : 'none', stroke: '#000000', strokeWidth: 0.6 * inv, strokeOpacity: 0.95, paintOrder: 'stroke' }}
                    onMouseEnter={onEnter(mask.name)}
                    onMouseMove={onMove}
                    onMouseLeave={onLeave}
                      onClick={(e) => { e.stopPropagation(); if (!editMasksMode) openPreview(mask); else zoomToMask(mask); }}
                  >
                    {mask.name.toUpperCase()}
                  </text>
                </>
              )}
            {editMasksMode && selectedMask === mask.id && mask.points.map((p, idx) => (
              <circle
                key={idx}
                cx={(p.xPct/100)*1000}
                cy={(p.yPct/100)*600}
                r={8 * inv}
                fill={selectedVertex && selectedVertex.maskId === mask.id && selectedVertex.idx === idx ? '#ffd' : '#fff'}
                stroke="#000"
                strokeWidth={1 * inv}
                style={{ cursor: maskEditAction === 'move' ? 'grab' : 'pointer' }}
                onPointerDown={(e) => { if (maskEditAction === 'move') startDragVertex(e, mask.id, idx); }}
                onPointerMove={moveVertex}
                onPointerUp={endDragVertex}
                onPointerCancel={endDragVertex}
              />
            ))}
            {/* preview temporary points when adding multiple */}
            {multiAddMode && selectedMask === mask.id && tempAddPoints.length > 0 && (
              <g>
                <polyline points={tempAddPoints.map(p => `${(p.xPct/100)*1000},${(p.yPct/100)*600}`).join(' ')} fill="none" stroke="#ffcc33" strokeWidth={2 * inv} strokeDasharray="6 4" style={{ pointerEvents: 'none' }} />
                {tempAddPoints.map((p, i) => (
                  <circle key={`t-${i}`} cx={(p.xPct/100)*1000} cy={(p.yPct/100)*600} r={6 * inv} fill="#ffcc33" opacity={0.95} style={{ pointerEvents: 'none' }} />
                ))}
              </g>
            )}
            </g>
          );
        })}

        {/* transparent rect captures clicks only when adding points; otherwise it must not block vertex handles */}
        <rect
          x={0}
          y={0}
          width={1000}
          height={600}
          fill="transparent"
          style={{ pointerEvents: (editMasksMode && selectedMask && maskEditAction === 'add') ? 'all' : 'none' }}
          onClick={onSvgClick}
        />
        </svg>
    </div>

      {/* small controls (admin only) */}
      {canEditMasks ? (
        <div style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 200, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn ml-2" onClick={() => { setEditMasksMode(m => !m); setSelectedMask(null); }}>{editMasksMode ? 'Fechar máscaras' : 'Editar máscaras'}</button>
          {editMasksMode && Object.values(masks).length > 0 && (
            <>
              <select className="btn ml-2" value={selectedMask ?? ''} onChange={(e) => setSelectedMask(e.target.value)} style={{ padding: '6px 8px' }}>
                <option value="">Selecione máscara</option>
                {Object.values(masks).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {selectedMask && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 6 }}>
                  <label style={{ fontSize: 12 }}><input type="radio" name="maskAction" checked={maskEditAction === 'move'} onChange={() => setMaskEditAction('move')} /> Mover</label>
                  <label style={{ fontSize: 12 }}><input type="radio" name="maskAction" checked={maskEditAction === 'add'} onChange={() => setMaskEditAction('add')} /> Adicionar ponto</label>
                  <label style={{ fontSize: 12 }}><input type="radio" name="maskAction" checked={maskEditAction === 'delete'} onChange={() => setMaskEditAction('delete')} /> Remover ponto</label>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
      </div>

      {/* tooltip element shown near cursor */}
      {tooltip.visible && (
        <div style={{ position: 'absolute', left: tooltip.x, top: tooltip.y, zIndex: 300, background: 'rgba(0,0,0,0.82)', color: '#fff', padding: '6px 8px', borderRadius: 6, pointerEvents: 'none', transform: 'translate(8px, 8px)' }}>
          {tooltip.text}
        </div>
      )}

      {preview.open && (
        <>
          {/* desktop card or mobile bottom sheet */}
          {!isMobile ? (
            <div
              style={{
                position: 'fixed',
                left: Math.max(8, (preview.x || 0)),
                top: Math.max(8, (preview.y || 0)),
                width: 360,
                zIndex: 900,
                padding: 12,
                borderRadius: 12,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                // glass background (backdrop blur + subtle translucency)
                background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: previewVisible ? '0 20px 52px rgba(2,6,23,0.6)' : '0 6px 18px rgba(2,6,23,0.3)',
                transform: 'translateY(0) scale(1)',
                opacity: 1,
                filter: 'none',
                animation: previewVisible ? 'card-appear 620ms cubic-bezier(.16,.86,.24,1) forwards' : 'card-disappear 420ms cubic-bezier(.2,.9,.2,1) forwards',
                color: '#fff'
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {preview.image ? (
                  <img className={`card-thumb ${previewVisible ? 'animate' : ''}`} src={preview.image} alt={preview.title} style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 8, flex: '0 0 96px', border: '1px solid rgba(255,255,255,0.04)' }} />
                ) : (
                  <div className={`card-thumb ${previewVisible ? 'animate' : ''}`} style={{ width: 96, height: 72, borderRadius: 8, background: 'linear-gradient(135deg,#222 0%, #111 100%)', flex: '0 0 96px', border: '1px solid rgba(255,255,255,0.04)' }} />
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div className={`card-title ${previewVisible ? 'animate' : ''}`} style={{ fontWeight: 800, color: '#ffe9b8', fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview.title}</div>
                    <button onClick={closePreview} aria-label="Fechar" style={{ background: 'transparent', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16 }}>✕</button>
                  </div>
                  <div className={`card-body ${previewVisible ? 'animate' : ''}`} style={{ marginTop: 8, color: '#e6e6e6', fontSize: 13, lineHeight: '1.35em', maxHeight: 120, overflow: 'auto' }}>{preview.summary}</div>
                  <div className={`card-cta ${previewVisible ? 'animate' : ''}`} style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => { if (preview.id) { setLocation(`/mundo/${preview.id}`); closePreview(); } }} className="btn" style={{ padding: '8px 12px', background: 'linear-gradient(90deg,#ffd86a,#ffb84d)', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, color: '#071522' }}>Visitar continente</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // mobile bottom sheet
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000, padding: 12, borderRadius: '12px 12px 0 0', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))', borderTop: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 -10px 40px rgba(2,6,23,0.6)', transform: 'translateY(0)', opacity: 1, filter: 'none', animation: previewVisible ? 'card-appear 620ms cubic-bezier(.16,.86,.24,1) forwards' : 'card-disappear 420ms cubic-bezier(.2,.9,.2,1) forwards' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div className={`card-title ${previewVisible ? 'animate' : ''}`} style={{ fontWeight: 800, color: '#ffe9b8', fontSize: 16 }}>{preview.title}</div>
                  <div className={`card-body ${previewVisible ? 'animate' : ''}`} style={{ marginTop: 6, color: '#e6e6e6', fontSize: 13, maxHeight: 160, overflow: 'auto' }}>{preview.summary}</div>
                </div>
                {/* simplified mobile actions: only visit button below */}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button className={`btn card-cta ${previewVisible ? 'animate' : ''}`} onClick={() => { if (preview.id) { setLocation(`/mundo/${preview.id}`); closePreview(); } }} style={{ flex: 1, padding: '10px 12px', background: 'linear-gradient(90deg,#ffd86a,#ffb84d)', borderRadius: 8, border: 'none', fontWeight: 700, color: '#071522' }}>Visitar</button>
                
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
