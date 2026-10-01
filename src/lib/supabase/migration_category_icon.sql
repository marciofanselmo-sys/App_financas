-- ============================================================================
-- Ícone da categoria + subcategoria sempre com a cor da mãe
-- ============================================================================
-- 1. Coluna nova e opcional: a chave do ícone escolhido (ex.: 'house').
--    Vazia = o app sugere um ícone pelo nome. Subcategorias deixam vazio e
--    usam o ícone da mãe.
alter table categories
  add column if not exists icon text;

-- 2. Subcategoria passa a ter sempre a cor da categoria-mãe.
update categories c
   set color = m.color
  from categories m
 where c.parent_id = m.id
   and c.color is distinct from m.color;
