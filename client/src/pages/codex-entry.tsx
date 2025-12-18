import { useEffect, useState } from 'react';
import { useAudio } from '@/contexts/AudioProvider';
import { useParams } from 'wouter';
import Navigation from '@/components/navigation';
import Footer from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CodexEntry } from '@shared/schema';
import { useLanguage } from '@/contexts/LanguageContext';
import { Wand2, Crown, MapPin, Settings } from 'lucide-react';
import RichEditor from '@/components/rich-editor';
import DOMPurify from 'dompurify';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CodexForm } from './admin';
import { useImageLightbox } from '@/components/image-lightbox';
import { bumpRevision } from '@/lib/revision';
import { withRevisionParam } from '@/lib/revision';
import { authHeaders } from '@/lib/authHeaders';

export default function CodexEntryProfile() {
  const params = useParams() as Record<string, string | undefined>;
  const id = params.id as string | undefined;
  const { t } = useLanguage();
  const { open } = useImageLightbox();
  const auth = useAuth();
  const isAdmin = auth?.isAdmin;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setEntity } = useAudio();
  const { data: entry } = useQuery<CodexEntry | null>({ 
    queryKey: ['/api/codex', id], 
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(withRevisionParam(`/api/codex/${id}`), { cache: 'no-store' });
      if (!res.ok) return null;
      return res.json();
    }
  });

  // Single-language: use primary fields
  const title = entry?.title ?? null;
  const description = entry?.description ?? null;

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (entry) {
      setEditTitle(entry.title || '');
      setEditDescription(entry.description || '');
      setImageUrl(entry.imageUrl || '');
    }
  }, [entry?.id]);

  const uploadFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const arr = new Uint8Array(data);
      let binary = '';
      for (let i = 0; i < arr.byteLength; i++) binary += String.fromCharCode(arr[i]);
      const base64 = btoa(binary);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: authHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({ filename: file.name, data: base64 }),
        credentials: 'include'
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.message || (res.status === 413 ? 'Arquivo muito grande (tente uma imagem menor).' : 'Falha no upload');
        alert(msg);
        return undefined;
      }
      return json.url as string | undefined;
    } catch (err) { console.error(err); alert('Falha no upload'); return undefined; }
  };

  const updateEntry = useMutation({
    mutationFn: async (payload: any) => {
      if (!entry) return null;
      const res = await fetch(`/api/admin/codex/${entry.id}`, { method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }), credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Falha ao salvar' }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: 'Codex salvo', description: 'As alterações foram aplicadas.' });
      setIsEditing(false);
      bumpRevision();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/codex'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/codex', id] }),
      ]);
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: String(e?.message || e), variant: 'destructive' })
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "magic":
        return <Wand2 className="h-6 w-6" />;
      case "creatures":
        return <Crown className="h-6 w-6" />;
      case "locations":
        return <MapPin className="h-6 w-6" />;
      default:
        return <Wand2 className="h-6 w-6" />;
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case "magic":
        return "Magia";
      case "creatures":
        return "Criaturas";
      case "locations":
        return "Localizações";
      default:
        return category;
    }
  };

  if (!entry) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-20">
          <Card>
            <CardContent className="p-8 text-center">Entrada do Codex não encontrada</CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  // Set codex entry entity for audio override while viewing
  useEffect(() => {
    if (entry?.id) setEntity({ type: 'codex', id: entry.id });
    return () => { setEntity(null); };
  }, [entry?.id, setEntity]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
          {entry.imageUrl && (
            <img 
              src={entry.imageUrl} 
              alt={title ?? entry.title} 
              className="w-36 h-44 object-cover rounded border cursor-zoom-in" 
              onClick={(e) => { e.stopPropagation(); const el = e.currentTarget as HTMLImageElement; open(entry.imageUrl!, title ?? entry.title, el); }}
            />
          )}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                  {getCategoryIcon(entry.category)}
                </div>
                <span className="text-accent font-medium capitalize">
                  {getCategoryName(entry.category)}
                </span>
              </div>
              <h1 className="text-3xl font-bold">{title ?? entry.title}</h1>
            </div>
          </div>
          {isAdmin && (
            <Button 
              variant="ghost" 
              size="icon"
              className="text-muted-foreground hover:text-primary transition-colors"
              title={isEditing ? 'Cancelar edição' : 'Editar codex'}
              onClick={() => setIsEditing(v => !v)}
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            {isAdmin && isEditing ? (
              <div data-testid="codex-inline-editor">
                <CodexForm
                  initial={entry}
                  onSubmit={async (payload) => {
                    await updateEntry.mutateAsync(payload);
                  }}
                />
                <div className="flex gap-3 justify-end mt-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
                <div className="rounded-lg border border-border p-6 bg-black/20">
                  <article className="prose prose-invert max-w-none content-prose">
                    {/* Prefer explicit `content` (detailed rich HTML). Fallback to `description` for older entries. */}
                    <div className="whitespace-normal break-words break-all" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize((entry as any).content ?? description ?? entry.description) }} onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target && target.tagName === 'IMG') {
                        const img = target as HTMLImageElement;
                        try { (window as any).__openImageLightbox(img.src, img.alt || '', img); } catch {}
                      }
                    }} />
                  </article>
                </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-4">Informações</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Categoria:</span>
                <span className="capitalize">{getCategoryName(entry.category)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-mono text-sm">{entry.id}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6">
          <Button asChild>
            <a href="/codex">← Voltar ao Codex</a>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
}


