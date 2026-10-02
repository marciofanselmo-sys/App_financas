'use client'

import { Tag, ArrowLeftRight, PiggyBank, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RuleKind = 'categorias' | 'entre' | 'aportes'

const KINDS: Record<RuleKind, {
  icon: LucideIcon; iconClass: string; bg: string; title: string
  what: string; when: string; example: string; effect: string
}> = {
  categorias: {
    icon: Tag, iconClass: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30',
    title: 'Regra de categoria',
    what: 'Decide em qual categoria um lançamento entra, pelo texto da descrição.',
    when: 'Para tudo que é gasto ou receita de verdade: mercado, aplicativo, salário, assinatura.',
    example: '"IFOOD" → Alimentação. Todo lançamento com IFOOD na descrição chega já em Alimentação.',
    effect: 'Muda só a categoria. O lançamento continua contando como gasto (ou receita).',
  },
  entre: {
    icon: ArrowLeftRight, iconClass: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-700',
    title: 'Regra entre minhas contas',
    what: 'Diz que um lançamento só mudou dinheiro de lugar entre contas suas.',
    when: 'Pagamento de fatura, TED da conta corrente para outra conta sua, dinheiro guardado.',
    example: '"PGTO FAT CARTAO" na conta C6 → entre minhas contas. A fatura não conta como gasto de novo.',
    effect: 'Tira o lançamento dos totais de gasto e receita. O saldo das contas não muda.',
  },
  aportes: {
    icon: PiggyBank, iconClass: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/30',
    title: 'Regra de aporte',
    what: 'Um tipo de "entre minhas contas" em que o destino é uma conta de investimento.',
    when: 'Quando o dinheiro sai da sua conta para a corretora, cripto ou previdência.',
    example: '"ENVIO DE TED" na conta C6 → aporte na Rico. A saída vira aporte e soma no valor da Rico.',
    effect: 'Tira dos gastos e soma como aporte na conta de investimento. O saldo das contas não muda.',
  },
}

/** Cartão no topo de cada aba: o que essa regra faz, quando usar, exemplo e efeito. */
export function RuleKindIntro({ kind }: { kind: RuleKind }) {
  const k = KINDS[kind]
  const Icon = k.icon
  return (
    <section className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-5">
      <div className="flex items-center gap-3">
        <span className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0', k.bg)}>
          <Icon className={cn('h-4 w-4', k.iconClass)} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{k.title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{k.what}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 mt-4">
        {[
          { l: 'Quando usar', t: k.when },
          { l: 'Exemplo', t: k.example },
          { l: 'O que muda', t: k.effect },
        ].map(b => (
          <div key={b.l} className="rounded-xl bg-slate-50 dark:bg-white/[0.04] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{b.l}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{b.t}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
