# FinanceApp — Briefing do Projeto

App web SaaS de gestão financeira pessoal. O produto permite ao usuário centralizar múltiplas contas bancárias, importar extratos, categorizar gastos automaticamente por regras, acompanhar parcelas e gastos fixos, definir metas e planejar o orçamento mensal.

Documento de produto completo: `docs/PRD.md`

---

## Manutenção da Documentação

**Regra atual (revertida em 2026-07-02):** não atualizar `.md` automaticamente a cada mudança — a atualização imediata estava deixando as sessões lentas. Só editar README.md, docs/PLAN.md, docs/PRD.md, CLAUDE.md ou AGENTES.md quando o usuário pedir explicitamente.

| Tipo de mudança | Atualizar (só se pedido) |
|---|---|
| Arquitetura, convenção de código, stack, identidade visual | `CLAUDE.md` (este arquivo) |
| Item de milestone concluído/iniciado/revertido | `docs/PLAN.md` |
| Requisito de produto, persona, estratégia (funil, pricing) | `docs/PRD.md` |
| Feature ou mudança visível ao usuário final | `README.md` |
| Uso/criação de agente ou skill de IA no projeto | `AGENTES.md` |

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Estilização | Tailwind CSS v4 |
| Componentes UI | shadcn/ui com **@base-ui** (não Radix) |
| Gráficos | Recharts |
| Backend / Banco | Supabase (PostgreSQL + Auth + RLS) |
| Deploy | Vercel |

---

## Identidade Visual

- **Cor primária**: azul royal `#2563eb` (classe `blue-600`)
- **Gradiente de marca**: `from-blue-600 via-blue-700 to-indigo-900`
- **Dark mode**: fundo `slate-900`, superfície `slate-800`
- **Raio de borda**: `rounded-xl` (12px) como padrão para cards e inputs
- **Tipografia**: sistema do Next.js (Inter via Tailwind)
- **Ícones**: Lucide React exclusivamente
- **Login/Register**: layout split-screen — painel de marca (52% esquerda, gradiente azul) + formulário (direita, branco/slate)
- **Sidebar**: fixa no desktop; nav inferior no mobile

> Tentativa de redesign dark premium (navy + dourado) para as páginas de auth foi feita e revertida em 2026-07-01 — o gradiente azul original (`from-blue-600 via-blue-700 to-indigo-900`) permanece como identidade oficial do painel de marca.

---

## Convenções de Código

### Componentes
- Sempre `'use client'` em componentes com estado ou hooks
- Nomes de componentes em PascalCase, arquivos em kebab-case
- Props tipadas inline ou como `interface` acima do componente

### Hooks
- Todos os hooks de dados ficam em `src/hooks/`
- Padrão: `use-[entidade].ts` (ex: `use-transactions.ts`, `use-goals.ts`)
- Cada hook encapsula o Supabase client, estado de loading e funções CRUD
- Dependências de `useCallback`/`useEffect`: arrays primitivos derivados de objetos (ex: `.join(',')` para arrays de IDs)

### Supabase / Banco
- RLS ativo em todas as tabelas — todas as policies usam `auth.uid() = user_id`
- Filtro NULL-safe para NOT IN: `.or('board_id.is.null,board_id.not.in.(ids)')`
- Client-side: `createClient()` de `@/lib/supabase/client`
- Server-side: `createClient()` de `@/lib/supabase/server`

### Formatação de valores
- Moeda: `new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)`
- Datas: `date-fns` com locale `ptBR`

### shadcn/ui (base-ui)
- `DropdownMenuTrigger` **não suporta `asChild`** — usar `className` direto no trigger
- Importar componentes de `@/components/ui/`

---

## Estrutura de Pastas

