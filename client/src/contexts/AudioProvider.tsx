import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';

export type AudioContextShape = {
  page: string | undefined;
  setPage: (page?: string) => void;
  setEntity: (ctx: { type: 'chapter'|'character'|'codex'|'location', id: string } | null) => void;
  currentTrack: { id: string; title: string; fileUrl: string; loop: boolean } | null;
  playing: boolean;
  muted: boolean;
  volume: number; // 0-1
  play: () => void;
  pause: () => void;
  toggleMute: () => void;
  setVolume: (v: number) => void;
  autoplayBlocked: boolean;
};

const Ctx = createContext<AudioContextShape | null>(null);

function mapPathToPage(pathname: string): string | undefined {
  if (!pathname) return undefined;
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/codex')) return 'codex';
  if (pathname.startsWith('/mundo') || pathname.startsWith('/world')) return 'world';
  if (pathname.startsWith('/characters')) return 'characters';
  if (pathname.startsWith('/chapters')) return 'chapters';
  if (pathname.startsWith('/blog')) return 'blog';
  return undefined;
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [page, _setPage] = useState<string | undefined>(undefined);
  const [entity, setEntity] = useState<{ type: 'chapter'|'character'|'codex'|'location', id: string } | null>(null);
  const [currentTrack, setCurrentTrack] = useState<{ id: string; title: string; fileUrl: string; loop: boolean } | null>(null);
  const currentTrackRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // Start unmuted by default (unless user previously chose mute)
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('audio.muted');
      if (v === 'true') return true;
      if (v === 'false') return false;
      return false; // default audible
    } catch { return false; }
  });
  const initialAutoUnmuteDone = useRef(false);
  const [volume, _setVolume] = useState<number>(() => {
    try { const s = localStorage.getItem('audio.volume'); const n = s ? parseFloat(s) : 0.7; return isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.7; } catch { return 0.7; }
  });
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Cache audio resolution results to avoid repeated /api/audio/resolve calls.
  const resolveCacheRef = useRef(new Map<string, { value: any; expiresAt: number }>());
  const RESOLVE_CACHE_TTL_MS = 60 * 1000;

  // Keep latest mute/volume in refs so resolve effect doesn't depend on them.
  const mutedRef = useRef(muted);
  const volumeRef = useRef(volume);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  // Ambient volume mapping: user volume (0..1) is remapped to a softer effective range
  // so background music remains unobtrusive even at max slider.
  const AMBIENT_MIN = 0.15; // floor loudness when not muted
  const AMBIENT_MAX = 0.55; // global cap loudness
  const computeEffectiveVolume = useCallback((userVol: number, trackUserMaxPct?: number) => {
    const v = Math.min(1, Math.max(0, userVol));
    // trackUserMaxPct is 0-100; normalize to 0..1 and cap with AMBIENT_MAX
    const trackCap = typeof trackUserMaxPct === 'number' ? Math.min(1, Math.max(0, trackUserMaxPct / 100)) : 1;
    const cap = Math.max(AMBIENT_MIN, Math.min(AMBIENT_MAX, trackCap));
    return AMBIENT_MIN + v * (cap - AMBIENT_MIN);
  }, []);
  const effectiveVolume = useMemo(() => {
    const userMax = (currentTrack as any)?.volumeUserMax as number | undefined;
    return computeEffectiveVolume(volume, userMax);
  }, [volume, currentTrack, computeEffectiveVolume]);

  // Audio elements for crossfade
  const aCurrent = useRef<HTMLAudioElement | null>(null);
  const aNext = useRef<HTMLAudioElement | null>(null);
  const fadeTimer = useRef<number | null>(null);

  const setPage = useCallback((p?: string) => _setPage(p), []);
  const applyVolumes = useCallback(() => {
    const vol = effectiveVolume * (muted ? 0 : 1);
    if (aCurrent.current) aCurrent.current.volume = vol;
    if (aNext.current) aNext.current.volume = vol;
  }, [effectiveVolume, muted]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    _setVolume(clamped);
    try { localStorage.setItem('audio.volume', String(clamped)); } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m; try { localStorage.setItem('audio.muted', String(next)); } catch {}
      if (aCurrent.current) aCurrent.current.muted = next;
      if (aNext.current) aNext.current.muted = next;
      return next;
    });
  }, []);

  const play = useCallback(() => {
    const el = aCurrent.current || aNext.current; if (!el) return;
    el.muted = muted; applyVolumes();
    el.play().then(() => { setPlaying(true); setAutoplayBlocked(false); }).catch(() => { setAutoplayBlocked(true); });
  }, [muted, applyVolumes]);

  const pause = useCallback(() => {
    if (aCurrent.current) aCurrent.current.pause();
    if (aNext.current) aNext.current.pause();
    setPlaying(false);
  }, []);

  // Resolve by location (page) automatically
  useEffect(() => {
    const p = mapPathToPage(location);
    _setPage(p);
  }, [location]);

  // Resolve track whenever context changes
  useEffect(() => {
    let aborted = false;
    const params = new URLSearchParams();
    if (page) params.set('page', page);
    if (entity) params.set(`${entity.type}Id`, entity.id);
    const q = params.toString();
    const cacheKey = q || '__global__';
    const cached = resolveCacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      const track = cached.value;
      Promise.resolve().then(() => {
        if (aborted) return;
        if (!track) {
          // No resolved track: stop any current (both refs)
          setCurrentTrack(null);
          currentTrackRef.current = null;
          if (fadeTimer.current) { window.clearInterval(fadeTimer.current); fadeTimer.current = null; }
          if (aCurrent.current) { try { aCurrent.current.pause(); } catch {} aCurrent.current = null; }
          if (aNext.current) { try { aNext.current.pause(); } catch {} aNext.current = null; }
          setPlaying(false);
          return;
        }
        // Same track? do nothing
        if (currentTrackRef.current === track.id) return;
        // Stop any stray 'next' audio to avoid duplicates before starting new one
        if (aNext.current) { try { aNext.current.pause(); } catch {} aNext.current = null; }
        const mutedNow = mutedRef.current;
        const volumeNow = volumeRef.current;
        // Start crossfade; apply per-track fades if available
        const nextEl = new Audio(track.fileUrl);
        nextEl.loop = !!track.loop;
        nextEl.muted = mutedNow;
        nextEl.volume = 0;
        aNext.current = nextEl;
        nextEl.play().then(() => {
          setAutoplayBlocked(false);
          const fadeIn = typeof (track as any).fadeInMs === 'number' ? (track as any).fadeInMs : 600;
          const fadeOut = typeof (track as any).fadeOutMs === 'number' ? (track as any).fadeOutMs : fadeIn;
          const fadeMs = Math.max(fadeIn, fadeOut);
          const startVol = (aCurrent.current ? aCurrent.current.volume : 0);
          let startedAt = performance.now();
          const nextTargetBase = computeEffectiveVolume(volumeNow, (track as any)?.volumeUserMax) * (mutedNow ? 0 : 1);
          const rafStep = () => {
            const now = performance.now();
            const t = Math.min(1, (now - startedAt) / fadeMs);
            nextEl.volume = nextTargetBase * t;
            if (aCurrent.current) aCurrent.current.volume = startVol * (1 - t);
            if (t >= 1) {
              if (aCurrent.current) { aCurrent.current.pause(); }
              aCurrent.current = nextEl; aNext.current = null;
              aCurrent.current.volume = nextTargetBase;
              setCurrentTrack({ id: track.id, title: track.title, fileUrl: track.fileUrl, loop: !!track.loop, ...(track as any) });
              currentTrackRef.current = track.id;
              setPlaying(true);
              fadeTimer.current = null;
              return;
            }
            fadeTimer.current = requestAnimationFrame(rafStep) as unknown as number;
          };
          if (fadeTimer.current) { cancelAnimationFrame(fadeTimer.current); fadeTimer.current = null; }
          fadeTimer.current = requestAnimationFrame(rafStep) as unknown as number;
        }).catch(() => {
          setAutoplayBlocked(true);
          setCurrentTrack({ id: track.id, title: track.title, fileUrl: track.fileUrl, loop: !!track.loop, ...(track as any) });
          currentTrackRef.current = track.id;
        });
      });
      return () => { aborted = true; };
    }

    fetch(`/api/audio/resolve${q ? `?${q}` : ''}`)
      .then((r) => r.json())
      .then((track) => {
        if (aborted) return;

        // cache resolved value (including null)
        try {
          resolveCacheRef.current.set(cacheKey, { value: track ?? null, expiresAt: Date.now() + RESOLVE_CACHE_TTL_MS });
        } catch {}

        if (!track) {
          // No resolved track: stop any current (both refs)
          setCurrentTrack(null);
          currentTrackRef.current = null;
          if (fadeTimer.current) { window.clearInterval(fadeTimer.current); fadeTimer.current = null; }
          if (aCurrent.current) { try { aCurrent.current.pause(); } catch {} aCurrent.current = null; }
          if (aNext.current) { try { aNext.current.pause(); } catch {} aNext.current = null; }
          setPlaying(false);
          return;
        }
        // Same track? do nothing
        if (currentTrackRef.current === track.id) return;
  // Stop any stray 'next' audio to avoid duplicates before starting new one
  if (aNext.current) { try { aNext.current.pause(); } catch {} aNext.current = null; }
  // Start crossfade; apply per-track fades if available
  const nextEl = new Audio(track.fileUrl);
        nextEl.loop = !!track.loop;
        const mutedNow = mutedRef.current;
        const volumeNow = volumeRef.current;
        nextEl.muted = mutedNow;
        nextEl.volume = 0;
        aNext.current = nextEl;
        nextEl.play().then(() => {
          setAutoplayBlocked(false);
          // Crossfade: use track.fadeInMs/fadeOutMs if provided, else default 600ms
          const fadeIn = typeof (track as any).fadeInMs === 'number' ? (track as any).fadeInMs : 600;
          const fadeOut = typeof (track as any).fadeOutMs === 'number' ? (track as any).fadeOutMs : fadeIn;
          const fadeMs = Math.max(fadeIn, fadeOut);
          const startVol = (aCurrent.current ? aCurrent.current.volume : 0);
          let startedAt = performance.now();
          const nextTargetBase = computeEffectiveVolume(volumeNow, (track as any)?.volumeUserMax) * (mutedNow ? 0 : 1);
          const rafStep = () => {
            const now = performance.now();
            const t = Math.min(1, (now - startedAt) / fadeMs);
            nextEl.volume = nextTargetBase * t;
            if (aCurrent.current) aCurrent.current.volume = startVol * (1 - t);
            if (t >= 1) {
              if (aCurrent.current) { aCurrent.current.pause(); }
              aCurrent.current = nextEl; aNext.current = null;
              aCurrent.current.volume = nextTargetBase;
              setCurrentTrack({ id: track.id, title: track.title, fileUrl: track.fileUrl, loop: !!track.loop, ...(track as any) });
              currentTrackRef.current = track.id;
              setPlaying(true);
              fadeTimer.current = null;
              return;
            }
            fadeTimer.current = requestAnimationFrame(rafStep) as unknown as number;
          };
          if (fadeTimer.current) { cancelAnimationFrame(fadeTimer.current); fadeTimer.current = null; }
          fadeTimer.current = requestAnimationFrame(rafStep) as unknown as number;
        }).catch(() => {
          // Autoplay blocked; attempt muted autoplay fallback
          try {
            nextEl.muted = true;
            nextEl.play().then(() => {
              setAutoplayBlocked(false);
              // Schedule unmute after short delay if user never set preference and we are not actually supposed to stay muted
              if (!initialAutoUnmuteDone.current && !localStorage.getItem('audio.muted')) {
                initialAutoUnmuteDone.current = true;
                setTimeout(() => {
                  // Only unmute if user hasn't manually muted meanwhile
                  setMuted((m) => {
                    if (m) return m; // respect user action
                    nextEl.muted = false; return m;
                  });
                }, 800);
              }
              // proceed with same crossfade logic as success branch above (simplify: treat as started)
              const fadeIn = typeof (track as any).fadeInMs === 'number' ? (track as any).fadeInMs : 600;
              const fadeOut = typeof (track as any).fadeOutMs === 'number' ? (track as any).fadeOutMs : fadeIn;
              const fadeMs = Math.max(fadeIn, fadeOut);
              const startVol = (aCurrent.current ? aCurrent.current.volume : 0);
              let startedAt = performance.now();
              const nextTargetBase = computeEffectiveVolume(volumeNow, (track as any)?.volumeUserMax) * (mutedNow ? 0 : 1);
              const rafStep = () => {
                const now = performance.now();
                const t = Math.min(1, (now - startedAt) / fadeMs);
                nextEl.volume = nextTargetBase * t;
                if (aCurrent.current) aCurrent.current.volume = startVol * (1 - t);
                if (t >= 1) {
                  if (aCurrent.current) { aCurrent.current.pause(); }
                  aCurrent.current = nextEl; aNext.current = null;
                  aCurrent.current.volume = nextTargetBase;
                  setCurrentTrack({ id: track.id, title: track.title, fileUrl: track.fileUrl, loop: !!track.loop, ...(track as any) });
                  currentTrackRef.current = track.id; setPlaying(true);
                  fadeTimer.current = null; return;
                }
                fadeTimer.current = requestAnimationFrame(rafStep) as unknown as number;
              };
              if (fadeTimer.current) { cancelAnimationFrame(fadeTimer.current); fadeTimer.current = null; }
              fadeTimer.current = requestAnimationFrame(rafStep) as unknown as number;
            }).catch(() => {
              setAutoplayBlocked(true);
              setCurrentTrack({ id: track.id, title: track.title, fileUrl: track.fileUrl, loop: !!track.loop, ...(track as any) });
              currentTrackRef.current = track.id;
            });
          } catch {
            setAutoplayBlocked(true);
            setCurrentTrack({ id: track.id, title: track.title, fileUrl: track.fileUrl, loop: !!track.loop, ...(track as any) });
            currentTrackRef.current = track.id;
          }
        });
      })
      .catch(() => {})
    return () => { aborted = true; };
  }, [page, entity, computeEffectiveVolume]);

  // Ensure playback starts if we have a track but not playing yet (e.g. after context change)
  useEffect(() => {
    applyVolumes();
    if (currentTrack && !playing && aCurrent.current) {
      aCurrent.current.muted = muted;
      aCurrent.current.play().then(() => { setPlaying(true); setAutoplayBlocked(false); }).catch(() => setAutoplayBlocked(true));
    }
  }, [currentTrack, playing, muted, volume, applyVolumes]);

  const value = useMemo<AudioContextShape>(() => ({
    page,
    setPage,
    setEntity,
    currentTrack,
    playing,
    muted,
    volume,
    play,
    pause,
    toggleMute,
    setVolume,
    autoplayBlocked,
  }), [page, setPage, setEntity, currentTrack, playing, muted, volume, play, pause, toggleMute, setVolume, autoplayBlocked]);

  // Autoplay gesture fallback: listen first user interaction if blocked
  useEffect(() => {
    if (!autoplayBlocked) return;
    const handler = () => {
      if (autoplayBlocked) {
        play();
      }
    };
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [autoplayBlocked, play]);

  // Cleanup on unmount: stop any playing audio to avoid lingering global track
  useEffect(() => {
    return () => {
      try {
        if (aCurrent.current) { aCurrent.current.pause(); aCurrent.current.src = ''; }
        if (aNext.current) { aNext.current.pause(); aNext.current.src = ''; }
      } catch {}
    };
  }, []);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAudio() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAudio must be used within AudioProvider');
  return v;
}
