-- Impede regra duplicada (mesma palavra-chave + tipo de correspondência) pro
-- mesmo usuário. Sem essa trava no banco, o app só checava "já existe?" antes
-- de inserir — se duas transações com a mesma descrição fossem recategorizadas
-- quase ao mesmo tempo (corrida), as duas checagens podiam rodar antes de
-- qualquer inserção terminar, e as duas criavam uma regra, gerando duplicata.
--
-- 1. Remove duplicatas existentes, mantendo a mais recente de cada grupo.
delete from categorization_rules a
using categorization_rules b
where a.user_id = b.user_id
  and a.keyword = b.keyword
  and a.match_type = b.match_type
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id < b.id)
  );

-- 2. Trava de verdade no banco — impede duplicata nova de qualquer forma.
alter table categorization_rules drop constraint if exists categorization_rules_user_keyword_matchtype_key;
alter table categorization_rules add constraint categorization_rules_user_keyword_matchtype_key
  unique (user_id, keyword, match_type);
