# FinanceApp — Gestão Financeira Pessoal

App web para controle completo das finanças pessoais: contas, transações, parcelas, gastos fixos, metas e planejamento orçamentário.

**Stack:** Next.js 16 · Supabase · Tailwind CSS v4 · shadcn/ui · Recharts · Vercel

---

## Funcionalidades

### Dashboard
- Resumo do mês: receitas, despesas e saldo
- Filtro por período (mês/ano)
- Cards individuais das contas pinadas ao dashboard
- Gráfico de categorias com maiores gastos
- Diagnóstico financeiro automático (alertas e dicas com base nos dados do mês)
- Próxima ação recomendada (parcelas ou recorrências pendentes de decisão)
- Modal de onboarding para novos usuários

### Contas (Multi-conta)
- Criação de múltiplas contas com nome, ícone e cor personalizáveis
- Templates prontos: Conta Corrente, Cartão de Crédito, Carteira Digital, Poupança, Investimentos, Dinheiro Físico
- Tipo por conta: entrada, saída ou ambos
- Pin/unpin: contas não pinadas são excluídas de todos os totais e gráficos agregados (dashboard, analytics, relatórios e parcelas ativas)
- Cada conta tem sua própria visão de transações com filtros independentes

### Transações
- Registro manual de receitas e despesas
- Campos: valor, data, descrição, categoria, conta, tag, tipo de parcelamento, marcação de recorrência
- Busca e filtros por categoria, tipo e conta
- Edição e exclusão inline
- Exportação das transações para CSV

### Importação de Extratos
- **CSV genérico**: compatível com Nubank, Inter, Banco do Brasil, Itaú, Bradesco e outros — detecção automática de colunas
- **OFX / QFX**: formato padrão bancário com maior precisão de dados (Itaú, Bradesco, Santander, Caixa, BB, Inter)
- **C6 Bank**: layout específico da conta corrente e fatura do cartão
- Fluxo de revisão antes de salvar: categorização automática por regras + edição manual de cada item importado

### Categorização Automática
- Regras baseadas em palavra-chave: ao criar uma regra, ela pode ser aplicada retroativamente a transações já importadas
- Criação de regras direto da tela de Analytics (ao clicar em uma transação sem categoria)

### Analytics (Análise Mensal)
- Gráficos de gastos e receitas por categoria
- Filtro por conta específica ou visão geral (excluindo contas não pinadas)
- Filtro de período (mês/ano)
- Drill-down: clicar em uma categoria abre a lista de transações daquele grupo

### Relatórios
Quatro tipos de relatório, todos com filtro por conta:
- **Mensal**: resumo de receitas e despesas do mês com breakdown por categoria
- **Anual**: visão do ano inteiro com comparativo mês a mês
- **Parcelas**: todas as compras parceladas ativas e seu progresso
- **Gastos Fixos**: recorrências confirmadas agrupadas por subcategoria, com média mensal

### Gastos Recorrentes (Fixos)
- Detecção automática de gastos recorrentes dos últimos 12 meses (mínimo 2 ocorrências)
- Agrupamento por subcategoria (ex: "Mercado" agrupa Hortifruti, Pão de Açúcar, Carrefour)
- Ações por item: confirmar como fixo, ignorar ou ocultar
- Gestão de subcategorias para agrupamento personalizado

### Parcelas Ativas
- Lista de compras parceladas em andamento com progresso (X/Y parcelas)
- Badges de status: "Última parcela", "Quase acabando", "Longo prazo"
- Cadastro manual de parcelamentos (para parcelas não importadas)
- Filtro por conta

### Metas Financeiras
- Tipos de meta: Reserva de Emergência, Investimento, Carro, Viagem, Quitar Dívida, Imóvel, Personalizada
- Status automático: No prazo / Adiantada / Atrasada (baseado na % concluída vs tempo decorrido)
- Atualização de saldo manual ou via importação de extrato:
  - **RICO (XLS)**: importação de extrato da corretora Rico para atualizar o valor investido
  - **OFX**: importação de saldo bancário para atualizar reserva/conta

### Planejamento Orçamentário
- Templates de orçamento: Equilibrado (50/30/20), Investidor (45/25/30), Quitar Dívidas, Personalizado
- Definição de limite por categoria
- Comparação planejado vs realizado para o mês selecionado
- Indicadores visuais de status por categoria (dentro do limite, próximo, estourado)

### Configurações
- **Categorias**: criar, editar, excluir e restaurar categorias padrão
- **Subcategorias**: agrupamento de gastos recorrentes por rótulo personalizado
- **Regras de categorização**: mapeamento automático de descrição → categoria

### Autenticação
- Login e cadastro com design split-screen (painel de marca + formulário)
- Sessão persistente via Supabase Auth
- Proteção de rotas por middleware (usuário não logado vai para o login)

### Outros
- Tema claro e escuro (toggle no header)
- Demo sem cadastro (`/demo`) para explorar o app com dados de exemplo
- Central de Ajuda integrada (`/ajuda`) com manual do usuário
- Painel de administração (`/admin`)

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
Preencha `.env.local` com suas credenciais do Supabase (Settings → API no painel do Supabase):
```
NEXT_PUBLIC_SUPABASE_URL=sua_url_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_aqui
```

> **Segurança:** `.env.local` está no `.gitignore` e nunca deve ser commitado. A segurança dos dados é garantida pelas políticas de Row Level Security (RLS) no banco.

### 3. Criar tabelas no Supabase
No SQL Editor do Supabase, execute o conteúdo de `src/lib/supabase/schema.sql`.

### 4. Rodar em desenvolvimento
```bash
npm run dev
```
Acesse `http://localhost:3000`.

---

## Deploy na Vercel

O projeto está configurado para deploy via CLI ou GitHub.

```bash
vercel --prod
```

**Variáveis de ambiente na Vercel:**
Configure em Dashboard → Project → Settings → Environment Variables:

| Variável | Onde encontrar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |

---

## Estrutura do projeto

```
src/
  app/
    (app)/
      dashboard/        # Dashboard principal
      transactions/     # Lista de contas + visão por conta
      analytics/        # Análise mensal por categoria
      reports/          # Relatórios (mensal, anual, parcelas, fixos)
      fixos/            # Gastos recorrentes
      recurring/        # Parcelas ativas
      goals/            # Metas financeiras
      planning/         # Planejamento orçamentário
      import/           # Importação de extratos
      settings/         # Categorias, subcategorias, regras
      categories/       # Gerenciamento de categorias
      account/          # Configurações da conta
      admin/            # Painel de administração
      help/             # Central de ajuda
    auth/
      login/            # Login (split-screen SaaS)
      register/         # Cadastro
    demo/               # Demo sem login
  components/
    dashboard/          # Cards, gráficos, filtro de período
    transactions/       # Formulário, tabela, filtros, import CSV
    layout/             # Sidebar (desktop) e nav inferior (mobile)
    ui/                 # Componentes base (shadcn/ui)
  hooks/                # Lógica de dados (CRUD, filtros, cálculos)
  lib/supabase/         # Clientes e schema SQL
  types/                # Tipos TypeScript
  utils/                # Exportação CSV, parsers de extrato
  middleware.ts         # Proteção de rotas via Supabase Auth
```

---

## Comandos úteis

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
npm run lint     # linting
vercel --prod    # deploy para produção
```
