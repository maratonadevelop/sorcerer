import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { authHeaders } from '@/lib/authHeaders';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ShieldCheck, Loader2, Camera, Eye, EyeOff, Lock, Mail, Save, X, Moon, Sun, Monitor, Trash2, LogOut, Sparkles } from 'lucide-react';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isValidEmail(v: string) {
  return /.+@.+\..+/.test(v.trim());
}

function passwordScore(pwd: string) {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[a-z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return Math.min(4, Math.max(0, s - 1)); // 0..4 visual steps
}

export default function SettingsPage() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [currPwd, setCurrPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [showCurr, setShowCurr] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const READER_FONT_SIZE_KEY = 'reader.fontSize';
  const readerFontSizes: Record<'xsmall' | 'small' | 'medium' | 'large', string> = {
    xsmall: '10px',
    small: '12px',
    medium: '16px',
    large: '18px',
  };
  const [readerFontSize, setReaderFontSize] = useState<'xsmall' | 'small' | 'medium' | 'large'>('medium');

  const pwdScore = useMemo(() => passwordScore(newPwd), [newPwd]);
  const emailValid = useMemo(() => isValidEmail(email || ''), [email]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation('/login');
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/user/profile', { credentials: 'include', headers: authHeaders() });
        if (!res.ok) return;
        const p = await res.json();
        setFirstName(p.firstName || '');
        setLastName(p.lastName || '');
        setEmail(p.email || '');
        setAvatarUrl(p.profileImageUrl || undefined);
      } catch {}
    })();
  }, [isAuthenticated, setLocation]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(READER_FONT_SIZE_KEY);
      if (stored === 'xsmall' || stored === 'small' || stored === 'medium' || stored === 'large') {
        setReaderFontSize(stored);
        document.documentElement.style.setProperty('--reader-font-size', readerFontSizes[stored]);
      } else {
        document.documentElement.style.setProperty('--reader-font-size', readerFontSizes.medium);
      }
    } catch {}
  }, []);

  const applyReaderFontSize = (size: 'xsmall' | 'small' | 'medium' | 'large') => {
    setReaderFontSize(size);
    try {
      localStorage.setItem(READER_FONT_SIZE_KEY, size);
      document.documentElement.style.setProperty('--reader-font-size', readerFontSizes[size]);
    } catch {}
  };

  async function handleSaveProfile() {
    setSaving(true);
    try {
      if (!emailValid) throw new Error('Email inválido');
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: authHeaders({ 'content-type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ firstName, lastName, email, profileImageUrl: avatarUrl }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      toast({ title: 'Perfil atualizado' });
    } catch (e) {
      toast({ title: 'Erro', description: (e as any)?.message || 'Não foi possível salvar o perfil', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await fileToDataUrl(f);
      const res = await fetch('/api/user/upload', {
        method: 'POST',
        headers: authHeaders({ 'content-type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ filename: f.name, data: dataUrl }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.message || 'Falha no upload');
      setAvatarUrl(out.url);
      toast({ title: 'Avatar atualizado' });
    } catch (e) {
      toast({ title: 'Erro', description: 'Não foi possível enviar o avatar', variant: 'destructive' });
    }
  }

  async function handleChangePassword() {
    setChangingPwd(true);
    try {
      if (!currPwd || !newPwd) throw new Error('Preencha as senhas');
      if (newPwd.length < 8) throw new Error('Senha nova muito curta');
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: authHeaders({ 'content-type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ currentPassword: currPwd, newPassword: newPwd }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.message || 'Falha ao trocar senha');
      setCurrPwd(''); setNewPwd('');
      toast({ title: 'Senha alterada' });
    } catch (e) {
      toast({ title: 'Erro', description: (e as any)?.message || 'Não foi possível alterar a senha', variant: 'destructive' });
    } finally {
      setChangingPwd(false);
    }
  }

  return (
    <div className="min-h-screen pt-24 px-4 bg-gradient-to-b from-background via-background/90 to-background">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">Configurações {user?.isAdmin && <ShieldCheck className="h-5 w-5 text-emerald-400" />}</h2>
            <p className="text-sm text-muted-foreground">Personalize sua experiência e gerencie sua conta.</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Fechar" onClick={() => window.history.length > 1 ? window.history.back() : setLocation('/')}> <X className="h-5 w-5" /> </Button>
        </div>

        <Tabs defaultValue="perfil" className="space-y-6">
          <TabsList>
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
            <TabsTrigger value="seguranca">Segurança</TabsTrigger>
            <TabsTrigger value="preferencias">Preferências</TabsTrigger>
            <TabsTrigger value="conta">Conta</TabsTrigger>
          </TabsList>

          {/* PERFIL */}
          <TabsContent value="perfil">
            <Card className="overflow-hidden backdrop-blur-sm bg-background/60 border border-border/60 shadow-inner">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex flex-col items-center md:items-start gap-4">
                    <div className="relative">
                      <Avatar className="h-24 w-24 ring-2 ring-primary/30">
                        <AvatarImage src={avatarUrl || ''} alt={firstName || user?.email || 'Avatar'} />
                        <AvatarFallback className="bg-muted text-foreground/70">
                          {(firstName || user?.email || 'U').slice(0,2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <button className="absolute -bottom-2 -right-2 rounded-full bg-primary text-primary-foreground p-2 shadow hover:scale-105 transition" onClick={() => fileInputRef.current?.click()} aria-label="Alterar foto">
                        <Camera className="h-4 w-4" />
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadAvatar} />
                    </div>
                    <div className="text-center md:text-left">
                      <p className="text-xs text-muted-foreground">Formatos recomendados: JPG, PNG, WEBP.</p>
                      <div className="flex gap-2 mt-3 justify-center md:justify-start">
                        <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>Enviar nova</Button>
                        {avatarUrl && <Button size="sm" variant="ghost" onClick={() => setAvatarUrl(undefined)}>Remover</Button>}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">Nome</Label>
                        <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Seu nome" />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Sobrenome</Label>
                        <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Sobrenome" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="email" className="pl-9" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" />
                      </div>
                      {!emailValid && <p className="text-xs text-red-400 mt-1">Informe um email válido.</p>}
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <Button onClick={handleSaveProfile} disabled={saving || !emailValid}>
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Salvar alterações
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SEGURANÇA */}
          <TabsContent value="seguranca">
            <Card className="overflow-hidden backdrop-blur-sm bg-background/60 border border-border/60">
              <CardContent className="p-6 space-y-6">
                <h3 className="text-base font-medium flex items-center gap-2"><Lock className="h-4 w-4" /> Alterar senha</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Label htmlFor="currPwd">Senha atual</Label>
                    <Input id="currPwd" type={showCurr ? 'text' : 'password'} value={currPwd} onChange={e => setCurrPwd(e.target.value)} placeholder="••••••••" />
                    <button type="button" aria-label={showCurr ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-3 top-[42px] text-muted-foreground" onClick={() => setShowCurr(v => !v)}>{showCurr ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>
                  <div className="relative">
                    <Label htmlFor="newPwd">Nova senha</Label>
                    <Input id="newPwd" type={showNew ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Mínimo 8 caracteres" />
                    <button type="button" aria-label={showNew ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-3 top-[42px] text-muted-foreground" onClick={() => setShowNew(v => !v)}>{showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                    <div className="mt-2 flex gap-1" aria-hidden>{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`h-1 w-full rounded ${i < pwdScore ? 'bg-emerald-500' : 'bg-muted'}`} />)}</div>
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <Button variant="secondary" onClick={handleChangePassword} disabled={changingPwd || newPwd.length < 8 || !currPwd}>{changingPwd ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />} Alterar senha</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PREFERENCIAS */}
          <TabsContent value="preferencias">
            <Card className="overflow-hidden backdrop-blur-sm bg-background/60 border border-border/60">
              <CardContent className="p-6 space-y-6">
                <h3 className="text-base font-medium flex items-center gap-2"><Sparkles className="h-4 w-4" /> Preferências</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Tema</Label>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline"><Monitor className="h-4 w-4 mr-1" /> Sistema</Button>
                      <Button size="sm" variant="outline"><Sun className="h-4 w-4 mr-1" /> Claro</Button>
                      <Button size="sm" variant="outline"><Moon className="h-4 w-4 mr-1" /> Escuro</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tamanho da fonte (leitura)</Label>
                    <div className="flex gap-2">
                      <Button size="sm" variant={readerFontSize === 'xsmall' ? 'secondary' : 'outline'} onClick={() => applyReaderFontSize('xsmall')}>Muito pequena</Button>
                      <Button size="sm" variant={readerFontSize === 'small' ? 'secondary' : 'outline'} onClick={() => applyReaderFontSize('small')}>Pequena</Button>
                      <Button size="sm" variant={readerFontSize === 'medium' ? 'secondary' : 'outline'} onClick={() => applyReaderFontSize('medium')}>Média</Button>
                      <Button size="sm" variant={readerFontSize === 'large' ? 'secondary' : 'outline'} onClick={() => applyReaderFontSize('large')}>Grande</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Largura do conteúdo</Label>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">Fluida</Button>
                      <Button size="sm" variant="outline">Focada</Button>
                      <Button size="sm" variant="outline">Ultra</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Animações</Label>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">Ativar</Button>
                      <Button size="sm" variant="outline">Reduzir</Button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end"><Button>Salvar preferências</Button></div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTA */}
          <TabsContent value="conta">
            <Card className="overflow-hidden backdrop-blur-sm bg-background/60 border border-border/60">
              <CardContent className="p-6 space-y-6">
                <h3 className="text-base font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Conta</h3>
                <div className="space-y-4 text-sm">
                  <p>Id: <code className="px-1 py-0.5 rounded bg-muted text-xs">{user?.id}</code></p>
                  <p>Email atual: <span className="text-muted-foreground">{email || user?.email}</span></p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="destructive" onClick={async () => {
                      try { await fetch('/api/logout', { method: 'POST', credentials: 'include', headers: authHeaders() }); } catch {}
                      try { localStorage.removeItem('devToken'); } catch {}
                      try { queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] }); } catch {}
                      window.location.href = '/';
                    }}><LogOut className="h-4 w-4 mr-1" /> Sair</Button>
                    <Button size="sm" variant="outline" disabled><Trash2 className="h-4 w-4 mr-1" /> Deletar conta (breve)</Button>
                  </div>
                  {import.meta.env.DEV && (
                    <div className="space-y-2">
                      <Label>devToken (para ambientes sem cookie)</Label>
                      <div className="flex gap-2">
                        <Input readOnly value={typeof window !== 'undefined' ? (localStorage.getItem('devToken') || '') : ''} />
                        <Button size="sm" variant="secondary" onClick={() => { try { const tok = localStorage.getItem('devToken') || ''; navigator.clipboard.writeText(tok); toast({ title: 'Token copiado' }); } catch { toast({ title: 'Falha ao copiar', variant: 'destructive' }); } }}>Copiar</Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
