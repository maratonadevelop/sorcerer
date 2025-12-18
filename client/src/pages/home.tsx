import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import HeroSection from "@/components/hero-section";
import Reveal from "@/components/reveal";
import ChapterCard from "@/components/chapter-card";
import CharacterCard from "@/components/character-card";
import WorldMap from "@/components/world-map";
import SectionDivider from "@/components/section-divider";
import SectionDividerAlt from "@/components/section-divider-alt";
import SectionIcon from "@/components/section-icon";
import NewsletterSignup from "@/components/newsletter-signup";
import Footer from "@/components/footer";
import HeroParticles from "@/components/hero-particles";
import Starfield from "@/components/starfield";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wand2, Crown, MapPin } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import type { Chapter, Character, Location, BlogPost } from "@shared/schema";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Home() {
  const { t } = useLanguage();
  // Codex video autoplay shim
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [shouldLoadCodexVideo, setShouldLoadCodexVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayAllowed, setAutoplayAllowed] = useState(true);
  const lastTimeRef = useRef(0);
  const stalledRef = useRef(false);
  const stallTimerRef = useRef<number | null>(null);
  const codexRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  const { data: chapters = [], isLoading: chaptersLoading } = useQuery<Chapter[]>({
    queryKey: ['/api/chapters'],
  });

  const { data: characters = [], isLoading: charactersLoading } = useQuery<Character[]>({
    queryKey: ['/api/characters'],
  });

  const { data: locations = [], isLoading: locationsLoading } = useQuery<Location[]>({
    queryKey: ['/api/locations'],
  });

  const { data: blogPosts = [], isLoading: blogLoading } = useQuery<BlogPost[]>({
    queryKey: ['/api/blog'],
  });

  const latestChapters = chapters.slice(0, 3);
  const mainCharacters = characters.slice(0, 4);
  const featuredBlogPost = blogPosts[0];
  const recentBlogPosts = blogPosts.slice(1, 4);

  const timeAgo = (date: Date | string) => {
    const now = new Date();
    const publishedDate = new Date(date);
    const diffTime = Math.abs(now.getTime() - publishedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return t.oneDayAgo;
    if (diffDays < 7) return `${diffDays} ${t.daysAgo}`;
    if (diffDays < 14) return t.oneWeekAgo;
    if (diffDays < 21) return t.twoWeeksAgo;
    return t.threeWeeksAgo;
  };

  // Try to autoplay when possible; if blocked (e.g., VS Code Simple Browser), show Play button.
  // Also verify that playback actually advances (codec support) and not just "play" event firing.
  useEffect(() => {
    // Respect prefers-reduced-motion: don't attempt autoplay logic
    if (reduceMotion) return;
    const v = videoRef.current;
    if (!v) return;
    let mounted = true;

    const updateState = () => {
      if (!mounted || !v) return;
      const actuallyPlaying = !v.paused && !v.ended && v.currentTime > 0 && v.readyState >= 2;
      setIsPlaying(actuallyPlaying);
    };

    const tryPlay = async () => {
      if (!v) return;
      try {
        v.muted = true;
        const p = v.play();
        if (p && typeof (p as Promise<void>).then === 'function') await p;
        if (!mounted) return;
        setAutoplayAllowed(true);
        updateState();
      } catch (e) {
        if (!mounted) return;
        setAutoplayAllowed(false);
        updateState();
      }
    };

    const onPlay = () => {
      stalledRef.current = false;
      updateState();
      // Start a short watchdog: if time doesn't advance soon, treat as not playing
      if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current);
      const startAt = v.currentTime;
      stallTimerRef.current = window.setTimeout(() => {
        const advanced = v.currentTime > startAt + 0.15; // ~150ms
        if (!advanced) {
          stalledRef.current = true;
          setIsPlaying(false);
          setAutoplayAllowed(false);
        }
      }, 1200);
    };

    const onPlaying = () => {
      stalledRef.current = false;
      updateState();
    };

    const onTimeupdate = () => {
      lastTimeRef.current = v.currentTime;
      if (!mounted) return;
      if (!v.paused && !v.ended && v.currentTime > 0) {
        setIsPlaying(true);
      }
    };

    const onWaiting = () => {
      stalledRef.current = true;
      setIsPlaying(false);
    };

    const onStalled = () => {
      stalledRef.current = true;
      setIsPlaying(false);
    };

    const onError = () => {
      stalledRef.current = true;
      setAutoplayAllowed(false);
      setIsPlaying(false);
    };

    v.addEventListener('play', onPlay);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('timeupdate', onTimeupdate);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('stalled', onStalled);
    v.addEventListener('error', onError);
    v.addEventListener('pause', updateState);
    v.addEventListener('ended', updateState);
    const onLoaded = () => tryPlay();
  v.addEventListener('loadeddata', onLoaded, { once: true } as any);

    // attempt immediately as well
    tryPlay();

    return () => {
      mounted = false;
      if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('timeupdate', onTimeupdate);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('stalled', onStalled);
      v.removeEventListener('error', onError);
      v.removeEventListener('pause', updateState);
      v.removeEventListener('ended', updateState);
      v.removeEventListener('loadeddata', onLoaded as any);
    };
  }, [reduceMotion]);

  // Lazy-load Codex video only when section is near viewport
  useEffect(() => {
    const el = codexRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldLoadCodexVideo(true);
            io.disconnect();
            break;
          }
        }
      },
      { root: null, rootMargin: '200px', threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const handleManualPlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.muted = true;
      await v.play();
      setAutoplayAllowed(true);
      setIsPlaying(true);
    } catch {
      setAutoplayAllowed(false);
      setIsPlaying(false);
    }
  };

  // Smooth crossfade: as the Codex section scrolls out, fade the video out while
  // revealing a themed gradient + noise bed behind it. Also soften edges with a mask.
  useEffect(() => {
    const el = codexRef.current;
    if (!el) return;

    const update = () => {
      if (!el) return;
      if (reduceMotion) {
        el.style.setProperty('--codex-fade', '0');
        el.style.setProperty('--codex-overlayOpacity', '0.75');
        el.style.setProperty('--codex-noiseOpacity', '0.03');
        return;
      }
      const rect = el.getBoundingClientRect();
      const vh = Math.max(320, window.innerHeight || 0);
      // Begin fading when the top of the section gets near the top of the viewport (15% viewport),
      // and complete only when it has moved well past (-70%), for a longer, smoother range.
      const startTop = vh * 0.15;
      const endTop = -vh * 0.70;
      const raw = (startTop - rect.top) / (startTop - endTop);
      const clamped = Math.min(1, Math.max(0, raw));
      // Smoothstep easing for a softer feel.
      const fade = clamped * clamped * (3 - 2 * clamped);

      // Overlay opacity goes from 0.75 → 0.45 (less aggressive), in sync with eased fade
      const overlayOpacity = 0.75 - 0.30 * fade;
      // Noise grows modestly (0.02 → 0.05) para não “sujar” a imagem
      const noiseOpacity = 0.02 + 0.03 * fade;

      el.style.setProperty('--codex-fade', String(fade));
      el.style.setProperty('--codex-overlayOpacity', overlayOpacity.toFixed(3));
      el.style.setProperty('--codex-noiseOpacity', noiseOpacity.toFixed(3));

      // Optional: pause the video when almost fully faded
      if (fade > 0.98 && videoRef.current && !videoRef.current.paused) {
        try { videoRef.current.pause(); } catch {}
      }
    };

    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll as any);
      window.removeEventListener('resize', onScroll as any);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [reduceMotion]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <HeroSection />

      {/* Latest Chapters */}
      <Reveal className="w-full">
        <section id="chapters" className="py-20 px-4 soft-fade">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 flex flex-col items-center justify-center min-h-32">
              <h2 className="section-title font-display text-3xl md:text-4xl font-bold text-primary mb-4" data-testid="text-latest-chapters">
                <SectionIcon type="rune" />{t.latestChapters || 'Últimos Capítulos'}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t.followEpicJourney || 'Acompanhe a jornada épica em cada capítulo.'}
              </p>
            </div>

            {chaptersLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-card border border-border rounded-lg h-96 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {latestChapters.map((chapter, idx) => (
                  <Reveal key={chapter.id} delay={idx * 80} className="">
                    <ChapterCard key={chapter.id} chapter={chapter} />
                  </Reveal>
                ))}
              </div>
            )}

            <div className="text-center mt-12 flex flex-col items-center justify-center min-h-32">
              <Link href="/chapters">
                <Button className="btn-gold btn-font px-8 py-3 font-semibold hover-glow btn-micro" data-testid="button-view-all-chapters">
                  {t.viewAllChapters || 'Ver todos os capítulos'}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Characters Gallery */}
      <Reveal className="w-full">
        <section id="characters" className="py-20 px-4 bg-muted/30 soft-fade">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mt-12 mb-12">
              <h2 className="section-title font-display text-3xl md:text-4xl font-bold text-primary mb-4" data-testid="text-characters">
                <SectionIcon type="leaf" />{t.characters || 'Personagens'}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t.meetHeroesVillains || 'Conheça heróis, vilões e rostos memoráveis do reino.'}
              </p>
            </div>

            {charactersLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-card border border-border rounded-lg h-96 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {mainCharacters.map((character, idx) => (
                  <Reveal key={character.id} delay={idx * 80} className="">
                    <CharacterCard key={character.id} character={character} />
                  </Reveal>
                ))}
              </div>
            )}

            <div className="text-center mt-12">
              <Link href="/characters">
                <Button
                  className="btn-gold btn-font px-8 py-3 font-semibold hover-glow btn-micro"
                  data-testid="button-view-character-profiles"
                >
                  {t.viewCharacterProfiles || 'Ver perfis de personagens'}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Interactive World Map */}
      <Reveal className="w-full">
        <section id="world" className="py-24 px-4 soft-fade">
          <div className="mx-auto max-w-[1600px] xl:max-w-[1760px] 2xl:max-w-[1920px]">
            <div className="text-center mb-16 flex flex-col items-center justify-center min-h-32">
              <h2 className="section-title font-display text-3xl md:text-4xl font-bold text-primary mb-4" data-testid="text-explore-realms">
                <SectionIcon type="spark" />{t.exploreRealms || 'Explore os Reinos'}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t.discoverVastWorld || 'Descubra o vasto mundo, locais e segredos ocultos.'}
              </p>
            </div>

            {locationsLoading ? (
              <div className="bg-card border border-border rounded-xl h-96 animate-pulse" />
            ) : (
              <WorldMap locations={locations} />
            )}
            <div className="text-center mt-12">
              <Link href="/world">
                <Button className="btn-gold btn-font px-8 py-3 font-semibold hover-glow btn-micro" data-testid="button-world">
                  Explore as Localizações
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Codex Section (title + cards now overlay the background video) */}
      <Reveal className="w-full">
        <section id="codex" className="py-24 bg-muted/30 soft-fade">
          <div className="codex-wrapper">
            {/* Video container with overlayed content */}
            <div
              ref={codexRef}
              className="codex-bg codex-cover full-bleed relative h-[520px] md:min-h-[85vh] lg:min-h-screen overflow-hidden mb-6 codex-crossfade"
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('a, button')) return;
                if (!isPlaying) handleManualPlay();
              }}
              
            >
              {/* Particles and starfield behind the video */}
              <div className="absolute inset-0 z-10 pointer-events-none">
                <HeroParticles />
                <Starfield count={36} />
              </div>

              {/* Themed gradient bed that fades in as video fades out */}
              <div className="absolute inset-0 z-[15] pointer-events-none codex-crossfade-bed" aria-hidden />
              {/* Noise overlay to avoid banding during crossfade */}
              <div className="absolute inset-0 z-[16] pointer-events-none codex-noise" aria-hidden />

              {/* Video */}
              <video
                ref={videoRef}
                autoPlay={!reduceMotion}
                muted
                loop
                playsInline
                preload={shouldLoadCodexVideo ? 'metadata' : 'none'}
                poster="/uploads/nOVOCOVER-poster.jpg"
                className="absolute inset-0 w-full h-full object-contain bg-black z-20 filter brightness-75 codex-video"
                aria-hidden
              >
                {shouldLoadCodexVideo && (
                  <>
                    <source src="/uploads/nOVOCOVER.webm" type="video/webm" />
                    <source src="/uploads/nOVOCOVER.mp4" type="video/mp4" />
                  </>
                )}
              </video>

              {/* Dark overlay above the video for readability */}
              <div className="absolute inset-0 z-30 codex-dark-overlay" aria-hidden />

              {/* Soft mask to blend bottom/top edges while crossfading */}
              <div className="absolute inset-0 pointer-events-none codex-mask" aria-hidden />

              {/* Bottom shadow to ground the transition into the next section (static, non-animated) */}
              <div className="absolute inset-0 pointer-events-none codex-bottom-shadow" aria-hidden />

              {/* Overlay content: title, cards and CTA over the video */}
              <div className="absolute inset-0 z-40 flex items-center justify-center px-4" data-testid="codex-overlay">
                <div className="w-full max-w-7xl pointer-events-auto">
                  <div className="text-center mb-8 md:mb-12 flex flex-col items-center justify-center">
                    <h2 className="section-title font-display text-3xl md:text-4xl font-bold text-primary mb-4" data-testid="text-codex">
                      {t.theCodex || 'O Códex'}
                    </h2>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                      {t.comprehensiveGuide || 'Um guia completo sobre magia, criaturas e locais.'}
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
                    {/* Magic Systems */}
                    <Card className="bg-card border border-border rounded-lg p-6 hover-glow codex-card">
                      <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Wand2 className="text-primary text-2xl h-8 w-8" />
                        </div>
                        <h3 className="font-display text-lg font-semibold text-card-foreground" data-testid="text-magic-systems">
                          {t.magicSystems || 'Sistemas Mágicos'}
                        </h3>
                      </div>
                      <div className="space-y-4">
                        <div className="border-l-2 border-accent pl-4">
                          <h4 className="font-semibold text-card-foreground">{t.elementalMagic || 'Magia Elemental'}</h4>
                          <p className="text-muted-foreground text-sm">{t.elementalMagicDesc || 'Controle sobre fogo, água, terra e ar.'}</p>
                        </div>
                        <div className="border-l-2 border-accent pl-4">
                          <h4 className="font-semibold text-card-foreground">{t.shadowWeaving || 'Tecelagem das Sombras'}</h4>
                          <p className="text-muted-foreground text-sm">{t.shadowWeavingDesc || 'Manipulação da escuridão e da energia do vazio.'}</p>
                        </div>
                        <div className="border-l-2 border-accent pl-4">
                          <h4 className="font-semibold text-card-foreground">{t.divineChanneling || 'Canalização Divina'}</h4>
                          <p className="text-muted-foreground text-sm">{t.divineChannelingDesc || 'Extrair poder de seres celestiais.'}</p>
                        </div>
                      </div>
                    </Card>

                    {/* Creatures */}
                    <Card className="bg-card border border-border rounded-lg p-6 hover-glow codex-card">
                      <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Crown className="text-primary text-2xl h-8 w-8" />
                        </div>
                        <h3 className="font-display text-lg font-semibold text-card-foreground" data-testid="text-creatures-beasts">
                          {t.creaturesBeasts || 'Criaturas e Bestas'}
                        </h3>
                      </div>
                      <div className="space-y-4">
                        <div className="border-l-2 border-accent pl-4">
                          <h4 className="font-semibold text-card-foreground">{t.skyfireDragons || 'Dragões de Fogo Celeste'}</h4>
                          <p className="text-muted-foreground text-sm">{t.skyfireDragonsDesc || 'Antigos guardiões dos cumes montanhosos.'}</p>
                        </div>
                        <div className="border-l-2 border-accent pl-4">
                          <h4 className="font-semibold text-card-foreground">{t.shadowWraiths || 'Espectros das Sombras'}</h4>
                          <p className="text-muted-foreground text-sm">{t.shadowWraithsDesc || 'Almas corrompidas vinculadas à escuridão.'}</p>
                        </div>
                        <div className="border-l-2 border-accent pl-4">
                          <h4 className="font-semibold text-card-foreground">{t.crystalSprites || 'Sprites de Cristal'}</h4>
                          <p className="text-muted-foreground text-sm">{t.crystalSpritesDesc || 'Seres benevolentes de pura energia mágica.'}</p>
                        </div>
                      </div>
                    </Card>

                    {/* Locations */}
                    <Card className="bg-card border border-border rounded-lg p-6 hover-glow codex-card">
                      <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <MapPin className="text-primary text-2xl h-8 w-8" />
                        </div>
                        <h3 className="font-display text-lg font-semibold text-card-foreground" data-testid="text-legendary-locations">
                          {t.legendaryLocations || 'Locais Lendários'}
                        </h3>
                      </div>
                      <div className="space-y-4">
                        <div className="border-l-2 border-accent pl-4">
                          <h4 className="font-semibold text-card-foreground">{t.sunspireTower || 'Torre Sunspire'}</h4>
                          <p className="text-muted-foreground text-sm">{t.sunspireTowerDesc || 'A maior academia mágica, flutuando acima das nuvens.'}</p>
                        </div>
                        <div className="border-l-2 border-accent pl-4">
                          <h4 className="font-semibold text-card-foreground">{t.nethermoorCaverns || 'Cavernas de Nethermoor'}</h4>
                          <p className="text-muted-foreground text-sm">{t.nethermoorCavernsDesc || 'Túneis subterrâneos repletos de magia sombria.'}</p>
                        </div>
                        <div className="border-l-2 border-accent pl-4">
                          <h4 className="font-semibold text-card-foreground">{t.eternalForge || 'Forja Eterna'}</h4>
                          <p className="text-muted-foreground text-sm">{t.eternalForgeDesc || 'Onde armas lendárias são forjadas.'}</p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Overlay CTA row */}
                  <div className="codex-cta-over">
                    <Link href="/codex">
                      <Button className="btn-gold btn-font px-12 py-4 text-lg font-semibold hover-glow" data-testid="button-codex">
                        {t.theCodex || 'Ver o Códex'}
                      </Button>
                    </Link>
                  </div>

                  {/* No explicit play button — video should autoplay silently; fallback click on background still triggers play if blocked */}
                </div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

  {/* Removed animated divider to keep transition above blog simpler and cleaner */}

      {/* Blog Section */}
      <Reveal className="w-full">
  <section id="blog" className="py-20 px-4 mt-40 soft-fade gradient-bridge-top">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 flex flex-col items-center justify-center min-h-32">
              <h2 className="section-title font-display text-3xl md:text-4xl font-bold text-primary mb-4" data-testid="text-authors-chronicles">
                {t.authorsChronicles || 'Crônicas do Autor'}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t.behindScenesInsights || 'Bastidores e insights do autor'}
              </p>
            </div>

            {blogLoading ? (
              <div className="grid lg:grid-cols-2 gap-8">
                <div className="bg-card border border-border rounded-lg h-96 animate-pulse" />
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-card border border-border rounded-lg h-32 animate-pulse" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Featured Blog Post */}
                {featuredBlogPost && (
                  <Card className="bg-card border border-border rounded-lg overflow-hidden hover-glow">
                    {featuredBlogPost.imageUrl && (
                      <img
                        src={featuredBlogPost.imageUrl}
                        alt={featuredBlogPost.title}
                        className="w-full h-48 object-cover"
                        loading="lazy"
                        decoding="async"
                        sizes="(max-width: 1024px) 100vw, 50vw"
                      />
                    )}
                    <CardContent className="p-6">
                      <div className="flex items-center mb-3">
                        <span className="bg-accent/20 text-accent px-3 py-1 rounded-full text-sm font-medium">
                          {featuredBlogPost.category}
                        </span>
                        <span className="text-muted-foreground text-sm ml-4">
                          {timeAgo(featuredBlogPost.publishedAt)}
                        </span>
                      </div>
                      <h3 className="font-display text-xl font-semibold text-card-foreground mb-3" data-testid={`text-blog-title-${featuredBlogPost.id}`}>
                        {featuredBlogPost.title}
                      </h3>
                      <p className="text-muted-foreground mb-4" data-testid={`text-blog-excerpt-${featuredBlogPost.id}`}>
                        {featuredBlogPost.excerpt}
                      </p>
                      <Button
                        variant="ghost"
                        className="text-primary hover:text-accent transition-colors font-medium p-0"
                        data-testid={`button-read-blog-${featuredBlogPost.id}`}
                      >
                        {t.readMore} →
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Blog Posts List */}
                <div className="space-y-6">
                  {recentBlogPosts.map((post, idx) => (
                    <Reveal key={post.id} delay={idx * 80} className="">
                      <Card key={post.id} className="bg-card border border-border rounded-lg p-6 hover-glow">
                        <div className="flex items-center mb-2">
                          <span className="bg-primary/20 text-primary px-2 py-1 rounded text-xs font-medium">
                            {post.category}
                          </span>
                          <span className="text-muted-foreground text-sm ml-3">
                            {timeAgo(post.publishedAt)}
                          </span>
                        </div>
                        <h4 className="font-display text-lg font-semibold text-card-foreground mb-2" data-testid={`text-blog-title-${post.id}`}>
                          {post.title}
                        </h4>
                        <p className="text-muted-foreground text-sm" data-testid={`text-blog-excerpt-${post.id}`}>
                          {post.excerpt}
                        </p>
                      </Card>
                    </Reveal>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </Reveal>

      {/* Blog CTA (moved under the two blog cards) */}
      <div className="max-w-7xl mx-auto text-center mt-8">
        <Link href="/blog">
          <Button className="btn-gold btn-font px-8 py-3 font-semibold hover-glow btn-micro" data-testid="button-chronicles">
            {t.processCreation || 'Processo de criação'}
          </Button>
        </Link>
      </div>

      <NewsletterSignup />
      <Footer />
    </div>
  );
}
