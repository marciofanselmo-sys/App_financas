'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, BarChart2, FileText, Upload, ArrowLeftRight, PiggyBank, CalendarCheck, Target,
  CreditCard, RefreshCw, Repeat, Settings, Search, Lightbulb, Rocket, HelpCircle, Landmark,
  MessageSquare, ArrowRight, ChevronRight, X, type LucideIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  HELP_FAQ, HELP_FORMATS, HELP_SECTIONS, type HelpArticle, type HelpGroup, type HelpSection,
} from '@/lib/help-content'

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  analise: BarChart2,
  relatorios: FileText,
  importar: Upload,
  contas: ArrowLeftRight,
  investimentos: PiggyBank,
  planejamento: CalendarCheck,
  metas: Target,
  parcelas: CreditCard,
  recorrencias: RefreshCw,
  entre: Repeat,
  config: Settings,
}

const GROUPS: HelpGroup[] = ['Visão geral', 'Gestão', 'Acompanhamento e conta']

const START_STEPS: { title: string; text: string; section: string; article: string; label: string }[] = [
  { title: 'Crie suas contas', text: 'Uma por banco ou cartão. Informe o saldo inicial para bater com o banco.', section: 'contas', article: 'saldo-inicial', label: 'Contas e Cartões' },
  { title: 'Importe o extrato', text: 'OFX, CSV, PDF ou planilha. O app categoriza e detecta parcelas sozinho.', section: 'importar', article: 'como', label: 'Como importar' },
  { title: 'Ajuste as categorias', text: 'Corrigiu uma vez, vira regra: as próximas importações já chegam certas.', section: 'config', article: 'regras', label: 'Regras automáticas' },
  { title: 'Planeje e acompanhe', text: 'Limite por categoria, metas e fixos. O Dashboard junta tudo.', section: 'planejamento', article: '503020', label: 'Planejamento' },
]

const POPULAR: { label: string; section: string; article: string }[] = [
  { label: 'Importar extrato', section: 'importar', article: 'como' },
  { label: 'Pagamento de fatura', section: 'entre-contas', article: 'o-que' },
  { label: 'Saldo não bate', section: 'contas', article: 'saldo-inicial' },
  { label: 'Aportes', section: 'investimentos', article: 'aportes' },
  { label: 'Regras automáticas', section: 'config', article: 'regras' },
]

