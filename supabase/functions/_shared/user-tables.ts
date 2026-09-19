/** Tabelas com user_id — ordem: filhos antes de pais quando houver FK entre elas */
export const USER_DATA_TABLES = [
  'transactions',
  // Depois de transactions (transactions.event_id aponta para cá).
  'events',
  'categorization_rules',
  'recurring_decisions',
  'recurring_groups',
  'goals',
  'budget_plans',
  'categories',
  'transaction_boards',
  'user_preferences',
  'user_suggestions',
  'user_profiles',
  'admin_page_views',
  // Adicionadas em set/2026. Sem elas a exclusão de conta deixava para trás
  // os formatos de CSV aprendidos e o registro de erros do usuário — dado
  // pessoal sobrando depois de um pedido de exclusão (LGPD).
  'csv_mappings',
  'app_errors',
] as const
