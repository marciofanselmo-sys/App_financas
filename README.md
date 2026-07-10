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
- **Seleção múltipla em massa**: dentro de uma conta (Contas e Cartões), marque várias transações com checkbox e aplique de uma vez: mudar categoria, mover para outra conta ou excluir — cada ação pede confirmação mostrando a quantidade de transações afetadas
- **Editar categoria vira regra automática**: ao trocar a categoria de uma transação para uma categoria normal, o sistema cria/atualiza automaticamente uma regra (badge "Automática" em `/settings/rules`) e aplica a mesma mudança em todas as transações passadas com a descrição exata. Categorias especiais nunca entram nesse mecanismo — nem geram regra, nem são sobrescritas por uma
- Exportação das transações para CSV

### Importação de Extratos
- **CSV genérico**: compatível com Nubank, Inter, Banco do Brasil, Itaú, Bradesco e outros — detecção automática de colunas
- **OFX / QFX**: formato padrão bancário com maior precisão de dados (Itaú, Bradesco, Santander, Caixa, BB, Inter)
- **C6 Bank**: layout específico da conta corrente e fatura do cartão
- Fluxo de revisão antes de salvar: categorização automática por regras + edição manual de cada item importado
- **Detecção automática de transferências**: descrições iniciadas por "Transferência", "Transf", "TED" ou "DOC" são marcadas como tipo Transferência (não entram como receita/despesa real). PIX é tratado como transação normal, pois pode ser tanto um gasto real quanto uma transferência entre contas próprias
- **Herança de categoria por histórico**: ao importar, uma descrição já categorizada antes puxa a mesma categoria automaticamente — mas esse histórico nunca considera categorias especiais, evitando que uma associação especial pontual "vaze" para outras transações com descrição parecida

### Categorização Automática
- Regras baseadas em palavra-chave: ao criar uma regra em `/settings/rules`, ela pode ser aplicada retroativamente a transações já importadas
- **Criação automática ao editar**: não é preciso criar regra manualmente na maioria dos casos — editar a categoria de uma transação (em Transações ou Analytics) já cria a regra sozinha (veja acima). O botão de criar regra manual existe apenas em `/settings/rules`

### Analytics (Análise Mensal)
- Gráficos de gastos e receitas por categoria
- Filtro por conta específica ou visão geral (excluindo contas não pinadas)
- Filtro de período (mês/ano)
- Drill-down: clicar em uma categoria abre a lista de transações daquele grupo, com descrição/data, seletor de categoria e valor lado a lado para recategorizar rapidamente

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
- **Cartões & Parcelas sempre contam como fixo:** os parcelamentos ativos aparecem como um grupo próprio no topo da tela, somados automaticamente ao total "Fixos confirmados / mês" — sem precisar de confirmação manual e sempre recalculado com base no mês atual

### Parcelas Ativas
- Lista de compras parceladas em andamento com progresso (X/Y parcelas)
- Badges de status: "Última parcela", "Quase acabando", "Longo prazo"
- Cadastro manual de parcelamentos (para parcelas não importadas)
- Filtro por conta
- **Remover da lista de parcelamentos:** ícone de lixeira em cada card, com confirmação — não apaga a transação, só limpa os campos de parcela (`installment_current`/`installment_total`, ou o sufixo `(X/Y)` legado), fazendo o item deixar de ser detectado como parcelamento

### Investimentos
- Contas dedicadas a investimento (`is_investment`), separadas das contas normais em `/transactions`
- Templates prontos: Corretora (RICO, XP, Clear, Nubank Investimentos), Previdência Privada, Criptomoedas, Tesouro Direto, Outro
- Importação de posição por conta: patrimônio total, breakdown de ativos por categoria e lista de proventos previstos
- Botão de atualizar posição a qualquer momento (reimportar extrato da corretora)

### Metas Financeiras
- Tipos de meta: Reserva de Emergência, Investimento, Carro, Viagem, Quitar Dívida, Imóvel, Personalizada
- Status automático: No prazo / Adiantada / Atrasada (baseado na % concluída vs tempo decorrido)
- **Valor atual**: manual ou vinculado a uma conta de investimento já existente (puxa o patrimônio importado em `/investments`) — mutuamente exclusivo, com botão de reatualizar em 1 clique sem precisar reabrir o seletor de conta
- "Meta iniciada em" é editável, para metas que representam dinheiro já guardado antes do cadastro no app

