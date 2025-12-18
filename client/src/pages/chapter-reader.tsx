import { useParams, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import ReadingProgress from "@/components/reading-progress";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Bookmark, Settings } from "lucide-react";
import { useReadingProgress } from "@/hooks/use-reading-progress";
import { useLanguage } from '@/contexts/LanguageContext';
import type { Chapter } from "@shared/schema";
import DOMPurify from 'dompurify';
import { useImageLightbox } from '@/components/image-lightbox';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RichEditor from "@/components/rich-editor";
import { ChapterForm } from './admin';
import { useState, useEffect } from "react";
import { useAudio } from '@/contexts/AudioProvider';
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { bumpRevision } from "@/lib/revision";
import { authHeaders } from "@/lib/authHeaders";

export default function ChapterReader() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const auth = useAuth();
  const isAdmin = auth?.isAdmin;
  const queryClient = useQueryClient();
  const { setEntity } = useAudio();
  
  const { data: chapter, isLoading } = useQuery<Chapter>({
    queryKey: ['/api/chapters', slug],
    enabled: !!slug,
  });

  const { data: allChapters = [] } = useQuery<Chapter[]>({
    queryKey: ['/api/chapters'],
  });

  const { language, t } = useLanguage();

  const { progress } = useReadingProgress(chapter?.id || '');

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (chapter && isEditing) {
      setTitle(chapter.title || '');
      setSubtitle(chapter.excerpt || '');
      setContent(chapter.content || '');
    }
  }, [chapter, isEditing]);

  const generateSlug = (text: string) =>
    (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

  const estimateReadingTime = (html: string) => {
    const wordCount = (html || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(w => w.length > 0).length;
    return Math.max(1, Math.ceil(wordCount / 250));
  };

  const updateChapter = useMutation({
    mutationFn: async (payload: any) => {
      if (!chapter) return;
      const res = await fetch(`/api/admin/chapters/${chapter.id}`, {
        method: 'PUT',
        headers: authHeaders({ 'content-type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Update failed' }));
        throw new Error(err.message || 'Update failed');
      }
      return res.json();
    },
    onSuccess: () => {
      bumpRevision();
      queryClient.invalidateQueries({ queryKey: ['/api/chapters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chapters', slug] });
      toast({ title: 'Capítulo atualizado com sucesso!' });
      setIsEditing(false);
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao atualizar capítulo', description: String(e?.message || e), variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <main className="pt-24 pb-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-xl h-96 animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <main className="pt-24 pb-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
              <h1 className="font-display text-3xl font-bold text-destructive mb-4" data-testid="text-chapter-not-found">
                {t.chapterNotFound || 'Capítulo não encontrado'}
              </h1>
              <p className="text-muted-foreground mb-8">
                {t.chapterNotFoundDesc || 'O capítulo que você procura não existe ou foi movido.'}
              </p>
              <Link href="/chapters">
                <Button data-testid="button-back-to-chapters">
                  {t.backToChapters || 'Voltar aos capítulos'}
                </Button>
              </Link>
          </div>
        </main>
      </div>
    );
  }

  // Set global audio context to this chapter while reading
  useEffect(() => {
    if (chapter?.id) {
      setEntity({ type: 'chapter', id: chapter.id });
    }
    return () => { setEntity(null); };
  }, [chapter?.id, setEntity]);

  // Ensure deterministic navigation order: by arcNumber asc, then chapterNumber asc, then publishedAt asc
  const sortedChapters = [...allChapters].sort((a, b) => {
    const aArc = (a as any).arcNumber ?? Number.POSITIVE_INFINITY;
    const bArc = (b as any).arcNumber ?? Number.POSITIVE_INFINITY;
    if (aArc !== bArc) return aArc - bArc;
    const aNum = (a.chapterNumber ?? Number.POSITIVE_INFINITY);
    const bNum = (b.chapterNumber ?? Number.POSITIVE_INFINITY);
    if (aNum !== bNum) return aNum - bNum;
    const aDate = new Date(a.publishedAt).getTime();
    const bDate = new Date(b.publishedAt).getTime();
    return aDate - bDate;
  });

  const currentIndex = sortedChapters.findIndex(c => c.id === chapter.id);
  const previousChapter = currentIndex > 0 ? sortedChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < sortedChapters.length - 1 ? sortedChapters[currentIndex + 1] : null;

  const localized = (item: any, field: string) => {
    try {
  return item?.[field] || '';
    } catch (e) {
      return item?.[field] || '';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h1 className="font-display text-2xl font-semibold text-card-foreground" data-testid="text-chapter-title">
                  {localized(chapter, 'title')}
                </h1>
                <p className="text-muted-foreground text-sm" data-testid="text-chapter-meta">
                  {(chapter as any).arcNumber ? `Arco ${(chapter as any).arcNumber}${(chapter as any).arcTitle ? `: ${(chapter as any).arcTitle}` : ''} • ` : ''}
                  {t.published || 'Publicado'} {new Date(chapter.publishedAt).toLocaleDateString()} • {chapter.readingTime} {t.minRead || 'min'}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                {previousChapter && (
                  <Link href={`/chapters/${previousChapter.slug}`}>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title={t.previous}
                      data-testid="button-previous-chapter"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  </Link>
                )}
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  title={t.bookmark || 'Favoritar'}
                  data-testid="button-bookmark"
                >
                  <Bookmark className="h-5 w-5" />
                </Button>
                {isAdmin && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title={isEditing ? 'Cancelar edição' : (t.settings || 'Editar capítulo')}
                    data-testid="button-settings"
                    onClick={() => setIsEditing((v) => !v)}
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                )}
                {nextChapter && (
                  <Link href={`/chapters/${nextChapter.slug}`}>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title={t.next}
                      data-testid="button-next-chapter"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            
            <CardContent className="p-8">
              {isAdmin && isEditing ? (
                <div data-testid="chapter-inline-editor">
                  <ChapterForm
                    initial={chapter}
                    onSubmit={async (payload) => {
                      await updateChapter.mutateAsync(payload);
                    }}
                    isSaving={updateChapter.isPending}
                  />
                  <div className="flex gap-3 justify-end mt-2">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="max-w-none" data-testid="content-chapter-text">
                  <div className="rounded-lg border border-border p-6 bg-black/20">
                    <article className="prose prose-invert max-w-none content-prose">
                      <div className="whitespace-normal break-words break-all" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(chapter.content ?? '') }} onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target && target.tagName === 'IMG') {
                              const img = target as HTMLImageElement;
                              // open lightbox
                              try { (window as any).__openImageLightbox(img.src, img.alt || '', img); } catch {}
                            }
                          }} />
                    </article>
                  </div>
                </div>
              )}

              <ReadingProgress progress={progress} />
              
              {/* Chapter Navigation */}
              <div className="flex justify-between items-center mt-12 pt-8 border-t border-border">
                {previousChapter ? (
                  <Link href={`/chapters/${previousChapter.slug}`}>
                    <Button variant="outline" className="flex items-center gap-2" data-testid="button-previous-nav">
                      <ChevronLeft className="h-4 w-4" />
                      {t.previous}: {previousChapter.title}
                    </Button>
                  </Link>
                ) : (
                  <div />
                )}
                
                {nextChapter ? (
                  <Link href={`/chapters/${nextChapter.slug}`}>
                    <Button className="flex items-center gap-2" data-testid="button-next-nav">
                      {t.next}: {nextChapter.title}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : (
                  <div />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}


