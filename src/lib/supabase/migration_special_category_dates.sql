-- Substitui special_month/special_year (um único mês por categoria) por uma lista
-- de meses/anos válidos (special_dates), permitindo que a mesma categoria especial
-- (ex: "Viagem") seja usada em mais de um mês sem precisar duplicar a categoria.
alter table categories add column if not exists special_dates jsonb not null default '[]'::jsonb;

update categories
set special_dates = jsonb_build_array(jsonb_build_object('month', special_month, 'year', special_year))
where special_month is not null
  and special_year is not null
  and special_dates = '[]'::jsonb;

alter table categories drop column if exists special_month;
alter table categories drop column if exists special_year;
