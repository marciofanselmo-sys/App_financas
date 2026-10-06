'use client'

import { withPlan } from '@/components/plan/with-plan'

import { useState, useEffect } from 'react'
import { useGoals } from '@/hooks/use-goals'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { useInvestmentContributions } from '@/hooks/use-investment-contributions'
import { investmentValueOf } from '@/lib/investment-contributions'
import { Goal, GoalType, GOAL_COLORS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Plus, Target,
  PiggyBank, TrendingUp, Car, Plane, CreditCard, Home,
  CheckCircle, Clock, AlertTriangle,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { GoalsSummary, GoalCard, PaceChart, GoalsTimeline, GoalsHelp, type GoalView } from '@/components/goals/goals-overview'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

// ── Tipos de meta ──────────────────────────────────────────────────────────────
const GOAL_TYPES: { value: GoalType; label: string; icon: React.ElementType }[] = [
  { value: 'reserva',      label: 'Reserva de emergência', icon: PiggyBank },
  { value: 'investimento', label: 'Investimento',          icon: TrendingUp },
  { value: 'carro',        label: 'Carro',                 icon: Car },
  { value: 'viagem',       label: 'Viagem',                icon: Plane },
  { value: 'divida',       label: 'Quitar dívida',         icon: CreditCard },
  { value: 'imovel',       label: 'Imóvel',                icon: Home },
  { value: 'personalizada',label: 'Personalizada',         icon: Target },
]

function goalTypeConfig(type: GoalType) {
  return GOAL_TYPES.find(t => t.value === type) ?? GOAL_TYPES[6]
}

// ── Status da meta (no prazo / adiantada / atrasada) ─────────────────────────
function goalStatus(goal: Goal): { label: string; color: string; Icon: React.ElementType } | null {
  if (goal.currentAmount >= goal.targetAmount) return null
  const pct = goal.currentAmount / goal.targetAmount
  const now = new Date()
  const created = new Date(goal.created_at)
  const [dy, dm] = goal.deadline.split('-').map(Number)
  const deadline = new Date(dy, dm - 1, 1)
  const totalMs = deadline.getTime() - created.getTime()
  if (totalMs <= 0) return { label: 'Prazo expirado', color: 'text-red-500', Icon: AlertTriangle }
  const elapsedMs = now.getTime() - created.getTime()
  const expectedPct = Math.min(1, elapsedMs / totalMs)
  if (pct >= expectedPct + 0.08) return { label: 'Adiantada', color: 'text-emerald-500', Icon: CheckCircle }
  if (pct >= expectedPct - 0.08) return { label: 'No prazo',  color: 'text-blue-500',    Icon: Clock }
  return { label: 'Atrasada', color: 'text-amber-500', Icon: AlertTriangle }
}

// O selo segue a mesma previsão mostrada no card ("Previsão mar/2029"). Antes
// ele vinha só do % guardado × tempo passado, com 8% de folga, e uma meta com
// previsão depois do prazo aparecia como "No prazo".
function paceStatus(
  base: ReturnType<typeof goalStatus>,
  projectedMonths: number | null,
  monthsLeft: number,
): ReturnType<typeof goalStatus> {
  if (!base || base.label === 'Prazo expirado' || projectedMonths == null) return base
  if (projectedMonths > monthsLeft) return { label: 'Atrasada', color: 'text-amber-500', Icon: AlertTriangle }
  if (projectedMonths <= monthsLeft - 2) return { label: 'Adiantada', color: 'text-emerald-500', Icon: CheckCircle }
  return { label: 'No prazo', color: 'text-blue-500', Icon: Clock }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function monthsRemaining(deadline: string): number {
  const [year, month] = deadline.split('-').map(Number)
  const now = new Date()
  return Math.max(0, (year - now.getFullYear()) * 12 + (month - now.getMonth() - 1))
}

function deadlineLabel(deadline: string): string {
  const [y, m] = deadline.split('-').map(Number)
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${months[m - 1]}/${y}`
}

// ── Form ──────────────────────────────────────────────────────────────────────
const currentYear = new Date().getFullYear()
const YEARS  = Array.from({ length: 11 }, (_, i) => currentYear + i)
// Meta pode ter começado no passado (ex: já vinha guardando antes de cadastrar
// no app) — diferente do prazo (YEARS), que só olha pra frente.
const START_YEARS = Array.from({ length: 16 }, (_, i) => currentYear - 15 + i)
const MONTHS = [
  { value: '01', label: 'Janeiro'   }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março'     }, { value: '04', label: 'Abril'     },
  { value: '05', label: 'Maio'      }, { value: '06', label: 'Junho'     },
  { value: '07', label: 'Julho'     }, { value: '08', label: 'Agosto'    },
  { value: '09', label: 'Setembro'  }, { value: '10', label: 'Outubro'   },
  { value: '11', label: 'Novembro'  }, { value: '12', label: 'Dezembro'  },
]

interface FormState {
  name: string
  type: GoalType
  targetAmount: string
  // Valor atual vem OU de uma conta de investimento vinculada, OU digitado à
  // mão — nunca os dois ao mesmo tempo (mesma lógica de exclusão mútua usada
  // em categoria normal/isolada no resto do app).
  linkMode: 'manual' | 'board'
  linkedBoardId: string
  currentAmount: string
  startMonth: string
  startYear: string
  deadlineMonth: string
  deadlineYear: string
  color: string
}

const now0 = new Date()
const EMPTY_FORM: FormState = {
  name: '',
  type: 'personalizada',
  targetAmount: '',
  linkMode: 'manual',
  linkedBoardId: '',
  currentAmount: '',
  startMonth: String(now0.getMonth() + 1).padStart(2, '0'),
  startYear: String(currentYear),
  deadlineMonth: String(new Date().getMonth() + 2).padStart(2, '0'),
  deadlineYear: String(currentYear + 1),
  color: GOAL_COLORS[0],
}

// ── Page ──────────────────────────────────────────────────────────────────────
function GoalsPage() {
  const { goals, loading, error, clearError, createGoal, updateGoal, deleteGoal } = useGoals()
  const { boards } = useTransactionBoards()
  const [formOpen, setFormOpen]       = useState(false)
  const [editing, setEditing]         = useState<Goal | null>(null)
  const [form, setForm]               = useState<FormState>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null)
  const [saving, setSaving]           = useState(false)

  // Puxar patrimônio de uma conta de investimento existente (Opção A, 2026-07-09)
  // — só o valor + um link leve pra conta, sem trazer posições/proventos pro
  // card da Meta (por pedido explícito do usuário). É o único jeito de atualizar
  // o valor atual por importação — extrato RICO/OFX direto na Meta foi removido
  // (2026-07-09), por pedido também.
  const [importingFor, setImportingFor]       = useState<Goal | null>(null)
  const [boardPickerOpen, setBoardPickerOpen] = useState(false)
  // Todas as contas criadas em Investimentos podem ser vinculadas, com ou sem
  // valor: a meta ligada acompanha o valor da conta (ver o efeito abaixo e
  // syncGoalsLinkedToBoard), então começar em R$ 0 não deixa ela parada.
  const investmentBoards = boards.filter(b => b.is_investment)
  const { linked, loading: linkedLoading } = useInvestmentContributions(investmentBoards.map(b => b.id))
  // O valor da conta é o mesmo que ela mostra em Investimentos: o extrato, se
  // houver; senão a soma dos aportes. Nunca os dois somados.
  const boardValue = (board: (typeof boards)[number]) => {
    const v = investmentValueOf(board, linked)
    return { value: v.value, has: v.source !== 'none' }
  }

  // Meta ligada acompanha a conta: ao abrir a tela, quem estiver diferente do
  // valor atual da conta é atualizado (cobre valores informados antes).
  useEffect(() => {
    if (loading || linkedLoading || boards.length === 0) return
    for (const goal of goals) {
      const imp = goal.lastImport
      if (imp?.source !== 'board' || !imp.boardId) continue
      const board = boards.find(b => b.id === imp.boardId)
      if (!board) continue
      const value = boardValue(board).value
      if (Math.abs(value - goal.currentAmount) < 0.005 && imp.boardName === board.name) continue
      updateGoal(goal.id, {
        currentAmount: value,
        lastImport: { ...imp, patrimonio: value, boardName: board.name, importedAt: board.last_position_import?.importedAt ?? imp.importedAt },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, linkedLoading, boards, linked, goals.map(g => `${g.id}:${g.currentAmount}`).join('|')])

  async function pullFromBoard(goal: Goal, board: (typeof boards)[number]) {
    // Conta sem valor ainda: liga mesmo assim, em R$ 0 — a meta passa a
    // acompanhar quando o valor for informado ou a posição importada.
    const value = boardValue(board).value
    const { error: updateError } = await updateGoal(goal.id, {
      currentAmount: value,
      lastImport: {
        source: 'board',
        importedAt: board.last_position_import?.importedAt ?? new Date().toISOString(),
        patrimonio: value,
        boardId: board.id,
        boardName: board.name,
      },
    })
    if (updateError) return // banner na página mostra o motivo; o seletor fica aberto
    setBoardPickerOpen(false)
    setImportingFor(null)
  }

  function openBoardPicker(goal: Goal) {
    setImportingFor(goal)
    setBoardPickerOpen(true)
  }

  // Atualização rápida (1 clique) quando a meta já está vinculada a uma conta —
  // sem reabrir o seletor. Se a conta foi excluída, cai pra abrir o seletor de novo.
  function quickRefreshFromBoard(goal: Goal) {
    const board = boards.find(b => b.id === goal.lastImport?.boardId)
    if (!board) { openBoardPicker(goal); return }
    pullFromBoard(goal, board)
  }

  function openCreate() { clearError(); setEditing(null); setForm(EMPTY_FORM); setFormOpen(true) }

  function openEdit(goal: Goal) {
    const [year, month] = goal.deadline.split('-')
    const created = new Date(goal.created_at)
    const linkedBoardId = goal.lastImport?.source === 'board' ? goal.lastImport.boardId ?? '' : ''
    clearError()
    setEditing(goal)
    setForm({
      name: goal.name,
      type: goal.type ?? 'personalizada',
      targetAmount: String(goal.targetAmount),
      linkMode: linkedBoardId ? 'board' : 'manual',
      linkedBoardId,
      currentAmount: String(goal.currentAmount),
      startMonth: String(created.getMonth() + 1).padStart(2, '0'),
      startYear: String(created.getFullYear()),
      deadlineMonth: month,
      deadlineYear: year,
      color: goal.color,
    })
    setFormOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const target  = parseFloat(form.targetAmount.replace(',', '.'))
    const deadline = `${form.deadlineYear}-${form.deadlineMonth}`
    // Preserva hora/minuto originais ao editar (só a mudança de mês/ano
    // importa pro cálculo de ritmo); usa o momento atual ao criar.
    const baseDate = editing ? new Date(editing.created_at) : new Date()
    const created_at = new Date(
      Number(form.startYear), Number(form.startMonth) - 1, baseDate.getDate(),
      baseDate.getHours(), baseDate.getMinutes(), baseDate.getSeconds(),
    ).toISOString()

    // Valor atual: vinculado a uma conta de investimento, ou digitado à mão.
    const linkedBoard = form.linkMode === 'board'
      ? investmentBoards.find(b => b.id === form.linkedBoardId)
      : undefined
    const current = linkedBoard
      ? boardValue(linkedBoard).value
      : parseFloat(form.currentAmount.replace(',', '.')) || 0
    const lastImport = linkedBoard
      ? {
          source: 'board' as const,
          importedAt: linkedBoard.last_position_import?.importedAt ?? new Date().toISOString(),
          patrimonio: current,
          boardId: linkedBoard.id,
          boardName: linkedBoard.name,
        }
      // Trocou pra manual (ou não escolheu conta nenhuma) — limpa o vínculo
      // anterior, senão o card continuaria mostrando "vinculada a X".
      : undefined

    const payload = { name: form.name, type: form.type, targetAmount: target, currentAmount: current, deadline, color: form.color, created_at, lastImport }

    setSaving(true)
    const { error: saveError } = editing
      ? await updateGoal(editing.id, payload)
      : await createGoal(payload)
    setSaving(false)

    // Só fecha se o banco confirmou. Antes fechava sempre, o que fazia a meta
    // parecer salva mesmo quando a escrita era recusada.
    if (!saveError) setFormOpen(false)
  }

  if (loading) return null

  // Números de cada meta — as mesmas fórmulas que os cards já usavam.
  const now = new Date()
  const goalViews: GoalView[] = [...goals]
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .map(goal => {
      const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
      const months = monthsRemaining(goal.deadline)
      const remaining = goal.targetAmount - goal.currentAmount
      const monthly = months > 0 ? remaining / months : remaining
      // Meses FRACIONÁRIOS desde o início, com piso de meio mês (14.30).
      const monthsElapsed = Math.max(0.5, (now.getTime() - new Date(goal.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      const currentPace = goal.currentAmount / monthsElapsed
      const projectedMonths = currentPace > 0 ? Math.ceil(remaining / currentPace) : null
      const projectedDate = projectedMonths != null ? (() => {
        const d = new Date(); d.setMonth(d.getMonth() + projectedMonths)
        const mn = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
        return `${mn[d.getMonth()]}/${d.getFullYear()}`
      })() : null
      const typeConf = goalTypeConfig(goal.type ?? 'personalizada')
      const imp = goal.lastImport
      return {
        goal, pct, months, remaining, monthly, monthsElapsed,
        // Ritmo só faz sentido depois de 1 mês (antes, o card não mostrava).
        currentPace: monthsElapsed >= 1 ? currentPace : 0,
        projectedDate: monthsElapsed >= 1 ? projectedDate : null,
        deadlineLabel: deadlineLabel(goal.deadline),
        typeLabel: typeConf.label,
        TypeIcon: typeConf.icon,
        status: paceStatus(goalStatus(goal), monthsElapsed >= 1 ? projectedMonths : null, months),
        awaitingBoard: imp?.source === 'board' && (() => {
          const board = boards.find(b => b.id === imp.boardId)
          return !board || !boardValue(board).has
        })(),
      }
    })

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Minhas Metas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {goals.length === 0 ? 'Defina seu primeiro objetivo' : `${goals.length} objetivo${goals.length > 1 ? 's' : ''} em andamento`}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nova meta
        </Button>
      </div>

      {error && !formOpen && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Empty state */}
      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Qual é o seu sonho?"
          description="Defina um objetivo financeiro — reserva de emergência, viagem, imóvel — e o app mostra quanto guardar por mês para chegar lá."
          primaryLabel="Criar minha primeira meta"
          primaryOnClick={openCreate}
          secondaryLabel="Ver exemplos"
          secondaryHref="/help"
        />
      ) : (
        <>
          <GoalsSummary items={goalViews} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
            <section>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-white/[0.08]">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Suas metas</h2>
                <span className="text-xs text-slate-400">ordenadas pelo prazo</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {goalViews.map(v => (
                  <GoalCard
                    key={v.goal.id}
                    v={v}
                    canLink={investmentBoards.length > 0}
                    onEdit={() => openEdit(v.goal)}
                    onDelete={() => setDeleteTarget(v.goal)}
                    onRefresh={() => quickRefreshFromBoard(v.goal)}
                    onPickBoard={() => openBoardPicker(v.goal)}
                  />
                ))}
              </div>
            </section>
            <div className="space-y-4">
              <PaceChart items={goalViews} />
              <GoalsTimeline items={goalViews} />
            </div>
          </div>
        </>
      )}

      <GoalsHelp />

      {/* FORM MODAL */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v) setFormOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar meta' : 'Nova meta'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {/* Tipo de meta */}
            <div className="space-y-2">
              <Label>Tipo de meta</Label>
              <div className="grid grid-cols-4 gap-2">
                {GOAL_TYPES.map(t => {
                  const Icon = t.icon
                  const active = form.type === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: t.value }))}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 text-xs font-medium transition-all ${
                        active
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300 dark:hover:border-slate-500'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[10px] text-center leading-tight">{t.label.split(' ')[0]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal-name">Nome do objetivo</Label>
              <Input id="goal-name" placeholder="Ex: Viagem para Europa..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal-target">Valor alvo (R$)</Label>
              <Input id="goal-target" type="number" min="1" step="0.01" placeholder="Ex: 10000" value={form.targetAmount} onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))} required />
            </div>

            <div className="space-y-2">
              <Label>Valor atual</Label>
              {investmentBoards.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, linkMode: 'board' }))}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                        form.linkMode === 'board'
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      Vincular conta
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, linkMode: 'manual' }))}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                        form.linkMode === 'manual'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      Valor manual
                    </button>
                  </div>
                  {form.linkMode === 'board' ? (
                    <div className="space-y-1.5 pt-1">
                      {investmentBoards.map(board => boardValue(board).has ? (
                        <button
                          key={board.id}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, linkedBoardId: board.id }))}
                          className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border-2 text-left transition-colors ${
                            form.linkedBoardId === board.id
                              ? 'border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                              : 'border-slate-200 dark:border-slate-600 hover:border-violet-300 dark:hover:border-violet-600'
                          }`}
                        >
                          <span className="font-medium text-sm text-slate-800 dark:text-slate-100">{board.name}</span>
                          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{fmt(boardValue(board).value)}</span>
                        </button>
                      ) : (
                        <button
                          key={board.id}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, linkedBoardId: board.id }))}
                          className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border-2 border-dashed text-left transition-colors ${
                            form.linkedBoardId === board.id
                              ? 'border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                              : 'border-slate-200 dark:border-slate-600 hover:border-violet-300 dark:hover:border-violet-600'
                          }`}
                        >
                          <span className="font-medium text-sm text-slate-800 dark:text-slate-100">{board.name}</span>
                          <span className="text-[11px] text-slate-400 text-right">sem valor ainda — a meta acompanha quando você informar</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Input id="goal-current" type="number" min="0" step="0.01" placeholder="Ex: 2500" value={form.currentAmount} onChange={e => setForm(f => ({ ...f, currentAmount: e.target.value }))} className="mt-1.5" />
                  )}
                </>
              ) : (
                <Input id="goal-current" type="number" min="0" step="0.01" placeholder="Ex: 2500" value={form.currentAmount} onChange={e => setForm(f => ({ ...f, currentAmount: e.target.value }))} />
              )}
            </div>

            <div className="space-y-2">
              <Label>Meta iniciada em</Label>
              <p className="text-xs text-slate-400 dark:text-slate-500 -mt-1">Usado pra calcular seu ritmo atual — mude se já vinha guardando antes de cadastrar aqui.</p>
              <div className="grid grid-cols-2 gap-3">
                <select value={form.startMonth} onChange={e => setForm(f => ({ ...f, startMonth: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100">
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select value={form.startYear} onChange={e => setForm(f => ({ ...f, startYear: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100">
                  {START_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prazo desejado</Label>
              <div className="grid grid-cols-2 gap-3">
                <select value={form.deadlineMonth} onChange={e => setForm(f => ({ ...f, deadlineMonth: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100">
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select value={form.deadlineYear} onChange={e => setForm(f => ({ ...f, deadlineYear: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {GOAL_COLORS.map(color => (
                  <button key={color} type="button" onClick={() => setForm(f => ({ ...f, color }))}
                    className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: color, borderColor: form.color === color ? '#1e293b' : 'transparent', outline: form.color === color ? '2px solid white' : 'none', outlineOffset: '-3px' }}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar meta'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* BOARD PICKER — puxa só o patrimônio, sem posições/proventos */}
      <Dialog open={boardPickerOpen} onOpenChange={v => { if (!v) { setBoardPickerOpen(false); setImportingFor(null) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Puxar de qual conta?</DialogTitle></DialogHeader>
          <div className="space-y-2 pt-2">
            {investmentBoards.map(board => boardValue(board).has ? (
              <button
                key={board.id}
                onClick={() => importingFor && pullFromBoard(importingFor, board)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-slate-200 dark:border-slate-600 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all text-left"
              >
                <span className="font-medium text-sm text-slate-800 dark:text-slate-100">{board.name}</span>
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{fmt(boardValue(board).value)}</span>
              </button>
            ) : (
              <button
                key={board.id}
                onClick={() => importingFor && pullFromBoard(importingFor, board)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all text-left"
              >
                <span className="font-medium text-sm text-slate-800 dark:text-slate-100">{board.name}</span>
                <span className="text-[11px] text-slate-400">sem valor ainda — acompanha quando informar</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Excluir meta</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 dark:text-slate-400 pt-2">Excluir <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong>? O progresso salvo será perdido.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={async () => { const { error: delError } = await deleteGoal(deleteTarget!.id); if (!delError) setDeleteTarget(null) }} className="flex-1">Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default withPlan(
  'goals',
  GoalsPage,
  'Defina objetivos com prazo e acompanhe o ritmo necessário para chegar lá.',
)
