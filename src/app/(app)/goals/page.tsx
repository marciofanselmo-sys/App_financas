'use client'

import { useState } from 'react'
import { useGoals } from '@/hooks/use-goals'
import { Goal, GOAL_COLORS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Target, Trophy, Star } from 'lucide-react'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function monthsRemaining(deadline: string): number {
  const [year, month] = deadline.split('-').map(Number)
  const now = new Date()
  return Math.max(0, (year - now.getFullYear()) * 12 + (month - now.getMonth() - 1))
}

function monthLabel(n: number): string {
  if (n === 0) return 'Este mês!'
  if (n === 1) return '1 mês restante'
  return `${n} meses restantes`
}

function milestone(pct: number): { label: string; color: string } | null {
  if (pct >= 100) return { label: '🏆 Meta atingida!', color: 'text-yellow-500' }
  if (pct >= 75)  return { label: '🌟 75% — quase lá!', color: 'text-purple-500' }
  if (pct >= 50)  return { label: '⭐ Metade do caminho!', color: 'text-blue-500' }
  if (pct >= 25)  return { label: '✨ 25% — ótimo começo!', color: 'text-green-500' }
  return null
}

// Gera os anos a partir do ano atual para os próximos 10
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 11 }, (_, i) => currentYear + i)
const MONTHS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },   { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },    { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },   { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro'},  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
]

interface FormState {
  name: string
  targetAmount: string
  currentAmount: string
  deadlineMonth: string
  deadlineYear: string
  color: string
}

const EMPTY_FORM: FormState = {
  name: '',
  targetAmount: '',
  currentAmount: '0',
  deadlineMonth: String(new Date().getMonth() + 2).padStart(2, '0'),
  deadlineYear: String(currentYear + 1),
  color: GOAL_COLORS[0],
}

export default function GoalsPage() {
  const { goals, loading, createGoal, updateGoal, deleteGoal } = useGoals()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [addingTo, setAddingTo] = useState<Goal | null>(null)
  const [addAmount, setAddAmount] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(goal: Goal) {
    const [year, month] = goal.deadline.split('-')
    setEditing(goal)
    setForm({
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      deadlineMonth: month,
      deadlineYear: year,
      color: goal.color,
    })
    setFormOpen(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const target = parseFloat(form.targetAmount.replace(',', '.'))
    const current = parseFloat(form.currentAmount.replace(',', '.')) || 0
    const deadline = `${form.deadlineYear}-${form.deadlineMonth}`

    if (editing) {
      updateGoal(editing.id, { name: form.name, targetAmount: target, currentAmount: current, deadline, color: form.color })
    } else {
      createGoal({ name: form.name, targetAmount: target, currentAmount: current, deadline, color: form.color })
    }
    setFormOpen(false)
  }

  function handleAddAmount(e: React.FormEvent) {
    e.preventDefault()
    if (!addingTo) return
    const value = parseFloat(addAmount.replace(',', '.'))
    if (isNaN(value) || value <= 0) return
    updateGoal(addingTo.id, { currentAmount: Math.min(addingTo.currentAmount + value, addingTo.targetAmount) })
    setAddingTo(null)
    setAddAmount('')
  }

  if (loading) return null

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Minhas Metas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {goals.length === 0 ? 'Defina seu primeiro objetivo' : `${goals.length} objetivo${goals.length > 1 ? 's' : ''} em andamento`}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova meta
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center gap-5 py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <Target className="h-8 w-8 text-blue-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-200 text-lg">Qual é o seu sonho?</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
              Defina um objetivo financeiro e o app vai te mostrar como chegar lá mês a mês.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Criar minha primeira meta
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => {
            const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
            const months = monthsRemaining(goal.deadline)
            const remaining = goal.targetAmount - goal.currentAmount
            const monthly = months > 0 ? remaining / months : remaining
            const ms = milestone(pct)

            return (
              <div key={goal.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                {/* Cabeçalho */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: goal.color + '25' }}>
                      {pct >= 100
                        ? <Trophy className="h-5 w-5" style={{ color: goal.color }} />
                        : <Target className="h-5 w-5" style={{ color: goal.color }} />
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{goal.name}</p>
                      {ms && <p className={`text-xs font-medium mt-0.5 ${ms.color}`}>{ms.label}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(goal)}>
                      <Pencil className="h-3.5 w-3.5 text-slate-400" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setDeleteTarget(goal)}>
                      <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                    </Button>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(goal.currentAmount)}</span>
                    <span className="text-slate-400 dark:text-slate-500">{formatCurrency(goal.targetAmount)}</span>
                  </div>
                  <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: goal.color }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
                    <span>{pct}% concluído</span>
                    <span>{formatCurrency(remaining)} restando</span>
                  </div>
                </div>

                {/* Rodapé com infos */}
                <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-slate-100 dark:border-slate-700">
                  <div className="space-y-0.5">
                    {pct < 100 && months > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(monthly)}/mês</span> para chegar lá
                      </p>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {monthLabel(months)}
                    </p>
                  </div>

                  {pct < 100 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1.5 h-8"
                      style={{ borderColor: goal.color + '60', color: goal.color }}
                      onClick={() => { setAddingTo(goal); setAddAmount('') }}
                    >
                      <Plus className="h-3 w-3" />
                      Adicionar valor
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* FORM MODAL */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v) setFormOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar meta' : 'Nova meta'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="goal-name">Nome do objetivo</Label>
              <Input
                id="goal-name"
                placeholder="Ex: Viagem para Europa, Carro novo..."
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="goal-target">Valor necessário</Label>
                <Input
                  id="goal-target"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="R$ 0,00"
                  value={form.targetAmount}
                  onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-current">Já tenho</Label>
                <Input
                  id="goal-current"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="R$ 0,00"
                  value={form.currentAmount}
                  onChange={e => setForm(f => ({ ...f, currentAmount: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prazo</Label>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.deadlineMonth}
                  onChange={e => setForm(f => ({ ...f, deadlineMonth: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                >
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select
                  value={form.deadlineYear}
                  onChange={e => setForm(f => ({ ...f, deadlineYear: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                >
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {GOAL_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color }))}
                    className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor: form.color === color ? '#1e293b' : 'transparent',
                      outline: form.color === color ? '2px solid white' : 'none',
                      outlineOffset: '-3px',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" className="flex-1">{editing ? 'Salvar' : 'Criar meta'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ADD VALUE MODAL */}
      <Dialog open={!!addingTo} onOpenChange={v => { if (!v) setAddingTo(null) }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Adicionar valor à meta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">{addingTo?.name}</p>
          <form onSubmit={handleAddAmount} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="add-amount">Quanto você guardou?</Label>
              <Input
                id="add-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="R$ 0,00"
                value={addAmount}
                onChange={e => setAddAmount(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setAddingTo(null)} className="flex-1">Cancelar</Button>
              <Button type="submit" className="flex-1">Adicionar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir meta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 dark:text-slate-400 pt-2">
            Excluir <strong>"{deleteTarget?.name}"</strong>? O progresso salvo será perdido.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={() => { deleteGoal(deleteTarget!.id); setDeleteTarget(null) }} className="flex-1">Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
