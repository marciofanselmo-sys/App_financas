-- Histórico leve de patrimônio por importação (gráfico de evolução).
-- Cada entrada: { "patrimonio": number, "importedAt": "ISO8601" }
-- A posição completa continua em last_position_import.
alter table transaction_boards
  add column if not exists position_import_history jsonb not null default '[]'::jsonb;
