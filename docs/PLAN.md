# PLAN — FinanceApp: Plano de Execução por Milestones

> Registro do que foi construído e o que ainda falta para o produto estar completo e comercialmente operacional.
>
> **Legenda:** ✅ Concluído · 🔲 Pendente · 🚧 Parcial

---

## ✅ M01 — Foundation & Setup
**Branch:** `main`
**Objetivo:** Scaffold do projeto com toda a infraestrutura base funcionando.

- [x] Next.js 16 com App Router e TypeScript
- [x] Tailwind CSS v4 configurado
- [x] shadcn/ui instalado (base-ui, não Radix)
- [x] Supabase: projeto criado, `schema.sql` com RLS policies
- [x] `.env.example` + `.gitignore` (credenciais protegidas)
- [x] Deploy inicial na Vercel com variáveis de ambiente configuradas
- [x] `middleware.ts` para proteção de rotas (redireciona para login se não autenticado)

**Commit final:** `6428a77` feat: add complete personal finance app

---

## ✅ M02 — Autenticação & Segurança
**Branch:** `main`
**Objetivo:** Usuário consegue criar conta, fazer login e ter seus dados isolados.

- [x] Página de login (`/auth/login`)
- [x] Página de cadastro (`/auth/register`)
- [x] Supabase Auth com email e senha
- [x] Row Level Security — `auth.uid() = user_id` em todas as tabelas
- [x] Sessão persistente com refresh automático
- [x] Redirect pós-login para `/dashboard`

**Commit final:** `6428a77` feat: add complete personal finance app

---

## ✅ M03 — Transações Core
**Branch:** `main`
**Objetivo:** Usuário consegue registrar, editar, excluir e visualizar receitas e despesas.

- [x] Formulário de transação (valor, data, descrição, categoria, tipo)
- [x] Tabela de transações com filtros (busca, categoria, tipo)
- [x] Edição e exclusão inline
- [x] Categorias dinâmicas com gestão (criar, editar, excluir, restaurar padrões)
- [x] Exportação para CSV
- [x] Dark/light mode toggle com `next-themes`
- [x] Cards de transação com cor de categoria
- [x] Fix: form reseta corretamente ao abrir nova transação
- [x] Seleção múltipla + mudança de categoria em massa na `TransactionTable` (checkbox por linha + "selecionar todas", barra de ação com seletor de categoria) — disponível na tela de conta (`transactions/[boardId]`) via novo prop opcional `onBulkCategoryChange` (2026-07-01)
- [x] Seleção múltipla expandida: "Mover para conta" e "Excluir" além de mudar categoria (`onBulkMove`/`onBulkDelete`), cada ação com dialog de confirmação mostrando a quantidade de transações afetadas (2026-07-02)
- [x] **Bug corrigido:** seleção de checkboxes ficava "presa" ao trocar de filtro (ex: trocar de conta ou mês) — a lista de `selected` não resetava. Corrigido com `useEffect` que zera `selected` sempre que a referência de `transactions` muda (2026-07-02)
- [x] Editar a categoria de uma transação para uma categoria normal cria/atualiza automaticamente uma regra exata (`syncCategoryToRule`) e cascateia a mudança pra todas as transações passadas com a mesma descrição — categorias especiais nunca entram nesse fluxo (nem geram regra, nem são sobrescritas por uma) (2026-07-02)

**Commit final:** `3ff04bf` feat: cards de transação com cor de categoria e limpeza de descrições OFX

---

## ✅ M04 — Motor de Importação de Extratos
**Branch:** `main`
**Objetivo:** Usuário importa extratos bancários reais com categorização automática.

