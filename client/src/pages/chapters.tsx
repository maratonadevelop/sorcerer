import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import ChapterCard from "@/components/chapter-card";
import Footer from "@/components/footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Chapter } from "@shared/schema";
// translations removed — single-language
import { useLanguage } from '@/contexts/LanguageContext';
import { Search, X, Layers, RefreshCw, LayoutGrid, List, ArrowDownNarrowWide, ArrowUpNarrowWide } from "lucide-react";

export default function Chapters() {
  const [searchQuery, setSearchQuery] = useState("");
  const [chapterNumber, setChapterNumber] = useState<string>("");
  const [arcFilter, setArcFilter] = useState<string>("");
  // single-language: use primary fields only
  
  const { data: chapters = [], isLoading } = useQuery<Chapter[]>({
    queryKey: ['/api/chapters'],
  });

  const { t } = useLanguage();

  const localizedFields = (item: any, field: string) => item?.[field] || '';

  // Ordenação e visualização (declarar antes dos efeitos que usam)
  type SortMode = 'number-asc' | 'date-desc' | 'date-asc';
  const [sortMode, setSortMode] = useState<SortMode>('number-asc');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  // Busca inteligente com debounce
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearchQuery(searchQuery), 200);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // Sync estado <-> URL (compartilhável)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (searchQuery) params.set('q', searchQuery); else params.delete('q');
    if (chapterNumber) params.set('ch', chapterNumber); else params.delete('ch');
    if (arcFilter) params.set('arc', arcFilter); else params.delete('arc');
    if (viewMode !== 'cards') params.set('view', viewMode); else params.delete('view');
    params.set('sort', sortMode);
    const url = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, chapterNumber, arcFilter, viewMode, sortMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    const ch = params.get('ch');
    const ar = params.get('arc');
    const vw = params.get('view') as 'cards' | 'list' | null;
    const st = params.get('sort') as SortMode | null;
    if (q) setSearchQuery(q);
    if (ch) setChapterNumber(ch);
    if (ar) setArcFilter(ar);
    if (vw) setViewMode(vw);
    if (st) setSortMode(st);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredChapters = chapters.filter((chapter: any) => {
    // Busca considera título, excerpt, número e arco
    const haystack = `${localizedFields(chapter, 'title')} ${localizedFields(chapter, 'excerpt')} ${chapter.chapterNumber ?? ''} ${(chapter.arcNumber ?? '')} ${(chapter.arcTitle ?? '')}`
      .toLowerCase();
    const textMatch = haystack.includes(debouncedSearchQuery.toLowerCase());
    const chapterMatch = chapterNumber
      ? String(chapter.chapterNumber || '').toLowerCase() === String(chapterNumber).toLowerCase()
      : true;
    const arcMatch = arcFilter
      ? `${chapter.arcNumber ?? ''} ${chapter.arcTitle ?? ''}`.toLowerCase().includes(arcFilter.toLowerCase())
      : true;
    return textMatch && chapterMatch && arcMatch;
  });

  // Group chapters by Arc (number + title). Chapters without arc go to "Outros".
  type ArcGroup = { key: string; arcNumber: number | null; arcTitle: string | null; chapters: Chapter[] };

  const arcGroups = useMemo<ArcGroup[]>(() => {
    const map = new Map<string, ArcGroup>();
    for (const ch of filteredChapters) {
      const num = (ch as any).arcNumber ?? null;
      const title = (ch as any).arcTitle ?? null;
      const key = `${num ?? 'none'}|${title ?? ''}`;
      if (!map.has(key)) {
        map.set(key, { key, arcNumber: num, arcTitle: title, chapters: [] });
      }
      map.get(key)!.chapters.push(ch);
    }
    const arr = Array.from(map.values());
    // Sort arcs: numeric first ascending, then nones, then by title
    arr.sort((a, b) => {
      const aNum = a.arcNumber ?? Number.POSITIVE_INFINITY;
      const bNum = b.arcNumber ?? Number.POSITIVE_INFINITY;
      if (aNum !== bNum) return aNum - bNum;
      const aTitle = (a.arcTitle ?? '').toLowerCase();
      const bTitle = (b.arcTitle ?? '').toLowerCase();
      return aTitle.localeCompare(bTitle);
    });
    // Sort chapters inside each arc by selected mode
    for (const g of arr) {
      g.chapters.sort((a, b) => {
        if (sortMode === 'number-asc') {
          return (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0);
        }
        const aDate = new Date(a.publishedAt).getTime();
        const bDate = new Date(b.publishedAt).getTime();
        return sortMode === 'date-desc' ? (bDate - aDate) : (aDate - bDate);
      });
    }
    return arr;
  }, [filteredChapters, sortMode]);

  // Manage expanded arcs (accordion "multiple")
  const [expandedArcs, setExpandedArcs] = useState<string[]>([]);
  const arcRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    // If filters change and expanded is empty, expand all groups that match (small UX sugar)
    if (expandedArcs.length === 0 && arcGroups.length > 0) {
      setExpandedArcs(arcGroups.map(g => g.key));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arcGroups.length, searchQuery, chapterNumber, arcFilter]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-primary mb-4" data-testid="text-chapters-title">
              {t.allChapters}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
              {t.allChaptersDesc}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-4xl mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  type="text"
                  placeholder={t.searchChapters || "Buscar capítulos por título, número, trecho ou arco"}
                  aria-label="Buscar capítulos"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 bg-input border-border text-foreground placeholder:text-muted-foreground"
                  data-testid="input-search-chapters"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Limpar busca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    data-testid="btn-clear-search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Input
                type="number"
                placeholder="Filtrar por nº do capítulo"
                aria-label="Filtrar por número do capítulo"
                value={chapterNumber}
                onChange={(e) => setChapterNumber(e.target.value)}
                onWheel={(e) => { (e.target as HTMLInputElement).blur(); }}
                onKeyDown={(e) => { if (["e","E","+","-","."].includes(e.key)) e.preventDefault(); }}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                data-testid="input-filter-chapter-number"
              />
              <>
                <Input
                  type="text"
                  list="arc-options"
                  placeholder="Filtrar por arco (número ou nome)"
                  aria-label="Filtrar por arco"
                  value={arcFilter}
                  onChange={(e) => setArcFilter(e.target.value)}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                  data-testid="input-filter-arc"
                />
                {/* Sugestões de arcos */}
                <datalist id="arc-options">
                  {Array.from(
                    new Set(
                      chapters
                        .map((ch: any) => `${ch.arcNumber ?? ''} ${ch.arcTitle ?? ''}`.trim())
                        .filter(Boolean)
                    )
                  ).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })).map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </>
            </div>

            {/* Quick arc picker chips */}
            {arcGroups.length > 0 && (
              <div className="mt-6 -mx-4 px-4" aria-label="Seleção rápida de arcos">
                <div className="overflow-x-auto pb-1">
                  <div className="flex items-center justify-center gap-2 w-max mx-auto">
                    <Badge
                      className={`cursor-pointer ${arcFilter.trim() === '' ? '' : 'opacity-70 hover:opacity-100'} bg-accent/30 text-accent-foreground border-border flex-shrink-0`}
                      onClick={() => setArcFilter('')}
                      title="Mostrar todos os arcos"
                    >
                      Todos
                    </Badge>
                    {arcGroups.map(g => (
                      <Badge
                        key={g.key}
                        className="cursor-pointer hover:shadow-sm bg-card border-border text-foreground flex-shrink-0"
                        onClick={() => setArcFilter(((g.arcNumber ?? '') + ' ' + (g.arcTitle ?? '')).trim())}
                        title={`Filtrar por Arco ${g.arcNumber ?? ''}${g.arcTitle ? `: ${g.arcTitle}` : ''}`}
                      >
                        <Layers className="h-3.5 w-3.5 mr-1" />
                        Arco {g.arcNumber ?? '–'}{g.arcTitle ? `: ${g.arcTitle}` : ''}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Resumo filtros ativos */}
            {(searchQuery || chapterNumber || arcFilter) && (
              <div className="mt-4 flex items-center justify-center gap-2 flex-wrap text-xs">
                {searchQuery && (
                  <Badge className="bg-primary/20 text-primary-foreground/90 border-border cursor-pointer" onClick={() => setSearchQuery("")}>Buscar: "{searchQuery}" ✕</Badge>
                )}
                {chapterNumber && (
                  <Badge className="bg-secondary/20 text-secondary-foreground/90 border-border cursor-pointer" onClick={() => setChapterNumber("")}>Capítulo: {chapterNumber} ✕</Badge>
                )}
                {arcFilter && (
                  <Badge className="bg-accent/30 text-accent-foreground border-border cursor-pointer" onClick={() => setArcFilter("")}>Arco: {arcFilter} ✕</Badge>
                )}
              </div>
            )}

            {/* Controls */}
            <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedArcs(arcGroups.map(g => g.key))}
              >
                Expandir todos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedArcs([])}
              >
                Recolher todos
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearchQuery(''); setChapterNumber(''); setArcFilter(''); }}
                title="Limpar filtros"
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Limpar filtros
              </Button>
              {/* Ordenação */}
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted-foreground mr-1">Ordenar:</span>
                <Button variant={sortMode==='number-asc'? 'default':'outline'} size="sm" onClick={() => setSortMode('number-asc')}>
                  <ArrowUpNarrowWide className="h-4 w-4 mr-1"/> Nº</Button>
                <Button variant={sortMode==='date-desc'? 'default':'outline'} size="sm" onClick={() => setSortMode('date-desc')}>
                  <ArrowDownNarrowWide className="h-4 w-4 mr-1"/> Data</Button>
                <Button variant={sortMode==='date-asc'? 'default':'outline'} size="sm" onClick={() => setSortMode('date-asc')}>
                  <ArrowUpNarrowWide className="h-4 w-4 mr-1"/> Data</Button>
              </div>
              {/* Modo de visualização */}
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted-foreground mr-1">Visualização:</span>
                <Button variant={viewMode==='cards'? 'default':'outline'} size="sm" onClick={() => setViewMode('cards')} title="Cards">
                  <LayoutGrid className="h-4 w-4"/>
                </Button>
                <Button variant={viewMode==='list'? 'default':'outline'} size="sm" onClick={() => setViewMode('list')} title="Lista">
                  <List className="h-4 w-4"/>
                </Button>
              </div>
            </div>
          </div>
          
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-card border border-border rounded-lg h-96 animate-pulse" />
              ))}
            </div>
          ) : filteredChapters.length === 0 ? (
            <div className="text-center py-20">
              <h3 className="font-display text-2xl font-semibold text-muted-foreground mb-4" data-testid="text-no-chapters">
                {searchQuery ? t.noChaptersFound : t.noChapters}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery ? t.adjustSearchTerms : t.chaptersWillAppear}
              </p>
            </div>
          ) : (
            <div>
              <Accordion type="multiple" value={expandedArcs} onValueChange={(v) => setExpandedArcs(v as string[])}>
                {arcGroups.map(group => (
                  <AccordionItem
                    key={group.key}
                    value={group.key}
                    className="my-3 rounded-lg border border-border bg-card/40 px-2"
                  >
                    <AccordionTrigger className="px-2">
                      <div className="w-full flex items-center justify-between" ref={(el) => { arcRefs.current[group.key] = el; }}>
                        <div className="text-left">
                          <div className="font-display text-xl md:text-2xl text-primary">
                            Arco {group.arcNumber ?? '–'}{group.arcTitle ? `: ${group.arcTitle}` : ''}
                          </div>
                          <div className="text-xs text-muted-foreground">{group.chapters.length} capítulo(s)</div>
                        </div>
                        {/* subtle accent bar */}
                        <div className="hidden md:block h-8 w-1 rounded-full bg-gradient-to-b from-primary/60 to-accent/60" />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {viewMode === 'cards' ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                          {group.chapters.map(ch => (
                            <ChapterCard key={ch.id} chapter={ch} />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {group.chapters.map(ch => (
                            <a key={ch.id} href={`/chapters/${ch.slug}`} className="flex items-center justify-between rounded-md border border-border bg-card/60 px-3 py-2 hover:bg-card">
                              <div>
                                <div className="font-medium text-foreground">Capítulo {ch.chapterNumber}: {localizedFields(ch, 'title')}</div>
                                <div className="text-xs text-muted-foreground">{new Date(ch.publishedAt).toLocaleDateString()}</div>
                              </div>
                              <div className="text-xs text-accent">{ch.readingTime} {t.minRead}</div>
                            </a>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}


