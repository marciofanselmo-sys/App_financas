-- ============================================================================
-- Ponto de partida dos aportes de uma conta de investimento
-- ============================================================================
-- Rendimento = valor atual − total aportado. O app só conhece os aportes que
-- estão nos extratos importados; o que já estava aplicado antes disso entra
-- aqui, como o saldo inicial das contas comuns:
--   invested_base       → quanto já estava aplicado
--   invested_base_date  → até que dia (aportes depois dessa data somam a ele)
-- Idempotente.
-- ============================================================================

alter table transaction_boards add column if not exists invested_base numeric not null default 0;
alter table transaction_boards add column if not exists invested_base_date date;
