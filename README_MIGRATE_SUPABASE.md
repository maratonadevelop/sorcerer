Migração para Supabase (Postgres)
=================================

Este documento descreve os passos rápidos para migrar o banco local (SQLite) para
uma instância do Supabase (Postgres) usando as ferramentas e scripts incluídos no
repositório.

1) Criar projeto no Supabase
- Crie uma conta em https://app.supabase.com e crie um novo projeto.
- Copie a connection string (DATABASE_URL) do painel do Supabase.

2) Configurar variáveis de ambiente localmente
- Crie um arquivo `.env` na raiz do repo (NÃO comitar) com:

  DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxx.supabase.co:5432/postgres"
  NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY="...anon key..."

Ou, em PowerShell para a sessão atual:

  $env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxx.supabase.co:5432/postgres"

3) Instalar dependências
- Na raiz do diretório `sorcerer` (onde está o package.json):

  npm install pg better-sqlite3

4) Ajustar a conexão do projeto
- O arquivo `server/db.ts` foi atualizado para detectar `process.env.DATABASE_URL`.
  - Se `DATABASE_URL` apontar para um Postgres (Supabase), o servidor usará Postgres.
  - Caso contrário, usará o banco local `dev.sqlite` para desenvolvimento.

5) Criar o schema no Supabase
- Se você usa `drizzle-kit` e migrations, rode:

  $env:DATABASE_URL="postgresql://..."; npx drizzle-kit push

  Ou cole o SQL do seu schema no SQL Editor do Supabase e execute.

6) Migrar dados do SQLite para o Supabase
- Há um script em `scripts/migrate-sqlite-to-postgres.js`. Execute:

  $env:DATABASE_URL="postgresql://..."; node scripts/migrate-sqlite-to-postgres.js

- Adapte o script conforme necessário para as suas tabelas/colunas.

7) Testar a aplicação
- Rode o servidor apontando para a nova DATABASE_URL:

  $env:DATABASE_URL="postgresql://..."; npm run dev

8) Deploy
- Configure `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  nas variáveis de ambiente do seu host (Vercel, Render, Fly, etc).

Notas de segurança
- Não comite o `DATABASE_URL` nem o arquivo `.env` em repositórios públicos.
- Se as credenciais foram expostas, rotacione a senha no painel do Supabase.

Problemas comuns
- Erro SSL: configuramos `ssl: { rejectUnauthorized: false }` nos clients para
  facilitar o desenvolvimento local. Em produção, revise a configuração de TLS.

Fallback para SQLite Local e Backups
------------------------------------

Quando o Supabase estiver instável/fora, você pode trabalhar 100% local com SQLite.

1) Alternar para SQLite
- No arquivo `.env.local` defina:

  DATABASE_URL="file:./dev.sqlite"

2) Exportar dados atuais do Supabase para JSON (quando disponível)
- Na pasta `sorcerer/` rode:

  $env:DATABASE_URL="postgresql://..."; node scripts/export-postgres-to-json.cjs

  Isso escreve backups em `data/` (offline-*.json).

3) Importar JSON no SQLite local

  $env:SQLITE_PATH="./sorcerer/dev.sqlite"; node scripts/import-json-to-sqlite.cjs

4) Voltar para Supabase (opcional)

  $env:SQLITE_PATH="./sorcerer/dev.sqlite"; $env:DATABASE_URL="postgresql://..."; node scripts/migrate-sqlite-to-postgres.cjs

Hardening sugerido
- Regeneração de sessão em login/registro
- Rate limit simples no login por IP (15 min janela)
- `Cache-Control: no-store` nas rotas `/api`
- Circuit breaker e health-checks (`/live`, `/ready`)
- Em produção: cookies `Secure`, `HttpOnly` e `SameSite=Strict`; restringir CORS para domínios confiáveis.