```
src/
  app/
    (app)/              # Rotas protegidas (exigem login)
      dashboard/        # Dashboard principal
      transactions/     # Lista de contas + visão por conta [boardId]
      analytics/        # Análise mensal por categoria
      reports/          # Relatórios (mensal, anual, parcelas, gastos fixos)
      fixos/            # Gastos recorrentes com agrupamento por subcategoria
      recurring/        # Parcelas ativas
      goals/            # Metas financeiras
      planning/         # Planejamento orçamentário
      import/           # Importação de extratos (CSV, OFX, C6, RICO)
      settings/         # Categorias, subcategorias, regras de categorização
      categories/       # Gerenciamento de categorias
      account/          # Conta do usuário
      admin/            # Painel de administração
      help/             # Central de ajuda (manual do usuário)
    auth/
      login/            # Login (split-screen SaaS)
      register/         # Cadastro
    demo/               # Demo com dados de exemplo, sem login
  components/
    dashboard/          # SummaryCards, DiagnosticCard, CategoryChart, BoardSummaryCard, etc.
    transactions/       # TransactionForm, TransactionTable, TransactionFilters, ImportCSVModal
    categories/         # SpecialDatesPicker (chips de mês/ano pra categoria especial)
    layout/             # Sidebar (desktop), MobileNav (mobile)
    ui/                 # Componentes base shadcn/ui
  hooks/                # Lógica de dados — CRUD, filtros, cálculos (use-rules, use-recurring, use-recurring-monthly-total, use-budget-plan, etc.)
  lib/
    supabase/           # Clientes (client.ts, server.ts), schema.sql e migration_*.sql
    special-category-filter.ts  # Filtros de categoria especial por data/transações
    recurring-groups.ts # Agrupamento de itens recorrentes (buildDisplayItems), compartilhado /fixos + relatórios
  types/                # Tipos TypeScript globais (Transaction, Category, Goal, etc.)
  utils/                # export-csv, parse-rico (XLSX), parse-ofx, parse-ofx-balance, detect-transfer
  middleware.ts         # Proteção de rotas via Supabase Auth
docs/
  PRD.md                # Product Requirements Document
```

---

## Conceitos-Chave do Domínio

### Categorias — exclusão cascateia para "Outros"
`deleteCategory` (`use-categories.ts`) reatribui para a categoria "Outros" tudo que apontava para a categoria excluída: `transactions.category`, `categorization_rules.category` e as chaves de `budget_plans.category_limits`. "Outros" não pode ser excluída (é o destino padrão, verificado por nome case-insensitive). A cascata só roda se **nenhuma outra categoria** ainda usa aquele nome — isso importa porque o fluxo de "Mesclar" (`confirmMerge`, em ambas as páginas de categorias) renomeia a categoria de origem para o nome da categoria destino *antes* de chamar `deleteCategory`; sem essa checagem, mesclar A→B disparia a cascata usando o nome "B" e moveria as transações da categoria destino inteira para "Outros".

**Duas páginas fazem a mesma coisa:** `/categories` e `/settings/categories` são implementações paralelas (a segunda é mais completa: busca, filtro por tipo, mesclar). Ambas usam `useCategories()` e precisam de manutenção em conjunto — `/categories` ainda é uma rota viva, referenciada por um link em `transaction-form.tsx`.

### Categorias especiais
Categoria válida só em meses/anos específicos (`Category.special_dates: { month, year }[]`, coluna JSONB — migração `migration_special_category_dates.sql`). Pensada pra organizar um gasto/evento único (ex: "Reforma Banheiro"). Vive na mesma tabela `categories` — funciona como qualquer outra ao categorizar uma transação — mas fica numa seção própria no final das duas páginas de categorias, fora da lista principal (`filtered`/`regularCategories` excluem quem tem `special_dates.length > 0`).

**Uma categoria, várias datas** — não duplica a categoria por mês. "Viagem" pode ter `special_dates: [{month:2,year:2026}, {month:3,year:2026}]` na mesma linha; o picker de datas (`src/components/categories/special-dates-picker.tsx`) deixa adicionar/remover meses a qualquer momento editando a categoria. Como o nome é único de novo (igual categoria normal, checado em `createCategory`), regras podem apontar pra categoria especial sem ambiguidade.

`src/lib/special-category-filter.ts` centraliza toda a lógica de "essa categoria vale pra essa data/essas transações": `isCategoryUsableForDate`, `categoriesForDate` (filtra pra uma transação/data), `nonSpecialCategories` (contextos sem data, ex: regras antigas antes da correspondência exata), `categoriesForTransactions` (seleção em massa — só libera se **todas** as selecionadas caem em algum mês da categoria). Todo lugar que oferece categoria pra escolher (`TransactionForm`, recategorizar no Analytics, revisão pós-importação, seleção em massa, Planejamento) usa um desses filtros — se adicionar um novo seletor de categoria, usar um deles também.

**Isolamento de categoria especial:** nunca entra no sistema de regras (nem cria regra automática, nem é sobrescrita por nenhuma regra — checado em `applyRuleToExisting` via `specialCategoryNames`). Uma vez que uma transação está numa categoria especial, só muda por edição manual, uma por uma.

