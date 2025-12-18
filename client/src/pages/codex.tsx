import React, { useEffect, useMemo, useState } from 'react';
import Navigation from '@/components/navigation';
import Footer from '@/components/footer';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, Crown } from "lucide-react";
import type { CodexEntry } from "@shared/schema";
import { useLanguage } from '@/contexts/LanguageContext';

// Background video with performance optimizations:
// - lazy play (IntersectionObserver) so it pauses when off-screen
// - preload="none" to avoid decoding before needed
// - poster fallback for fast first paint
// - multiple sources (VP9 + H.264). Consider adding AV1 when browser support suits the audience.
// - will attempt re-play silently if autoplay is initially blocked
// - keeps component memoized so re-renders from tab switching don't re-init the video
const VideoBackground = React.memo(function VideoBackground() {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Try to play as soon as it's ready; if blocked (e.g. browser policy) we ignore.
    const attemptPlay = () => {
      if (!v) return;
      if (v.paused) {
        v.play().catch(() => { /* silent */ });
      }
    };
    if (v.readyState >= 2) attemptPlay();
    else v.addEventListener('loadeddata', attemptPlay, { once: true });

    // Pause when not visible to reduce CPU/GPU usage (especially on low-end devices).
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!v) return;
        if (e.isIntersecting) {
          attemptPlay();
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { threshold: 0.15 });
    obs.observe(v);

    return () => { obs.disconnect(); };
  }, []);

  return (
    <div className="codex-bg" aria-hidden data-perf="codex-bg-wrapper">
      <video
        ref={videoRef}
        // autoplay is still desired; IntersectionObserver pauses if off-screen
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster="/uploads/nOVOCOVER-poster.jpg"
        // prevent PiP UI & remote playback dialogs where supported
        disablePictureInPicture
        className="hero-like-video"
        aria-label="Plano de fundo animado do Codex"
        // containment hints; avoids expensive style/layout invalidations
        style={{ contain: 'layout paint size' }}
      >
        {/* Smaller / optimized 720p60 VP9 first for quality:bitrate efficiency */}
        <source src="/uploads/nOVOCOVER_720p60.webm" type="video/webm" />
        {/* Fallback H.264 (widest compatibility). Could be 30fps if 60fps heavy */}
        <source src="/uploads/nOVOCOVER_720p60.mp4" type="video/mp4" />
        {/* Legacy original as final fallback */}
        <source src="/uploads/nOVOCOVER.webm" type="video/webm" />
        <source src="/uploads/nOVOCOVER.mp4" type="video/mp4" />
        Seu navegador não suporta vídeo HTML5.
      </video>
      <div className="codex-bg-overlay" aria-hidden />
    </div>
  );
});

