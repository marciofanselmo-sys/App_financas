# FinanceApp — Gestão Financeira Pessoal

## Stack
- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (base-ui)
- **Gráficos**: Recharts
- **Backend/BaaS**: Supabase (PostgreSQL + Auth + RLS)
- **Deploy**: Vercel

## Setup inicial

### 1. Configurar Supabase
1. Crie um projeto em supabase.com
2. Copie a URL e a Anon Key do projeto
3. Preencha `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=sua_url_aqui
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_aqui
   ```
4. No SQL Editor do Supabase, execute o arquivo `src/lib/supabase/schema.sql`

### 2. Rodar localmente
```bash
npm install
npm run dev
```

## Estrutura do projeto
```
src/
  app/
    (app)/          # Rotas protegidas (dashboard, transactions)
    auth/           # Login e cadastro
  components/
    dashboard/      # Cards, gráficos, filtro de período
    transactions/   # Formulário, tabela, filtros
    layout/         # Sidebar (desktop) e nav inferior (mobile)
    ui/             # shadcn/ui components
  hooks/            # use-transactions (CRUD + filtros)
  lib/supabase/     # Client, server, schema SQL
  types/            # Tipos TypeScript (Transaction, Category, etc.)
  utils/            # export-csv
  middleware.ts     # Proteção de rotas via Supabase Auth
```

## Notas importantes

### shadcn/ui versão base-ui
Esta versão do shadcn usa @base-ui ao invés de Radix. O DropdownMenuTrigger não suporta asChild — use className direto no trigger.

### Middleware (Next.js 16)
O Next.js 16 deprecou middleware.ts em favor de proxy. Por enquanto ainda funciona.

### RLS no Supabase
Todas as políticas de Row Level Security usam auth.uid() = user_id. Cada usuário só acessa seus próprios dados.

## Comandos úteis
```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
npm run lint     # linting
```
