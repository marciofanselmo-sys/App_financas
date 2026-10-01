-- ============================================================================
-- Paleta nova de cores (15 cores bem distintas — src/types/index.ts)
-- ============================================================================
-- Troca cada cor da paleta antiga pela mais próxima da nova. Verde-água e
-- índigo, que se confundiam com verde e azul, vão para verde-escuro e roxo.
-- Depois, subcategorias acompanham a mãe de novo.
update categories set color = case color
  when '#10b981' then '#16a34a'  -- verde
  when '#06b6d4' then '#22d3ee'  -- ciano
  when '#3b82f6' then '#2563eb'  -- azul
  when '#8b5cf6' then '#a78bfa'  -- lilás
  when '#f59e0b' then '#facc15'  -- amarelo
  when '#ef4444' then '#dc2626'  -- vermelho
  when '#14b8a6' then '#065f46'  -- verde-água → verde-escuro
  when '#6366f1' then '#7e22ce'  -- índigo → roxo
  when '#6b7280' then '#64748b'  -- cinza
  else color end
where color in ('#10b981','#06b6d4','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#14b8a6','#6366f1','#6b7280');

update categories c
   set color = m.color
  from categories m
 where c.parent_id = m.id
   and c.color is distinct from m.color;
