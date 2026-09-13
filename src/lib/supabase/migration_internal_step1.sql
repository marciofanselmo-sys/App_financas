-- ============================================================================
-- PASSO 1 de 2 — marcar o que é movimentação interna (sem perder nada)
-- ============================================================================
-- Cole TODO este arquivo no Supabase -> SQL Editor -> Run.
--
-- O que faz: cria a coluna `is_internal` e marca como interna toda linha que
-- hoje tem type='transferencia'. Não precisa adivinhar nada — "é interna" é
-- exatamente o que esse tipo já significa.
--
-- O que NÃO faz: não apaga linha nenhuma, não muda type, não mexe em conta,
-- data, valor ou categoria. Sua organização manual fica intacta.
--
-- Reversível: depois disso, `is_internal = true` marca exatamente o conjunto
-- que era transferência. Para desfazer, basta:
--     update transactions set type = 'transferencia' where is_internal;
-- ============================================================================

alter table transactions
  add column if not exists is_internal boolean not null default false;

comment on column transactions.is_internal is
  'Movimentação entre contas do próprio usuário: move o saldo da conta, mas não conta como receita/despesa do mês.';

update transactions
   set is_internal = true
 where type = 'transferencia'
   and is_internal = false;

-- Confirmação: quantas linhas foram marcadas.
select count(*) as linhas_marcadas_como_internas
  from transactions
 where is_internal = true;