- [x] Parser CSV genérico com detecção automática de colunas (Nubank, Inter, BB, Itaú, Bradesco)
- [x] Parser OFX/QFX — formato padrão bancário com maior precisão
- [x] Parser C6 Bank — layout específico da conta corrente e fatura
- [x] Parser Mercado Pago — PDF exportado pelo app (`parse-mercadopago-pdf.ts`)
- [x] Fluxo de revisão antes de salvar (editar cada item importado)
- [x] Regras de categorização: keyword → categoria (contains, starts_with, ends_with, exact)
- [x] Aplicação retroativa de regras em transações existentes
- [x] Detecção automática de transferências na importação (`detect-transfer.ts`/`isTransferDescription`): descrições "Transferência", "Transf", "TED", "DOC" marcadas como `type: 'transferencia'` no OFX e no CSV genérico/C6, para não contarem como receita/despesa real. PIX propositalmente excluído (pode ser gasto real) (2026-07-02)
- [x] **Bug corrigido:** herança de categoria por histórico na importação (`historyMap`) inseria também categorias especiais — uma associação manual pontual (ex: transação → categoria especial "Campeonato CBT BH") "vazava" para outras transações com descrição genérica parecida (ex: "DEBITO DE CARTAO") em meses onde a categoria especial nem era válida. Corrigido excluindo categorias especiais da construção do `historyMap` por completo — o histórico de importação só herda categorias normais (2026-07-02)
- [x] ~~Criação de regra direta da tela de Analytics~~ — removida (2026-07-02): substituída pela criação automática de regra ao recategorizar (`syncCategoryToRule`). Todos os botões manuais de "criar regra" fora de `/settings/rules` foram removidos (Analytics "virar regra", revisão de importação) — a única forma de criar regra manualmente agora é em `/settings/rules`

**Commit final:** `3cd7eb5` feat: add OFX/QFX import with auto-categorization

---

## ✅ M05 — Layout & Navegação
**Branch:** `main`
**Objetivo:** Estrutura de navegação completa para desktop e mobile.

- [x] Sidebar fixa no desktop com todos os itens de menu
- [x] Navigation bar inferior no mobile (4 itens principais)
- [x] Drawer "Mais" no mobile com itens secundários
- [x] Submenu expansível em Configurações
- [x] ThemeToggle acessível no header e no mobile drawer
- [x] Logo e identidade visual aplicados na sidebar

**Commit final:** `99283d4` feat: submenu expansível em Configurações, categorias em /settings/categories

---

## ✅ M06 — Metas Financeiras
**Branch:** `main`
**Objetivo:** Usuário define e acompanha metas de médio e longo prazo.

- [x] Página `/goals` com CRUD de metas
- [x] Tipos de meta: Reserva, Investimento, Carro, Viagem, Dívida, Imóvel, Personalizada
- [x] Progresso visual com barra e percentual
- [x] Cálculo de valor mensal necessário para atingir a meta
- [x] Status automático: No prazo / Adiantada / Atrasada (baseado em % concluída vs tempo)
- [x] Importação de extrato RICO (`PosicaoDetalhada.xlsx`) para atualizar valor investido
- [x] Importação OFX balance para atualizar saldo de reserva/conta

**Commit final:** `8c4179e` feat: importação de extrato RICO (PosicaoDetalhada.xlsx) nas metas

---

## ✅ M07 — Multi-Conta & Dashboard
**Branch:** `main`
**Objetivo:** Usuário gerencia múltiplas contas e tem visão centralizada no dashboard.

- [x] `TransactionBoard` — entidade de conta com nome, ícone, cor e tipo
- [x] Templates prontos: Conta Corrente, Cartão de Crédito, Carteira Digital, Poupança, Investimentos, Dinheiro Físico
- [x] Pin/unpin de contas — contas não pinadas excluídas de **todos** os totais agregados
- [x] Isolamento NULL-safe via PostgREST: `board_id.is.null,board_id.not.in.(ids)`
- [x] Dashboard: SummaryCards (receita, despesa, saldo)
- [x] Dashboard: cards individuais das contas pinadas (`BoardSummaryCard`)
- [x] Dashboard: `TopCategoriesBar` — maiores categorias de gasto do mês
- [x] Dashboard: `DiagnosticCard` — análise automática de saúde financeira
- [x] Dashboard: `NextActionCard` — próxima ação recomendada
- [x] Filtro de período (mês/ano) no dashboard
- [x] Modal de onboarding para novos usuários

**Commit final:** `8c52134` feat: multi-conta, analytics, relatórios, importação e planejamento orçamentário

---

## ✅ M08 — Analytics
**Branch:** `main`
**Objetivo:** Usuário analisa seus gastos por categoria com profundidade.

