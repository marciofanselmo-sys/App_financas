'use client'

import { useState } from 'react'
import { useGoals } from '@/hooks/use-goals'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { Goal, GoalType, GOAL_COLORS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Plus, Pencil, Trash2, Target, Trophy, Star, RefreshCw,
  PiggyBank, TrendingUp, Car, Plane, CreditCard, Home,
  CheckCircle, Clock, AlertTriangle, Flame, Link2,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { InfoBox } from '@/components/ui/info-box'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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

function milestone(pct: number): { label: string; color: string } | null {
  if (pct >= 100) return { label: '🏆 Meta atingida!',      color: 'text-yellow-500' }
  if (pct >= 75)  return { label: '🌟 75% — quase lá!',     color: 'text-purple-500' }
  if (pct >= 50)  return { label: '⭐ Metade do caminho!',  color: 'text-blue-500'   }
  if (pct >= 25)  return { label: '✨ 25% — ótimo começo!', color: 'text-green-500'  }
  return null
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
export default function GoalsPage() {
  const { goals, loading, createGoal, updateGoal, deleteGoal } = useGoals()
  const { boards } = useTransactionBoards()
  const [formOpen, setFormOpen]       = useState(false)
  const [editing, setEditing]         = useState<Goal | null>(null)
  const [form, setForm]               = useState<FormState>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null)

  // Puxar patrimônio de uma conta de investimento existente (Opção A, 2026-07-09)
  // — só o valor + um link leve pra conta, sem trazer posições/proventos pro
  // card da Meta (por pedido explícito do usuário). É o único jeito de atualizar
  // o valor atual por importação — extrato RICO/OFX direto na Meta foi removido
  // (2026-07-09), por pedido também.
  const [importingFor, setImportingFor]       = useState<Goal | null>(null)
  const [boardPickerOpen, setBoardPickerOpen] = useState(false)
  const investmentBoardsWithPosition = boards.filter(b => b.is_investment && b.last_position_import)

  function pullFromBoard(goal: Goal, board: (typeof boards)[number]) {
    if (!board.last_position_import) return
    updateGoal(goal.id, {
      currentAmount: board.last_position_import.patrimonio,
      lastImport: {
        source: 'board',
        importedAt: new Date().toISOString(),
        patrimonio: board.last_position_import.patrimonio,
        boardId: board.id,
        boardName: board.name,
      },
    })
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
    if (!board?.last_position_import) { openBoardPicker(goal); return }
    pullFromBoard(goal, board)
  }

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setFormOpen(true) }

  function openEdit(goal: Goal) {
    const [year, month] = goal.deadline.split('-')
    const created = new Date(goal.created_at)
    const linkedBoardId = goal.lastImport?.source === 'board' ? goal.lastImport.boardId ?? '' : ''
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

  function handleSave(e: React.FormEvent) {
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
      ? investmentBoardsWithPosition.find(b => b.id === form.linkedBoardId)
      : undefined
    const current = linkedBoard?.last_position_import
      ? linkedBoard.last_position_import.patrimonio
      : parseFloat(form.currentAmount.replace(',', '.')) || 0
    const lastImport = linkedBoard?.last_position_import
      ? {
          source: 'board' as const,
          importedAt: new Date().toISOString(),
          patrimonio: linkedBoard.last_position_import.patrimonio,
          boardId: linkedBoard.id,
          boardName: linkedBoard.name,
        }
      // Trocou pra manual (ou não escolheu conta nenhuma) — limpa o vínculo
      // anterior, senão o card continuaria mostrando "vinculada a X".
      : undefined

    if (editing) {
      updateGoal(editing.id, { name: form.name, type: form.type, targetAmount: target, currentAmount: current, deadline, color: form.color, created_at, lastImport })
    } else {
      createGoal({ name: form.name, type: form.type, targetAmount: target, currentAmount: current, deadline, color: form.color, created_at, lastImport })
    }
    setFormOpen(false)
  }

  if (loading) return null

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Minhas Metas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {goals.length === 0 ? 'Defina seu primeiro objetivo' : `${goals.length} objetivo${goals.length > 1 ? 's' : ''} em andamento`}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nova meta
        </Button>
      </div>

      <InfoBox id="goals-vincular-conta">
        <p className="text-blue-600 dark:text-blue-400">
          O valor atual de uma meta pode vir de uma <strong>conta de investimento vinculada</strong>, em vez de digitado à mão. Pra isso funcionar, primeiro crie a conta em <strong>Investimentos</strong> e importe a posição dela (o patrimônio precisa aparecer no card da conta) — só depois ela fica disponível pra vincular aqui.
        </p>
        <p className="text-blue-600 dark:text-blue-400">
          Vinculada, a meta guarda uma referência leve à conta (não copia posições nem proventos) — o valor só atualiza quando você clicar em &ldquo;Atualizar valor&rdquo;, nunca sozinho.
        </p>
      </InfoBox>

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
        <div className="space-y-4">
          {goals.map(goal => {
            const pct      = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
            const months   = monthsRemaining(goal.deadline)
            const remaining = goal.targetAmount - goal.currentAmount
            const monthly  = months > 0 ? remaining / months : remaining
            const ms       = milestone(pct)
            const status   = goalStatus(goal)
            const imp      = goal.lastImport
            const typeConf = goalTypeConfig(goal.type ?? 'personalizada')
            const TypeIcon = typeConf.icon

            // Projeção baseada no ritmo atual
            const now = new Date()
            const created = new Date(goal.created_at)
            const monthsElapsed = Math.max(1, (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth()))
            const currentPace = goal.currentAmount / monthsElapsed
            const projectedMonths = currentPace > 0 ? Math.ceil(remaining / currentPace) : null
            const projectedDate = projectedMonths != null ? (() => {
              const d = new Date(); d.setMonth(d.getMonth() + projectedMonths)
              const mn = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
              return `${mn[d.getMonth()]}/${d.getFullYear()}`
            })() : null

            return (
              <div key={goal.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-5">
                  {/* Cabeçalho */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: goal.color + '20' }}>
                        {pct >= 100
                          ? <Trophy className="h-5 w-5" style={{ color: goal.color }} />
                          : <TypeIcon className="h-5 w-5" style={{ color: goal.color }} />
                        }
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{goal.name}</p>
                          {/* Status badge */}
                          {status && (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 ${status.color}`}>
                              <status.Icon className="h-3 w-3" /> {status.label}
                            </span>
                          )}
                          {pct >= 100 && (
                            <span className="text-[11px] font-semibold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded-full">
                              🏆 Concluída
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{typeConf.label}</p>
                        {ms && <p className={`text-xs font-medium mt-0.5 ${ms.color}`}>{ms.label}</p>}
                        {imp && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {imp.source === 'board' && (
                              <span className="inline-flex items-center gap-1 text-violet-500 dark:text-violet-400 font-medium mr-1">
                                <Link2 className="h-3 w-3" /> {imp.boardName} ·
                              </span>
                            )}
                            Atualizado em {format(new Date(imp.importedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        )}
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
                      <span className="font-bold text-slate-700 dark:text-slate-200">{fmt(goal.currentAmount)}</span>
                      <span className="text-slate-400 dark:text-slate-500">{fmt(goal.targetAmount)}</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: goal.color }} />
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
                      <span>{pct}% concluído</span>
                      <span>{fmt(remaining)} restando</span>
                    </div>
                  </div>

                  {/* Rodapé: mensal + prazo */}
                  <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-4 flex-wrap">
                      {pct < 100 && months > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500">Necessário/mês</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{fmt(monthly)}</p>
                        </div>
                      )}
                      {pct < 100 && projectedDate && monthsElapsed >= 1 && currentPace > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500">Ritmo atual</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                            <Flame className="h-3 w-3 text-orange-400" />
                            {fmt(currentPace)}/mês
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Prazo definido</p>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-400" />
                          {deadlineLabel(goal.deadline)}
                          {months > 0 && <span className="text-xs text-slate-400 font-normal">({months}m)</span>}
                        </p>
                      </div>
                      {pct < 100 && projectedDate && projectedMonths != null && (
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500">Projeção do ritmo</p>
                          <p className={`text-sm font-semibold flex items-center gap-1 ${
                            status?.label === 'Adiantada' ? 'text-emerald-600 dark:text-emerald-400'
                            : status?.label === 'Atrasada' ? 'text-amber-500'
                            : 'text-slate-700 dark:text-slate-200'
                          }`}>
                            {projectedDate}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {imp?.source === 'board' && (
                        <Button
                          size="sm" variant="ghost" className="text-xs gap-1.5 h-8 text-slate-500"
                          title={`Atualizar com o patrimônio atual de "${imp.boardName}"`}
                          onClick={() => quickRefreshFromBoard(goal)}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Atualizar valor
                        </Button>
                      )}
                      {investmentBoardsWithPosition.length > 0 && (
                        <Button
                          size="sm" variant="outline" className="text-xs gap-1.5 h-8 border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400"
                          onClick={() => openBoardPicker(goal)}
                        >
                          <Link2 className="h-3 w-3" />
                          {imp?.source === 'board' ? 'Trocar conta' : 'Importar Patrimônio'}
                        </Button>
                      )}
                    </div>
                  </div>
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
              {investmentBoardsWithPosition.length > 0 ? (
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
                      {investmentBoardsWithPosition.map(board => (
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
                          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{fmt(board.last_position_import!.patrimonio)}</span>
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

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" className="flex-1">{editing ? 'Salvar' : 'Criar meta'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* BOARD PICKER — puxa só o patrimônio, sem posições/proventos */}
      <Dialog open={boardPickerOpen} onOpenChange={v => { if (!v) { setBoardPickerOpen(false); setImportingFor(null) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Puxar de qual conta?</DialogTitle></DialogHeader>
          <div className="space-y-2 pt-2">
            {investmentBoardsWithPosition.map(board => (
              <button
                key={board.id}
                onClick={() => importingFor && pullFromBoard(importingFor, board)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-slate-200 dark:border-slate-600 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all text-left"
              >
                <span className="font-medium text-sm text-slate-800 dark:text-slate-100">{board.name}</span>
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{fmt(board.last_position_import!.patrimonio)}</span>
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
            <Button variant="destructive" onClick={() => { deleteGoal(deleteTarget!.id); setDeleteTarget(null) }} className="flex-1">Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
