'use client'

import { useState, useRef } from 'react'
import { useGoals } from '@/hooks/use-goals'
import { Goal, GoalType, GOAL_COLORS } from '@/types'
import { parseRICOXLSX, RICOData } from '@/utils/parse-rico'
import { parseOFXBalance, OFXBalance } from '@/utils/parse-ofx-balance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Plus, Pencil, Trash2, Target, Trophy, Star, Upload,
  ChevronDown, ChevronUp, AlertCircle, RefreshCw,
  PiggyBank, TrendingUp, Car, Plane, CreditCard, Home,
  CheckCircle, Clock, AlertTriangle, Building2, BarChart2, Flame,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
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

function rentColor(value: string): string {
  const n = parseFloat(value?.replace('%', '').replace(',', '.'))
  if (isNaN(n)) return 'text-slate-400'
  return n >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'
}

// ── Form ──────────────────────────────────────────────────────────────────────
const currentYear = new Date().getFullYear()
const YEARS  = Array.from({ length: 11 }, (_, i) => currentYear + i)
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
  currentAmount: string
  deadlineMonth: string
  deadlineYear: string
  color: string
}

const EMPTY_FORM: FormState = {
  name: '',
  type: 'personalizada',
  targetAmount: '',
  currentAmount: '',
  deadlineMonth: String(new Date().getMonth() + 2).padStart(2, '0'),
  deadlineYear: String(currentYear + 1),
  color: GOAL_COLORS[0],
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GoalsPage() {
  const { goals, loading, createGoal, updateGoal, deleteGoal } = useGoals()
  const [formOpen, setFormOpen]       = useState(false)
  const [editing, setEditing]         = useState<Goal | null>(null)
  const [form, setForm]               = useState<FormState>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null)
  const [expandedPos, setExpandedPos] = useState<Set<string>>(new Set())

  // Import state
  const [importingFor, setImportingFor]   = useState<Goal | null>(null)
  const [importTypeOpen, setImportTypeOpen] = useState(false)   // format selector
  const [importFormat, setImportFormat]   = useState<'rico' | 'ofx' | null>(null)
  const [ricoPreview, setRicoPreview]     = useState<RICOData | null>(null)
  const [ofxPreview, setOfxPreview]       = useState<OFXBalance | null>(null)
  const [importError, setImportError]     = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setFormOpen(true) }

  function openEdit(goal: Goal) {
    const [year, month] = goal.deadline.split('-')
    setEditing(goal)
    setForm({
      name: goal.name,
      type: goal.type ?? 'personalizada',
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
    const target  = parseFloat(form.targetAmount.replace(',', '.'))
    const current = parseFloat(form.currentAmount.replace(',', '.')) || 0
    const deadline = `${form.deadlineYear}-${form.deadlineMonth}`
    if (editing) {
      updateGoal(editing.id, { name: form.name, type: form.type, targetAmount: target, currentAmount: current, deadline, color: form.color })
    } else {
      createGoal({ name: form.name, type: form.type, targetAmount: target, currentAmount: current, deadline, color: form.color })
    }
    setFormOpen(false)
  }

  function togglePos(id: string) {
    setExpandedPos(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  function openImport(goal: Goal) {
    setImportingFor(goal)
    setRicoPreview(null)
    setOfxPreview(null)
    setImportError('')
    setImportFormat(null)
    setImportTypeOpen(true)
  }

  function selectFormat(fmt: 'rico' | 'ofx') {
    setImportFormat(fmt)
    setImportTypeOpen(false)
    if (fileRef.current) {
      fileRef.current.accept = fmt === 'rico' ? '.xlsx,.xls' : '.ofx,.qfx,.OFX,.QFX'
      fileRef.current.value = ''
    }
    setTimeout(() => fileRef.current?.click(), 100)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportLoading(true)
    setImportError('')

    if (importFormat === 'rico') {
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          setRicoPreview(parseRICOXLSX(ev.target?.result as ArrayBuffer))
        } catch (err) {
          setImportError(err instanceof Error ? err.message : 'Erro ao ler o arquivo.')
          setImportingFor(null)
        } finally {
          setImportLoading(false)
          if (fileRef.current) fileRef.current.value = ''
        }
      }
      reader.onerror = () => { setImportError('Erro ao ler o arquivo.'); setImportLoading(false); setImportingFor(null) }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const text = ev.target?.result as string
          setOfxPreview(parseOFXBalance(text))
        } catch (err) {
          setImportError(err instanceof Error ? err.message : 'Erro ao ler o arquivo OFX.')
          setImportingFor(null)
        } finally {
          setImportLoading(false)
          if (fileRef.current) fileRef.current.value = ''
        }
      }
      reader.onerror = () => { setImportError('Erro ao ler o arquivo.'); setImportLoading(false); setImportingFor(null) }
      reader.readAsText(file, 'latin1')
    }
  }

  function confirmRICO() {
    if (!importingFor || !ricoPreview) return
    updateGoal(importingFor.id, {
      currentAmount: ricoPreview.patrimonio,
      lastImport: { ...ricoPreview, source: 'rico' },
    })
    setImportingFor(null); setRicoPreview(null)
  }

  function confirmOFX() {
    if (!importingFor || !ofxPreview) return
    updateGoal(importingFor.id, {
      currentAmount: ofxPreview.ledgerBalance,
      lastImport: {
        source: 'ofx',
        importedAt: new Date().toISOString(),
        patrimonio: ofxPreview.ledgerBalance,
        bankName: ofxPreview.bankName,
        accountType: ofxPreview.accountType,
        availBalance: ofxPreview.availBalance,
        balanceDate: ofxPreview.balanceDate,
      },
    })
    setImportingFor(null); setOfxPreview(null)
  }

  if (loading) return null

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />

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

      {importError && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" /> {importError}
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

                  {/* Import breakdown */}
                  {imp && (imp.source === 'rico' || !imp.source) && imp.totalInvestido !== undefined && (
                    <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-center">
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Investido</p>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{fmt(imp.totalInvestido!)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Saldo livre</p>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{fmt(imp.saldoDisponivel!)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Patrimônio</p>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{fmt(imp.patrimonio)}</p>
                      </div>
                    </div>
                  )}
                  {imp && imp.source === 'ofx' && (
                    <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{imp.bankName}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{imp.accountType === 'INVESTMENT' ? 'Investimento' : imp.accountType === 'SAVINGS' ? 'Poupança' : 'Conta corrente'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400 dark:text-slate-500">Saldo</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{fmt(imp.patrimonio)}</p>
                      </div>
                    </div>
                  )}

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

                    <div className="flex gap-2">
                      {imp && imp.positions && imp.positions.length > 0 && (
                        <Button variant="ghost" size="sm" className="text-xs gap-1 h-8 text-slate-500" onClick={() => togglePos(goal.id)}>
                          {expandedPos.has(goal.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {imp.positions.length} ativos
                        </Button>
                      )}
                      <Button
                        size="sm" variant="outline" className="text-xs gap-1.5 h-8"
                        style={{ borderColor: goal.color + '60', color: goal.color }}
                        disabled={importLoading}
                        onClick={() => openImport(goal)}
                      >
                        {importLoading && importingFor?.id === goal.id
                          ? <RefreshCw className="h-3 w-3 animate-spin" />
                          : <Upload className="h-3 w-3" />
                        }
                        {imp ? 'Atualizar extrato' : 'Importar extrato'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Posições RICO expandidas */}
                {expandedPos.has(goal.id) && imp && imp.positions && imp.positions.length > 0 && (() => {
                  const positions = imp.positions!
                  const posRow = (pos: import('@/types').RICOPosition) => (
                    <div key={pos.ticker} className="flex items-center gap-2 text-sm">
                      <span className="font-mono font-semibold text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded w-16 text-center shrink-0">{pos.ticker}</span>
                      {pos.quantity && <span className="text-xs text-slate-400 shrink-0">{pos.quantity} un.</span>}
                      <span className="text-xs text-slate-400 shrink-0">{pos.allocation}</span>
                      <span className={`text-xs font-medium shrink-0 ml-auto ${rentColor(pos.rentabilidade)}`}>{pos.rentabilidade}</span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 shrink-0">{fmt(pos.value)}</span>
                    </div>
                  )
                  const cats = Array.from(new Set(positions.map(p => p.category).filter(Boolean)))
                  if (cats.length === 0) return (
                    <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Posições</p>
                      <div className="space-y-2">{positions.map(posRow)}</div>
                    </div>
                  )
                  return (
                    <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-4 space-y-4">
                      {cats.map(cat => {
                        const catPos = positions.filter(p => p.category === cat)
                        const subs   = Array.from(new Set(catPos.map(p => p.subcategory))).filter(Boolean)
                        return (
                          <div key={cat}>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">{cat}</p>
                            {subs.length > 0 ? subs.map(sub => (
                              <div key={sub} className="mb-3">
                                {subs.length > 1 && <p className="text-xs text-slate-400 mb-1.5 pl-1">{sub}</p>}
                                <div className="space-y-2">{catPos.filter(p => p.subcategory === sub).map(posRow)}</div>
                              </div>
                            )) : <div className="space-y-2">{catPos.map(posRow)}</div>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
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
              <Label htmlFor="goal-current">Valor atual (R$)</Label>
              <Input id="goal-current" type="number" min="0" step="0.01" placeholder="Ex: 2500" value={form.currentAmount} onChange={e => setForm(f => ({ ...f, currentAmount: e.target.value }))} />
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

      {/* FORMAT SELECTOR */}
      <Dialog open={importTypeOpen} onOpenChange={v => { if (!v) { setImportTypeOpen(false); setImportingFor(null) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Qual tipo de extrato?</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <button
              onClick={() => selectFormat('rico')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left group"
            >
              <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                <BarChart2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">RICO / XP Investimentos</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Arquivo PosicaoDetalhada.xlsx — mostra carteira detalhada</p>
              </div>
            </button>
            <button
              onClick={() => selectFormat('ofx')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all text-left group"
            >
              <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/40 transition-colors">
                <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Extrato bancário OFX</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Itaú, Bradesco, BB, Santander, Caixa, Inter… (.ofx, .qfx)</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* RICO PREVIEW */}
      <Dialog open={!!ricoPreview} onOpenChange={v => { if (!v) { setRicoPreview(null); setImportingFor(null) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Confirmar importação RICO</DialogTitle></DialogHeader>
          {ricoPreview && (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-slate-500 dark:text-slate-400">Meta: <strong className="text-slate-700 dark:text-slate-200">{importingFor?.name}</strong></p>
              <div className="space-y-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Total investido em ativos</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(ricoPreview.totalInvestido)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Saldo disponível</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(ricoPreview.saldoDisponivel)}</span>
                </div>
                <div className="h-px bg-slate-200 dark:bg-slate-600 my-1" />
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">Patrimônio total</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{fmt(ricoPreview.patrimonio)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">O progresso será atualizado com o patrimônio total ({fmt(ricoPreview.patrimonio)}).</p>
              {ricoPreview.positions.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{ricoPreview.positions.length} posições</p>
                  {ricoPreview.positions.map(p => (
                    <div key={p.ticker} className="flex justify-between text-xs">
                      <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">{p.ticker}</span>
                      <span className={rentColor(p.rentabilidade)}>{p.rentabilidade}</span>
                      <span className="text-slate-600 dark:text-slate-300">{fmt(p.value)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => { setRicoPreview(null); setImportingFor(null) }} className="flex-1">Cancelar</Button>
                <Button onClick={confirmRICO} className="flex-1">Confirmar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* OFX PREVIEW */}
      <Dialog open={!!ofxPreview} onOpenChange={v => { if (!v) { setOfxPreview(null); setImportingFor(null) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Confirmar extrato bancário</DialogTitle></DialogHeader>
          {ofxPreview && (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-slate-500 dark:text-slate-400">Meta: <strong className="text-slate-700 dark:text-slate-200">{importingFor?.name}</strong></p>
              <div className="space-y-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Banco</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{ofxPreview.bankName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Tipo de conta</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {ofxPreview.accountType === 'INVESTMENT' ? 'Investimento' : ofxPreview.accountType === 'SAVINGS' ? 'Poupança' : 'Conta corrente'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Data do extrato</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {ofxPreview.balanceDate ? new Date(ofxPreview.balanceDate + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                  </span>
                </div>
                {ofxPreview.availBalance !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Saldo disponível</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(ofxPreview.availBalance)}</span>
                  </div>
                )}
                <div className="h-px bg-slate-200 dark:bg-slate-600 my-1" />
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">Saldo contábil</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{fmt(ofxPreview.ledgerBalance)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">O progresso será atualizado com o saldo contábil ({fmt(ofxPreview.ledgerBalance)}).</p>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => { setOfxPreview(null); setImportingFor(null) }} className="flex-1">Cancelar</Button>
                <Button onClick={confirmOFX} className="flex-1">Confirmar</Button>
              </div>
            </div>
          )}
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
