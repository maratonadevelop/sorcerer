import React, { useEffect, useRef } from 'react';

// Highly-animated divider with flowing wave + comets; used only between Codex and Blog
export default function SectionDividerMagic() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) el.classList.add('section-divider-magic--visible');
          else el.classList.remove('section-divider-magic--visible');
        });
      },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="section-divider-magic" aria-hidden>
      {/* animated gradient bed */}
      <div className="magic-bed" />

      {/* gentle bobbing wave */}
      <svg className="magic-wave" viewBox="0 0 1440 120" preserveAspectRatio="none" width="100%" height="100%">
        <defs>
          <linearGradient id="magicGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,230,160,0.10)" />
            <stop offset="35%" stopColor="rgba(255,190,90,0.12)" />
            <stop offset="65%" stopColor="rgba(140,180,255,0.10)" />
            <stop offset="100%" stopColor="rgba(255,230,160,0.08)" />
          </linearGradient>
        </defs>
        <path d="M0,60 C340,110 1120,-20 1440,50 L1440 120 L0 120 Z" fill="url(#magicGrad)" />
      </svg>

      {/* comets */}
      <span className="magic-comet mc-1" />
      <span className="magic-comet mc-2" />
      <span className="magic-comet mc-3" />
      <span className="magic-comet mc-4" />
      <span className="magic-comet mc-5" />
      <span className="magic-comet mc-6" />
    </div>
  );
}