const cardCls = 'bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06]'

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// ── Corpo do artigo ──────────────────────────────────────────────────────────
function ArticleBody({ article }: { article: HelpArticle }) {
  return (
    <div className="space-y-2">
      {article.body.map((line, i) => {
        if (line.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-blue-500 mt-0.5 shrink-0">•</span>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{line.slice(2)}</p>
            </div>
          )
        }
        if (/^\d+\./.test(line)) {
          return (
            <div key={i} className="flex gap-2">
              <span className="h-5 w-5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {line.split('.')[0]}
              </span>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{line.replace(/^\d+\.\s*/, '')}</p>
            </div>
          )
        }
        if (line.startsWith('> ')) {
          return (
            <div key={i} className="bg-slate-50 dark:bg-white/[0.04] border-l-[3px] border-blue-500 rounded-r-lg px-3 py-2">
              <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">{line.slice(2)}</p>
            </div>
          )
        }
        return <p key={i} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{line}</p>
      })}
      {article.tip && (
        <div className="flex gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg px-3 py-2.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{article.tip}</p>
        </div>
      )}
      {article.link && (
        <Link
          href={article.link.href}
          className="inline-flex items-center gap-1.5 mt-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-2 text-xs font-semibold text-white transition-colors"
        >
          {article.link.label} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}

function SectionIcon({ section, size = 'md' }: { section: HelpSection; size?: 'md' | 'sm' }) {
  const Icon = ICONS[section.icon] ?? HelpCircle
  const [bg, ...text] = section.color.split(' ')
  return (
    <span className={cn('rounded-xl flex items-center justify-center shrink-0', bg, size === 'md' ? 'h-9 w-9' : 'h-7 w-7')}>
      <Icon className={cn(size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5', text.join(' '))} />
    </span>
  )
}

function Badge({ kind }: { kind: 'novo' | 'atualizado' }) {
  return kind === 'novo'
    ? <span className="text-[9px] font-bold uppercase tracking-wide bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full px-1.5 py-0.5">Novo</span>
    : <span className="text-[9px] font-bold uppercase tracking-wide bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-full px-1.5 py-0.5">Atualizado</span>
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function HelpPage() {
  const [search, setSearch] = useState('')
  const [sectionId, setSectionId] = useState(HELP_SECTIONS[0].id)
  const [articleId, setArticleId] = useState(HELP_SECTIONS[0].articles[0].id)
  const [faqOpen, setFaqOpen] = useState<number | null>(0)

  const section = HELP_SECTIONS.find(s => s.id === sectionId) ?? HELP_SECTIONS[0]
  const article = section.articles.find(a => a.id === articleId) ?? section.articles[0]

  function open(sec: string, art?: string) {
    const s = HELP_SECTIONS.find(x => x.id === sec)
    if (!s) return
    setSectionId(s.id)
    setArticleId(art ?? s.articles[0].id)
    setSearch('')
    setTimeout(() => document.getElementById('help-reader')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }

  // Busca em títulos, textos e dicas de todos os artigos (sem acento).
  const results = useMemo(() => {
    const q = norm(search.trim())
    if (q.length < 2) return null
    const out: { section: HelpSection; article: HelpArticle }[] = []
    for (const s of HELP_SECTIONS) {
      for (const a of s.articles) {
        const hay = norm([s.title, a.title, ...a.body, a.tip ?? ''].join(' '))
        if (hay.includes(q)) out.push({ section: s, article: a })
      }
    }
    return out
  }, [search])

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Central de ajuda</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Tudo o que o NOBLI faz, explicado com exemplos.</p>
      </div>

      {/* Busca */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder='Busque: "importar extrato", "pagamento de fatura", "aporte"…'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-white dark:bg-[#111c2d]"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Limpar busca">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span>Mais buscados:</span>
          {POPULAR.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => open(p.section, p.article)}
              className="rounded-full border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-2.5 py-1 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {results ? (
        <section className={cn(cardCls, 'p-5')}>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {results.length} resultado{results.length === 1 ? '' : 's'} para &ldquo;{search.trim()}&rdquo;
          </h2>
          {results.length === 0 ? (
            <p className="text-sm text-slate-400 mt-3">
              Nada encontrado. Tente: importar, fatura, aporte, parcela, meta, regra — ou mande sua dúvida em Sugestões.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.06]">
              {results.map(({ section: s, article: a }) => (
                <li key={`${s.id}:${a.id}`}>
                  <button type="button" onClick={() => open(s.id, a.id)} className="w-full flex items-center gap-3 py-3 text-left group">
                    <SectionIcon section={s} size="sm" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:underline">{a.title}</span>
                      <span className="block text-[11px] text-slate-400">{s.title}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {/* Comece por aqui */}
          <section className={cn(cardCls, 'p-5')}>
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Comece por aqui</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 ml-6">Quatro passos para deixar o app com a sua cara</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4">
              {START_STEPS.map((s, i) => (
                <div key={s.title} className="rounded-xl border border-slate-100 dark:border-white/[0.06] bg-gradient-to-b from-blue-50/50 to-white dark:from-white/[0.03] dark:to-transparent p-4">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-2.5">{s.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{s.text}</p>
                  <button type="button" onClick={() => open(s.section, s.article)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                    {s.label} <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Tópicos por grupo do menu */}
          <div className="space-y-4">
            {GROUPS.map(g => (
              <div key={g}>
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-2">{g}</p>
                <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-4">
                  {HELP_SECTIONS.filter(s => s.group === g).map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => open(s.id)}
                      className={cn(
                        cardCls,
                        'flex items-start gap-3 p-3 text-left transition-all hover:border-blue-200 dark:hover:border-blue-500/40',
                        s.id === sectionId && 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-100 dark:ring-blue-500/20',
                      )}
                    >
                      <SectionIcon section={s} />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.title}</span>
                          {s.badge && <Badge kind={s.badge} />}
                        </span>
                        <span className="block text-[11px] text-slate-400 mt-0.5 leading-snug">{s.summary}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Leitura: índice da seção + artigo */}
          <section id="help-reader" className={cn(cardCls, 'p-4 grid gap-4 md:grid-cols-[230px_minmax(0,1fr)] scroll-mt-20')}>
            <nav className="rounded-xl border border-slate-100 dark:border-white/[0.06] p-2.5 self-start">
              <p className="flex items-center gap-2 px-2 pb-2 text-xs font-bold text-[#0B2D6B] dark:text-slate-100">
                <SectionIcon section={section} size="sm" /> {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.articles.map(a => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setArticleId(a.id)}
                      className={cn(
                        'w-full text-left rounded-lg px-2.5 py-2 text-[13px] transition-colors',
                        a.id === article.id
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]',
                      )}
                    >
                      {a.title}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <article className="min-w-0 p-1">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{article.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5 mb-4">{section.title}</p>
              <ArticleBody article={article} />
            </article>
          </section>

          {/* FAQ + bancos e formatos */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
            <section className={cn(cardCls, 'p-5')}>
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Perguntas frequentes</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 ml-6">As dúvidas que mais aparecem</p>
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.06]">
                {HELP_FAQ.map((f, i) => (
                  <li key={f.q} className="py-3">
                    <button type="button" onClick={() => setFaqOpen(faqOpen === i ? null : i)} aria-expanded={faqOpen === i} className="w-full flex items-center justify-between gap-3 text-left">
                      <span className={cn('text-sm text-slate-700 dark:text-slate-200', faqOpen === i && 'font-semibold')}>{f.q}</span>
                      <ChevronRight className={cn('h-4 w-4 text-slate-400 shrink-0 transition-transform', faqOpen === i && 'rotate-90')} />
                    </button>
                    {faqOpen === i && (
                      <div className="mt-2 text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {f.a}
                        {f.link && (
                          <button type="button" onClick={() => open(f.link!.section, f.link!.article)} className="ml-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                            Ler mais →
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className={cn(cardCls, 'p-5')}>
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Bancos e formatos</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 ml-6">O que dá para importar hoje</p>
              <table className="w-full mt-3 text-xs">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wide text-slate-400 border-b border-slate-100 dark:border-white/[0.06]">
                    <th className="text-left font-semibold py-1.5">Banco</th>
                    <th className="text-left font-semibold py-1.5">Formato</th>
                  </tr>
                </thead>
                <tbody>
                  {HELP_FORMATS.map(f => (
                    <tr key={f.bank} className="border-b last:border-b-0 border-slate-50 dark:border-white/[0.04]">
                      <td className="py-2 text-slate-700 dark:text-slate-200">{f.bank}</td>
                      <td className="py-2">
                        <span className="flex flex-wrap items-center gap-1">
                          {f.formats.map(x => (
                            <span key={x} className="text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{x}</span>
                          ))}
                          {f.note && <span className="text-[11px] text-slate-400">{f.note}</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}

      {/* Não achou? */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg,#1d4ed8,#0B2D6B)' }}>
        <MessageSquare className="h-6 w-6 text-blue-100 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">Não achou o que procurava?</p>
          <p className="text-xs text-blue-100 mt-0.5">Mande sua dúvida — a resposta aparece em Sugestões.</p>
        </div>
        <Link href="/suggestions?tipo=duvida" className="self-start sm:self-auto rounded-lg bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 transition-colors">
          Enviar dúvida
        </Link>
      </div>
    </div>
  )
}
