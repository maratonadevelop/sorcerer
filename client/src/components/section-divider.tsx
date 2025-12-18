import { useEffect, useRef } from 'react';

// Soft "aurora" divider: gentle animated gradient ribbons to make transitions feel alive and natural
export default function SectionDivider() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) el.classList.add('section-divider--visible');
          else el.classList.remove('section-divider--visible');
        });
      },
      { threshold: 0.1 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="section-divider aurora" aria-hidden>
      <div className="aurora-layer aurora-1" />
      <div className="aurora-layer aurora-2" />
      <div className="aurora-layer aurora-3" />
    </div>
  );
}
