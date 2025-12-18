import { useEffect, useRef } from 'react';

// Alternate divider: diagonal shimmer ribbon for variety between sections
export default function SectionDividerAlt() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) el.classList.add('section-divider-alt--visible');
        else el.classList.remove('section-divider-alt--visible');
      });
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="section-divider-alt" aria-hidden>
      <div className="ribbon-bg" />
      <div className="ribbon-glow" />
    </div>
  );
}
