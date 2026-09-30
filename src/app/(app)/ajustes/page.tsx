'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, ArrowLeftRight, ArrowRight, Check, CheckCircle2, ChevronRight, Lightbulb, Loader2, Undo2, X } from 'lucide-react'
import { withPlan } from '@/components/plan/with-plan'
import { useAdjustments } from '@/hooks/use-adjustments'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { LateCreditGroup, PairSuggestion, SuggestionTx } from '@/lib/data-suggestions'
import { PAIRING_TOLERANCE_DAYS } from '@/lib/internal-counterpart'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (d: string) => format(new Date(`${d}T00:00:00`), "dd 'de' MMM yyyy", { locale: ptBR })
const fmtShort = (d: string) => format(new Date(`${d}T00:00:00`), 'dd/MM/yy', { locale: ptBR })
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const counts = (t: SuggestionTx) => !t.is_internal && !t.counterpart_board_id && !t.counterpart_of_id
const sum = (list: SuggestionTx[]) => list.reduce((s, t) => s + Number(t.amount), 0)
const SHOWN = 6

type Banner = { kind: 'ok' | 'error'; text: string; undoKey?: string }

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-semibold text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
        <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">{children}</div>
      </div>
    </div>
  )
}

/** Situação de um lado do par, hoje. */
function Status({ tx, kind }: { tx: SuggestionTx; kind: 'despesa' | 'receita' }) {
  return counts(tx)
    ? <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', kind === 'despesa' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400')}>
        soma como {kind}
      </span>
    : <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">já fora das somas</span>
}