### Planejamento Orçamentário
- Templates de orçamento: Equilibrado (30% poupança/investimento), Investidor (40%), Quitar Dívidas (10%), Personalizado
- Três campos no topo: **Receita prevista**, **Gastos Previstos (Recorrência)** e **Poupança/Investimento previsto** (soma Investimento + Reserva/Reserva de emergência) — unificado em 2026-07-01
- **Gastos Previstos (Recorrência)**: campo somente leitura, puxado do mesmo total de "Fixos confirmados / mês" de `/fixos` (recorrências confirmadas + Cartões & Parcelas ativos). Antes de salvar, mostra uma prévia ao vivo; ao clicar em "Salvar Planejamento", o valor é **travado** (congelado) naquele momento e fica gravado com aquele mês específico — não muda mais sozinho depois. Esse valor não aparece na tabela Planejado × Realizado (é só referência no formulário)
- Definição de limite por categoria
- **Limite por subcategoria**: seção separada para limitar subcategorias de despesa (ex: "Mercado"), fora da soma de "Total Despesas" da tabela Planejado × Realizado (evita contar o mesmo gasto duas vezes, já que subcategoria é um recorte transversal à categoria)
- Comparação planejado vs realizado para o mês selecionado
- Indicadores visuais de status por categoria (dentro do limite, próximo, estourado)
- **Repetição automática:** ao salvar um planejamento, ele passa a valer também para os meses seguintes que ainda não têm plano próprio (a tela avisa quando o valor exibido foi herdado). Meses anteriores e meses futuros já configurados individualmente não são alterados.

### Configurações
- **Categorias**: criar, editar, excluir e restaurar categorias padrão
- **Excluir categoria cascateia para "Outros"**: transações, regras de categorização e limites de planejamento que apontavam para a categoria excluída são automaticamente reatribuídos à categoria "Outros" (que não pode ser excluída, por ser o destino padrão). Usar "Mesclar" (→) em vez de excluir se quiser mover para uma categoria específica
- **Categorias especiais**: seção separada no final da tela de Categorias, para organizar um gasto/evento preso a um ou mais meses/anos específicos (ex: "Viagem" válida em fevereiro E março/2026 — não precisa duplicar a categoria por mês). Só aparecem como opção ao categorizar transações dentro dos meses configurados; em outros meses ficam invisíveis nos seletores de categoria. Nunca entram no sistema de regras automáticas nem no histórico de herança por descrição — isoladas por design, pra não "vazar" pra outras transações
- **Subcategorias**: agrupamento de gastos recorrentes por rótulo personalizado
- **Regras de categorização**: mapeamento automático de descrição → categoria, com badge "Automática" para regras criadas ao editar a categoria de uma transação (veja Transações)

### Autenticação
- Login e cadastro com design split-screen (painel de marca + formulário)
- Barra superior sem links de navegação cruzada entre login/cadastro — apenas o toggle de tema
- Cadastro com campo **Nome**, salvo em `user_metadata.full_name` no Supabase Auth
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
Preencha `.env.local` com suas credenciais do Supabase (Settings → API no painel do Supabase) e o e-mail do owner:
```
NEXT_PUBLIC_SUPABASE_URL=sua_url_aqui
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua_chave_aqui
NEXT_PUBLIC_ADMIN_EMAIL=seu@email.com
```
`NEXT_PUBLIC_ADMIN_EMAIL` controla quem tem acesso ao painel `/admin` — sem ela, o item de menu e a rota ficam bloqueados mesmo para o dono do app.

> **Segurança:** `.env.local` está no `.gitignore` e nunca deve ser commitado. A segurança dos dados é garantida pelas políticas de Row Level Security (RLS) no banco.

### 3. Criar tabelas no Supabase
No SQL Editor do Supabase, execute o conteúdo de `src/lib/supabase/schema.sql` e, em seguida, todos os arquivos `migration_*.sql`/`migration-*.sql` da mesma pasta (várias tabelas/colunas foram adicionadas depois do schema inicial — regras, parcelas, subcategorias, categorias especiais, etc).

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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API → anon/publishable key |
| `NEXT_PUBLIC_ADMIN_EMAIL` | E-mail do owner do SaaS — libera acesso ao painel `/admin` |

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
      investments/      # Contas de investimento e importação de posição
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
    investments/        # Breakdown de posição, categorias e proventos
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
