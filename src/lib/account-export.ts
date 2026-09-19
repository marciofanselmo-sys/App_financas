import { createClient } from '@/lib/supabase/client'

const USER_TABLES = [
  'transactions',
  'transaction_boards',
  'categories',
  'goals',
  'budget_plans',
  'categorization_rules',
  'recurring_groups',
  'recurring_decisions',
  'user_profiles',
  'user_preferences',
  'user_suggestions',
  'csv_mappings',
] as const

export async function exportUserData(userId: string) {
  const supabase = createClient()
  const exportedAt = new Date().toISOString()
  const bundle: Record<string, unknown> = { exportedAt, userId }

  for (const table of USER_TABLES) {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId)
    if (error) throw new Error(`Falha ao exportar ${table}.`)
    bundle[table] = data ?? []
  }

  return bundle
}

export function downloadJsonExport(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