- [x] Gráficos de despesas por categoria (barras e proporções)
- [x] Gráficos de receitas por categoria
- [x] Filtro por conta específica ou visão geral
- [x] Filtro de período (mês/ano)
- [x] Drill-down: clicar em categoria abre lista de transações daquele grupo
- [x] Isolamento de contas não pinadas na visão geral
- [x] Linha de transação do drill-down redesenhada em 3 colunas: descrição+data empilhados (col. 1, `flex-1`), seletor de categoria (col. 2, `shrink-0`), valor alinhado à direita (col. 3, `w-24`) — recategorizar já dispara `syncCategoryToRule` (2026-07-02)

**Commit final:** `8c52134`

---

## ✅ M09 — Gastos Fixos & Recorrentes
**Branch:** `main`
**Objetivo:** Usuário identifica e gerencia seus gastos recorrentes mensais.

- [x] Detecção automática dos últimos 12 meses (mínimo 2 ocorrências ou flag `is_recurring`)
- [x] Agrupamento por `group_label` (subcategoria customizada)
- [x] Decisões por item: confirmar como fixo / ignorar / ocultar
- [x] Persistência das decisões na tabela `recurring_decisions`
- [x] Gestão de subcategorias (`/settings/subcategories`)
- [x] Média mensal ponderada por grupo
- [x] Isolamento de contas não pinadas
- [x] Cartões & Parcelas (`/recurring`) passam a contar sempre como fixo em `/fixos`: aparecem como grupo próprio (sempre visível, sem confirmação manual), somados ao total "Fixos confirmados / mês" e recalculados a cada mês (2026-07-01)
- [x] **Bug corrigido:** "Confirmar como fixo" não marcava todas as transações com o mesmo nome quando havia pequena variação de texto exata (espaço, capitalização) entre elas, mesmo aparecendo somadas na média visual — o agrupamento usava comparação frouxa mas a escrita no banco usava só uma variante exata. Corrigido guardando todas as variações de texto (`RecurringItem.descriptionVariants`) e usando a lista completa no `.in('description', ...)` (2026-07-01)
- [x] **Bug corrigido:** transação nova (de uma importação recente) com a mesma descrição de um item já confirmado/rotulado ficava para trás — `is_recurring` continuava `false` e a subcategoria não era herdada, porque a sincronização checava o estado agregado do grupo (já `true` por causa de ocorrências antigas) em vez de cada transação individualmente. Corrigido: a sincronização em `/fixos` agora sempre repropaga `is_recurring=true` para itens confirmados e herda a subcategoria (`group_label`) do grupo para qualquer transação nova que ainda esteja sem uma (2026-07-01)

**Commit final:** `8c52134`

---

## ✅ M10 — Parcelas Ativas
**Branch:** `main`
**Objetivo:** Usuário acompanha o progresso de todas as compras parceladas.

- [x] Detecção automática via `installment_total > 1` (campo DB) ou padrão legado `(X/Y)` na descrição
- [x] Lista com progresso visual (X/Y parcelas e previsão de término)
- [x] Badges de status: "Última parcela", "Quase acabando", "Longo prazo"
- [x] Cadastro manual de parcelamentos não importados
- [x] Filtro por conta
- [x] Isolamento de contas não pinadas
- [x] Remover parcelamento detectado (`dismissInstallment` em `use-recurring.ts`): botão de lixeira + confirmação, não destrutivo — limpa `installment_current`/`installment_total` (ou o sufixo legado `(X/Y)`) sem apagar a transação, deixando de contar como parcela ativa (2026-07-01)

**Commit final:** `8c52134`

---

## ✅ M11 — Relatórios
**Branch:** `main`
**Objetivo:** Usuário extrai relatórios consolidados do seu histórico financeiro.

- [x] Relatório Mensal: receitas, despesas e breakdown por categoria
- [x] Relatório Anual: comparativo mês a mês no ano
- [x] Relatório de Parcelas: todas as parcelas ativas com progresso
- [x] Relatório de Gastos Fixos: agrupado por subcategoria com média mensal
- [x] Filtro por conta em todos os relatórios
- [x] Fix: agrupamento correto no relatório de gastos fixos (mesma lógica da tela `/fixos`)

**Commit final:** `8c52134`

---

## ✅ M12 — Planejamento Orçamentário
**Branch:** `main`
**Objetivo:** Usuário define um orçamento mensal e acompanha se está dentro do plano.

