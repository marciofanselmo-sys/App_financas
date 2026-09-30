'use client'

import { useEffect, useState } from 'react'
import { ArrowLeftRight, CheckCircle2, Pencil, Plus, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react'
import { CategorizationRule, MatchType, applyInternalRule } from '@/hooks/use-rules'
import { TransactionBoard } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const MATCH_LABELS: Record<MatchType, string> = {
  contains: 'Contém',
  starts_with: 'Começa com',
  ends_with: 'Termina com',
  exact: 'Igual a',
}

interface FormState {
  keyword: string
  matchType: MatchType
  scope: string   // '' = qualquer conta
  target: string  // '' = nenhuma (conta fora do app, ou só não somar)
}

const EMPTY: FormState = { keyword: '', matchType: 'contains', scope: '', target: '' }

type Result = { count: number; legs: number; error?: string }

/**
 * Regras "Entre minhas contas": em vez de categorizar, marcam o lançamento para
 * não somar em gasto nem ganho — o pagamento da fatura saindo da conta
 * corrente é o caso típico. Aplica no histórico ao salvar e mostra antes
 * quantos lançamentos vai pegar.
 */
export function InternalRulesSection({ rules, boards, createRule, updateRule, deleteRule }: {
  rules: CategorizationRule[]
  boards: TransactionBoard[]
  createRule: (keyword: string, category: string, extra?: Partial<CategorizationRule>) => Promise<CategorizationRule | undefined>
  updateRule: (id: string, data: Partial<CategorizationRule>) => Promise<{ ok: boolean; error?: string }>
  deleteRule: (id: string) => Promise<void>
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CategorizationRule | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [preview, setPreview] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CategorizationRule | null>(null)

  const boardName = (id?: string | null) => (id ? boards.find(b => b.id === id)?.name ?? 'conta excluída' : null)

  // "Encontrei N lançamentos" enquanto o usuário digita — só conta, não grava.
  useEffect(() => {
    if (!formOpen) return
    const keyword = form.keyword.trim()
    if (keyword.length < 3) { setPreview(null); return }
    let cancelled = false
    const t = setTimeout(async () => {
      const r = await applyInternalRule(
        { keyword, match_type: form.matchType, scope_board_id: form.scope || null, target_board_id: form.target || null },
        { dryRun: true },
      )
      if (!cancelled) setPreview(r.error ? null : r.count)
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [formOpen, form.keyword, form.matchType, form.scope, form.target])

  function openCreate() {
    setEditing(null); setForm(EMPTY); setPreview(null); setFormOpen(true)
  }
  function openEdit(r: CategorizationRule) {
    setEditing(r)
    setForm({ keyword: r.keyword, matchType: r.match_type, scope: r.scope_board_id ?? '', target: r.target_board_id ?? '' })
    setPreview(null)
    setFormOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setResult(null)
    const fields = {
      keyword: form.keyword.trim(),
      match_type: form.matchType,
      scope_board_id: form.scope || null,
      target_board_id: form.target || null,
    }
    if (editing) {
      const r = await updateRule(editing.id, fields)
      if (!r.ok || r.error === 'partial') {
        setSaving(false); setFormOpen(false)
        setResult({ count: 0, legs: 0, error: 'Não foi possível salvar. Rode a migração migration_rules_internal.sql no Supabase e tente de novo.' })
        return
      }
    } else {
      const saved = await createRule(fields.keyword, '', { ...fields, action: 'internal' })
      if (!saved) {
        setSaving(false); setFormOpen(false)
        setResult({ count: 0, legs: 0, error: 'Não foi possível criar a regra. Rode a migração migration_rules_internal.sql no Supabase e tente de novo.' })
        return
      }
    }
    const applied = await applyInternalRule(fields)
    setSaving(false)
    setFormOpen(false)
    setResult(applied)
  }

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-700">
              <ArrowLeftRight className="h-4 w-4 text-slate-500 dark:text-slate-300" />
            </div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Entre minhas contas</h2>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 ml-9">
            Lançamentos que só mudam dinheiro de lugar — como pagar a fatura do cartão pela conta corrente. Continuam na conta e no saldo, mas não somam em gastos, entradas, categorias, relatórios nem planejamento.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openCreate} className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" /> Nova
        </Button>
      </div>

      {result && (
        <div className={cn(
          'border rounded-xl p-4 flex items-start gap-3',
          result.error ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
        )}>
          {result.error
            ? <X className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />
            : <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-500" />}
          <div className="flex-1 text-sm">
            <p className={cn('font-semibold', result.error ? 'text-red-800 dark:text-red-300' : 'text-emerald-800 dark:text-emerald-300')}>
              {result.error ? 'Algo deu errado' : 'Regra salva!'}
            </p>
            <p className={cn('text-xs mt-0.5', result.error ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
              {result.error ?? (
                result.count === 0
                  ? 'Nenhum lançamento anterior combinou — a regra vale para as próximas importações.'
                  : `${result.count} lançamento${result.count === 1 ? '' : 's'} deixa${result.count === 1 ? '' : 'm'} de somar nos gastos.` +
                    (result.legs > 0 ? ` A conta de destino recebeu ${result.legs} crédito${result.legs === 1 ? '' : 's'} que faltava${result.legs === 1 ? '' : 'm'}.` : '')
              )}
            </p>
          </div>
          <button onClick={() => setResult(null)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {rules.length === 0 ? (
        <button
          onClick={openCreate}
          className="w-full text-left border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
        >
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Criar a primeira regra</p>
          <p className="text-xs text-slate-400 mt-0.5">Ex.: tudo que contém &ldquo;PGTO FAT CARTAO&rdquo; na conta corrente é pagamento do cartão.</p>
        </button>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
          {rules.map(rule => {
            const scope = boardName(rule.scope_board_id)
            const target = boardName(rule.target_board_id)
            return (
              <div key={rule.id} className={cn('flex items-center gap-3 px-4 py-3', !rule.active && 'opacity-50')}>
                <button onClick={() => updateRule(rule.id, { active: !rule.active })} className="shrink-0 text-slate-400 hover:text-blue-500 transition-colors">
                  {rule.active ? <ToggleRight className="h-5 w-5 text-blue-500" /> : <ToggleLeft className="h-5 w-5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded font-semibold">{rule.keyword}</span>
                    <span className="text-xs text-slate-400">({MATCH_LABELS[rule.match_type]})</span>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    {scope ? `Em ${scope}` : 'Em qualquer conta'}
                    {target ? ` → ${target}` : ' · só não soma'}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}>
                    <Pencil className="h-3 w-3 text-slate-400" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setDeleteTarget(rule)}>
                    <Trash2 className="h-3 w-3 text-slate-400" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={v => { if (!v) setFormOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar regra entre contas' : 'Nova regra entre contas'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de correspondência</Label>
                <Select value={form.matchType} onValueChange={v => setForm(f => ({ ...f, matchType: v as MatchType }))} items={MATCH_LABELS}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(MATCH_LABELS) as [MatchType, string][]).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="internal-keyword" className="text-xs">Texto</Label>
                <Input
                  id="internal-keyword"
                  placeholder="Ex: PGTO FAT CARTAO"
                  value={form.keyword}
                  onChange={e => setForm(f => ({ ...f, keyword: e.target.value.toUpperCase() }))}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Em qual conta acontece</Label>
              <Select value={form.scope} onValueChange={v => setForm(f => ({ ...f, scope: v ?? '' }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Qualquer conta" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Qualquer conta</SelectItem>
                  {boards.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Para qual conta vai o dinheiro</Label>
              <Select value={form.target} onValueChange={v => setForm(f => ({ ...f, target: v ?? '' }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Nenhuma — só não somar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma — só não somar</SelectItem>
                  {boards.filter(b => b.id !== form.scope).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400">
                Escolhendo o cartão, o app registra o pagamento nele também — assim a fatura aparece como paga.
              </p>
            </div>

            {preview !== null && (
              <p className="text-xs rounded-lg bg-slate-50 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300 px-3 py-2">
                {preview === 0
                  ? 'Nenhum lançamento já importado combina com isso.'
                  : `Encontrei ${preview} lançamento${preview === 1 ? '' : 's'} que ${preview === 1 ? 'vai' : 'vão'} deixar de somar nos gastos.`}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={form.keyword.trim().length < 3 || saving} className="flex-1">
                {saving ? 'Aplicando...' : editing ? 'Salvar' : 'Criar regra'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Excluir regra</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 dark:text-slate-400 pt-2">
            Excluir a regra <strong>&ldquo;{deleteTarget?.keyword}&rdquo;</strong>? Os lançamentos já marcados continuam fora das somas — para voltar a somar um deles, edite o lançamento.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={() => { deleteRule(deleteTarget!.id); setDeleteTarget(null) }} className="flex-1">Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
