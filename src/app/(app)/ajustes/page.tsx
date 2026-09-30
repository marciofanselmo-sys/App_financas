'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeftRight, CheckCircle2, ChevronRight, Lightbulb, Loader2, Undo2, X } from 'lucide-react'
import { withPlan } from '@/components/plan/with-plan'
import { useAdjustments } from '@/hooks/use-adjustments'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { PairSuggestion } from '@/lib/data-suggestions'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (d: string) => format(new Date(`${d}T00:00:00`), "dd 'de' MMM yyyy", { locale: ptBR })
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

type Banner = { kind: 'ok' | 'error'; text: string; undoKey?: string }

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{title}</p>
      <div className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{children}</div>
    </div>
  )
}

function SuggestionCard({ s, name, busy, onApply, onSnooze, onDismiss }: {
  s: PairSuggestion
  name: (id: string) => string
  busy: boolean
  onApply: () => void
  onSnooze: () => void
  onDismiss: () => void
}) {
  const [open, setOpen] = useState(false)
  const origin = name(s.originBoardId)
  const target = name(s.targetBoardId)
  const entryText = s.entryTexts[0]
  const pendingOuts = s.pairs.filter(p => !p.out.is_internal && !p.out.counterpart_board_id).length
  const outsWithoutEntry = Math.max(0, s.outflowsStillCounting - pendingOuts)

  const impactParts = [
    s.expenseThisYear > 0 ? <><strong className="text-red-500">{fmt(s.expenseThisYear)}</strong> como despesa em {origin}</> : null,
    s.incomeThisYear > 0 ? <><strong className="text-green-600">{fmt(s.incomeThisYear)}</strong> como receita em {target}</> : null,
  ].filter(Boolean)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
          <ArrowLeftRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            {s.onlyEntryMissing ? `Falta a outra metade: a entrada em ${target}` : `Dinheiro entre suas contas: ${origin} → ${target}`}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Movimentação entre contas suas contando como gasto e ganho</p>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        <Part title="O que encontrei">
          {s.onlyEntryMissing ? (
            <>As saídas <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">{s.keyword}</code> de {origin} já estão fora das somas, mas {plural(s.entriesStillCounting, 'entrada', 'entradas')} do mesmo valor em {target} (&ldquo;{entryText}&rdquo;) ainda {s.entriesStillCounting === 1 ? 'conta' : 'contam'} como receita.</>
          ) : (
            <>{s.pairs.length} vezes saiu dinheiro de <strong>{origin}</strong> com o texto <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">{s.keyword}</code> e, em até 3 dias, entrou o mesmo valor em <strong>{target}</strong> (&ldquo;{entryText}&rdquo;).</>
          )}
        </Part>

        <Part title="Por que isso importa">
          {impactParts.length > 0 ? (
            <>O mesmo dinheiro está contando como se fosse gasto e ganho de verdade. Só em {s.year}: {impactParts.reduce<React.ReactNode[]>((acc, p, i) => (i ? [...acc, ' e ', p] : [p]), [])}. Isso infla suas despesas e receitas no Dashboard, na Análise e nos Relatórios.</>
          ) : (
            <>Em {s.year} nada disso aparece, mas nos anos anteriores o mesmo dinheiro ainda conta como gasto e ganho nos Relatórios.</>
          )}
        </Part>

        <Part title="O que vai acontecer se você aplicar">
          {s.existingRule
            ? <>Vou completar a sua regra <strong>Entre minhas contas</strong> &ldquo;{s.existingRule.keyword}&rdquo;, informando que o dinheiro vai para {target}.</>
            : <>Vou criar a regra <strong>Entre minhas contas</strong>: &ldquo;{s.keyword}&rdquo; em {origin} → {target}.</>}
          {' '}Ela é aplicada no histórico: {s.outflowsStillCounting > 0 && <>{plural(s.outflowsStillCounting, 'saída', 'saídas')} em {origin} e </>}{plural(s.entriesStillCounting, 'entrada', 'entradas')} em {target} deixam de somar em gastos e entradas. Importações futuras já chegam marcadas.
          {outsWithoutEntry > 0 && (
            <span className="block mt-1 text-xs text-amber-700 dark:text-amber-400">
              {plural(outsWithoutEntry, 'saída', 'saídas')} com esse texto não {outsWithoutEntry === 1 ? 'tem' : 'têm'} a entrada correspondente em {target} — para {outsWithoutEntry === 1 ? 'ela' : 'elas'}, o app lança a entrada em {target}, como faz com a fatura do cartão.
            </span>
          )}
        </Part>

        <Part title="O que não muda">
          Nenhum lançamento é apagado. Eles continuam no extrato, o saldo de cada conta fica igual e você pode desfazer depois.
        </Part>

        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
          {open ? 'Esconder' : 'Ver'} os {s.pairs.length} pares encontrados
        </button>
        {open && (
          <div className="rounded-xl border border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 max-h-72 overflow-y-auto">
            {s.pairs.map(({ out, entry }) => (
              <div key={out.id} className="px-3 py-2 flex items-center gap-3 text-xs">
                <span className="w-24 shrink-0 text-slate-400">{fmtDate(out.date)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-slate-600 dark:text-slate-300">Saiu de {origin}: {out.description}</span>
                  <span className="block truncate text-slate-400">Entrou em {target}: {entry.description}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums text-slate-700 dark:text-slate-200">{fmt(Number(out.amount))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onDismiss} disabled={busy} className="text-slate-500">Não sugerir de novo</Button>
        <Button variant="outline" size="sm" onClick={onSnooze} disabled={busy}>Agora não</Button>
        <Button size="sm" onClick={onApply} disabled={busy} className="gap-1.5">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Aplicar
        </Button>
      </div>
    </div>
  )
}

function AdjustmentsPage() {
  const { suggestions, applied, loading, error, decisionsLocal, apply, undo, snooze, dismiss } = useAdjustments()
  const { boards } = useTransactionBoards()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [banner, setBanner] = useState<Banner | null>(null)
  const name = (id: string) => boards.find(b => b.id === id)?.name.trim() ?? 'conta excluída'

  async function handleApply(s: PairSuggestion) {
    setBusyKey(s.key); setBanner(null)
    const { error: e, result } = await apply(s)
    setBusyKey(null)
    if (e && !result) { setBanner({ kind: 'error', text: e }); return }
    const total = (result?.marked ?? 0) + (result?.paired ?? 0)
    setBanner({
      kind: e ? 'error' : 'ok',
      text: e
        ? `Aplicado em parte: ${e}`
        : `Pronto: ${plural(total, 'lançamento deixou', 'lançamentos deixaram')} de somar em gastos e entradas.` +
          (result?.legs ? ` O app lançou ${plural(result.legs, 'entrada', 'entradas')} que faltava${result.legs === 1 ? '' : 'm'} em ${name(s.targetBoardId)}.` : ''),
      undoKey: s.key,
    })
  }

  async function handleUndo(key: string) {
    setBusyKey(key)
    const { error: e } = await undo(key)
    setBusyKey(null)
    setBanner(e ? { kind: 'error', text: `Não deu para desfazer: ${e}` } : { kind: 'ok', text: 'Desfeito: tudo voltou a ser como era antes.' })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Ajustes sugeridos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          O app cruza seus lançamentos e aponta o que pode estar distorcendo seus números. Nada muda até você aplicar, e tudo pode ser desfeito.
        </p>
      </div>

      {banner && (
        <div className={cn(
          'border rounded-xl p-4 flex items-start gap-3',
          banner.kind === 'ok' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
        )}>
          {banner.kind === 'ok' ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" /> : <X className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />}
          <p className={cn('flex-1 text-sm', banner.kind === 'ok' ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300')}>{banner.text}</p>
          {banner.undoKey && applied.some(a => a.key === banner.undoKey) && (
            <Button size="sm" variant="outline" onClick={() => handleUndo(banner.undoKey!)} disabled={!!busyKey} className="gap-1.5 shrink-0">
              <Undo2 className="h-3.5 w-3.5" /> Desfazer
            </Button>
          )}
          <button onClick={() => setBanner(null)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : loading ? (
        <div className="py-10 flex items-center justify-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cruzando seus lançamentos…
        </div>
      ) : suggestions.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-50 dark:bg-emerald-500/15"
          title="Nada para ajustar agora"
          description="Não encontrei dinheiro entre suas contas contando como gasto e ganho. A cada importação, o app confere de novo."
          primaryLabel="Ver minhas regras"
          primaryHref="/settings/rules"
        />
      ) : (
        <div className="space-y-4">
          {suggestions.map(s => (
            <SuggestionCard
              key={s.key}
              s={s}
              name={name}
              busy={busyKey === s.key}
              onApply={() => handleApply(s)}
              onSnooze={() => snooze(s)}
              onDismiss={() => dismiss(s)}
            />
          ))}
        </div>
      )}

      {applied.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Aplicados</h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {applied.map(({ key, undo: a }) => (
              <div key={key} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 dark:text-slate-200 truncate">&ldquo;{a.keyword}&rdquo; — {name(a.originBoardId)} → {name(a.targetBoardId)}</p>
                  <p className="text-xs text-slate-400">
                    {fmtDate(a.appliedAt.slice(0, 10))} · {plural(a.marked + a.paired, 'lançamento', 'lançamentos')} fora das somas
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleUndo(key)} disabled={!!busyKey} className="gap-1.5 shrink-0">
                  {busyKey === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Desfazer
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-start gap-1.5">
        <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          As regras criadas aqui ficam em <Link href="/settings/rules" className="underline">Regras automáticas → Entre minhas contas</Link>, onde você pode editar ou excluir.
          {decisionsLocal && ' Por enquanto, suas escolhas ("Agora não", "Não sugerir de novo") ficam salvas só neste aparelho.'}
        </span>
      </p>
    </div>
  )
}

export default withPlan(
  'rules',
  AdjustmentsPage,
  'O app cruza seus lançamentos e aponta o que está distorcendo seus números — e corrige com um clique.',
)