function RuleField({ label, value, changedFrom }: { label: string; value: React.ReactNode; changedFrom?: string }) {
  return (
    <div className="flex items-baseline gap-2 py-1.5">
      <span className="w-40 shrink-0 text-xs text-slate-400">{label}</span>
      <span className="text-sm text-slate-700 dark:text-slate-200 min-w-0">
        {changedFrom !== undefined && <span className="line-through text-slate-400 mr-1.5">{changedFrom}</span>}
        {value}
      </span>
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
  const [showAll, setShowAll] = useState(false)
  const [showUnpaired, setShowUnpaired] = useState(false)
  const origin = name(s.originBoardId)
  const target = name(s.targetBoardId)
  const outsCounting = s.pairs.map(p => p.out).filter(counts)
  const entriesCounting = s.pairs.map(p => p.entry).filter(counts)
  const shown = showAll ? s.pairs : s.pairs.slice(0, SHOWN)
  const existing = s.existingRule
  const code = (t: string) => <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded">{t}</code>

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      {/* Cabeçalho: o que é e quanto distorce */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
            <ArrowLeftRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
              {origin} <ArrowRight className="h-3.5 w-3.5 text-slate-400" /> {target}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {s.onlyEntryMissing
                ? 'A saída já está fora das somas, mas a entrada do outro lado ainda conta como receita'
                : 'Dinheiro entre suas contas contando como gasto e como ganho'}
            </p>
          </div>
        </div>
        {(s.expenseThisYear > 0 || s.incomeThisYear > 0) && (
          <div className="flex flex-wrap gap-2 mt-3 ml-11">
            {s.expenseThisYear > 0 && (
              <span className="text-xs rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-1">
                <strong>{fmt(s.expenseThisYear)}</strong> a mais em despesas em {s.year}
              </span>
            )}
            {s.incomeThisYear > 0 && (
              <span className="text-xs rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1">
                <strong>{fmt(s.incomeThisYear)}</strong> a mais em receitas em {s.year}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-5">
        <Section n={1} title="Como encontrei">
          <ul className="space-y-1">
            {[
              <>Saída em <strong>{origin}</strong> e entrada em <strong>{target}</strong> — duas contas suas</>,
              <>Mesmo valor, centavo por centavo</>,
              <>No máximo {PAIRING_TOLERANCE_DAYS} dias entre a saída e a entrada</>,
              <>O texto da saída {code(s.keyword)} se repete em {plural(s.pairs.length, 'par', 'pares')} — não é coincidência de valor</>,
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> <span>{item}</span>
              </li>
            ))}
          </ul>
          {s.entryTexts.length > 0 && (
            <p className="text-xs text-slate-400 mt-1.5">
              Do outro lado, a entrada aparece como &ldquo;{s.entryTexts.join('” ou “')}&rdquo; — o texto da entrada não é usado para decidir, só o valor e a data.
            </p>
          )}
        </Section>

        <Section n={2} title={existing ? 'A regra que vou completar' : 'A regra que vou criar'}>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1 divide-y divide-slate-100 dark:divide-slate-700/60">
            <RuleField label="Tipo" value={<>Entre minhas contas <span className="text-slate-400">(não soma)</span></>} />
            <RuleField label="Texto da saída" value={<>contém {code(existing?.keyword ?? s.keyword)}</>} />
            <RuleField label="Em qual conta acontece" value={origin} />
            <RuleField
              label="Para qual conta vai"
              value={target}
              changedFrom={existing && existing.target_board_id !== s.targetBoardId ? (existing.target_board_id ? name(existing.target_board_id) : 'nenhuma') : undefined}
            />
            <RuleField
              label="Condição"
              value={<>só quando existir a entrada do mesmo valor em {target}, em até {PAIRING_TOLERANCE_DAYS} dias</>}
              changedFrom={existing ? 'qualquer saída com o texto' : undefined}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Fica salva em Regras automáticas → Entre minhas contas. Importações futuras já chegam marcadas.</p>
        </Section>

        <Section n={3} title="O que muda nos seus números">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/40 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">Lançamentos</th>
                  <th className="text-right font-semibold px-3 py-2">Valor</th>
                  <th className="text-left font-semibold px-3 py-2">Depois de aplicar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {outsCounting.length > 0 && (
                  <tr>
                    <td className="px-3 py-2">{plural(outsCounting.length, 'saída', 'saídas')} em {origin} <span className="text-red-500">somando como despesa</span></td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt(sum(outsCounting))}</td>
                    <td className="px-3 py-2 text-slate-500">saem das somas</td>
                  </tr>
                )}
                {entriesCounting.length > 0 && (
                  <tr>
                    <td className="px-3 py-2">{plural(entriesCounting.length, 'entrada', 'entradas')} em {target} <span className="text-green-600">somando como receita</span></td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt(sum(entriesCounting))}</td>
                    <td className="px-3 py-2 text-slate-500">saem das somas</td>
                  </tr>
                )}
                {s.unpairedOutflows.length > 0 && (
                  <tr>
                    <td className="px-3 py-2">{plural(s.unpairedOutflows.length, 'saída', 'saídas')} com o mesmo texto <strong>sem</strong> entrada em {target}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt(sum(s.unpairedOutflows))}</td>
                    <td className="px-3 py-2 text-slate-500">continuam somando</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Valores de todo o histórico. O que já está fora das somas não é mexido.</p>
        </Section>

        <Section n={4} title={`Os ${s.pairs.length} pares encontrados`}>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60">
            {shown.map(({ out, entry }) => (
              <div key={out.id} className="px-3 py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400">Saiu · {fmtShort(out.date)} · {origin}</p>
                    <p className="text-xs text-slate-700 dark:text-slate-200 truncate">{out.description}</p>
                    <Status tx={out} kind="despesa" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400">Entrou · {fmtShort(entry.date)} · {target}</p>
                    <p className="text-xs text-slate-700 dark:text-slate-200 truncate">{entry.description}</p>
                    <Status tx={entry} kind="receita" />
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200 shrink-0">{fmt(Number(out.amount))}</span>
              </div>
            ))}
          </div>
          {s.pairs.length > SHOWN && (
            <button onClick={() => setShowAll(v => !v)} className="mt-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
              {showAll ? 'Mostrar menos' : `Ver todos os ${s.pairs.length}`}
            </button>
          )}
          {s.unpairedOutflows.length > 0 && (
            <div className="mt-2">
              <button onClick={() => setShowUnpaired(v => !v)} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:underline">
                <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showUnpaired && 'rotate-90')} />
                {plural(s.unpairedOutflows.length, 'saída que fica', 'saídas que ficam')} como {s.unpairedOutflows.length === 1 ? 'está' : 'estão'} (sem entrada em {target})
              </button>
              {showUnpaired && (
                <div className="mt-1 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60">
                  {s.unpairedOutflows.map(t => (
                    <div key={t.id} className="px-3 py-1.5 flex items-center gap-3 text-xs">
                      <span className="w-16 shrink-0 text-slate-400">{fmtShort(t.date)}</span>
                      <span className="flex-1 min-w-0 truncate text-slate-600 dark:text-slate-300">{t.description}</span>
                      <span className="tabular-nums text-slate-600 dark:text-slate-300">{fmt(Number(t.amount))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>

        <Section n={5} title="O que não muda">
          Nenhum lançamento é apagado nem muda de valor ou categoria. Todos continuam no extrato, com uma tarja cinza &ldquo;Entre contas&rdquo;, e o saldo de cada conta fica igual. Dá para desfazer depois.
        </Section>
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

/**
 * Créditos que o app lançou por engano ao salvar uma regra (29–30/09/2026).
 * Remoção em dois cliques, com a lista à vista — é o único lugar da tela que
 * apaga lançamentos.
 */
function LateCreditsCard({ groups, name, onRemove }: {
  groups: LateCreditGroup[]
  name: (id: string) => string
  onRemove: (ids: string[]) => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const all = groups.flatMap(g => g.credits)
  return (
    <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-800 overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-start gap-3 border-b border-slate-100 dark:border-slate-700">
        <div className="h-8 w-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="h-4 w-4 text-red-500" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 dark:text-slate-100">Entradas lançadas por engano ao salvar uma regra</p>
          <p className="text-xs text-slate-400 mt-0.5">Isso mudou o saldo {groups.length === 1 ? 'desta conta' : 'destas contas'} — e não deveria</p>
        </div>
      </div>
      <div className="px-4 py-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
        <p>
          Ao salvar uma regra &ldquo;Entre minhas contas&rdquo; com conta de destino, o app lançava nessa conta a entrada de pagamentos
          antigos que não tinham par. Para faturas cujas compras não estão no app, isso criou créditos que não existem no banco.
          Já corrigimos o app: salvar uma regra agora só marca lançamentos, nunca cria.
        </p>
        {groups.map(g => (
          <div key={g.boardId}>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              {name(g.boardId)} · {plural(g.credits.length, 'entrada', 'entradas')} · saldo alterado em{' '}
              <span className={g.total >= 0 ? 'text-green-600' : 'text-red-500'}>{g.total >= 0 ? '+' : '−'}{fmt(Math.abs(g.total))}</span>
            </p>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60 max-h-64 overflow-y-auto">
              {g.credits.map(c => (
                <div key={c.id} className="px-3 py-1.5 flex items-center gap-3 text-xs">
                  <span className="w-16 shrink-0 text-slate-400">{fmtShort(c.date)}</span>
                  <span className="flex-1 min-w-0 truncate">{c.description}</span>
                  <span className="shrink-0 text-[11px] text-slate-400 hidden sm:inline">lançada em {c.created_at ? fmtShort(c.created_at.slice(0, 10)) : '—'}</span>
                  <span className="shrink-0 tabular-nums font-medium">{fmt(Number(c.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="text-xs text-slate-500">
          <strong>Remover</strong> apaga só essas {all.length} entradas criadas pelo app. Os pagamentos originais continuam na conta de
          origem, fora das somas, e o saldo {groups.length === 1 ? 'da conta volta' : 'das contas volta'} a ser o de antes.
        </p>
      </div>
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2 justify-end items-center">
        {confirming ? (
          <>
            <span className="text-xs text-slate-500 mr-auto">Remover {plural(all.length, 'entrada', 'entradas')}? Não dá para desfazer.</span>
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={busy}>Cancelar</Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              className="gap-1.5"
              onClick={async () => { setBusy(true); await onRemove(all.map(c => c.id)); setBusy(false); setConfirming(false) }}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirmar remoção
            </Button>
          </>
        ) : (
          <Button size="sm" variant="destructive" onClick={() => setConfirming(true)}>Remover {plural(all.length, 'entrada', 'entradas')}</Button>
        )}
      </div>
    </div>
  )
}

function AdjustmentsPage() {
  const { lateCredits, removeLateCredits, suggestions, hiddenSuggestions, unhide, applied, loading, error, decisionsLocal, apply, undo, snooze, dismiss } = useAdjustments()
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

      <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-900/15 px-4 py-3 text-xs text-blue-800 dark:text-blue-300 space-y-1">
        <p className="font-semibold">Como funciona</p>
        <p>Quando você passa dinheiro de uma conta sua para outra — pagar a fatura, mandar um PIX para você mesmo —, o extrato mostra uma saída de um lado e uma entrada do outro. Somadas, elas parecem gasto e ganho, mas o dinheiro só mudou de lugar.</p>
        <p>O app procura esses pares pelo <strong>valor igual</strong> e pela <strong>data próxima</strong> (até {PAIRING_TOLERANCE_DAYS} dias). Cada sugestão mostra a regra que será criada e cada lançamento que ela vai tocar, antes de você aplicar.</p>
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

      {!loading && lateCredits.length > 0 && (
        <LateCreditsCard
          groups={lateCredits}
          name={name}
          onRemove={async ids => {
            const { error: e, removed } = await removeLateCredits(ids)
            setBanner(e
              ? { kind: 'error', text: `Não deu para remover: ${e}` }
              : { kind: 'ok', text: `${plural(removed, 'entrada removida', 'entradas removidas')}. O saldo voltou ao que era antes.` })
          }}
        />
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
          title={hiddenSuggestions.length > 0 ? 'Nenhuma sugestão nova' : 'Nada para ajustar agora'}
          description={hiddenSuggestions.length > 0
            ? 'As que você ocultou estão logo abaixo — dá para trazer de volta e aplicar.'
            : 'Não encontrei dinheiro entre suas contas contando como gasto e ganho. A cada importação, o app confere de novo.'}
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

      {hiddenSuggestions.length > 0 && (
        <section className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Ocultadas</h2>
            <p className="text-xs text-slate-400">Sugestões que você escondeu. O problema continua nos dados — elas seguem somando como gasto e ganho.</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {hiddenSuggestions.map(({ suggestion: h, reason }) => (
              <div key={h.key} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 dark:text-slate-200 truncate">&ldquo;{h.keyword}&rdquo; — {name(h.originBoardId)} → {name(h.targetBoardId)}</p>
                  <p className="text-xs text-slate-400">
                    {reason.kind === 'snoozed' ? `"Agora não" — volta sozinha em ${fmtDate(reason.until)}` : '"Não sugerir de novo"'}
                    {h.expenseThisYear + h.incomeThisYear > 0 && ` · ${fmt(h.expenseThisYear + h.incomeThisYear)} a mais em gastos e ganhos de ${h.year}`}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => unhide(h.key)} className="shrink-0">Mostrar de novo</Button>
              </div>
            ))}
          </div>
        </section>
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