### TransactionBoard (Conta)
Representa uma conta financeira (banco, cartão, investimento). Campo `show_on_dashboard: boolean` controla se a conta é pinada no dashboard. Contas não pinadas são excluídas de **todos** os totais agregados: dashboard, analytics, relatórios e parcelas ativas.

### Isolamento de contas não pinadas
Filtro aplicado via `exclude_board_ids` na interface `TransactionFilters`:
```typescript
// NULL-safe NOT IN no PostgREST:
query.or(`board_id.is.null,board_id.not.in.(${ids})`)
```

### Gastos Recorrentes
Detectados automaticamente nos últimos 12 meses (mínimo 2 ocorrências). Agrupados por `group_label` (subcategoria). Decisões por item: confirmado / ignorado / oculto — persistidas na tabela `recurring_decisions`.

**Cartões & Parcelas sempre contam como fixo:** em `/fixos`, os parcelamentos ativos (de `useRecurring().installments`) aparecem como um grupo próprio, sempre somado ao total "Fixos confirmados / mês" sem passar pelo fluxo de confirmação manual — diferente dos demais itens recorrentes, que exigem decisão do usuário.

O agrupamento de itens recorrentes (`buildDisplayItems`, por `group_label`) vive em `src/lib/recurring-groups.ts`, compartilhado entre `/fixos` e o hook `use-recurring-monthly-total.ts` — qualquer tela que precise do mesmo total de "fixos confirmados/mês" deve usar esse hook em vez de recalcular a lógica de agrupamento.

### Planejamento Mensal — Gastos Previstos (Recorrência)
Campo somente leitura em `/planning`, ligado à coluna `expenses_target` de `budget_plans`. Diferente dos outros campos do plano, ele **trava (snapshot)** no valor do momento em que o usuário clica em "Salvar Planejamento" — não recalcula sozinho depois. Antes do primeiro save de um mês, mostra uma prévia ao vivo do total de `useRecurringMonthlyTotal()`. Esse valor não entra na tabela Planejado × Realizado (é referência de formulário, não comparação).

### Chaves de agrupamento (gastos fixos)
- Item com `group_label`: chave `group:${label}`
- Item avulso: chave `description.toLowerCase()`
- **`RecurringItem.descriptionVariants`**: a chave de agrupamento é frouxa (`description.toLowerCase().trim()`), mas ações de escrita (`Confirmar como fixo`, atribuir subcategoria) usam `.in('description', ...)` no Supabase, que é comparação **exata**. Por isso `use-recurring.ts` guarda todas as variações de texto exatas vistas para a mesma chave em `descriptionVariants`, e `buildDisplayItems` usa essa lista (não só uma representante) ao montar `item.descriptions` — senão transações com pequena diferença de texto (espaço, capitalização) ficam de fora do UPDATE mesmo aparecendo somadas visualmente. Bug corrigido em 2026-07-01.
- **Sincronização de transações novas em `/fixos`**: `is_recurring` é um campo agregado por grupo (`true` se QUALQUER transação do grupo já for `true`), então checar `!item.is_recurring` antes de repropagar não pega transações novas de uma importação recente (o agregado já parecia `true` por causa de ocorrências antigas). A sincronização em `fixos/page.tsx` sempre repropaga `is_recurring=true` para itens confirmados (idempotente) e também propaga `group_label` do grupo para qualquer transação nova ainda sem subcategoria (`.is('group_label', null)`, nunca sobrescreve uma já definida). Bug corrigido em 2026-07-01.

### Parcelas
Detectadas por `installment_total > 1` (campo DB) ou pelo padrão legado `(X/Y)` na descrição.

### Regras de categorização — criação automática
Além de criar regra manualmente em `/settings/rules`, **qualquer recategorização de uma transação pra categoria normal** (formulário de editar em Contas e Cartões, recategorizar no Analytics, revisão pós-importação) cria ou atualiza sozinha uma regra de correspondência **exata** com a descrição daquela transação, via `syncCategoryToRule` (`use-rules.ts`) — e já aplica retroativamente. Não existe mais botão manual de "criar regra" fora de `/settings/rules` (removido em 2026-07-02: Analytics tinha "⚡ virar regra", revisão pós-importação tinha botão "Regra" — ambos removidos, a automação cobre o caso).

