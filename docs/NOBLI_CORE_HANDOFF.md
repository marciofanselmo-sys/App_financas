# NOBLI — CORE HANDOFF

Documento de contrato entre o **agente do core** (produto, banco, pagamento,
usuários, infraestrutura) e o **agente de aquisição** (tráfego, landing pages,
quiz, tracking, funil).

Levantado do ambiente real em **26/09/2026**. Nenhum segredo aparece aqui.

---

## A. Arquitetura atual

```
Meta Ads A ─┐
            ├──► Landing / Quiz ──► Checkout Cakto ──► Webhook ──► Core ──► Banco ──► Acesso
Meta Ads B ─┘
```

| Camada | O que é | Onde vive |
|---|---|---|
| Aplicação | Next.js 16 (App Router, TypeScript, Tailwind v4) | Vercel, time `no-blesse`, projeto `gestao-financeira` |
| Banco / Auth | Supabase (Postgres + Auth + RLS), plano **gratuito** | projeto único, compartilhado por todos os usuários |
| Pagamento | Cakto (produto + ofertas + checkout hospedado) | conta do produtor |
| E-mail | Resend, domínio `noblifinance.com.br`, região São Paulo | DNS na Hostinger |
| Domínio | **noblifinance.com.br** (registrado; DNS na Hostinger) | `nobli.finance` **não existe** |

## B. Repositório / aplicação

- Branch em produção: `cursor/feature-expansion-multi-account-analytics`.
- Deploy: `vercel --prod`. Domínio principal: `https://noblifinance.com.br`.
- Rotas públicas (sem login): `/` (página do produto), `/auth/*`, `/primeiro-acesso`,
  `/terms`, `/privacy`, `/demo`, `/api/webhooks/*`.
- Todo o resto exige sessão (middleware em `src/middleware.ts`).

## C. Banco — tabelas reais

Confirmadas em produção: `transactions`, `transaction_boards`, `categories`,
`events`, `goals`, `budget_plans`, `categorization_rules`, `recurring_decisions`,
`user_profiles`, `user_preferences`, `user_suggestions`, `csv_mappings`,
`app_errors`, `subscriptions`, `cakto_webhook_events`, `plan_usage`.

Relevantes para a operação comercial:

| Tabela | Papel | Quem escreve |
|---|---|---|
| `subscriptions` | Estado da assinatura (uma linha por usuário) | **só o webhook**, via service role |
| `cakto_webhook_events` | Toda entrega da Cakto, crua, para auditoria e deduplicação | só o webhook |
| `plan_usage` | Consumo do plano (hoje: importações por mês) | só o servidor |
| `user_profiles` | Nome, papel (`admin`) e `needs_password` | o próprio usuário |

**Não existem** (código as referencia, mas a tabela não está no banco):
`admin_page_views`, `recurring_groups`, `recurring_subcategories` — ver **P. Riscos**.

Não existe hoje tabela de `order`, `payment` ou `attribution` separada: a venda
vive na Cakto, e o que o core guarda é o **estado do acesso** mais o payload
cru do evento.

## D. Autenticação

Supabase Auth, e-mail e senha. RLS em todas as tabelas, sempre com
`auth.uid() = user_id`. Não há login social. A sessão é cookie via `@supabase/ssr`.

O identificador único da pessoa é o **`auth.users.id` (uuid)**. O e-mail é
único por conta.

## E. Cakto — integração

- Acesso por **MCP remoto** (`https://mcp.cakto.com.br`) com chave de API de
  escopos `read write products offers orders webhooks`. **Sem** `withdrawals_write`.
- A API pública **não expõe equipe nem permissões** — auditado nos 59 endpoints:
  produtos, ofertas, pedidos, assinaturas, webhooks, financeiro. Acesso de
  segundo usuário só pelo painel. Ver **H**.

## F. Produto na Cakto

| Produto | Tipo | Ofertas |
|---|---|---|
| NOBLI Essencial | assinatura | mensal R$ 29,90 · anual R$ 297,00 |
| NOBLI Completo | assinatura | mensal R$ 49,90 · anual R$ 497,00 |

Entrega de conteúdo: **externa** (quem libera acesso é o core, não a Cakto).
Garantia: 7 dias (padrão da Cakto, e é o que a página promete).
Meios: PIX, PIX Automático e cartão. Recobrança: 3 tentativas.

## G. Oferta / checkout

Links públicos (podem ser usados por qualquer landing):

