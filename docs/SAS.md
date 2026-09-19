# FinanceApp → SaaS: Roteiro Completo

> Documento vivo. Ponto de partida pra virar o app pessoal num SaaS de verdade,
> com monetização. Organizado em fases: onde estamos, o que falta pro beta, e o
> que falta pro produto completo. Atualize este arquivo conforme decisões forem
> tomadas — ele existe pra não precisar reexplicar o histórico do zero.
>
> Última atualização: 2026-09-19.

---

## 1. Onde estamos hoje (raio-x honesto do estado atual)

**Stack**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 +
shadcn/ui (`@base-ui`) + Supabase (Postgres + Auth + RLS) + Vercel.

**O que já existe e funciona:**
- Autenticação por e-mail/senha (`supabase.auth.signUp` / `signInWithPassword`). **Não há login social** (Google/Apple) ainda.
- Multi-usuário real: um único projeto Supabase compartilhado, isolamento de dados por RLS (`auth.uid() = user_id` em todas as tabelas). Testado empiricamente — chamada anônima às tabelas retorna vazio.
- Schema consolidado em `src/lib/supabase/full_setup.sql` — cria as 11 tabelas + RLS num arquivo só, pra setup do zero.
- Painel `/admin` protegido por e-mail fixo (`NEXT_PUBLIC_ADMIN_EMAIL`), não por papel/role no banco.
- Exclusão de conta já limpa todas as tabelas do usuário (corrigido nesta fase — antes deixava lixo pra trás).
- Parsers de extrato próprios para bancos BR: C6, Itaú, Inter, Mercado Pago, RICO (investimentos) — hoje é o maior diferencial de produto.

**O que NÃO existe ainda (gaps conhecidos):**
- Nenhuma cobrança/billing — o app é 100% gratuito hoje, sem plano pago.
- Nenhuma página legal (Termos de Uso, Política de Privacidade).
- Nenhum teste automatizado (`*.test.ts`) no repositório.
- Nenhuma ferramenta de observabilidade de erro (Sentry ou equivalente) — hoje, bug em produção só aparece se: (a) o usuário reportar, ou (b) alguém abrir o console do navegador.
- Nenhum rate limiting nas rotas/API.
- Schema evolui via 21 arquivos `migration_*.sql` soltos, aplicados manualmente um por um no SQL Editor do Supabase — fonte confirmada de vários bugs nesta fase (tabela/coluna/constraint faltando em ambientes que não rodaram todas as migrações em ordem).

---

## 2. Fase 1 — Beta fechado (10 usuários de teste) — **fase atual**

Objetivo: validar o produto com uso real antes de investir em monetização.

### Checklist — pronto para o beta
- [x] Arquitetura multi-usuário com RLS validada
- [x] Schema consolidado (`full_setup.sql`) pronto para reprodução em outro projeto Supabase, se necessário
- [x] Exclusão de conta limpa todas as tabelas (sem dado órfão)
- [x] Bugs de fundação corrigidos: `budget_plans`/`goals`/`recurring_decisions` sem `CREATE TABLE`, tabela errada na exclusão de conta, constraint de `transferencia` faltando

### Checklist — recomendado antes/durante o beta (baixo esforço)
- [ ] Aviso visual de "Beta" em algum canto da UI (ou combinar direto com os 10 testadores, sem UI)
- [ ] Canal de feedback simples (link de WhatsApp ou formulário) — hoje não há como saber de um bug sem o usuário procurar ativamente
- [ ] Acompanhar uso do plano gratuito do Supabase (linhas, usuários de Auth, egress) — se apertar com os 10 ativos, migrar para o plano pago (~US$25/mês)

**Não há nenhuma mudança de código pendente e bloqueante pra essa fase.**

---

## 3. Fase 2 — SaaS completo com monetização (não iniciado)

Só puxar estes itens quando decidir avançar — são ideias já discutidas, para
não precisar re-explicar do zero, não são compromissos assumidos.

### 3.1 Cobrança / Billing
- [ ] Escolher gateway: **Pagar.me, Iugu ou Asaas** preferíveis a Stripe puro pro público BR (suportam PIX/boleto nativamente, melhor conversão)
- [ ] Definir modelo de planos. Ideia inicial discutida:
  - **Grátis**: 1–2 contas + histórico limitado
  - **Pago**: contas ilimitadas, todos os parsers de banco, relatórios/exportação, investimentos
- [ ] Modelar tabela de assinatura (`subscriptions` ou similar): plano atual, status, data de renovação, gateway customer id
- [ ] Middleware/guard de feature-gating (bloquear funcionalidades pagas no plano grátis)
- [ ] Webhook do gateway de pagamento → atualizar status da assinatura
- [ ] Fluxo de upgrade/downgrade/cancelamento pelo próprio usuário

### 3.2 Infraestrutura de schema
- [ ] Substituir os `migration_*.sql` soltos por uma ferramenta de migração de verdade — Supabase CLI com pasta `supabase/migrations`, ou Prisma/Drizzle — rodando como parte do processo de deploy
- [ ] Isso elimina de vez a classe de bug "esqueci de rodar um arquivo", que já causou retrabalho várias vezes nesta fase

### 3.3 Admin / multi-tenant
- [ ] Trocar `NEXT_PUBLIC_ADMIN_EMAIL` (hardcoded, hoje usado nas policies de `admin_page_views`) por uma coluna `role` numa tabela de perfis de usuário
- [ ] Painel admin com visão de: usuários ativos, plano de cada um, uso de recursos, erros recentes

