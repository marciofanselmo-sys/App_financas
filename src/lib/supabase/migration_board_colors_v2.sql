-- ============================================================================
-- Contas na paleta nova (a mesma das categorias — CATEGORY_COLORS)
-- ============================================================================
-- Mesmo de-para de migration_category_colors_v2.sql. Rosa, laranja e lima
-- já existem na paleta nova e ficam como estão.
update transaction_boards set color = case lower(color)
  when '#10b981' then '#16a34a'
  when '#22c55e' then '#16a34a'
  when '#06b6d4' then '#22d3ee'
  when '#3b82f6' then '#2563eb'
  when '#8b5cf6' then '#a78bfa'
  when '#f59e0b' then '#facc15'
  when '#ef4444' then '#dc2626'
  when '#14b8a6' then '#065f46'
  when '#6366f1' then '#7e22ce'
  when '#6b7280' then '#64748b'
  else color end
where lower(color) in ('#10b981','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#14b8a6','#6366f1','#6b7280');