```
Essencial mensal  https://pay.cakto.com.br/38jkbsw
Essencial anual   https://pay.cakto.com.br/cft4dhf
Completo mensal   https://pay.cakto.com.br/3jedo3p
Completo anual    https://pay.cakto.com.br/pi5nfna
```

**Parâmetros que a landing deve preservar e repassar ao checkout:**

| Parâmetro | Para que serve | Obrigatório |
|---|---|---|
| `callback` | id do usuário logado no app. É o que liga o pagamento à conta certa sem depender do e-mail. | Só quando a pessoa já está logada no NOBLI. Landing pública não tem como preencher — deixe fora. |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` | Atribuição. A Cakto devolve no webhook e o core grava em `subscriptions.utm`. | Recomendado |
| `sck` | Campo livre da Cakto, também devolvido no webhook. Serve para `landing_variant` / `quiz_variant`. | Opcional |

Exemplo: `https://pay.cakto.com.br/3jedo3p?utm_source=lp_direta&utm_campaign=lancamento&sck=lp01_v2`

## H. Acesso do segundo sócio à Cakto

**Coprodução não será usada.** Decisão dos sócios em 27/09/2026. A divisão da
receita é tratada entre eles, fora da plataforma. O core não calcula split, não
cria segunda venda para representar comissão e não tem tabela de comissão. Uma
venda é uma venda.

O acesso do segundo sócio é pela aba **Equipe** do painel:
`fariafelipesouza@gmail.com`, convite **Ativo** desde 27/09/2026. Com isso ele
edita pixel, visual do checkout e vitrine sem depender do outro sócio.

**A Cakto não oferece níveis de permissão** — o acesso de equipe é total ao
painel, incluindo faturamento, vendas e clientes. Foi uma decisão consciente
dos sócios, não um descuido. A API pública não expõe equipe nem permissões
(auditado nos 59 endpoints), então isso só existe no painel.

**Acesso de painel não é acesso técnico.** Não implica acesso ao banco, ao
backend nem aos secrets. Preço e oferta continuam sendo feitos pelo core via
API.

## I. Webhook

- Endpoint: `POST https://noblifinance.com.br/api/webhooks/cakto` (runtime Node).
- Diagnóstico público, sem segredo: `GET` na mesma URL diz quais variáveis estão
  configuradas.
- Webhook cadastrado na Cakto: **"NOBLI App — assinaturas"**, id `70435`, ativo,
  cobrindo os dois produtos.
- **Autenticação:** HMAC-SHA256 de `{timestamp}.{corpo cru}` no header
  `X-Cakto-Signature`, com janela de 5 minutos (`X-Cakto-Timestamp`). O campo
  `secret` do corpo é aceito só como reserva. Testado: assinatura inválida e
  entrega fora da janela retornam **401**.
- **Idempotência:** chave primária `evento:id_do_pedido` em `cakto_webhook_events`.
  Reenvio devolve 200 com `duplicated: true` sem reprocessar.
- **Erros:** entrega legítima é gravada crua **antes** do processamento. Falha no
  processamento responde 200 (com o erro registrado na linha) para não gerar
  reenvio infinito; falha de gravação responde 500, que a Cakto reenvia.

## J. Eventos financeiros — nomes reais

Cadastrados no webhook (nomenclatura da própria Cakto):

| Evento | Efeito no acesso |
|---|---|
| `purchase_approved` | `active` |
| `subscription_created` | `active` (não dispara e-mail: vem junto do anterior) |
| `subscription_renewed` | `active` + e-mail de renovação |
| `subscription_resumed`, `subscription_late_recovered` | `active` |
| `subscription_late`, `subscription_renewal_refused` | `past_due` — **acesso continua**, com aviso |
| `subscription_canceled`, `subscription_paused` | `canceled` → volta ao plano grátis |
| `refund` | `refunded` → plano grátis |
| `chargeback` | `chargeback` → plano grátis, sem e-mail automático (é disputa) |

Existem também, disponíveis e **não usados** hoje: `checkout_abandonment`,
`pix_gerado`, `boleto_gerado`, `picpay_gerado`, `openfinance_nubank_gerado`,
`purchase_refused`. São os candidatos naturais para recuperação de carrinho — e
quem consumiria isso é a camada de aquisição, não o core.

## K. Provisionamento de acesso

1. **Quem é o comprador:** primeiro pelo `callback` (id do usuário); se não vier,
   pelo **e-mail** do checkout.
