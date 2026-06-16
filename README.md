# FinanceApp — Gestão Financeira Pessoal

App web para controle de finanças pessoais com dashboard, gráficos e exportação CSV.

**Stack:** Next.js 16 · Supabase · Tailwind CSS · shadcn/ui · Recharts · Vercel

---

## Setup local

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env.local
```
Preencha `.env.local` com suas credenciais do Supabase (Settings → API no painel do Supabase).

> **Segurança:** `.env.local` está no `.gitignore` e **nunca** deve ser commitado.

### 3. Criar tabela no Supabase
No SQL Editor do Supabase, execute o conteúdo de `src/lib/supabase/schema.sql`.

### 4. Rodar em desenvolvimento
```bash
npm run dev
```
Acesse `http://localhost:3000`.

---

## Deploy na Vercel

O projeto está configurado para deploy contínuo via GitHub.  
Cada `git push` na branch `main` dispara um novo deploy automaticamente.

**Variáveis de ambiente na Vercel:**  
Configure em Dashboard → Project → Settings → Environment Variables:

| Variável | Onde encontrar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API → anon public |

---

## Segurança

- As credenciais do Supabase usam o prefixo `NEXT_PUBLIC_` pois a **Publishable Key** (anteriormente Anon Key) é projetada para ser pública — a segurança dos dados é garantida pelas políticas de **Row Level Security (RLS)** configuradas no banco.
- Nenhuma chave secreta é exposta no código ou no repositório.
- O arquivo `.env.local` está protegido pelo `.gitignore`.

---

## Estrutura do projeto

```
src/
  app/
    (app)/        # Dashboard e Transações (rotas protegidas)
    auth/         # Login e Cadastro
  components/     # UI, Dashboard, Transações, Layout
  hooks/          # useTransactions (CRUD + filtros)
  lib/supabase/   # Clientes e schema SQL
  types/          # Tipos TypeScript
  utils/          # Exportação CSV
  middleware.ts   # Proteção de rotas via Supabase Auth
```
