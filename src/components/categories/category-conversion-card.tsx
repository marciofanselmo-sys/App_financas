'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, CategoryBucket, Subcategory } from '@/types'
import { planCategoryConversion, applyCategoryConversion } from '@/lib/category-conversion'
import { Button } from '@/components/ui/button'
import { Layers, Sparkles, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'

const BUCKET_LABEL: Record<CategoryBucket, string> = {
  essencial: 'Essencial',
  estilo: 'Estilo de vida',
  futuro: 'Futuro',
}

interface Props {
  categories: Category[]
  groups: Subcategory[]
  loading: boolean
  onDone: () => Promise<void> | void
}

/**
 * Conversão única para Categoria > Subcategoria. Aparece só para quem ainda
 * está no modelo antigo (sem a marca category_tree_v2) e só grava depois que
 * o usuário vê a prévia e confirma.
 */
export function CategoryConversionCard({ categories, groups, loading, onDone }: Props) {
  const [converted, setConverted] = useState<boolean | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
      setConverted(user?.user_metadata?.category_tree_v2 === true)
    })
  }, [])

  const plan = useMemo(() => planCategoryConversion(categories, groups), [categories, groups])

  if (done) {
    return (
      <div className="nobli-card p-4 flex items-center gap-3 text-sm text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        Pronto! Suas categorias agora estão organizadas em Categoria › Subcategoria.
      </div>
    )
  }

  if (loading || converted !== false || plan.empty || !userId) return null

  async function apply() {
    setApplying(true)
    setError('')
    const { error } = await applyCategoryConversion(createClient(), userId!, plan)
    setApplying(false)
    if (error) { setError(error); return }
    setDone(true)
    await onDone()
  }

  const newCount = plan.parents.filter(p => !p.existing).length

  return (
    <div className="nobli-card p-5 border-2 border-blue-200 dark:border-blue-800/60 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-100">Nova organização de categorias</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Suas categorias passam a ficar em dois níveis: <strong>Categoria › Subcategoria</strong>{' '}
            (ex.: Alimentação › Mercado). Nenhum lançamento é apagado. Depois você pode mover
            qualquer subcategoria para outra categoria.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {open ? 'Esconder prévia' : 'Ver como vai ficar'}
      </button>

      {open && (
        <div className="space-y-4">
          <ul className="space-y-2">
            {plan.parents.map(p => (
              <li key={p.name} className="rounded-xl border border-slate-200 dark:border-white/[0.08] p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</span>
                  {!p.existing && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">nova</span>
                  )}
                  {p.bucket && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {BUCKET_LABEL[p.bucket]}
                    </span>
                  )}
                </div>
                {p.children.length > 0 ? (
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                    {p.children.map((ch, i) => (
                      <span key={ch.name}>
                        {i > 0 && ', '}
                        {ch.name}
                        {!ch.existing && <span className="text-blue-600 dark:text-blue-400"> (nova)</span>}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">Sem subcategorias</p>
                )}
              </li>
            ))}
          </ul>

          {plan.events.length > 0 && (
            <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700/50 p-3 space-y-1.5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-700 dark:text-violet-300">
                <Sparkles className="h-4 w-4" /> Categorias isoladas viram eventos
              </p>
              <p className="text-sm text-violet-700 dark:text-violet-300">
                {plan.events.map(e => e.name).join(', ')}
              </p>
              <p className="text-xs text-violet-600/80 dark:text-violet-300/80">
                Os lançamentos continuam marcados com o evento (para você ver quanto gastou nele) e
                passam para <strong>Lazer › Viagens</strong>. Depois é só reclassificar o que quiser.
              </p>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
              {error} Pode tentar de novo: o que já foi feito não é repetido.
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {plan.parents.length} categorias{newCount > 0 ? ` (${newCount} novas)` : ''}
              {plan.events.length > 0 ? ` · ${plan.events.length} evento${plan.events.length > 1 ? 's' : ''}` : ''}
            </p>
            <Button onClick={apply} disabled={applying} className="gap-2">
              {applying ? 'Aplicando…' : 'Aplicar nova organização'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
