-- ============================================================================
-- PASSO 2 de 2 — converter transferências em receita/despesa + is_internal
-- ============================================================================
-- Rode a prévia (_previa_conversao.sql) ANTES. Esta é a que altera.
--
-- Regras acordadas com o dono dos dados (set/2026):
--   PGTO FAT / ENVIO DE TED TRANSF ....... despesa interna (sai do caixa)
--   PAGAMENTO DE FATURA / ON LINE ........ receita interna (chega no cartão)
--   Pix de/para o próprio titular ........ interna, direção pelo texto
--   MERCADOPAGO * (cartão) ............... despesa normal
--   Pix enviado/recebido de terceiros .... despesa/receita normal, NÃO interna
--
-- Linhas cuja descrição é só um nome (sem "enviada"/"recebida") ficam
-- intocadas: não há como saber a direção, e chutar seria pior que deixar.
--
-- Reversível: `where type = 'transferencia'` é o filtro, então rodar de novo
-- não faz efeito duplo. Para desfazer tudo:
--     update transactions set type = 'transferencia' where is_internal;
-- (vale só se você não tiver criado transferências novas depois)
-- ============================================================================

update transactions
   set type = case
         when description ~* 'pgto\s+fat'                            then 'despesa'
         when description ~* '^\s*envio\s+de\s+ted\s+transf'         then 'despesa'
         when description ~* 'pagamento\s+(de\s+)?fatura'            then 'receita'
         when description ~* 'pagamento\s+on\s*line'                 then 'receita'
         when description ~* 'marcio\s+fagundes\s+anselmo'
              and description ~* 'recebid'                           then 'receita'
         when description ~* 'marcio\s+fagundes\s+anselmo'
              and description ~* 'enviad'                            then 'despesa'
         when description ~* 'mercadopago'                           then 'despesa'
         when description ~* 'enviad[ao]'                            then 'despesa'
         when description ~* 'recebid[ao]'                           then 'receita'
         else type
       end,
       is_internal = case
         when description ~* 'pgto\s+fat'                            then true
         when description ~* '^\s*envio\s+de\s+ted\s+transf'         then true
         when description ~* 'pagamento\s+(de\s+)?fatura'            then true
         when description ~* 'pagamento\s+on\s*line'                 then true
         when description ~* 'marcio\s+fagundes\s+anselmo'
              and (description ~* 'recebid' or description ~* 'enviad') then true
         else false
       end
 where type = 'transferencia'
   and description ~* 'pgto\s+fat|^\s*envio\s+de\s+ted\s+transf|pagamento\s+(de\s+)?fatura|pagamento\s+on\s*line|mercadopago|enviad[ao]|recebid[ao]';

-- Conferência final
select type, is_internal, count(*) as linhas
  from transactions
 group by type, is_internal
 order by type, is_internal;