- Regra criada por essa automação vem com `auto_created: true` (coluna nova, migração `migration_rule_auto_created.sql`) e aparece na lista de `/settings/rules` com uma etiqueta roxa "Automática", misturada com as manuais, dentro do mesmo agrupamento por categoria.
- Categoria especial nunca passa por aqui — `syncCategoryToRule` retorna cedo se a categoria alvo for especial (ver seção "Categorias especiais" acima).
- `applyRuleToExisting` e `syncCategoryToRule` fazem update direto no Supabase (não reusam `createRule`/`updateRule` do hook) especificamente pra propagar o erro real do Postgres — esse fluxo já teve bug de erro engolido silenciosamente (`PGRST204`, coluna faltando) corrigido em 2026-07-02.

### Transferências — detecção na importação
`src/utils/detect-transfer.ts` (`isTransferDescription`) reconhece transações que começam com "Transferência"/"Transf"/"TED"/"DOC" e marca `type: 'transferencia'` nos parsers (`parse-ofx.ts`, `import-csv-modal.tsx` — C6 crédito, C6 conta corrente, CSV genérico). PIX é propositalmente **excluído** do reconhecimento (a maioria é pagamento a terceiros, uma despesa/receita real, não movimentação interna). Toda a UI que soma "gasto" (`type === 'despesa'`) já ignora `transferencia` corretamente — o bug histórico era os parsers nunca atribuírem esse tipo, não a agregação.

**Herança de categoria por histórico na importação** (`import-csv-modal.tsx`, `handleImport`): transação nova com categoria "Outros" herda a categoria de uma transação antiga com a mesma descrição exata. Categoria especial é **excluída** dessa herança desde a raiz — nunca entra no `historyMap` — porque descrições genéricas (ex: "DEBITO DE CARTAO") podem repetir em transações de eventos completamente diferentes; herdar uma categoria especial por coincidência de texto sempre estaria errado. Bug corrigido em 2026-07-01/02.

### Seleção múltipla em `TransactionTable`
Checkbox por linha + "selecionar todas", com barra de ação (mudar categoria / mover para conta / excluir), cada uma com diálogo de confirmação mostrando a contagem antes de aplicar. A seleção (`selected` state) é resetada via `useEffect` sempre que o array `transactions` muda de referência (troca de filtro, mês, busca) — sem isso, uma seleção antiga podia ser aplicada por engano numa lista diferente da que está na tela (bug corrigido em 2026-07-02). Só ativa (mostra os checkboxes) se a página passar `onBulkCategoryChange`/`onBulkMove`/`onBulkDelete` — hoje só `transactions/[boardId]/page.tsx` usa isso.

### Auth (Login/Cadastro)
- Links de navegação cruzada no topo (canto superior direito) foram removidos de ambas as páginas — `ThemeToggle` é o único elemento na barra superior
- O link "Já tem uma conta? Entrar" / "Não tem conta? Criar conta" permanece **dentro do formulário**, abaixo do botão de submit (não é nav do topo)
- Cadastro tem campo **Nome** no topo do formulário, salvo em `user_metadata.full_name` via `options.data` no `supabase.auth.signUp()`

---

## Setup Inicial

### 1. Variáveis de ambiente
```bash
cp .env.example .env.local
```
Preencha com as credenciais do Supabase (Settings → API) e o e-mail do owner (acesso ao `/admin`):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_ADMIN_EMAIL=...
```
Sem `NEXT_PUBLIC_ADMIN_EMAIL` configurada (local **e** na Vercel), o painel `/admin` fica inacessível — `src/app/(app)/admin/page.tsx` e `src/components/layout/sidebar.tsx` comparam `user.email` contra essa variável.

### 2. Banco de dados
No SQL Editor do Supabase, execute `src/lib/supabase/schema.sql` e, em seguida, todos os `migration_*.sql` da mesma pasta (não há runner automático — cada um roda manualmente, uma vez, na ordem que foram criados). Se uma tela der erro de "coluna não existe" ou similar, é sinal de alguma migração pendente — os arquivos mais recentes costumam ser mencionados como pendência no histórico da conversa/commit correspondente.

### 3. Rodar localmente
```bash
npm install
npm run dev
```

### 4. Deploy
```bash
vercel --prod
```

---

## Notas Importantes

- **Next.js 16**: `middleware.ts` ainda funciona (deprecação do proxy ainda não obrigatória)
- **Vercel free plan**: limite de 100 deploys/dia — aguardar 24h se atingido
- **Hook ordering**: `useMemo` que deriva arrays de IDs deve ser declarado **antes** do hook que os consome
- **Datas**: sempre `YYYY-MM-DD` no banco; usar `date-fns` para display
