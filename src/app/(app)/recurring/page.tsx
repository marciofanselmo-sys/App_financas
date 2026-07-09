'use client'

import { useState } from 'react'
import { useRecurring, InstallmentItem } from '@/hooks/use-recurring'
import { useCategories } from '@/hooks/use-categories'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { createClient } from '@/lib/supabase/client'
import { CreditCard, Calendar, TrendingDown, CheckCircle, Plus, X, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { InfoBox } from '@/components/ui/info-box'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function formatYearMonth(ym: string): string {
  const [year, month] = ym.split('-')
  return `${MONTH_NAMES[parseInt(month) - 1]}/${year}`
}

function InstallmentBadge({ remaining }: { remaining: number }) {
  if (remaining === 0) return (
    <span className="text-[11px] font-medium text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
      Última parcela
    </span>
  )
  if (remaining === 1) return (
    <span className="text-[11px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
      Quase acabando
    </span>
  )
  if (remaining >= 12) return (
    <span className="text-[11px] font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
      Longo prazo
    </span>
  )
  return null
}

interface ManualForm {
  description: string
  totalInstallments: string
  currentInstallment: string
  monthlyAmount: string
  category: string
  board_id: string
  date: string
}

const TODAY = new Date().toISOString().split('T')[0]

const EMPTY_FORM: ManualForm = {
  description: '',
  totalInstallments: '',
  currentInstallment: '1',
  monthlyAmount: '',
  category: '',
  board_id: '',
  date: TODAY,
}

export default function RecurringPage() {
  const { installments, loading, refetch, dismissInstallment } = useRecurring()
  const { categories } = useCategories()
  const { boards } = useTransactionBoards()

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<ManualForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [removeTarget, setRemoveTarget] = useState<InstallmentItem | null>(null)
  const [removing, setRemoving] = useState(false)

  async function handleRemove() {
    if (!removeTarget) return
    setRemoving(true)
    await dismissInstallment(removeTarget)
    setRemoving(false)
    setRemoveTarget(null)
    refetch()
  }

  const expenseCategoriesAll = categories.filter(c => c.type === 'despesa' || c.type === 'ambos')
  // Normais e isoladas em seletores separados, mesmo padrão do resto do app —
  // escolher em um desmarca o outro.
  const expenseCategoriesNormal = expenseCategoriesAll.filter(c => !c.special_dates || c.special_dates.length === 0)
  const expenseCategoriesSpecial = expenseCategoriesAll.filter(c => (c.special_dates?.length ?? 0) > 0)
  const expenseCategoryIsSpecial = expenseCategoriesSpecial.some(c => c.name === form.category)

  const totalMonthly = installments
    .filter(i => i.remaining > 0)
    .reduce((s, i) => s + i.monthlyAmount, 0)

  const totalCommitted = installments
    .filter(i => i.remaining > 0)
    .reduce((s, i) => s + i.monthlyAmount * i.remaining, 0)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const total = parseInt(form.totalInstallments)
    const current = parseInt(form.currentInstallment)
    const amount = parseFloat(form.monthlyAmount.replace(',', '.'))

    if (!form.description.trim()) { setError('Informe o nome da compra.'); return }
    if (isNaN(total) || total < 2) { setError('Total de parcelas deve ser maior que 1.'); return }
    if (isNaN(current) || current < 1 || current > total) { setError('Parcela atual inválida.'); return }
    if (isNaN(amount) || amount <= 0) { setError('Informe o valor da parcela.'); return }
    if (!form.category) { setError('Selecione uma categoria.'); return }

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); setError('Usuário não autenticado.'); return }

    const { error: dbErr } = await supabase.from('transactions').insert({
      user_id: user.id,
      description: form.description.trim(),
      amount,
      date: form.date || TODAY,
      type: 'despesa',
      category: form.category,
      board_id: form.board_id || null,
      installment_current: current,
      installment_total: total,
    })

    setSaving(false)
    if (dbErr) { setError('Erro ao salvar. Tente novamente.'); return }

    setForm(EMPTY_FORM)
    setAddOpen(false)
    refetch()
  }

  if (loading) return null

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Cartões & Parcelas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Parcelamentos ativos detectados nas suas transações
          </p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setError(''); setAddOpen(true) }} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova parcela
        </Button>
      </div>

      <InfoBox id="recurring-como-funciona">
        <p className="text-blue-600 dark:text-blue-400">
          Esta aba reúne todas as compras parceladas que o app encontrou nas suas transações (via importação de extrato ou lançamento manual). Ela não é uma lista do mês atual — é um acompanhamento das parcelas <strong>em andamento</strong>, olhando do primeiro pagamento até o último, independente de qual mês você está vendo agora.
        </p>
        <div className="border-t border-blue-200 dark:border-blue-800 pt-2.5">
          <p className="font-semibold mb-1">O que os valores em cima significam?</p>
          <p className="text-blue-600 dark:text-blue-400">
            <strong>Parcelas / mês</strong> é a soma do valor de UMA parcela de cada compra ativa — ou seja, quanto sai do seu bolso todo mês, recorrentemente, até cada parcelamento terminar. Não é só do mês atual: se um parcelamento começou em janeiro e vai até dezembro, esse valor conta com ele em todos esses meses.
          </p>
        </div>
        <div className="border-t border-blue-200 dark:border-blue-800 pt-2.5">
          <p className="font-semibold mb-1">Total comprometido</p>
          <p className="text-blue-600 dark:text-blue-400">
            Já esse é o valor que ainda falta pagar no total, somando todas as parcelas futuras (a partir de hoje) de todos os parcelamentos ativos — sua dívida restante em parcelas, de uma vez só.
          </p>
        </div>
      </InfoBox>

      {/* Summary cards */}
      {installments.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-[#111c2d] rounded-xl p-4 border border-slate-100 dark:border-white/[0.06] shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400">Parcelas / mês</p>
            <p className="text-xl font-bold text-violet-600 dark:text-violet-400 mt-1">{fmt(totalMonthly)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{installments.filter(i => i.remaining > 0).length} ativo{installments.filter(i => i.remaining > 0).length !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white dark:bg-[#111c2d] rounded-xl p-4 border border-slate-100 dark:border-white/[0.06] shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total comprometido</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">{fmt(totalCommitted)}</p>
            <p className="text-xs text-slate-400 mt-0.5">em parcelas futuras</p>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {installments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            iconColor="text-violet-500"
            iconBg="bg-violet-50 dark:bg-violet-500/15"
            title="Nenhum parcelamento encontrado"
            description="Importe um extrato para detectar parcelamentos automaticamente, ou adicione um manualmente."
            primaryLabel="Nova parcela manual"
            primaryOnClick={() => { setForm(EMPTY_FORM); setError(''); setAddOpen(true) }}
            secondaryLabel="Importar extrato"
            secondaryHref="/transactions"
          />
        ) : (
          installments.map((item, i) => {
            const pct = Math.round((item.currentInstallment / item.totalInstallments) * 100)
            const isLast = item.remaining === 0
            const totalCommittedItem = item.monthlyAmount * item.remaining

            return (
              <div key={i} className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-100 dark:border-white/[0.06] shadow-sm overflow-hidden">
                <div className={`h-1 ${
                  isLast ? 'bg-green-400' :
                  item.remaining === 1 ? 'bg-amber-400' :
                  item.remaining >= 12 ? 'bg-blue-400' :
                  'bg-violet-400'
                }`} />

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{item.description}</p>
                        <InstallmentBadge remaining={item.remaining} />
                      </div>
                      <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                        {item.category}
                      </span>
                    </div>
                    <div className="text-right shrink-0 flex items-start gap-2">
                      <div>
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{fmt(item.monthlyAmount)}</p>
                        <p className="text-xs text-slate-400">por mês</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(item)}
                        title="Remover da lista de parcelamentos"
                        className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors shrink-0 mt-0.5"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                      <span className="font-medium">{item.currentInstallment}/{item.totalInstallments} parcelas</span>
                      <span>{pct}% concluído</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isLast ? 'bg-green-500' : item.remaining === 1 ? 'bg-amber-400' : 'bg-violet-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-white/[0.05]">
                    {!isLast ? (
                      <>
                        <span className="flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" />
                          {item.remaining} restante{item.remaining !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          até {formatYearMonth(item.endYearMonth)}
                        </span>
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          Total restante: {fmt(totalCommittedItem)}
                        </span>
                      </>
                    ) : (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle className="h-3 w-3" />
                        Última parcela — {formatYearMonth(item.endYearMonth)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ADD MANUAL INSTALLMENT MODAL */}
      <Dialog open={addOpen} onOpenChange={v => { if (!v) setAddOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova parcela manual</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="inst-desc">Nome da compra</Label>
              <Input
                id="inst-desc"
                placeholder="Ex: iPhone 15, Notebook, Sofá..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="inst-current">Parcela atual</Label>
                <Input
                  id="inst-current"
                  type="number"
                  min="1"
                  placeholder="Ex: 3"
                  value={form.currentInstallment}
                  onChange={e => setForm(f => ({ ...f, currentInstallment: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inst-total">Total de parcelas</Label>
                <Input
                  id="inst-total"
                  type="number"
                  min="2"
                  placeholder="Ex: 12"
                  value={form.totalInstallments}
                  onChange={e => setForm(f => ({ ...f, totalInstallments: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inst-amount">Valor por parcela</Label>
              <Input
                id="inst-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={form.monthlyAmount}
                onChange={e => setForm(f => ({ ...f, monthlyAmount: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <div className={expenseCategoriesSpecial.length > 0 ? 'grid grid-cols-2 gap-2' : ''}>
                <Select
                  value={expenseCategoryIsSpecial ? '' : form.category}
                  onValueChange={v => { if (v) setForm(f => ({ ...f, category: v })) }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategoriesNormal.length === 0 ? (
                      <SelectItem value="__empty__" disabled>Nenhuma categoria disponível</SelectItem>
                    ) : (
                      expenseCategoriesNormal.map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {expenseCategoriesSpecial.length > 0 && (
                  <Select
                    value={expenseCategoryIsSpecial ? form.category : ''}
                    onValueChange={v => { if (v) setForm(f => ({ ...f, category: v })) }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Categoria isolada..." />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategoriesSpecial.map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {boards.length > 0 && (
              <div className="space-y-2">
                <Label>Conta (opcional)</Label>
                <Select value={form.board_id} onValueChange={v => setForm(f => ({ ...f, board_id: v ?? '' }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhuma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma conta</SelectItem>
                    {boards.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="inst-date">Data da parcela atual</Label>
              <Input
                id="inst-date"
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1.5">
                <X className="h-3.5 w-3.5 shrink-0" /> {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? 'Salvando...' : 'Adicionar parcela'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* REMOVE INSTALLMENT CONFIRM */}
      <Dialog open={!!removeTarget} onOpenChange={v => { if (!v) setRemoveTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover parcelamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 dark:text-slate-400 pt-2">
            Remover <strong>&ldquo;{removeTarget?.description}&rdquo;</strong> da lista de Cartões &amp; Parcelas?
            A transação continua no seu histórico normalmente — ela só deixa de ser contada como parcelamento ativo.
          </p>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)} className="flex-1">Cancelar</Button>
            <Button type="button" variant="destructive" disabled={removing} onClick={handleRemove} className="flex-1">
              {removing ? 'Removendo...' : 'Remover'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
