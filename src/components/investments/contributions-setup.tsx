'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CategorizationRule, applyInternalRule, isInternalRule } from '@/hooks/use-rules'
import { Transaction, TransactionBoard } from '@/types'
import { formatCurrency } from '@/components/investments/rico-position-summary'
import { isCreditCardBoard } from '@/lib/data-suggestions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type UpdateBoardFn = (id: string, data: Partial<Omit<TransactionBoard, 'id' | 'user_id' | 'created_at'>>) => Promise<{ error: string | null }>

const parseMoney = (v: string) => parseFloat(v.replace(/\./g, '').replace(',', '.'))
const fmtDate = (d: string) => format(new Date(`${d}T00:00:00`), 'dd/MM/yy', { locale: ptBR })

/**
 * "Aportes" de uma conta de investimento: de qual conta sai o dinheiro e com
 * que texto (vira uma regra "Entre minhas contas" com destino nesta conta — a
 * saída não é gasto, e passa a contar como aporte) + o ponto de partida (o que
 * já estava aplicado antes). Nada aqui cria ou apaga lançamento: o saldo das
 * contas não muda.
 */
export function ContributionsSetup({ board, boards, rules, createRule, updateRule, updateBoard, onClose, onSaved }: {
  board: TransactionBoard
  boards: TransactionBoard[]
  rules: CategorizationRule[]
  createRule: (keyword: string, category: string, extra?: Partial<CategorizationRule>) => Promise<CategorizationRule | undefined>
  updateRule: (id: string, data: Partial<CategorizationRule>) => Promise<{ ok: boolean; error?: string }>
  updateBoard: UpdateBoardFn
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const existing = rules.find(r => isInternalRule(r) && r.target_board_id === board.id) ?? null
  const cashBoards = boards.filter(b => !b.is_investment)
  // Dinheiro para investir sai de conta corrente, nunca de cartão de crédito.
  const defaultOrigin = cashBoards.find(b => !isCreditCardBoard(b)) ?? cashBoards[0]
  const [origin, setOrigin] = useState(existing?.scope_board_id ?? defaultOrigin?.id ?? '')
  const [keyword, setKeyword] = useState(existing?.keyword ?? '')
  const [base, setBase] = useState(board.invested_base ? String(board.invested_base).replace('.', ',') : '')
  const [baseDate, setBaseDate] = useState(board.invested_base_date ?? '')
  const [found, setFound] = useState<Transaction[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const originItems = Object.fromEntries(cashBoards.map(b => [b.id, b.name.trim()]))

  // Prévia: o que a regra vai ligar a esta conta (só leitura).
  useEffect(() => {
    const kw = keyword.trim()
    if (!origin || kw.length < 3) { setFound(null); return }
    let cancelled = false
    const t = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('transactions')
        .select('id, date, amount, type, description, board_id, category, is_internal, counterpart_board_id, counterpart_of_id')
        .eq('board_id', origin)
        .eq('type', 'despesa')
        .ilike('description', `%${kw}%`)
        .order('date', { ascending: false })
      if (!cancelled) setFound((data ?? []) as Transaction[])
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [origin, keyword])

  const baseValue = base.trim() ? parseMoney(base) : 0
  const counted = (found ?? []).filter(t => !baseDate || t.date > baseDate)
  const totalFound = counted.reduce((s, t) => s + Number(t.amount), 0)
  const status = (t: Transaction) =>
    t.counterpart_board_id === board.id ? 'já ligado a esta conta'
      : t.is_internal || t.counterpart_board_id ? 'já fora das somas'
        : 'soma como gasto hoje'

  async function save() {
    setSaving(true)
    setError('')
    const kw = keyword.trim().toUpperCase()
    if (kw) {
      const fields = { keyword: kw, match_type: 'contains' as const, scope_board_id: origin, target_board_id: board.id, pair_sides: 'out' as const, require_pair: false }
      // Uma regra por conta de investimento; reaproveita a que tiver o mesmo texto.
      const reuse = existing ?? rules.find(r => isInternalRule(r) && r.match_type === 'contains' && r.keyword.toUpperCase() === kw) ?? null
      if (reuse) {
        const r = await updateRule(reuse.id, { ...fields, active: true })
        if (!r.ok || r.error === 'partial') { setSaving(false); setError('Não foi possível salvar a regra de aporte.'); return }
      } else {
        try {
          const created = await createRule(kw, '', { ...fields, action: 'internal' })
          if (!created) { setSaving(false); setError('Não foi possível criar a regra de aporte.'); return }
        } catch (e) {
          setSaving(false); setError(e instanceof Error ? e.message : 'Não foi possível criar a regra de aporte.'); return
        }
      }
      const applied = await applyInternalRule(fields)
      if (applied.error) { setSaving(false); setError(applied.error); return }
    }
    // Só grava o ponto de partida quando ele existe ou mudou — configurar só o
    // texto do aporte não depende da migração do ponto de partida.
    const baseChanged = (baseValue > 0 ? baseValue : 0) !== Number(board.invested_base ?? 0)
      || (baseValue > 0 ? baseDate : null) !== (board.invested_base_date ?? null)
    const { error: boardError } = baseChanged
      ? await updateBoard(board.id, {
          invested_base: baseValue > 0 ? baseValue : 0,
          invested_base_date: baseValue > 0 && baseDate ? baseDate : null,
        })
      : { error: null }
    setSaving(false)
    if (boardError) {
      setError('Falta atualizar o banco para guardar o ponto de partida: rode a migração migration_investment_base.sql no Supabase.')
      return
    }
    onSaved(`Aportes de ${board.name.trim()} configurados.`)
  }

  return (
    <Dialog open onOpenChange={v => { if (!v && !saving) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Aportes — {board.name.trim()}</DialogTitle></DialogHeader>
        <div className="space-y-5 pt-1 text-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Com os aportes, o app mostra quanto você colocou nesta conta e quanto ela rendeu (valor atual − total aportado).
            Nada aqui cria ou apaga lançamento: o saldo das suas contas não muda.
          </p>

          <section className="space-y-2">
            <p className="font-semibold text-slate-700 dark:text-slate-200">1. De onde sai o dinheiro</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Conta</Label>
                <Select value={origin} onValueChange={v => setOrigin(v ?? '')} items={originItems}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Escolha a conta" /></SelectTrigger>
                  <SelectContent>
                    {cashBoards.map(b => <SelectItem key={b.id} value={b.id}>{b.name.trim()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aporte-kw" className="text-xs">Texto no extrato</Label>
                <Input id="aporte-kw" placeholder="Ex: ENVIO DE TED TRANSF" value={keyword} onChange={e => setKeyword(e.target.value.toUpperCase())} />
              </div>
            </div>
            {found && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/40 text-xs text-slate-600 dark:text-slate-300 flex justify-between">
                  <span>{counted.length} aporte{counted.length === 1 ? '' : 's'}{baseDate ? ` depois de ${fmtDate(baseDate)}` : ''}</span>
                  <strong className="tabular-nums">{formatCurrency(totalFound)}</strong>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
                  {found.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Nenhuma saída com esse texto nessa conta.</p>}
                  {found.map(t => {
                    const ignored = !!baseDate && t.date <= baseDate
                    return (
                      <div key={t.id} className={`px-3 py-1.5 flex items-center gap-3 text-xs ${ignored ? 'opacity-50' : ''}`}>
                        <span className="w-16 shrink-0 text-slate-400">{fmtDate(t.date)}</span>
                        <span className="flex-1 min-w-0 truncate">
                          {t.description}
                          <span className="block text-[10px] text-slate-400">{ignored ? 'antes do ponto de partida — já está nele' : status(t)}</span>
                        </span>
                        <span className="tabular-nums font-medium">{formatCurrency(Number(t.amount))}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-400">
              Vira uma regra &ldquo;Entre minhas contas&rdquo; ({originItems[origin] ?? 'conta'} → {board.name.trim()}): essas saídas não somam como gasto e passam a contar como aporte — inclusive nas próximas importações.
            </p>
          </section>

          <section className="space-y-2">
            <p className="font-semibold text-slate-700 dark:text-slate-200">2. Ponto de partida <span className="font-normal text-slate-400">(opcional)</span></p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quanto já estava aplicado nesta conta antes dos aportes acima. Deixe em branco se a conta começou com eles.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="aporte-base" className="text-xs">Já aplicado (R$)</Label>
                <Input id="aporte-base" inputMode="decimal" placeholder="0,00" value={base} onChange={e => setBase(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aporte-base-date" className="text-xs">Até o dia</Label>
                <Input id="aporte-base-date" type="date" value={baseDate} onChange={e => setBaseDate(e.target.value)} disabled={!(baseValue > 0)} />
              </div>
            </div>
          </section>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
            Total aportado: <strong>{formatCurrency((baseValue > 0 ? baseValue : 0) + totalFound)}</strong>
            {board.last_position_import && (() => {
              const invested = (baseValue > 0 ? baseValue : 0) + totalFound
              const gain = board.last_position_import.patrimonio - invested
              return invested > 0 ? <> · rendimento <strong>{gain >= 0 ? '+' : '−'}{formatCurrency(Math.abs(gain))} ({gain >= 0 ? '+' : ''}{((gain / invested) * 100).toFixed(1).replace('.', ',')}%)</strong> sobre o valor atual de {formatCurrency(board.last_position_import.patrimonio)}</> : null
            })()}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1">Cancelar</Button>
            <Button onClick={save} disabled={saving || (!keyword.trim() && !(baseValue > 0)) || (baseValue > 0 && !baseDate)} className="flex-1 gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
