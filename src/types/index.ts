export type TransactionType = 'receita' | 'despesa' | 'transferencia'
export type CategoryType = 'receita' | 'despesa' | 'ambos'
export type BoardType = 'entrada' | 'saida' | 'ambos'
export type BoardIconKey =
  | 'wallet' | 'credit-card' | 'building' | 'shopping-cart'
  | 'home' | 'briefcase' | 'piggy-bank' | 'trending-up'
  | 'receipt' | 'car' | 'coins' | 'dollar-sign'

export interface Category {
  id: string
  user_id: string
  name: string
  type: CategoryType
  color: string
  created_at: string
}

export interface TransactionBoard {
  id: string
  user_id: string
  name: string
  color: string
  icon: BoardIconKey
  description?: string
  type: BoardType
  show_on_dashboard: boolean
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  description: string
  amount: number
  date: string
  type: TransactionType
  category: string
  board_id?: string | null
  tags?: string[]
  installment_current?: number | null
  installment_total?: number | null
  group_label?: string | null
  is_recurring?: boolean
  created_at: string
}

export interface TransactionFilters {
  month?: number
  year?: number
  category?: string
  search?: string
  board_id?: string
  tag?: string
  exclude_board_ids?: string[]
}

export interface DashboardSummary {
  totalIncome: number
  totalExpenses: number
  balance: number
}

// Categorias padrão criadas automaticamente para novos usuários
export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'Salário',      type: 'receita', color: '#10b981' },
  { name: 'Freelance',    type: 'receita', color: '#06b6d4' },
  { name: 'Alimentação',  type: 'despesa', color: '#f59e0b' },
  { name: 'Transporte',   type: 'despesa', color: '#3b82f6' },
  { name: 'Moradia',      type: 'despesa', color: '#8b5cf6' },
  { name: 'Saúde',        type: 'despesa', color: '#ef4444' },
  { name: 'Educação',     type: 'despesa', color: '#ec4899' },
  { name: 'Lazer',        type: 'despesa', color: '#f97316' },
  { name: 'Outros',       type: 'ambos',   color: '#6b7280' },
]

export interface RICOPosition {
  ticker: string
  value: number
  allocation: string
  rentabilidade: string
  quantity?: string
  category: string    // ex: "Fundos Imobiliários", "Ações"
  subcategory: string // ex: "Fundos Listados", "Renda Variável Brasil"
}

export interface GoalImport {
  importedAt: string
  patrimonio: number        // valor que vira currentAmount
  source?: 'rico' | 'ofx'  // undefined = legado RICO

  // RICO-specific (source === 'rico' ou undefined)
  totalInvestido?: number
  saldoDisponivel?: number
  positions?: RICOPosition[]

  // OFX-specific (source === 'ofx')
  bankName?: string
  accountType?: string
  availBalance?: number
  balanceDate?: string
}

export type GoalType = 'reserva' | 'investimento' | 'carro' | 'viagem' | 'divida' | 'imovel' | 'personalizada'

export interface Goal {
  id: string
  user_id: string
  name: string
  type: GoalType
  targetAmount: number
  currentAmount: number
  deadline: string // YYYY-MM
  color: string
  created_at: string
  lastImport?: GoalImport
}

export const GOAL_COLORS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#f97316',
  '#14b8a6', '#6366f1', '#84cc16', '#6b7280',
]

export const BOARD_COLORS = GOAL_COLORS

export const BOARD_ICONS: { key: BoardIconKey; label: string }[] = [
  { key: 'wallet',        label: 'Carteira' },
  { key: 'credit-card',  label: 'Cartão' },
  { key: 'building',     label: 'Banco' },
  { key: 'shopping-cart',label: 'Compras' },
  { key: 'home',         label: 'Casa' },
  { key: 'briefcase',    label: 'Trabalho' },
  { key: 'piggy-bank',   label: 'Poupança' },
  { key: 'trending-up',  label: 'Investimento' },
  { key: 'receipt',      label: 'Conta' },
  { key: 'car',          label: 'Transporte' },
  { key: 'coins',        label: 'Moedas' },
  { key: 'dollar-sign',  label: 'Dinheiro' },
]

export const CATEGORY_COLORS = [
  '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6',
  '#ec4899', '#f59e0b', '#ef4444', '#f97316',
  '#14b8a6', '#6366f1', '#84cc16', '#6b7280',
]
