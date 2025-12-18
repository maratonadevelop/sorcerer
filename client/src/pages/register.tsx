import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserPlus, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const [idOrEmail, setIdOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const queryClient = useQueryClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (!firstName.trim() || !idOrEmail.trim() || !password) {
      setError('Preencha nome, usuário/email e senha');
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres');
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }
    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: idOrEmail, email: idOrEmail, password, firstName })
      });
      if (resp.ok) {
  try { queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] }); } catch(e) {}
        setLocation('/');
        window.location.reload();
        return;
      }
      const data = await resp.json().catch(() => ({}));
      setError(data?.message || 'Falha ao criar conta');
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
          <CardTitle className="text-2xl">Criar conta</CardTitle>
          <CardDescription>Cadastre-se para acessar o conteúdo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reg-name">Nome</Label>
              <Input id="reg-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Seu nome" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-id">Usuário ou email</Label>
              <Input id="reg-id" value={idOrEmail} onChange={(e) => setIdOrEmail(e.target.value)} placeholder="usuario ou email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">Senha</Label>
              <div className="relative">
                <Input id="reg-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-sm opacity-80 hover:opacity-100" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-confirm">Confirmar senha</Label>
              <Input id="reg-confirm" type={showPassword ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <Button type="submit" disabled={loading} className="w-full" data-testid="btn-submit-register">
              <UserPlus className="h-4 w-4 mr-2" /> {loading ? 'Criando...' : 'Criar conta'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Já tem conta?</span>
          <Button variant="ghost" size="sm" onClick={() => setLocation('/login')}>Entrar</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