2. **Se o e-mail já existe:** usa a conta existente, não cria outra.
3. **Se não existe:** a conta é criada **apenas** em evento que ativa acesso, e o
   cliente recebe um link de convite de uso único (Resend) para definir a senha
   em `/primeiro-acesso`. Nenhuma senha trafega por e-mail.
4. **Cancelamento, reembolso e chargeback:** a assinatura cai para plano grátis.
   **Nenhum dado do usuário é apagado** — os recursos pagos apenas deixam de abrir.
5. **Dois usuários para a mesma pessoa:** evitado porque o e-mail é único no
   Supabase Auth e a busca vem antes da criação.
6. **Processar duas vezes o mesmo pedido:** evitado pela chave de deduplicação e
   pelo `unique (user_id)` em `subscriptions` (upsert, não insert).

## L. Planos e bloqueio (o que a venda entrega)

Fonte única: `src/lib/plans.ts` — a página de vendas lê daqui, então não existe
promessa sem lastro.

| | Grátis | Essencial | Completo |
|---|---|---|---|
| Contas | 2 | 5 | ilimitadas |
| Importação de extrato | 1/mês | ilimitada | ilimitada |
| Regras, recorrências, planejamento, metas, CSV | — | sim | sim |
| Relatórios | — | mensal | todos |
| Investimentos | — | — | sim |

Nenhum plano corta histórico. Recurso bloqueado **abre a tela** explicando o que
faria, com botão de assinar (não some do menu).

## M-1. Landing externa — JÁ LIGADA (27/09/2026)

A página de vendas passou a ser servida pelo projeto do time de aquisição,
**no mesmo domínio**, por repasse de caminhos (`rewrites`):

| Caminho em noblifinance.com.br | Servido por |
|---|---|
| `/`, `/landing-page`, `/quiz`, `/assets/*` | projeto do time de aquisição (`LP_ORIGIN`) |
| `/dashboard`, `/auth/*`, `/api/*`, `/obrigado`, `/assinar/*`, `/terms`, `/privacy` | core |

Consequências práticas:
- O time de aquisição **publica quando quiser**, na conta Vercel dele, sem
  acesso a este repositório, às variáveis de ambiente ou ao banco.
- Caminho novo (ex.: `/lp/black-friday`) precisa ser liberado aqui — hoje só
  os quatro acima passam. É um pedido de um minuto.
- Quem está logado e abre `/` é mandado para `/dashboard` — cliente pagante
  não vê página de vendas.
- Se o projeto da landing cair, a raiz do domínio cai junto; o app continua
  de pé em `/dashboard`.

**Política de segurança separada.** A CSP do app bloqueava CSS, fontes e
bibliotecas de CDN, e a landing aparecia sem estilo nenhum ao ser servida
pelo nosso domínio. Hoje os caminhos de marketing têm CSP própria, que libera
`cdn.tailwindcss.com`, `cdn.jsdelivr.net`, Google Fonts e `pay.cakto.com.br`
como destino de formulário. **Domínio novo que a landing precise carregar tem
que ser pedido ao core** — senão o recurso é bloqueado em silêncio.

Recomendações já passadas ao time de aquisição: tirar o Tailwind do CDN
(gerar CSS no build), hospedar as fontes e substituir as imagens de
`placehold.co`.

## M-2. Links curtos de assinatura — USAR ESTES

```
https://noblifinance.com.br/assinar/mensal       R$ 39,90 por mês
https://noblifinance.com.br/assinar/trimestral   R$ 79,90 a cada 3 meses
https://noblifinance.com.br/assinar/anual        R$ 297,00 por ano
https://noblifinance.com.br/assinar              (padrão: Mensal)

Links antigos (essencial, completo, *-anual) continuam funcionando e caem
no plano novo do mesmo período.
```

Eles redirecionam para o checkout da Cakto **repassando `utm_*`, `sck` e
`callback`**. Prefira-os aos links crus `pay.cakto.com.br/<id>`: se a oferta
mudar de id, troca-se uma variável no core e **os anúncios já publicados
continuam funcionando**.

Não repassamos a página de pagamento para dentro do domínio, de propósito:
ela tem antifraude, 3DS e cookies próprios da Cakto.

## M-3. Landing antiga do core — classificação para substituição

A página em `/` é do core, mas é descartável. Componentes:

