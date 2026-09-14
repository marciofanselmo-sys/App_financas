'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PiggyBank, Settings2, Loader2 } from 'lucide-react'
import { formatDashboardCurrency } from '@/lib/dashboard-patrimony'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

const QUICK_PCTS = [10, 20, 30, 40] as const

function calcTargetFromPct(income: number, pct: number) {
  if (income <= 0 || pct <= 0) return 0
  // Arredonda em CENTAVOS, não em reais. Math.round() jogava o valor para o
  // real mais próximo: 20% de R$ 3.333,00 virava R$ 667 em vez de R$ 666,60, e
  // o usuário via uma meta que não correspondia ao percentual que digitou.
  // (14.31)
  return Math.round((income * pct)) / 100
}

interface InvestMonthCardProps {
  monthlyIncome: number
  investmentTarget: number
  actualContributions?: number
  loading?: boolean
  saving?: boolean
  defaultInvestmentPct?: number
  onSaveTarget?: (target: number, pct: number) => Promise<{ error?: unknown } | void>
}

export function InvestMonthCard({
  monthlyIncome,
  investmentTarget,
  actualContributions = 0,
  loading,
  saving = false,
  defaultInvestmentPct = 20,
  onSaveTarget,
}: InvestMonthCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pctInput, setPctInput] = useState('')
  const [saveError, setSaveError] = useState('')

  const hasPlan = investmentTarget > 0
  const incomeBase = monthlyIncome > 0 ? monthlyIncome : 0
  const pct =
    incomeBase > 0 && hasPlan ? Math.round((investmentTarget / incomeBase) * 100) : null
  const contributionPct =
    hasPlan && investmentTarget > 0
      ? Math.min(999, Math.round((actualContributions / investmentTarget) * 100))
      : null

  const pctNum = parseFloat(pctInput.replace(',', '.'))
  const previewTarget =
    !isNaN(pctNum) && pctNum > 0 && incomeBase > 0 ? calcTargetFromPct(incomeBase, pctNum) : 0

  useEffect(() => {
    if (!dialogOpen) return
    if (pct != null && pct > 0) {
      setPctInput(String(pct))
    } else {
      setPctInput(String(defaultInvestmentPct))
    }
    setSaveError('')
  }, [dialogOpen, pct, defaultInvestmentPct])

  async function handleSave() {
    if (!onSaveTarget) return
    const n = parseFloat(pctInput.replace(',', '.'))
    if (isNaN(n) || n <= 0 || n > 100) {
      setSaveError('Informe um percentual entre 1 e 100.')
      return
    }
    if (incomeBase <= 0) {
      setSaveError('Registre receitas no mês para calcular a meta.')
      return
    }
    setSaveError('')
    const target = calcTargetFromPct(incomeBase, n)
    const result = await onSaveTarget(target, n)
    if (result?.error) {
      setSaveError(
        typeof result.error === 'string'
          ? result.error
          : (result.error as { message?: string })?.message || 'Erro ao salvar.',
      )
      return
    }
    setDialogOpen(false)
  }

  if (loading) {
    return (
      <div className="h-28 nobli-card animate-pulse" />
    )
  }

  return (
    <>
      <div className="nobli-gradient rounded-2xl p-5 shadow-[var(--nobli-shadow-m)] text-white">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-white/15 flex items-center justify-center">
              <PiggyBank className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Este mês</p>
              <p className="text-sm font-semibold">Investir</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasPlan && pct != null && (
              <span className="text-xs font-bold bg-white/15 px-2 py-1 rounded-lg">{pct}% da receita</span>
            )}
            {onSaveTarget && (
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="h-8 w-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                aria-label="Ajustar percentual a investir"
              >
                <Settings2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {hasPlan ? (
          <>
            <p className="text-2xl font-bold tabular-nums">{formatDashboardCurrency(investmentTarget)}</p>
            <p className="text-xs text-white/70 mt-1">
              {pct != null ? (
                <>
                  {pct}% × receita do mês
                  {incomeBase > 0 && <> ({formatDashboardCurrency(incomeBase)})</>}
                </>
              ) : (
                'Meta do planejamento'
              )}
            </p>
            {actualContributions > 0 && (
              <p className="text-xs text-white/90 mt-2 pt-2 border-t border-white/15">
                Aportado: <strong>{formatDashboardCurrency(actualContributions)}</strong>
                {contributionPct != null && <> · {contributionPct}% da meta</>}
              </p>
            )}
            {actualContributions === 0 && (
              <p className="text-[11px] text-white/60 mt-2">
                Aportes: dinheiro enviado para contas de investimento
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-white/90 leading-relaxed">
              {incomeBase > 0
                ? 'Defina quanto da receita deste mês quer investir.'
                : 'Registre receitas no mês para calcular a meta de investimento.'}
            </p>
            {onSaveTarget ? (
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                disabled={incomeBase <= 0}
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold bg-white/15 hover:bg-white/25 disabled:opacity-50 disabled:pointer-events-none px-3 py-1.5 rounded-lg transition-colors"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Definir % a investir
              </button>
            ) : (
              <Link
                href="/planning"
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Configurar planejamento
              </Link>
            )}
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Meta de investimento</DialogTitle>
            <DialogDescription>
              Percentual da receita do mês selecionado no dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div>
              <Label htmlFor="invest-pct" className="text-xs text-slate-500">
                % da receita a investir
              </Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Input
                  id="invest-pct"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={pctInput}
                  onChange={e => setPctInput(e.target.value)}
                  className="tabular-nums"
                />
                <span className="text-sm font-medium text-slate-500">%</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK_PCTS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPctInput(String(p))}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                    pctInput === String(p)
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/40 dark:text-emerald-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] p-3 text-sm">
              {incomeBase > 0 ? (
                <>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Receita do mês</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                    {formatDashboardCurrency(incomeBase)}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-3 mb-1">Meta calculada</p>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums text-lg">
                    {previewTarget > 0 ? formatDashboardCurrency(previewTarget) : '—'}
                  </p>
                  {previewTarget > 0 && pctNum > 0 && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      {pctNum}% × {formatDashboardCurrency(incomeBase)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Nenhuma receita neste mês. Importe ou lance entradas antes de definir a meta.
                </p>
              )}
            </div>

            {saveError && (
              <p className="text-xs text-red-500">{saveError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || incomeBase <= 0}
                className="gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar meta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
