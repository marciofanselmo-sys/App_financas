-- ============================================================================
-- Assinaturas (Cakto) — motor de cobrança
-- ============================================================================
-- Duas tabelas:
--   subscriptions        → o estado atual da assinatura de cada usuário
--   cakto_webhook_events → tudo que a Cakto entregou, cru, para auditoria e
--                          para não processar a mesma entrega duas vezes
--
-- Ninguém escreve nessas tabelas pelo app: quem grava é o webhook, no
-- servidor, com a chave de serviço (que ignora RLS). O usuário só LÊ a
-- própria assinatura — assim uma aba do navegador nunca consegue se
-- promover para "pago".
-- ============================================================================

create table if not exists subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,

  -- free     : conta gratuita (padrão de quem se cadastra pelo site)
  -- active   : pagando, acesso liberado
  -- past_due : renovação atrasada/recusada — ainda entra, com aviso
  -- canceled : cancelou ou a cobrança parou; acesso de plano grátis
  -- refunded / chargeback: devolvido; acesso de plano grátis
  status                   text not null default 'free'
    check (status in ('free', 'active', 'past_due', 'canceled', 'refunded', 'chargeback')),
  plan                     text not null default 'free',

  provider                 text not null default 'cakto',
  provider_subscription_id text,
  provider_order_id        text,
  customer_email           text,

  -- Até quando o acesso pago vale (vem da Cakto na renovação).
  current_period_end       timestamptz,
  canceled_at              timestamptz,

  -- De onde veio a venda (utm_source/campaign etc. do próprio webhook) —
  -- é o que permite comparar a LP direta com o funil do quiz.
  utm                      jsonb not null default '{}'::jsonb,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (user_id)
);

create index if not exists subscriptions_user_id_idx on subscriptions(user_id);
create index if not exists subscriptions_provider_sub_idx on subscriptions(provider_subscription_id);

alter table subscriptions enable row level security;

-- Só leitura, e só da própria linha. Escrita é exclusiva do service role.
drop policy if exists "users read own subscription" on subscriptions;
create policy "users read own subscription"
  on subscriptions for select
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------

create table if not exists cakto_webhook_events (
  -- Chave de deduplicação: id do pedido + evento. A Cakto reenvia quando a
  -- entrega falha, e sem isso uma renovação poderia ser contada duas vezes.
  id            text primary key,
  event         text not null,
  order_id      text,
  customer_email text,
  user_id       uuid references auth.users(id) on delete set null,
  payload       jsonb not null,
  processed     boolean not null default false,
  error         text,
  received_at   timestamptz not null default now()
);

create index if not exists cakto_webhook_events_received_idx on cakto_webhook_events(received_at desc);

-- RLS ligado e sem policy: nem usuário logado nem anônimo leem. O webhook
-- (service role) escreve, e o painel /admin lê pelo servidor.
alter table cakto_webhook_events enable row level security;

-- ----------------------------------------------------------------------------
-- Primeiro acesso: quem comprou pelo anúncio recebe a conta já criada e
-- precisa definir a senha antes de usar o app.
alter table user_profiles
  add column if not exists needs_password boolean not null default false;