- [x] Templates: Equilibrado (50/30/20), Investidor (45/25/30), Quitar Dívidas, Personalizado
- [x] Definição de limite por categoria
- [x] Comparativo planejado vs realizado para o mês selecionado
- [x] Indicadores visuais: dentro do limite / atenção / estourado
- [x] Persistência do plano via `use-budget-plan` hook
- [x] Herança automática: um planejamento salvo passa a valer para os meses seguintes que ainda não têm plano próprio; meses anteriores e meses futuros já configurados não são afetados (2026-07-01)
- [x] Tentativa de incluir subcategorias como opção no planejamento (dropdown "Adicionar" + linhas na tabela) — revertida em 2026-07-01: o valor de uma subcategoria já está contido na categoria pai (mesmas transações via `group_label`), então dar limite próprio à subcategoria duplicava o gasto no "Total Despesas". Planejamento continua só por categoria.
- [x] Unificação de "Investimento previsto" + "Reserva financeira" em um único campo "Poupança/Investimento" — os dois eram conceitualmente ambíguos (investimento já é uma forma de reserva); agora soma as categorias Investimento + Reserva/Reserva de emergência num só alvo. `reserve_target` na tabela `budget_plans` permanece na estrutura por compatibilidade, mas passa a ser sempre salvo como 0 (2026-07-01)
- [x] Campo "Gastos Previstos (Recorrência)" (coluna `expenses_target`, migração `migration_budget_plan_expenses_target.sql` — **precisa ser rodada manualmente no Supabase**): redesenhado após feedback do usuário — não é mais editável nem entra na tabela Planejado × Realizado (tirado por não fazer sentido ali). Agora é somente leitura, puxado do mesmo cálculo de "Fixos confirmados / mês" (`useRecurringMonthlyTotal`, extraído de `/fixos` para hook compartilhado). Mostra prévia ao vivo antes de salvar; ao clicar em "Salvar Planejamento", trava (congela) o valor daquele momento para aquele mês específico — não atualiza mais sozinho depois de salvo. O rodapé da tabela de categorias continua como "Total das categorias configuradas" (2026-07-01)

**Commit final:** `8c52134`

---

## ✅ M13 — Identidade SaaS & Onboarding
**Branch:** `main`
**Objetivo:** O produto tem aparência e fluxo de um SaaS profissional desde a primeira tela.

- [x] Redesign do login: split-screen (painel de marca 52% + formulário 48%)
- [x] Redesign do cadastro: mesmo padrão com benefícios rápidos
- [x] Painel de marca: gradiente azul-índigo, dot grid, preview de dashboard, features
- [x] Demo sem cadastro (`/demo`) com dados de exemplo e score financeiro
- [x] Modal de onboarding para novos usuários (`OnboardingModal`)
- [x] Central de ajuda integrada (`/help`) com artigos e busca
- [x] Login/cadastro: links de navegação cruzada removidos do canto superior direito (só `ThemeToggle` na barra superior)
- [x] Cadastro: campo Nome adicionado ao topo do formulário, salvo em `user_metadata.full_name`
- [x] Tentativa de redesign dark premium (navy + dourado) avaliada e revertida — gradiente azul original mantido como identidade oficial

**Commit final:** `8c52134`

---

## ✅ M14 — Configurações & Perfil
**Branch:** `main`
**Objetivo:** Usuário personaliza o app e gerencia sua conta.

