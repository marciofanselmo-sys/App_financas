export type TransactionType = 'receita' | 'despesa'
export type CategoryType = 'receita' | 'despesa' | 'ambos'

export interface Category {
  id: string
  user_id: string
  name: string
  type: CategoryType
  color: string
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
  created_at: string
}

export interface TransactionFilters {
  month?: number
  year?: number
  category?: string
  search?: string
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

export interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline: string // YYYY-MM
  color: string
  created_at: string
}

export const GOAL_COLORS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#f97316',
  '#14b8a6', '#6366f1', '#84cc16', '#6b7280',
]

export const CATEGORY_COLORS = [
  '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6',
  '#ec4899', '#f59e0b', '#ef4444', '#f97316',
  '#14b8a6', '#6366f1', '#84cc16', '#6b7280',
]
