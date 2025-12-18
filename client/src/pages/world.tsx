import React from 'react';
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import type { Location } from "@shared/schema";
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from 'wouter';

export default function World() {
  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ['/api/locations'],
  });
  const [, setLocation] = useLocation();

  const { t } = useLanguage();

  const typePt = (type: string) => {
    const map: Record<string, string> = {
      kingdom: 'Reino',
      city: 'Cidade',
      capital: 'Capital',
      forest: 'Floresta',
      ruins: 'Ruínas',
      mountains: 'Montanhas',
      desert: 'Deserto',
      ocean: 'Oceano',
      plains: 'Planícies',
      other: 'Outro',
      islands: 'Ilhas',
      island: 'Ilha',
      ilha: 'Ilha',
      montanha: 'Montanha',
      montanhas: 'Montanhas',
    };
    return map[type] || type;
  };

  const themes: Record<string, { color: string; gradient: string }> = {
    luminah: { color: '#ffd28a', gradient: 'linear-gradient(135deg,#ffd28a 0%,#ffb36b 100%)' },
    akeli: { color: '#7ee7c6', gradient: 'linear-gradient(135deg,#bff6e8 0%,#56d8b0 100%)' },
    umbra: { color: '#c7b3ff', gradient: 'linear-gradient(135deg,#d7cbff 0%,#9a7bff 100%)' },
    aquario: { color: '#8fd8ff', gradient: 'linear-gradient(135deg,#cfeeff 0%,#61bfff 100%)' },
    ferros: { color: '#f0a78a', gradient: 'linear-gradient(135deg,#f6c8b8 0%,#e07a50 100%)' },
    silvanum: { color: '#9be59a', gradient: 'linear-gradient(135deg,#cff7cf 0%,#60c65f 100%)' },
  };

  // per-type color hints for buttons (used for active / hover accents)
  const typeColors: Record<string, string> = {
    ocean: '#5fb7ff',
    ruins: '#8b2e2e',
    forest: '#57b66a',
    mountains: '#b08968',
    desert: '#d3a24a',
    city: '#9bb0ff',
    capital: '#ffd86a',
    kingdom: '#cfa87a',
    plains: '#c9d9a5',
    islands: '#7fd1c7',
    other: '#9aa1a6',
  };

  // tags removed from header filter per UX: keep search and type filters only

  const [query, setQuery] = React.useState('');
  const [activeTypeFilter, setActiveTypeFilter] = React.useState<string | null>(null);

  const matchesFilter = (l: Location) => {
    const rawSlug = (((l as any).slug) ?? '') as string;
    const computedSlug = rawSlug.trim() || (l.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slugOrId = (computedSlug || (l.id || '') as string).toString().toLowerCase();
    const title = (l.name || '').toString().toLowerCase();
    const q = query.trim().toLowerCase();
    if (q) {
      if (!slugOrId.includes(q) && !title.includes(q)) return false;
    }
    if (activeTypeFilter) {
      if ((l.type || 'other') !== activeTypeFilter) return false;
    }
    // tag-based filtering removed; only query and type filters remain
    return true;
  };

  // locations that should be shown in "Outros Locais" (exclude the six top continents)
  const filteredLocations = React.useMemo(() => {
    return (locations || [])
      .filter((l) => !['luminah','akeli','umbra','aquario','ferros','silvanum'].includes(((l.id || '') as string).toLowerCase()))
      .filter(matchesFilter);
  }, [locations, query, activeTypeFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#081017] via-[#071726] to-[#071522] text-foreground" style={{ backgroundImage: 'radial-gradient(ellipse at 10% 10%, rgba(150,120,255,0.03) 0%, transparent 20%), radial-gradient(ellipse at 90% 90%, rgba(80,200,255,0.02) 0%, transparent 18%)' }}>
      <Navigation />

      <main className="pt-16 pb-20 px-4 flex flex-col items-center">
        <div className="w-full max-w-5xl mx-auto">
          {isLoading ? (
            <div className="bg-card border border-border rounded-xl h-24 animate-pulse mb-8" />
          ) : null}

          <section className="mx-auto mb-12 flex flex-col items-center text-center">
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-[color:#e6cfa3] mb-3" style={{ textShadow: '0 6px 30px rgba(0,0,0,0.7)' }}>Os Ecos da Primeira Geração</h2>
            <p className="text-muted-foreground/80 max-w-3xl mx-auto mb-6">Ecos antigos das primeiras massas de terra — continentes que guardam a memória e as lendas da aurora do mundo. Explore as regiões primordiais abaixo.</p>

            <div className="w-full px-2 sm:px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {['luminah','akeli','umbra','aquario','ferros','silvanum'].map((slug) => {
                const loc = locations.find((l) => ((l.id || '') as string).toLowerCase() === slug || (((l as any).slug || '') as string).toLowerCase() === slug || (l.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === slug);
                const title = loc?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);
                const desc = loc?.description ?? '';
                const type = loc?.type ?? 'other';
                const href = `/mundo/${loc?.id ?? slug}`;

                const theme = themes[slug] ?? { color: '#ffd28a', gradient: 'linear-gradient(135deg,#ffd28a 0%,#ffb36b 100%)' };

                // ensure the top cards always render (they represent continents)
                // for continent cards we only want the synthetic 'continente' tag —
                // ignore any other tags they might have in the data
                const ensureTags = (_rawTags?: string) => 'continente';
                const locView = loc ? ({ ...loc, tags: ensureTags((loc as any).tags) }) : undefined;

                return (
                  <Card
                    key={slug}
                    onClick={(e) => {
                      try { window.dispatchEvent(new CustomEvent('continent-click', { detail: { slug, name: title } })); } catch (err) {}
                      setLocation(href);
                    }}
                    role="button"
                    tabIndex={0}
                    className="relative group cursor-pointer transform hover:scale-102 transition-transform duration-220 ease-out shadow-lg overflow-hidden border border-border/30 rounded-2xl bg-gradient-to-b from-card/60 to-card/40"
                    style={{ ['--accent' as any]: theme.color }}
                    onMouseEnter={(e) => {
                      // dispatch a global event so the SVG map tooltip can also show
                      try { window.dispatchEvent(new CustomEvent('continent-hover', { detail: { slug, name: title, x: (e as any).clientX + 12, y: (e as any).clientY + 12 } })); } catch (err) {}
                    }}
                    onMouseMove={(e) => { try { window.dispatchEvent(new CustomEvent('continent-move', { detail: { x: (e as any).clientX + 12, y: (e as any).clientY + 12 } })); } catch (err) {} }}
                    onMouseLeave={() => { try { window.dispatchEvent(new CustomEvent('continent-leave')); } catch (err) {} }}
                  >
                    {locView && locView.imageUrl ? (
                          <div className="relative w-full h-48 overflow-hidden rounded-t-2xl">
                            <img src={locView.imageUrl} alt={title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-20 transition-opacity duration-500" style={{ background: `${theme.gradient}` }} />
                        <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full opacity-0 group-hover:opacity-30 blur-2xl transform rotate-12 pointer-events-none transition-opacity duration-500" style={{ background: theme.color }} />
                      </div>
                    ) : (
                      <div className="w-full h-48 bg-muted/30 rounded-t-2xl" aria-hidden="true" />
                    )}
                    <CardContent className="p-6">
                      <div className="mb-2 flex items-center justify-end">
                        <a href={href} onClick={(e) => { e.stopPropagation(); setLocation(href); }} className="text-[var(--accent)] underline group-hover:text-white">Ver</a>
                      </div>
                      <h3 className="font-display text-xl md:text-2xl font-extrabold transition-all duration-200 ease-out text-[var(--accent)] tracking-wide">{title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground/80 leading-relaxed line-clamp-3">{desc}</p>
                    </CardContent>
                    {/* small continent color dot + slug at bottom-left (restore previous behavior) */}
                    <div className="absolute left-4 bottom-6 z-20 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full block border border-white/8" style={{ background: theme.color }} />
                      <span className="text-[color:var(--accent)]/80 lowercase text-xs">{slug}</span>
                    </div>
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      <div className="absolute -left-40 top-0 w-48 h-full transform -skew-x-12 opacity-0 group-hover:opacity-90 group-hover:translate-x-[220%] transition-all duration-700 ease-in-out" style={{ background: `linear-gradient(90deg, transparent 0%, ${theme.color}22 45%, ${theme.color}55 55%, transparent 100%)` }} />
                    </div>
                    <div className="pointer-events-none absolute inset-0 rounded-lg ring-0 group-hover:ring-4 group-hover:ring-[color:var(--accent)] group-hover:opacity-90 transition-all duration-300" />
                  </Card>
                );
              })}
            </div>
          </section>

          <div className="w-full max-w-5xl mx-auto mt-8 mb-6">
            <div className="w-full flex items-center justify-center my-8">
              <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent w-1/4 md:w-1/3" />
              <div className="mx-4 text-sm text-muted-foreground/80 uppercase tracking-widest">Outros Locais</div>
              <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent w-1/4 md:w-1/3" />
            </div>

            {/* Combined search + improved type filter placed under Outros Locais */}
            <div className="w-full max-w-5xl mx-auto mb-6">
              <div className="flex flex-col items-center gap-4 justify-center mb-4">
                <div className="w-full md:w-2/3 flex items-center bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] border border-border/10 rounded-xl px-4 py-3 shadow-[0_8px_20px_rgba(2,6,23,0.6)] transition-shadow duration-200 hover:shadow-[0_12px_30px_rgba(2,6,23,0.7)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-3 opacity-70"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={'Buscar por slug, nome ou id...'} aria-label="Busca por slug, nome ou id" className="bg-transparent outline-none text-sm w-full placeholder:opacity-80" />
                  <div className="flex items-center gap-2 ml-4">
                    {query ? (
                      <button onClick={() => { setQuery(''); }} className="px-3 py-1 rounded-md text-sm bg-transparent border border-border/10 hover:bg-muted/6">Limpar</button>
                    ) : null}
                  </div>
                </div>

                <div className="w-full flex items-center justify-between px-2 md:px-0 gap-4">
                  <div className="flex-shrink-0">
                    <button onClick={() => { setQuery(''); setActiveTypeFilter(null); }} className="px-3 py-2 rounded-full text-sm font-semibold bg-transparent border border-border/10 hover:bg-muted/6 focus:outline-none focus:ring-2 focus:ring-[color:#ffd86a]">Todos</button>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-3 justify-center">
                  {React.useMemo(() => {
                    // compute counts from search-only filtered set (do not apply activeTypeFilter)
                    const set = new Map<string, number>();
                    (locations || [])
                      .filter((l) => !['luminah','akeli','umbra','aquario','ferros','silvanum'].includes(((l.id || '') as string).toLowerCase()))
                      .filter((l) => {
                        const q = query.trim().toLowerCase();
                        if (!q) return true;
                        const rawSlug = (((l as any).slug) ?? '') as string;
                        const computedSlug = rawSlug.trim() || (l.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        const slugOrId = (computedSlug || (l.id || '') as string).toString().toLowerCase();
                        const title = (l.name || '').toString().toLowerCase();
                        return slugOrId.includes(q) || title.includes(q);
                      })
                      .forEach((l) => {
                        const key = l.type || 'other';
                        set.set(key, (set.get(key) || 0) + 1);
                      });
                    return Array.from(set.entries()).map(([k, count]) => ({ k, count }));
                  }, [locations, query]).map(({ k: typeKey, count }) => {
                    const active = activeTypeFilter === typeKey;
                    const label = typePt(typeKey || 'other');
                    // neutral look: no color by default; active filter highlights and dims others but keep all pills visible
                    const dimmed = activeTypeFilter && !active;
                    return (
                      <button
                        key={typeKey}
                        onClick={() => setActiveTypeFilter(active ? null : typeKey)}
                        className={`relative group flex items-center gap-3 px-3 py-2 rounded-full text-sm font-semibold tracking-wide transition-all duration-300 ease-out ${active ? 'text-black' : 'text-muted-foreground'} hover:text-[color:#e6cfa3] focus:outline-none focus:ring-2 focus:ring-[color:#e6cfa3]`}
                        aria-pressed={active}
                        style={active ? { background: 'rgba(230,205,150,0.95)', boxShadow: '0 8px 22px rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.04)', color: '#071522', transform: 'scale(1.02)' } : { background: 'transparent', border: '1px solid rgba(255,255,255,0.02)', opacity: dimmed ? 0.35 : 0.95, transform: dimmed ? 'scale(0.985)' : 'scale(1)' }}
                      >
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/6 text-xs font-mono ${active ? '' : 'opacity-80'}`}>{count}</span>
                        <span className={`uppercase transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-90'} group-hover:opacity-100`}>{label}</span>
                      </button>
                    );
                  })}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {locations
                .filter((l) => !['luminah','akeli','umbra','aquario','ferros','silvanum'].includes(((l.id || '') as string).toLowerCase()))
                .filter(matchesFilter)
                .map((loc) => (
                  <Card key={loc.id} onClick={() => setLocation(`/mundo/${loc.id}`)} role="button" tabIndex={0} className="relative group cursor-pointer transform hover:scale-102 transition-transform duration-150 ease-out shadow-md overflow-hidden">
                    {loc.imageUrl ? (
                      <img src={loc.imageUrl} alt={loc.name} className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-40 bg-muted/30" />
                    )}
                    <CardContent className="p-4 pb-10">
                      <h4 className="font-display text-lg font-semibold text-card-foreground">{loc.name}</h4>
                      <p className="mt-1 text-sm text-muted-foreground/80 truncate">{loc.description}</p>
                      <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
                        <span>{typePt(loc.type || 'other')}</span>
                        <a href={`/mundo/${loc.id}`} onClick={(e) => { e.stopPropagation(); setLocation(`/mundo/${loc.id}`); }} className="text-primary underline">Ver</a>
                      </div>
                    </CardContent>
                    {/* small continent color dot + slug at bottom-left for locations (restore previous behavior) */}
                    {(() => {
                      try {
                        const tags = (loc as any).tags || '';
                        const found = String(tags).split(',').map((s) => s.trim()).find((t) => Object.keys(themes).includes(t));
                        if (found) {
                          const color = themes[found].color || '#ffd28a';
                          return (
                            <div className="absolute left-4 bottom-6 z-20 flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full block border border-white/8" style={{ background: color }} />
                              <span className="text-[color:var(--accent)]/80 lowercase text-xs">{found}</span>
                            </div>
                          );
                        }
                      } catch (e) { /* noop */ }
                      return null;
                    })()}
                  </Card>
                ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}