- [x] Categorias (`/settings/categories`): criar, editar, excluir, restaurar padrões
- [x] Subcategorias (`/settings/subcategories`): agrupamento de recorrentes
- [x] Regras (`/settings/rules`): keyword → categoria com 4 tipos de match
- [x] Conta do usuário (`/account`): editar nome/e-mail, alterar senha, excluir conta
- [x] **Bug corrigido:** excluir uma categoria não cascateava para nada — transações ficavam com uma categoria "órfã" que não existe mais na lista. Corrigido em `deleteCategory` (`use-categories.ts`): transações, `categorization_rules.category` e chaves de `budget_plans.category_limits` que apontavam pra categoria excluída são reatribuídas/removidas automaticamente, com "Outros" como destino. A categoria "Outros" não pode mais ser excluída (é o destino padrão). O fluxo de "Mesclar" (que renomeia antes de excluir) não é afetado — a cascata só roda se nenhuma outra categoria ainda usa aquele nome (2026-07-01)
- [x] **Categorias especiais** — nova seção separada no final de `/categories` e `/settings/categories` para criar uma categoria presa a mês(es)/ano(s) específicos. Funciona como categoria normal em transações (substitui a categoria normal) só dentro dos meses configurados, não aparece na lista principal, e permite nomes repetidos entre categorias especiais de meses/anos diferentes (2026-07-01)
- [x] **Bug corrigido:** `PeriodFilter` (componente compartilhado) tinha botões sem `type="button"` — dentro do formulário de categoria especial, clicar num mês disparava o submit do form e salvava antes da hora. Corrigido adicionando `type="button"` em todos os botões do componente (2026-07-01)
- [x] **Redesenho:** modelo trocado de par único `special_month`/`special_year` (uma categoria = um mês, exigindo linhas duplicadas pra reusar em vários meses) para `special_dates: {month,year}[]` — uma única categoria "Viagem" agora pode valer em fevereiro E março/2026. Nova migração `migration_special_category_dates.sql` (adiciona `special_dates jsonb`, migra dados antigos, remove as duas colunas antigas — **precisa ser rodada manualmente no Supabase**). Novo componente `SpecialDatesPicker` (chips com adicionar/remover mês/ano) e util `special-category-filter.ts` (`isCategoryUsableForDate`, `categoriesForDate`, `nonSpecialCategories`, `categoriesForTransactions`) usado em todos os seletores de categoria do app pra filtrar por mês (2026-07-02)
- [x] **Bug corrigido:** categorias especiais apareciam em todos os seletores de categoria do app, mesmo fora do mês configurado. Corrigido aplicando `categoriesForDate`/`nonSpecialCategories`/`categoriesForTransactions` em todos os pickers relevantes (2026-07-02)
- [x] **Bug corrigido (vazamento de categoria especial):** associar manualmente uma transação a uma categoria especial fazia com que outras transações com descrição genérica parecida (ex: "DEBITO DE CARTAO") também virassem aquela categoria especial em importações futuras, via herança de histórico. Corrigido em duas frentes: (1) `historyMap` na importação nunca mais considera categorias especiais; (2) `applyRuleToExisting` agora sempre ignora transações que já estão em qualquer categoria especial antes de aplicar qualquer regra. Transações que já tinham herdado errado foram apagadas do histórico e devolvidas para "Outros" (2026-07-02)
- [x] **Isolamento de categoria especial no sistema de regras:** trocar a categoria de uma transação para uma categoria especial nunca cria regra (`syncCategoryToRule` retorna no-op); e nenhuma regra automática ou manual pode sobrescrever uma transação já em categoria especial. Coluna `auto_created` adicionada em `categorization_rules` (migração `migration_rule_auto_created.sql` — precisa ser rodada manualmente no Supabase) com badge "Automática" em `/settings/rules` (2026-07-02)

**Commit final:** `8c52134`

---

## ✅ M15 — Painel de Admin & Observabilidade
**Branch:** `main`
**Objetivo:** Owner consegue monitorar uso e adoção do produto.

- [x] Página `/admin` restrita ao e-mail do owner
- [x] Métricas: DAU (usuários ativos diários), page views por rota
- [x] Usuários ativos nos últimos 15 minutos (tempo real)
- [x] Retenção em 30 dias
- [x] Rastreamento de navegação via `use-page-tracker`

**Commit final:** `8c52134`

---

---

## 🚧 M16 — Navegação Mobile Melhorada
**Branch:** `feat/mobile-nav`
**Objetivo:** UX fluida e completa em dispositivos móveis.

- [ ] Revisar itens visíveis no bottom bar (prioridade por uso)
- [ ] Badge de notificação para parcelas/recorrentes pendentes de decisão
- [ ] Animação de entrada/saída no drawer "Mais"
- [ ] Gesto de swipe para fechar drawer
- [ ] Testar em diferentes tamanhos de tela (iPhone SE → iPad)

**Commit final:** `feat: melhora navegação mobile com badges e animações`

---

## 🔲 M17 — Importação: Expansão de Bancos
**Branch:** `feat/import-banks`
**Objetivo:** Suportar os principais bancos brasileiros com parsers dedicados.

