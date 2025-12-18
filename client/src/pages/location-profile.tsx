import { useEffect, useState } from 'react';
import { useAudio } from '@/contexts/AudioProvider';
import { useParams } from 'wouter';
import Navigation from '@/components/navigation';
import Footer from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Location } from '@shared/schema';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { Settings } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { LocationForm } from './admin';
import { useImageLightbox } from '@/components/image-lightbox';
import { bumpRevision } from '@/lib/revision';
import { withRevisionParam } from '@/lib/revision';
import { authHeaders } from '@/lib/authHeaders';

export default function LocationProfile(props?: any) {
  const paramsFromHook = useParams() as Record<string, string | undefined>;
  // wouter may pass route params via props.params when using the `component` prop on Route.
  // Prefer explicit props.params.id when present, then fallback to hook.
  const id = (props?.params?.id ?? paramsFromHook?.id ?? props?.id) as string | undefined;
  const { t } = useLanguage();
  const auth = useAuth();
  const isAdmin = auth?.isAdmin;
  const [, setLocationPath] = useLocation();
  const { data: location, isLoading } = useQuery<Location | null>({ 
    queryKey: ['/api/locations', id], 
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;
      // Try direct fetch by id first
      try {
        const res = await fetch(withRevisionParam(`/api/locations/${id}`), { cache: 'no-store' });
        if (res.ok) return res.json();
      } catch (e) {
        // ignore and fallback
      }

      // Fallback: fetch all locations and try to match by id or by slugified name
      try {
        const listRes = await fetch(withRevisionParam('/api/locations'), { cache: 'no-store' });
        if (!listRes.ok) return null;
        const arr: Location[] = await listRes.json();
        // exact id match
        const byId = arr.find((l) => l.id === id);
        if (byId) return byId;
        // try matching by slugified name (e.g., '/world/reino-de-valaria')
        const slugCandidate = String(id).toLowerCase();
        const byName = arr.find((l) => {
          const slug = (l.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          return slug === slugCandidate || l.name?.toLowerCase() === slugCandidate;
        });
        if (byName) return byName;
      } catch (e) {
        // ignore
      }

      return null;
    }
  });

  // Translation disabled: use primary fields only
  const name = location?.name ?? null;
  const description = location?.description ?? null;
  const details = (location as any)?.details ?? null;

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
    };
    return map[type] || type;
  };

  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { open } = useImageLightbox();

  const updateLocation = useMutation({
    mutationFn: async (payload: any) => {
      if (!location) throw new Error('No location');
      const res = await fetch(`/api/admin/locations/${location.id}`, { method: 'PUT', headers: authHeaders({ 'content-type':'application/json' }), body: JSON.stringify(payload), credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Update failed' }));
        throw new Error(err.message || 'Update failed');
      }
      return res.json();
    },
    onSuccess: () => {
      bumpRevision();
      queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/locations', id] });
      toast({ title: 'Localização atualizada' });
      setIsEditing(false);
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao salvar', description: String(e?.message || e), variant: 'destructive' });
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-20">
          <Card>
            <CardContent className="p-8 text-center">Carregando localização...</CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-20">
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <div className="text-lg font-semibold">Localização não encontrada</div>
              <div className="text-xs opacity-70">ID/Slug: {String(id || '')}</div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const { setEntity } = useAudio();
  // Set location entity for audio override
  useEffect(() => {
    if (location?.id) setEntity({ type: 'location', id: location.id });
    return () => { setEntity(null); };
  }, [location?.id, setEntity]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 py-12">
        {location.imageUrl && (
          <div className="mb-6 w-full overflow-hidden rounded-lg shadow-lg">
            <img src={location.imageUrl} alt={name ?? location.name} className="w-full h-64 object-cover cursor-zoom-in" onClick={(e) => { e.stopPropagation(); const el = e.currentTarget as HTMLImageElement; open(location.imageUrl, name ?? location.name, el); }} />
          </div>
        )}

        {/* Reading card: embed name + meta and show details inside a darker inner panel (chapter style) */}
        {details ? (
          <Card className="mb-6 bg-card/90 border border-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-display font-bold leading-tight">{name ?? location.name}</h1>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <Button variant="ghost" size="icon" title={isEditing ? 'Cancelar edição' : 'Editar história'} onClick={() => setIsEditing((v) => !v)}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 bg-card/80 rounded-lg p-6">
                {isAdmin && isEditing ? (
                  <div data-testid="location-inline-editor">
                    <LocationForm
                      initial={location}
                      onSubmit={async (payload) => {
                        await updateLocation.mutateAsync(payload);
                      }}
                    />
                    <div className="flex gap-3 justify-end mt-2">
                      <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="prose max-w-none text-white">
                    <div className="whitespace-normal break-words break-all" dangerouslySetInnerHTML={{ __html: details }} onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target && target.tagName === 'IMG') {
                        const img = target as HTMLImageElement;
                        try { (window as any).__openImageLightbox(img.src, img.alt || '', img); } catch {}
                      }
                    }} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          // fallback: no details, show name only
          <div className="mb-6">
            <h1 className="text-3xl font-display font-bold leading-tight">{name ?? location.name}</h1>
          </div>
        )}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-4">Informações Técnicas</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo:</span>
                <span className="capitalize">{typePt(location.type)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Posição no Mapa:</span>
                <span>X: {location.mapX}%, Y: {location.mapY}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-mono text-sm">{location.id}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6">
          <Button asChild>
            <a href="/mundo">← Voltar ao Mundo</a>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
