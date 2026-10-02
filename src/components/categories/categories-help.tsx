'use client'

import { useState } from 'react'
import {
  ChevronRight, Info, Tag, Layers, Compass, MoreVertical, AlertTriangle, Zap, Sparkles, RotateCcw, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function Item({ icon: Icon, iconClass, title, children }: { icon: LucideIcon; iconClass?: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="h-7 w-7 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center shrink-0">
        <Icon className={cn('h-3.5 w-3.5 text-slate-400', iconClass)} />
      </span>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        <strong className="text-slate-700 dark:text-slate-200">{title}</strong>{' '}{children}
      </p>
    </div>
  )
}

/** Explicação da tela de Categorias — no fim da página, recolhida (mesmo padrão das outras telas). */
export function CategoriesHelp() {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] p-4">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="w-full flex items-center gap-2 text-left">
        <ChevronRight className={cn('h-4 w-4 text-slate-400 shrink-0 transition-transform', open && 'rotate-90')} />
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Como funciona esta tela</h2>
      </button>

      {open && (
        <div className="grid gap-6 lg:grid-cols-2 mt-4">
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Como é organizado</p>
            <Item icon={Tag} iconClass="text-blue-600" title="Categoria › Subcategoria.">
              Cada lançamento fica numa categoria (Moradia) e, se quiser, numa subcategoria dentro dela (Aluguel).
              A subcategoria usa a cor e o ícone da categoria.
            </Item>
            <Item icon={Layers} title="Lançamentos.">
              Cada linha mostra quantas subcategorias e lançamentos a categoria tem. Quanto você gasta em cada uma
              fica na Análise — aqui é o lugar de organizar.
            </Item>
            <Item icon={Compass} iconClass="text-blue-600" title="Pilares 50/30/20.">
              Cada categoria de despesa é Essencial, Estilo de vida ou Futuro. O card de pilares mostra quais
              categorias estão em cada um — clique numa para mudar. Categoria sem pilar fica fora do 50/30/20.
            </Item>
            <Item icon={Sparkles} iconClass="text-violet-500" title="Eventos.">
              Uma etiqueta por cima da categoria (viagem, reforma): o lançamento continua na categoria e também soma no evento.
            </Item>
          </div>
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">O que dá para fazer</p>
            <Item icon={MoreVertical} title="Menu ⋮.">
              Nova subcategoria, editar (nome, cor, ícone, pilar), mover para outra categoria, separar uma categoria
              &ldquo;Ambos&rdquo; em despesa e receita, e excluir. Ao excluir, o que usava a categoria vai para &ldquo;Outros&rdquo;.
            </Item>
            <Item icon={AlertTriangle} iconClass="text-amber-500" title="Vale organizar.">
              Mostra o que falta arrumar — categorias sem pilar, subcategorias dentro de &ldquo;Outros&rdquo; e lançamentos
              em &ldquo;Outros&rdquo; — com um botão para resolver cada um.
            </Item>
            <Item icon={Zap} iconClass="text-amber-500" title="Reclassificar &ldquo;Outros&rdquo;.">
              Em &ldquo;Outros&rdquo;, os lançamentos aparecem agrupados por descrição. Escolha a categoria certa: todos com
              a mesma descrição mudam juntos e o app cria a regra para os próximos.
            </Item>
            <Item icon={RotateCcw} title="Restaurar padrões.">
              Recria as categorias padrão que estiverem faltando.
            </Item>
          </div>
        </div>
      )}
    </section>
  )
}