- [ ] Integrar `parse-mercadopago-pdf.ts` na UI de importação (parser existe, falta o botão)
- [ ] Mercado Pago: validar e testar com extratos reais
- [ ] Pesquisar e implementar parser para Nubank CSV (formato específico)
- [ ] Pesquisar e implementar parser para XP Investimentos
- [ ] Documentar formato esperado de cada banco na tela de importação

**Commit final:** `feat: adiciona suporte a Mercado Pago e Nubank na importação`

---

## 🔲 M18 — Manual do Usuário Completo
**Branch:** `feat/help-content`
**Objetivo:** Usuário consegue aprender a usar qualquer funcionalidade do app sem suporte.

- [ ] Mapear artigos existentes na `/help` e identificar lacunas
- [ ] Escrever artigos para: importação, regras, metas, parcelas, relatórios
- [ ] Adicionar exemplos visuais (screenshots ou GIFs) nos artigos principais
- [ ] FAQ com dúvidas frequentes
- [ ] Link contextual "?" em telas complexas apontando para o artigo correto
- [x] **Nova convenção adotada (2026-07-02):** toda página nova ou mudança de comportamento não óbvia passa a ganhar um bloco explicativo direto na tela (não só em `/help`) — modelo é o box azul "Como funciona" em `/settings/rules`, expandido para 3 seções (importação/regras manuais, regras automáticas com preview do badge "Automática", isolamento de categoria especial). `/help` também atualizada removendo instruções dos botões manuais de regra que foram removidos

**Commit final:** `docs: completa central de ajuda com todos os artigos e exemplos`

---

## 🔲 M19 — SaaS: Produto Comercial
**Branch:** `feat/saas-commercial`
**Objetivo:** App pronto para receber usuários pagantes com landing page e assinatura.

- [x] Funil de vendas mapeado como estratégia comercial: `@no.blesse` (orgânico + Meta Ads) → Quiz diagnóstico financeiro → Página de resultado personalizada → Checkout Cakto → Onboarding → Retenção
- [x] Mapa mental do funil documentado em `mapa-mental-funil.html` (fora da pasta `gestao-financeira`, em `~/Gestão Financeira /funil-de-vendas/`)
- [x] Posicionamento e preço confirmados: R$29,90/mês via Cakto, identidade "Controle financeiro" via canal `@no.blesse`
- [ ] Landing page pública (`/`) com proposta de valor, features e CTA
- [ ] Página de pricing com planos (gratuito / premium)
- [ ] Integração com sistema de pagamento (Cakto)
- [ ] Quiz diagnóstico financeiro (etapa do funil antes do checkout)
- [ ] Onboarding guiado (wizard passo a passo para novos usuários)
- [ ] E-mail de boas-vindas após cadastro
- [ ] Proteção de features premium por plano
- [ ] Página de sucesso pós-assinatura

**Commit final:** `feat: landing page, pricing e integração de pagamento`

---

## Resumo do Progresso

| # | Milestone | Status |
|---|---|---|
| M01 | Foundation & Setup | ✅ Concluído |
| M02 | Autenticação & Segurança | ✅ Concluído |
| M03 | Transações Core | ✅ Concluído |
| M04 | Motor de Importação | ✅ Concluído |
| M05 | Layout & Navegação | ✅ Concluído |
| M06 | Metas Financeiras | ✅ Concluído |
| M07 | Multi-Conta & Dashboard | ✅ Concluído |
| M08 | Analytics | ✅ Concluído |
| M09 | Gastos Fixos & Recorrentes | ✅ Concluído |
| M10 | Parcelas Ativas | ✅ Concluído |
| M11 | Relatórios | ✅ Concluído |
| M12 | Planejamento Orçamentário | ✅ Concluído |
| M13 | Identidade SaaS & Onboarding | ✅ Concluído |
| M14 | Configurações & Perfil | ✅ Concluído |
| M15 | Painel de Admin | ✅ Concluído |
| M16 | Navegação Mobile Melhorada | 🚧 Parcial |
| M17 | Importação: Expansão de Bancos | 🔲 Pendente |
| M18 | Manual do Usuário Completo | 🔲 Pendente |
| M19 | SaaS: Produto Comercial | 🔲 Pendente |

> **15 de 19 milestones concluídos.**
