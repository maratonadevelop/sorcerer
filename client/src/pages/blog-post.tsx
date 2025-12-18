import { useEffect, useState } from 'react';
import { useParams } from 'wouter';
import Navigation from '@/components/navigation';
import Footer from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BlogPost } from '@shared/schema';
import { useLanguage } from '@/contexts/LanguageContext';
import { Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import RichEditor from '@/components/rich-editor';
import DOMPurify from 'dompurify';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlogForm } from './admin';
import { useImageLightbox } from '@/components/image-lightbox';
import { bumpRevision } from '@/lib/revision';
import { withRevisionParam } from '@/lib/revision';
import { authHeaders } from '@/lib/authHeaders';

export default function BlogPostProfile() {
  const params = useParams() as Record<string, string | undefined>;
  const slug = params.slug as string | undefined;
  const { t } = useLanguage();
  const auth = useAuth();
  const isAdmin = auth?.isAdmin;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { open } = useImageLightbox();
  const { data: post } = useQuery<BlogPost | null>({ 
    queryKey: ['/api/blog', slug], 
    queryFn: async () => {
      if (!slug) return null;
      const res = await fetch(withRevisionParam(`/api/blog/${slug}`), { cache: 'no-store' });
      if (!res.ok) return null;
      return res.json();
    }
  });

  // Translation disabled: always use primary fields
  const title = post?.title ?? null;
  const content = post?.content ?? null;
  const excerpt = post?.excerpt ?? null;

  const timeAgo = (date: Date | string) => {
    const now = new Date();
    const publishedDate = new Date(date);
    const diffTime = Math.abs(now.getTime() - publishedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "1 dia atrás";
    if (diffDays < 7) return `${diffDays} dias atrás`;
    if (diffDays < 14) return "1 semana atrás";
    if (diffDays < 21) return "2 semanas atrás";
    return "3 semanas atrás";
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "update":
        return "bg-primary/20 text-primary";
      case "world-building":
        return "bg-accent/20 text-accent";
      case "behind-scenes":
        return "bg-secondary/20 text-secondary-foreground";
      case "research":
        return "bg-muted/20 text-muted-foreground";
      default:
        return "bg-primary/20 text-primary";
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case "update":
        return "Atualização";
      case "world-building":
        return "Construção de Mundo";
      case "behind-scenes":
        return "Bastidores";
      case "research":
        return "Pesquisa";
      default:
        return category;
    }
  };

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editExcerpt, setEditExcerpt] = useState('');
  const [editContent, setEditContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (post) {
      setEditTitle(post.title || '');
      setEditExcerpt(post.excerpt || '');
      setEditContent(post.content || '');
      setImageUrl((post as any).imageUrl || '');
    }
  }, [post?.id]);

  const uploadFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
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

  const updatePost = useMutation({
    mutationFn: async (payload: any) => {
      if (!post) return null;
      const res = await fetch(`/api/admin/blog/${post.id}`,
        { method: 'PUT', headers: authHeaders({ 'content-type': 'application/json' }), credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Falha ao salvar' }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: 'Post salvo', description: 'As alterações foram aplicadas.' });
      setIsEditing(false);
      bumpRevision();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/blog'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/blog', slug] }),
      ]);
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: String(e?.message || e), variant: 'destructive' })
  });

  if (!post) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-20">
          <Card>
            <CardContent className="p-8 text-center">Post do blog não encontrado</CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {post.imageUrl && (
              <img src={post.imageUrl} alt={title ?? post.title} className="w-28 h-28 object-cover rounded border cursor-zoom-in" onClick={(e) => { e.stopPropagation(); const el = e.currentTarget as HTMLImageElement; open(post.imageUrl!, title ?? post.title, el); }} />
            )}
            <div>
              <div className="flex items-center gap-4 mb-1">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(post.category)}`}>
                  {getCategoryName(post.category)}
                </span>
                <span className="text-muted-foreground text-sm">
                  {timeAgo(post.publishedAt)}
                </span>
              </div>
              <h1 className="text-4xl font-bold mb-1">{title ?? post.title}</h1>
              {excerpt && <p className="text-muted-foreground">{excerpt}</p>}
            </div>
          </div>
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-primary transition-colors"
              title={isEditing ? 'Cancelar edição' : 'Editar post'}
              onClick={() => setIsEditing(v => !v)}
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* header (imagem, título e meta) já renderizado acima; duplicata removida */}

        <Card className="mb-6">
          <CardContent className="p-8">
            {isAdmin && isEditing ? (
              <div data-testid="blog-inline-editor">
                <BlogForm
                  initial={post}
                  onSubmit={async (payload) => {
                    await updatePost.mutateAsync(payload);
                  }}
                />
                <div className="flex gap-3 justify-end mt-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border p-6 bg-black/20">
                <article className="prose prose-invert max-w-none content-prose">
                  <div className="whitespace-normal break-words break-all" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content ?? post.content) }} onClick={(e) => {
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
            <h3 className="font-semibold text-lg mb-4">Informações do Post</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Categoria:</span>
                <span className="capitalize">{getCategoryName(post.category)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Publicado em:</span>
                <span>{new Date(post.publishedAt).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slug:</span>
                <span className="font-mono text-sm">{post.slug}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6">
          <Button asChild>
            <a href="/blog">← Voltar ao Blog</a>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