| Componente | Classificação | Observação |
|---|---|---|
| `src/components/landing/landing.tsx` (hero, dores, recursos, CTA) | **A. Pode ser descartado com a LP** | Conteúdo puro, sem lógica |
| `src/components/landing/pricing-section.tsx` | **D. Precisa ser reimplementado na nova LP** | Preço e links de checkout precisam continuar existindo em algum lugar |
| `src/lib/plans.ts` (preços e limites) | **C. Pertence ao core** | Usado pelo bloqueio de recurso |
| `checkoutUrl()` em `src/hooks/use-subscription.ts` | **C. Pertence ao core** | A LP externa monta a URL por conta própria |
| Rota `/` com redirect de quem está logado | **C. Pertence ao core** | Se a LP virar externa, decidir quem responde na raiz |
| Links `/auth/register` e `/auth/login` | **C. Pertence ao core** | A nova LP deve apontar para eles |

**Não existe hoje, em nenhum lugar do código:** Pixel, dataset, Meta CAPI,
Google Analytics, gerenciador de tags, cookie de rastreamento ou banner de
cookies. Auditado por busca no repositório inteiro. A camada de aquisição parte
do zero nesse ponto — e isso é bom, porque evita herdar Pixel duplicado.

## N. Meta Pixel / Dataset / CAPI — estado e recomendação

- **Estado atual: nada implementado.**
- Recomendação para duas contas de anúncio: **um único Dataset (Pixel) do NOBLI**,
  compartilhado com as duas contas por permissão de ativo no Business Manager.
  Criar dois Pixels para o mesmo produto quebra otimização e atribuição.
- Para `Purchase` sem duplicar: a venda acontece na Cakto, não no nosso domínio.
  Dois caminhos possíveis, e é **decisão da aquisição**:
  1. Usar o Pixel da própria Cakto (o produto já tem campos de pixel no painel), ou
  2. O core enviar `Purchase` por CAPI ao receber `purchase_approved`, usando
     `data.id` (id do pedido) como `event_id` para deduplicar com o browser.
- Se escolherem o caminho 2, o core precisa de: Dataset ID e token de CAPI, e o
  evento sairia do webhook — ponto único, já idempotente. **Não implementado ainda.**

## O. Atribuição