// Single consolidated Codex page (replaces duplicated exports)
export default function Codex() {
  const [selectedCategory, setSelectedCategory] = useState("magic");
  
  const { data: codexEntries = [], isLoading } = useQuery<CodexEntry[]>({
    queryKey: ['/api/codex'],
  });

  const categorizedEntries = useMemo(() => {
    const acc: Record<'magic' | 'creatures' | 'items' | 'other', CodexEntry[]> = {
      magic: [],
      creatures: [],
      items: [],
      other: [],
    };
    for (const e of codexEntries) {
      const cat = (e.category as any) as 'magic' | 'creatures' | 'items' | 'other';
      if (acc[cat]) acc[cat].push(e);
      else acc.other.push(e);
    }
    return acc;
  }, [codexEntries]);

  // Pick a default tab that actually has entries
  useEffect(() => {
    if (!isLoading && codexEntries.length > 0) {
      const order: Array<keyof typeof categorizedEntries> = ['magic', 'creatures', 'items', 'other'];
      const firstWithEntries = order.find(k => categorizedEntries[k].length > 0);
      if (firstWithEntries) setSelectedCategory(firstWithEntries);
    }
  }, [isLoading, codexEntries.length]);

  const { t } = useLanguage();

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "magic":
        return <Wand2 className="h-5 w-5" />;
      case "creatures":
        return <Crown className="h-5 w-5" />;
      // locations moved to World page
      case "items":
        return <Wand2 className="h-5 w-5" />;
      case "other":
        return <Wand2 className="h-5 w-5" />;
      default:
        return <Wand2 className="h-5 w-5" />;
    }
  };

  // No placeholder content — the Códex ficará vazio até ser preenchido no Admin

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      
      <main className="pt-24 pb-20 px-4">
          <div className="max-w-7xl mx-auto codex-wrapper">
          <VideoBackground />

          <div className="codex-content relative z-10">
            <div className="text-center mb-16">
              <h1 className="font-display text-4xl md:text-5xl font-bold text-primary mb-4" data-testid="text-codex-title">
                {t.codexPageTitle || 'O Códex'}
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t.codexPageDesc || 'Navegue por entradas do lore sobre magia, criaturas e itens.'}
              </p>
            </div>

            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-4 mb-12">
                {['magic','creatures','items','other'].map((cat) => {
                  const active = selectedCategory === cat;
                  const dimmed = selectedCategory && selectedCategory !== cat;
                  const label = cat === 'magic' ? (t.magic || 'Magia') : cat === 'creatures' ? (t.creatures || 'Criaturas') : cat === 'items' ? 'Itens' : 'Outros';
                  const Icon = cat === 'creatures' ? Crown : Wand2;
                  const hoverClass = active ? '' : 'group-hover:text-[color:#e6cfa3] hover:bg-[rgba(230,205,150,0.06)]';
                  return (
                    <TabsTrigger
                      key={cat}
                      value={cat}
                      className={`group justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:#e6cfa3] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex items-center gap-2 ${active ? 'text-[color:#071522]' : 'text-muted-foreground'} ${hoverClass}`}
                      style={active ? { background: 'rgba(230,205,150,0.95)', boxShadow: '0 8px 22px rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.04)', color: '#071522', transform: 'scale(1.02)' } : { background: 'transparent', border: '1px solid rgba(255,255,255,0.02)', opacity: dimmed ? 0.35 : 0.95, transform: dimmed ? 'scale(0.985)' : 'scale(1)' }}
                      data-testid={`tab-${cat}`}
                    >
                      <Icon className="h-4 w-4 transition-colors duration-300" />
                      <span className="ml-1 transition-colors duration-300">{label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {["magic", "creatures", "items", "other"].map((category) => (
                <TabsContent key={category} value={category} forceMount>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {isLoading ? (
                    [1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="bg-card border border-border rounded-lg h-64 animate-pulse" />
                    ))
                  ) : categorizedEntries[category as keyof typeof categorizedEntries].length === 0 ? (
                    <div className="col-span-full text-center text-muted-foreground py-10">
                      {t.noCodexEntries || 'Sem entradas ainda para esta categoria.'}
                    </div>
                  ) : (
                    categorizedEntries[category as keyof typeof categorizedEntries].map((entry) => (
                      <Card key={entry.id} className="group bg-card border border-border rounded-lg cursor-pointer shadow-md overflow-hidden transition-all duration-300 ease-out transform hover:scale-102 hover:shadow-lg active:scale-99 hover:-translate-y-0.5" onClick={() => (window.location.href = `/codex/${entry.id}`)}>
                          {entry.imageUrl && (
                            <div className="relative w-full h-32 overflow-hidden rounded-t-lg">
                              <img 
                                src={entry.imageUrl} 
                                alt={entry.title}
                                className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 group-hover:brightness-110"
                              />
                              <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-30 transition-opacity duration-300" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.12))' }} />
                            </div>
                          )}
                          <CardContent className="p-6">
                            <div className="cursor-pointer">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center transition-all duration-300 group-hover:bg-[rgba(230,205,150,0.08)]">
                                {getCategoryIcon(category)}
                              </div>
                              <h3 className="font-display text-lg font-semibold text-card-foreground transition-colors duration-300 group-hover:text-[color:#e6cfa3]" data-testid={`text-entry-title-${entry.id}`}>
                                {entry.title}
                              </h3>
                            </div>
                            <p className="text-muted-foreground text-sm transition-colors duration-300 group-hover:text-muted-foreground/90 whitespace-normal break-all" data-testid={`text-entry-description-${entry.id}`}>
                              {entry.description}
                            </p>
                            </div>
                          </CardContent>
                        </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}


