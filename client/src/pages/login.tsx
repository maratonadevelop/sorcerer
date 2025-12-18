import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogIn, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [idOrEmail, setIdOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Basic client-side validation
    if (!idOrEmail.trim() || !password) {
      setError('Preencha usuário/email e senha');
      setLoading(false);
      return;
    }
    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: idOrEmail, password })
      });
      if (resp.ok) {
        // if server returned a devToken, store it for environments without cookies
        try {
          const data = await resp.clone().json().catch(() => null);
          const token = data?.devToken;
          if (token) localStorage.setItem('devToken', token);
        } catch {}
        // refresh auth state cached by useAuth (react-query)
        try { await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] }); } catch(e) {}
        // Give the session cookie a tick to settle
        await new Promise(r => setTimeout(r, 50));
        setLocation('/');
        return;
      }
      const data = await resp.json().catch(() => ({}));
      setError(data?.message || `Falha ao entrar (status ${resp.status})`);
    } catch (err) {
      setError('Erro de rede');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-card text-foreground">
        <CardHeader>
          <CardTitle className="text-2xl">Entrar</CardTitle>
          <CardDescription>Acesse sua conta para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-id">Usuário ou email</Label>
              <Input id="login-id" value={idOrEmail} onChange={(e) => setIdOrEmail(e.target.value)} placeholder="seu@email.com" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Senha</Label>
              <div className="relative">
                <Input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-sm opacity-80 hover:opacity-100" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <Button type="submit" disabled={loading} className="w-full" data-testid="btn-submit-login">
              <LogIn className="h-4 w-4 mr-2" /> {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Não tem conta?</span>
          <Button variant="ghost" size="sm" onClick={() => setLocation('/register')}>Criar conta</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
