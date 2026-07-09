-- Garante que categorization_rules.id gera um UUID sozinho quando não
-- informado — necessário pro upsert de syncCategoryToRule (use-rules.ts), que
-- não envia `id` explícito (deixa o banco gerar). Em algumas contas essa
-- coluna foi criada sem o "default gen_random_uuid()" (provavelmente criada
-- manualmente antes da migração ter esse detalhe), causando erro
-- "null value in column id violates not-null constraint" ao criar regra.
alter table categorization_rules alter column id set default gen_random_uuid();
