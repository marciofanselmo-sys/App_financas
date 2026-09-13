-- ============================================================================
-- transactions.direction — direção de uma transferência (entrada | saida)
-- ============================================================================
-- Contexto (set/2026): o tipo 'transferencia' marcava a linha como interna
-- (não é receita nem despesa do mês), mas ao fazer isso os parsers jogavam
-- fora o SINAL do extrato — o dado que diz se o dinheiro saiu ou entrou.
-- Sem esse sinal, `balanceFromTransactions` não tinha como mover o saldo e
-- passava por cima da linha, o que causava dois bugs:
--
--   14.2 — o TED que saiu da conta não reduzia o saldo dela;
--   14.1 — o mesmo dinheiro contava duas vezes no patrimônio (não saía do
--          caixa E entrava de novo pela posição importada do investimento).
--
-- Esta coluna devolve a direção. Duas perguntas que o `type` misturava passam
-- a ser separadas:
--   - "conta como receita/despesa do mês?"  -> type (transferência: não)
--   - "o dinheiro entrou ou saiu da conta?" -> direction (toda linha tem)
--
-- Só é preenchida para transferências. Em receita/despesa a direção já é
-- implícita no próprio type (receita entra, despesa sai), então gravar seria
-- redundante.
--
-- NULL = direção desconhecida (linha importada antes desta mudança). O cálculo
-- de saldo trata NULL como neutro, exatamente o comportamento de hoje — uma
-- transferência antiga nunca passa a mover o saldo com um sinal chutado.
-- ============================================================================

alter table transactions
  add column if not exists direction text
    check (direction is null or direction in ('entrada', 'saida'));

comment on column transactions.direction is
  'Direção de uma transferência: entrada | saida. NULL para receita/despesa (implícito no type) ou para transferências importadas antes de set/2026.';

-- ============================================================================
-- OPCIONAL — limpar transferências antigas para reimportar os extratos
-- ============================================================================
-- As linhas importadas antes desta mudança não têm direção e seguem neutras no
-- saldo. Reimportar os extratos é o jeito mais limpo de corrigir o histórico:
-- os parsers agora preservam o sinal na origem.
--
-- Rode o SELECT primeiro para ver o tamanho do estrago antes de apagar.
-- O DELETE está comentado de propósito: descomente só quando tiver certeza.
-- Troque <SEU_USER_ID> pelo seu id em auth.users.

-- select count(*), min(date), max(date)
--   from transactions
--  where user_id = '<SEU_USER_ID>'
--    and type = 'transferencia'
--    and direction is null;

-- delete from transactions
--  where user_id = '<SEU_USER_ID>'
--    and type = 'transferencia'
--    and direction is null;