### 3.4 Observabilidade
- [x] **Tabela própria de log de erros + painel no `/admin`** (set/2026) — `app_errors`, alimentada por `logSafeError` e por um listener de erros não tratados. Erros agrupados por onde + mensagem, com contagem de usuários afetados. Sem serviço externo nem custo. Motivação real: um worker do pdf.js em versão errada quebrou toda importação de PDF e só foi descoberto porque o próprio dono tentou importar.
- [ ] Integrar Sentry — quando houver cliente pagando. A tabela própria não **avisa**: é preciso abrir o `/admin` para ver.
- [ ] Alertas básicos (e-mail/Slack) para erro em produção

### 3.5 Legal / LGPD
- [x] Termos de Uso — `/terms`, no ar
- [x] Política de Privacidade — `/privacy`, no ar
- [x] Fluxo de exportação de dados pessoais — `src/lib/account-export.ts`
- [ ] Confirmar que exclusão de conta cobre 100% dos dados pessoais — a lista de tabelas (`supabase/functions/_shared/user-tables.ts`) foi atualizada em set/2026 com `csv_mappings` e `app_errors`, que ficavam para trás. **Falta redeploy da edge function `delete-account`** para valer em produção.
- [ ] Incluir na Política de Privacidade o uso de IA para ler extratos, **se** o item de PDF com IA (3.7) for feito

### 3.6 Segurança / robustez adicional
- [ ] Rate limiting nas rotas sensíveis (login, cadastro, endpoints de API)
- [ ] Testes automatizados pelo menos nos fluxos críticos (parsers de extrato, RLS, cálculo de planejamento) — hoje zero cobertura de teste
- [ ] Login social (Google) — reduz fricção no cadastro, hoje só e-mail/senha

### 3.7 Diferencial de produto (médio prazo, não prioridade agora)
- [ ] Os parsers próprios de banco (C6, Itaú, Inter, Mercado Pago, RICO) são hoje o maior trunfo de marketing: "funciona com o banco que você já usa, sem precisar de Open Finance"
- [ ] Evolução natural, quando fizer sentido: integrar Open Finance via Pluggy ou Belvo, eliminando o passo manual de "baixar PDF/CSV todo mês" — projeto à parte, não é prioridade hoje
- [x] **CSV de qualquer banco, aprendido** (set/2026) — o usuário mapeia as colunas uma vez e o app guarda o formato (`csv_mappings`, pela impressão digital do cabeçalho). Na próxima importação do mesmo banco, reconhece sozinho. Todas as regras (categorização, deduplicação, pagamento de fatura, parcelas) já valiam para qualquer formato. Hoje é **por usuário**.
- [ ] **Compartilhar formatos de CSV entre usuários** — o layout do CSV de um banco é o mesmo para todos: o primeiro ensina, os outros ganham de graça. A tabela guarda só nomes de coluna, então não há problema de privacidade. **Precisa de trava** antes: um mapeamento errado propagaria para todo mundo (ex: só compartilhar depois que 2–3 usuários confirmarem o mesmo mapeamento).
- [ ] **PDF de qualquer banco, lido por IA** — hoje só 4 formatos de PDF têm parser (fatura e extrato Inter, Itaú, Mercado Pago); qualquer outro o usuário precisa converter ou digitar. PDF não tem colunas — chega como uma linha só de texto —, então não dá para "aprender" o formato como no CSV. O caminho é um modelo de IA ler o texto e devolver as transações. Custos a resolver antes:
  - **Exatidão:** a IA pode ler um valor errado — grave num app financeiro. Conferir contra os totais impressos no próprio extrato, quando houver (como já é feito com o Mercado Pago), e sempre mostrar prévia antes de gravar.
  - **LGPD:** o texto do extrato vai para um serviço externo. Precisa de cláusula na Política de Privacidade e consentimento explícito do usuário.
  - **Custo:** centavos por importação. Pequeno, mas passa a existir — entra na conta do preço do plano.

---

## 4. Ordem sugerida de ataque (se/quando decidir avançar pra Fase 2)

Isto é uma sugestão de sequência, não uma imposição — a ordem certa depende de
quantos usuários pagantes reais existirem e de quanto tempo/orçamento houver.

1. **Legal mínimo** (Termos + Privacidade) — pré-requisito pra cobrar de qualquer um, é rápido e evita risco jurídico
2. **Observabilidade básica** — antes de ter usuário pagando, é preciso saber quando algo quebra sem depender do usuário avisar
3. **Billing** — é o que efetivamente vira o app em receita
4. **Migração de schema automatizada** — vale a pena fazer antes de crescer a base de usuários, fica mais caro consertar depois
5. **Admin com role no banco** — junto ou logo depois do billing, pra dar suporte a clientes de verdade
6. **Rate limiting + testes automatizados** — reforço de robustez, pode entrar em paralelo com os itens acima
7. **Login social / Open Finance** — melhorias de fricção e diferencial, fazem sentido depois que a base de monetização já está de pé

---

## 5. Perguntas em aberto (decisões que só o dono do produto pode tomar)

- Qual gateway de pagamento (Pagar.me / Iugu / Asaas / outro)?
- Qual o preço e o corte exato do plano grátis vs pago?
- Vale a pena Sentry (serviço externo, custo recorrente) ou uma tabela de erro caseira resolve por enquanto?
- Meta de quantos usuários pagantes pra justificar o investimento em cada item acima?