Hoje o core grava, em `subscriptions.utm` (JSONB), o que a Cakto devolve:
`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `sck`.

Não existem colunas para `campaign_id`, `adset_id`, `ad_id`, `ad_account_source`,
`landing_variant`, `quiz_variant`, `funnel_variant`.

**Proposta (não implementada, aguardando decisão):** em vez de criar dezenas de
colunas, usar o JSONB que já existe e padronizar as chaves na origem — a landing
manda tudo dentro de `sck` num formato combinado (ex.:
`lp01|v2|adset123|ad456`), ou usa os cinco UTMs com uma convenção fixa. Se a
aquisição precisar de relatório por anúncio, aí sim vale uma tabela
`acquisition_events` própria — mas só depois de existir volume.

## P. Riscos conhecidos

1. **Banco sem backup.** Supabase no plano gratuito não tem backup automático nem
   restauração para um ponto no tempo. Com cliente pagando, um erro de operação é
   perda definitiva. **Recomendação: Supabase Pro (~US$ 25/mês) antes da primeira
   venda.** É o único custo que o core considera bloqueante.
2. **Três tabelas referenciadas pelo código não existem no banco:**
   `admin_page_views` (registro de uso no /admin), `recurring_groups` e
   `recurring_subcategories`. Falham em silêncio hoje; nenhuma afeta pagamento ou
   acesso, mas o painel admin fica sem dados de uso.
3. **Não existe ambiente de staging** — ver **Q**.
4. **Produto de assinatura com PIX comum:** PIX simples não renova sozinho. A
   renovação automática vem do PIX Automático ou do cartão. O core trata o atraso
   (`past_due`, acesso mantido com aviso), mas vale decidir se o PIX comum
   continua ativo como meio de pagamento.
5. **O e-mail sai de `noblifinance.com.br`.** Se a marca pública virar
   `nobli.finance`, o domínio precisa ser registrado e todo o DNS refeito.

## Q. Staging

**Não existe.** Hoje há um único banco Supabase e um único projeto Vercel; os
deploys de preview apontam para o **mesmo banco de produção**.

Mínimo necessário para teste ponta a ponta sem sujar produção:
1. Segundo projeto Supabase (grátis) com `full_setup.sql` + as migrações novas.
2. Ambiente **Preview** na Vercel com as variáveis apontando para esse banco.
3. Um produto de teste na Cakto (R$ 1,00) com webhook apontando para a URL de preview.

Enquanto isso não existir, o teste real é comprar em produção e reembolsar dentro
da garantia de 7 dias.

## R. Segurança — o que nunca sai daqui

Não são compartilhados com a camada de aquisição, em nenhuma hipótese:
`SUPABASE_SERVICE_ROLE_KEY`, `CAKTO_WEBHOOK_SECRET`, `RESEND_API_KEY`,
client secret da API da Cakto, senha do banco.

O que é público e pode ser usado livremente pela aquisição: os quatro links de
checkout, o domínio do app, as URLs `/auth/register` e `/auth/login`, e a chave
publicável do Supabase (que só funciona sob RLS).

Se a landing externa precisar falar com o core, o caminho é um endpoint novo e
específico, com escopo mínimo — nunca a chave de serviço.

## S. Contrato de integração — o que a aquisição pode assumir

1. Qualquer número de landings e quizzes pode apontar para os **mesmos quatro
   links de checkout**. Não é preciso duplicar produto, banco, webhook ou backend.
2. Os UTMs e o `sck` enviados na URL chegam ao core e ficam gravados junto da
   assinatura.
3. Depois do pagamento, quem entrega o acesso é o core, por e-mail. A landing não
   precisa fazer nada.
4. Se a landing quiser mandar quem já é cliente para o checkout, deve preservar o
   parâmetro `callback` quando ele existir na URL de origem.

---

## DADOS NECESSÁRIOS DO AGENTE DE AQUISIÇÃO

1. **Domínios** das novas landings e do quiz (para liberar CORS, se um dia houver
   endpoint, e para alinhar o remetente de e-mail).
2. **Quem responde na raiz** `noblifinance.com.br`: a landing nova ou a página
   atual do core? Se for a nova, definir subdomínio para o app (ex.: `app.`).
3. **Convenção de UTM** que vocês vão usar (valores exatos de `utm_source` e
   `utm_campaign` por caminho).
4. Como pretendem identificar **landing_variant / quiz_variant** — proposta do
   core: campo `sck` no link do checkout.
5. **Decisão sobre Pixel/Dataset:** um único dataset para as duas contas? Quem é o
   dono do ativo no Business Manager?
6. Se quiserem **`Purchase` por CAPI vindo do servidor**: Dataset ID e token de
   acesso (o core já tem o ponto único e idempotente para disparar).
7. **URLs de retorno** desejadas depois do pagamento (hoje não há redirect
   configurado — o cliente fica na tela da Cakto).
8. **Eventos planejados** no funil, para sabermos quais eventos da Cakto ainda não
   usados (`checkout_abandonment`, `pix_gerado`) precisam ser encaminhados.
9. **Política de cookies/consentimento** que vão adotar, já que hoje o app não tem
   nenhum banner — se a LP passar a usar cookie de rastreamento, isso muda a
   Política de Privacidade, que é do core.

---

## CHECKLIST DO ACESSO DO SEGUNDO SÓCIO — status real

- [x] Acesso de equipe concedido a `fariafelipesouza@gmail.com` — Ativo, 27/09/2026
- [x] Dois produtos criados e ativos (NOBLI Essencial e NOBLI Completo)
- [ ] Conta Cakto do produtor aprovada para venda — **bloqueado**: o campo
      Sobrenome do cadastro não aceita edição, suporte acionado
- [ ] 2FA ativado nas duas contas — recomendado, já que o acesso de equipe é total
- [ ] Venda de teste real em produção, com reembolso pela garantia

Coprodução foi descartada — ver **H**.

---

## Ações que o agente do core consegue executar

- Criar e ajustar produtos, ofertas e webhooks na Cakto (via API).
- Alterar preços, planos e bloqueios no app.
- Configurar variáveis de ambiente e deploy.
- Implementar CAPI, redirect pós-pagamento e encaminhamento de eventos de funil.
- Montar o staging descrito em **Q**.

## Ações que dependem dos sócios (nenhum agente resolve)

1. **Aprovação da conta Cakto para venda** (cadastro do produtor bloqueado).
2. **Assinar o Supabase Pro** para ter backup.
3. **Compra de teste real** em produção, com reembolso pela garantia.
4. Decidir o **domínio oficial** e quem responde na raiz.
5. Definir **CNPJ e razão social** para Termos, nota fiscal e rodapé dos e-mails.
