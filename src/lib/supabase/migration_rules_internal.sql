-- ============================================================================
-- Regra "Entre minhas contas" — lançamento que não soma em gasto nem ganho
-- ============================================================================
-- Caso real (set/2026): o pagamento da fatura do cartão C6 sai da conta
-- corrente C6 e contava como despesa JUNTO com as compras da própria fatura —
-- o mesmo gasto duas vezes. A detecção automática (counterpart_board_id) só
-- roda na importação, então o que já estava no banco nunca era marcado, e o
-- usuário não tinha como corrigir.
--
-- Agora uma regra pode, em vez de categorizar, marcar o lançamento como
-- movimentação entre as contas do próprio usuário: ele continua na conta e no
-- saldo, mas sai de Despesas/Receitas, categorias, relatórios e planejamento.
--
-- Idempotente: pode rodar de novo sem efeito colateral.
-- ============================================================================

-- Marca por lançamento, para quando não há conta de destino (ex.: PIX para uma
-- conta sua em outro banco que não está no app) ou marcação manual.
alter table transactions
  add column if not exists is_internal boolean not null default false;

-- action: 'categorize' (regra de sempre) ou 'internal' (não somar).
-- scope_board_id: a regra só vale para lançamentos DESTA conta (opcional).
-- target_board_id: conta que recebe o dinheiro — o app credita ela (opcional).
-- Sem chave estrangeira de propósito: em produção os ids têm tipo diferente do
-- que o setup descreve (categories.id é text), e uma referência de tipo
-- diferente faria a migração falhar. O app valida a conta; conta excluída só vira "conta
-- excluída" na tela.
alter table categorization_rules add column if not exists action text not null default 'categorize';
alter table categorization_rules add column if not exists scope_board_id text;
alter table categorization_rules add column if not exists target_board_id text;

alter table categorization_rules drop constraint if exists categorization_rules_action_check;
alter table categorization_rules
  add constraint categorization_rules_action_check check (action in ('categorize', 'internal'));

-- require_pair (30/09/2026): só marca a saída quando existe, na conta de
-- destino, uma entrada do MESMO valor em até 3 dias. Valor + data provam que
-- o dinheiro foi para a sua outra conta; o texto sozinho não prova (o mesmo
-- "PIX TRANSF" pode ir para outra pessoa). Desligado para a fatura do C6, cujo
-- extrato do cartão não traz o pagamento — ali o app cria a entrada.
alter table categorization_rules add column if not exists require_pair boolean not null default false;
