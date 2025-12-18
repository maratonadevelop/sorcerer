import { useEffect, useState } from 'react';
import { useAudio } from '@/contexts/AudioProvider';
import { useParams, Link } from 'wouter';
import Navigation from '@/components/navigation';
import Footer from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Character } from '@shared/schema';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChevronLeft, ChevronRight, Bookmark, Settings } from 'lucide-react';
import DOMPurify from 'dompurify';
import RichEditor from '@/components/rich-editor';
import { CharacterForm } from './admin';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { bumpRevision } from '@/lib/revision';
import { withRevisionParam } from '@/lib/revision';
import { authHeaders } from '@/lib/authHeaders';

function generateSlug(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function CharacterProfile() {
  const params = useParams() as Record<string, string | undefined>;
  // Support both /characters/:slug and older /characters/:id
  const idOrSlug = (params.slug ?? params.id) as string | undefined;
  const { t } = useLanguage();
  const auth = useAuth();
  const isAdmin = auth?.isAdmin;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setEntity } = useAudio();

  const { data: character, isLoading } = useQuery<Character | null>({
    queryKey: ['/api/characters', idOrSlug],
    queryFn: async () => {
      if (!idOrSlug) return null;
      // try slug route first
      let res = await fetch(withRevisionParam(`/api/characters/slug/${idOrSlug}`), { cache: 'no-store' });
      if (res.ok) return res.json();
      // fallback to id route
      res = await fetch(withRevisionParam(`/api/characters/${idOrSlug}`), { cache: 'no-store' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!idOrSlug,
  });

  const { data: allCharacters = [] } = useQuery<Character[]>({
    queryKey: ['/api/characters'],
  });

    // Translation system disabled: use primary (Portuguese) fields only.
    const story = (character as any)?.story ?? character?.description ?? null;
    const title = character?.title ?? null;
    const name = character?.name ?? null;

  // Inline edit state (admin only)
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editStory, setEditStory] = useState<string>('');

  useEffect(() => {
    if (character) {
      setEditName(character.name || '');
      setEditTitle(character.title || '');
      setEditStory((character as any).story || character.description || '');
    }
  }, [character?.id]);

  // IMPORTANT: this hook must run on every render (not positioned after conditional returns)
  useEffect(() => {
    if (character?.id) {
      setEntity({ type: 'character', id: character.id });
      try { console.log('[audio] setEntity character', character.id); } catch {}
    } else {
      // If leaving the page, clear entity so global resumes
      setEntity(null);
    }
    // Cleanup also clears on unmount
    return () => { setEntity(null); };
  }, [character?.id, setEntity]);

  const updateCharacter = useMutation({
    mutationFn: async (payload: any) => {
      if (!character) return null;
      const res = await fetch(`/api/admin/characters/${character.id}`,
        { method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify(payload), credentials: 'include' });
      if (!res.ok) throw new Error('Falha ao salvar personagem');
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: 'Personagem salvo', description: 'As alterações foram aplicadas.' });
      setIsEditing(false);
      bumpRevision();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/characters'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/characters', idOrSlug] }),
      ]);
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao salvar', description: String(err?.message || err), variant: 'destructive' });
    }
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

  if (!character) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-20">
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <p className="text-lg font-semibold">Personagem não encontrado</p>
              <p className="text-xs opacity-70">Slug/ID: {idOrSlug || '(vazio)'} • Verifique se o slug corresponde ao campo slug do personagem ou se o vínculo usa o ID correto.</p>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }


  const currentIndex = allCharacters.findIndex(c => c.id === character.id);
  const previousCharacter = currentIndex > 0 ? allCharacters[currentIndex - 1] : null;
  const nextCharacter = currentIndex < allCharacters.length - 1 ? allCharacters[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h1 className="font-display text-2xl font-semibold text-card-foreground" data-testid="text-character-title">
                  {name}
                </h1>
                <p className="text-white/80 text-sm" data-testid="text-character-meta">
                  {title} • {character.role === 'protagonist' ? 'Protagonista' : character.role === 'antagonist' ? 'Antagonista' : 'Coadjuvante'}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                {previousCharacter && (
                  <Link href={`/characters/${previousCharacter.slug || previousCharacter.id}`}>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="Previous Character"
                      data-testid="button-previous-character"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  </Link>
                )}
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  title="Bookmark"
                  data-testid="button-bookmark"
                >
                  <Bookmark className="h-5 w-5" />
                </Button>
                {isAdmin && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title={isEditing ? 'Cancelar edição' : 'Editar personagem'}
                    data-testid="button-settings"
                    onClick={() => setIsEditing(v => !v)}
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                )}
                {nextCharacter && (
                  <Link href={`/characters/${nextCharacter.slug || nextCharacter.id}`}>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="Next Character"
                      data-testid="button-next-character"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            <CardContent className="p-8">
              {isAdmin && isEditing ? (
                <div data-testid="character-inline-editor">
                  <CharacterForm
                    initial={character}
                    onSubmit={async (payload) => {
                      await updateCharacter.mutateAsync(payload);
                    }}
                    isSaving={updateCharacter.isPending}
                  />
                  <div className="flex gap-3 justify-end mt-2">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="max-w-none" data-testid="content-character-text">
                  <div className="rounded-lg border border-border p-6 bg-black/20">
                    <article className="prose prose-invert max-w-none content-prose">
                      {story ? (
                        <div className="whitespace-normal break-words break-all" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(story || '') }} />
                      ) : (
                        <p className="text-white leading-relaxed mb-6 text-lg whitespace-normal break-all">{character.description}</p>
                      )}
                      <div className="mt-6 p-3 rounded bg-black/30 text-xs font-mono space-y-1">
                        <div>Debug:</div>
                        <div>ID: {character.id}</div>
                        <div>Slug provável: {generateSlug(character.name || '')}</div>
                        <div>Tem story: {story ? 'sim' : 'não'}</div>
                      </div>
                    </article>
                  </div>
                </div>
              )}

              {/* Character Navigation */}
              <div className="flex justify-between items-center mt-12 pt-8 border-t border-border">
                {previousCharacter ? (
                  <Link href={`/characters/${previousCharacter.slug || previousCharacter.id}`}>
                    <Button variant="outline" className="flex items-center gap-2" data-testid="button-previous-nav">
                      <ChevronLeft className="h-4 w-4" />
                      Previous: {previousCharacter.name}
                    </Button>
                  </Link>
                ) : (
                  <div />
                )}
                
                {nextCharacter ? (
                  <Link href={`/characters/${nextCharacter.slug || nextCharacter.id}`}>
                    <Button className="flex items-center gap-2" data-testid="button-next-nav">
                      Next: {nextCharacter.name}
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
