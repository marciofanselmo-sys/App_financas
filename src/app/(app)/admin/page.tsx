'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { selectAllPages } from '@/lib/supabase/select-all'
import { logSafeError } from '@/lib/supabase-error'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Users, Activity, BarChart2, Clock, RefreshCw, Shield, Eye, AlertTriangle } from 'lucide-react'
import { SuggestionsPanel } from '@/components/admin/suggestions-panel'
import { UsersPanel } from '@/components/admin/users-panel'
import { BusinessTab } from '@/components/admin/business-tab'
import { UsageTab } from '@/components/admin/usage-tab'
import { LimitsTab } from '@/components/admin/limits-tab'
import { ErrorsTab } from '@/components/admin/errors-tab'
import { agruparErros, ABERTOS, type AppError, type RegistroStatus } from '@/lib/admin/errors'
import { VERCEL_PLANO } from '@/lib/admin/limits'
import { format, subDays, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ACTIVE_MINUTES = 15
const RETENTION_DAYS = 30

interface PageView {
  id: string
  user_id: string
  user_email: string
  page: string
  created_at: string
}

const ABAS = [
  { id: 'geral',     label: 'Visão geral' },
  { id: 'negocio',   label: 'Negócio' },
  { id: 'usuarios',  label: 'Usuários' },
  { id: 'uso',       label: 'Uso por cliente' },
  { id: 'limites',   label: 'Limites' },
  { id: 'erros',     label: 'Erros' },
  { id: 'sugestoes', label: 'Sugestões' },
] as const
type Aba = typeof ABAS[number]['id']

const PAGE_LABELS: Record<string, string> = {
  '/dashboard':              'Dashboard',
  '/analytics':              'Análise',
  '/reports':                'Relatórios',
  '/transactions':           'Contas e Cartões',
  '/transactions/[conta]':   'Extrato de uma conta',
  '/investments':            'Investimentos',
  '/planning':               'Planejamento',
  '/goals':                  'Metas',
  '/recurring':              'Cartões & Parcelas',
  '/fixos':                  'Recorrências',
  '/settings':               'Configurações',
  '/settings/categories':    'Categorias',
  '/settings/subcategories': 'Subcategorias',
  '/settings/rules':         'Regras Auto.',
  '/settings/assinatura':    'Minha assinatura',
  '/account':                'Conta',
  '/help':                   'Ajuda',
  '/suggestions':            'Sugestões',
  '/admin':                  'Admin',
}

// Cada conta tem a própria URL (/transactions/<uuid>). Sem juntar, cada conta
// virava uma "página" diferente no ranking, com o id cru no lugar do nome.
function normalizePage(page: string) {
  return page.startsWith('/transactions/') ? '/transactions/[conta]' : page
}

/**
 * Telas que não entram no ranking: rotas antigas que hoje só redirecionam
 * (nunca registram visita) e o próprio painel, que é acesso do dono.
 */
const TELAS_FORA_DO_RANKING = ['/settings/subcategories', '/admin']

function pageLabel(page: string) {
  return PAGE_LABELS[normalizePage(page)] ?? page
}

function fmt(n: number) { return n.toLocaleString('pt-BR') }

// useSearchParams pede um Suspense em volta para a página poder ser montada.
export default function AdminPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><RefreshCw className="h-6 w-6 animate-spin text-slate-400" /></div>}>
      <AdminPainel />
    </Suspense>
  )
}

function AdminPainel() {
  const router = useRouter()
  const params = useSearchParams()
  const abaParam = params.get('aba')
  // A aba vive no estado da página; o endereço só acompanha. Antes o clique
  // fazia router.replace e esperava o Next buscar a página de novo no
  // servidor — quando essa busca demorava ou ficava na fila, a aba não mudava
  // e parecia que nenhum clique funcionava.
  const [aba, setAba] = useState<Aba>(() => ABAS.some(a => a.id === abaParam) ? abaParam as Aba : 'geral')
  const irPara = (id: Aba) => {
    setAba(id)
    window.history.replaceState(null, '', id === 'geral' ? '/admin' : `/admin?aba=${id}`)
  }

  const [refreshKey, setRefreshKey] = useState(0)
  const [statusErros, setStatusErros] = useState<RegistroStatus[]>([])
  const [statusUnavailable, setStatusUnavailable] = useState(false)
  const [sugestoesNovas, setSugestoesNovas] = useState(0)
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [views, setViews]           = useState<PageView[]>([])
  const [errors, setErrors]         = useState<AppError[]>([])
  const [errorsUnavailable, setErrorsUnavailable] = useState(false)
  const [viewsUnavailable, setViewsUnavailable]   = useState(false)
  const [loading, setLoading]       = useState(true)
  const [firstLoad, setFirstLoad]   = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Status de cada tipo de erro. Sem a tabela (migration não rodada), os erros
  // aparecem do mesmo jeito, só sem os botões de status.
  const carregarStatus = useCallback(async () => {
    const { data, error } = await createClient()
      .from('app_error_status')
      .select('*')
    setStatusUnavailable(!!error)
    setStatusErros((data as RegistroStatus[] | null) ?? [])
  }, [])

  // Verifica autorização e carrega dados
  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setAuthorized(false)
      setLoading(false)
      return
    }

    const { data: isAdmin } = await supabase.rpc('is_app_admin')
    if (!isAdmin) {
      setAuthorized(false)
      setLoading(false)
      router.replace('/dashboard')
      return
    }
    setAuthorized(true)

    // Cleanup: deleta registros com mais de 30 dias
    await supabase
      .from('admin_page_views')
      .delete()
      .lt('created_at', new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString())

    // Busca todos os views dos últimos 30 dias
    // Paginado: com o painel cortado em 1000 linhas, "usuários online" e
    // "páginas mais vistas" eram calculados sobre uma amostra parcial — e,
    // pela ordem decrescente, sempre a mais recente. (14.26)
    const { rows, error } = await selectAllPages<PageView>(() => supabase
      .from('admin_page_views')
      .select('*')
      .gte('created_at', new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false }))

    if (error) logSafeError('adminPageViews.load', error)
    setViewsUnavailable(!!error)
    setViews(rows)

    // Erros do app — mesma retenção de 30 dias dos page views.
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('app_errors').delete().lt('created_at', cutoff)
    const { rows: errRows, error: errLoad } = await selectAllPages<AppError>(() => supabase
      .from('app_errors')
      .select('id, user_id, created_at, context, message, code, route')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false }))
    // Não passa por logSafeError: se a própria tabela de erros falhar (ex:
    // migração ainda não rodada), registrar ali de novo não adiantaria nada.
    if (errLoad) console.error('[admin] app_errors indisponível:', errLoad.message)
    setErrorsUnavailable(!!errLoad)
    setErrors(errRows)
    await carregarStatus()

    // Número no submenu: sugestões que ninguém leu ainda.
    const { count } = await supabase
      .from('user_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'nova')
    setSugestoesNovas(count ?? 0)
    setLastRefresh(new Date())
    setLoading(false)
    setFirstLoad(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Redireciona se não autorizado
  useEffect(() => {
    if (authorized === false) router.replace('/dashboard')
  }, [authorized, router])

  const grupos = useMemo(() => agruparErros(errors, statusErros), [errors, statusErros])
  const errosAbertos = grupos.filter(g => ABERTOS.includes(g.status)).length

  // Métricas derivadas
  const now = useMemo(() => new Date(), [lastRefresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeUsers = useMemo(() => {
    const cutoff = new Date(now.getTime() - ACTIVE_MINUTES * 60 * 1000)
    const map = new Map<string, { email: string; page: string; last_seen: string }>()
    for (const v of views) {
      if (new Date(v.created_at) < cutoff) continue
      if (!map.has(v.user_id) || new Date(v.created_at) > new Date(map.get(v.user_id)!.last_seen)) {
        map.set(v.user_id, { email: v.user_email, page: v.page, last_seen: v.created_at })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.last_seen.localeCompare(a.last_seen))
  }, [views, now])

  const todayViews = useMemo(() => {
    const start = startOfDay(now)
    return views.filter(v => new Date(v.created_at) >= start)
  }, [views, now])

  const uniqueUsersToday = useMemo(() => {
    return new Set(todayViews.map(v => v.user_id)).size
  }, [todayViews])

  const totalUsersEver = useMemo(() => {
    return new Set(views.map(v => v.user_id)).size
  }, [views])

  const topPages = useMemo(() => {
    const map = new Map<string, { views: number; users: Set<string> }>()

    // Começa com todas as telas conhecidas em zero. Sem isso, o card só
    // mostrava o que alguém visitou — e "ninguém abriu Metas este mês" é
    // justamente a informação que falta para decidir o que melhorar.
    for (const page of Object.keys(PAGE_LABELS)) {
      if (!TELAS_FORA_DO_RANKING.includes(page)) map.set(page, { views: 0, users: new Set() })
    }

    for (const v of views) {
      const page = normalizePage(v.page)
      const entry = map.get(page) ?? { views: 0, users: new Set() }
      entry.views++
      entry.users.add(v.user_id)
      map.set(page, entry)
    }

    // Sem corte: eram 10 linhas para 19 telas, então metade do app ficava
    // invisível no painel.
    return Array.from(map.entries())
      .map(([page, d]) => ({ page, views: d.views, users: d.users.size }))
      .sort((a, b) => b.views - a.views || pageLabel(a.page).localeCompare(pageLabel(b.page)))
  }, [views])

  const last7Days = useMemo(() => {
    const days: { label: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const day = subDays(now, i)
      const start = startOfDay(day)
      const end   = new Date(start.getTime() + 24 * 60 * 60 * 1000)
      const count = views.filter(v => {
        const d = new Date(v.created_at)
        return d >= start && d < end
      }).length
      days.push({ label: format(day, 'EEE', { locale: ptBR }), count })
    }
    return days
  }, [views, now])

  const maxDay = Math.max(...last7Days.map(d => d.count), 1)

  if (authorized === null || firstLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!authorized) return null

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Painel Admin</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Atualizado às {format(lastRefresh, 'HH:mm:ss')} · últimos {RETENTION_DAYS} dias
            </p>
          </div>
        </div>
        <button
          onClick={() => { load(); setRefreshKey(k => k + 1) }}
          disabled={loading}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Sem a tabela, os cartões e gráficos abaixo mostram zero — que parece
          "ninguém usou" em vez de "não está sendo medido". */}
      {viewsUnavailable && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-5 py-4">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Os acessos não estão sendo registrados, então os números abaixo não valem. Rode{' '}
            <code className="font-mono">migration_admin_page_views_fix.sql</code> no Supabase.
          </p>
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <Activity className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Ativos agora</span>
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{activeUsers.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">últimos {ACTIVE_MINUTES} min</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Usuários hoje</span>
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{uniqueUsersToday}</p>
          <p className="text-xs text-slate-400 mt-0.5">{fmt(todayViews.length)} page views</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
              <Users className="h-4 w-4 text-violet-500" />
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Ativos no mês</span>
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{totalUsersEver}</p>
          <p className="text-xs text-slate-400 mt-0.5">usaram nos últimos 30 dias</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
              <Eye className="h-4 w-4 text-amber-500" />
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total views</span>
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{fmt(views.length)}</p>
          <p className="text-xs text-slate-400 mt-0.5">30 dias</p>
        </div>
      </div>

      {/* Submenu: cada aba tem endereço próprio (/admin?aba=erros) */}
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-white/10 -mx-4 px-4 sm:mx-0 sm:px-0" aria-label="Seções do painel">
        {ABAS.map(a => {
          const badge = a.id === 'erros' ? errosAbertos : a.id === 'sugestoes' ? sugestoesNovas : a.id === 'limites' && VERCEL_PLANO === 'hobby' ? '!' : 0
          const ativa = aba === a.id
          return (
            <button key={a.id} type="button" onClick={() => irPara(a.id)} aria-current={ativa ? 'page' : undefined}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 -mb-px border-b-2 text-sm transition-colors ${ativa
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium'}`}>
              {a.label}
              {!!badge && (
                <span className={`text-[10px] font-bold rounded-full px-1.5 py-px ${a.id === 'erros'
                  ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                  : a.id === 'limites' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                  : 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'}`}>{badge}</span>
              )}
            </button>
          )
        })}
      </nav>

      {aba === 'geral' && (<div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Usuários ativos agora */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Online agora</h2>
            <span className="ml-auto text-xs text-slate-400">últimos {ACTIVE_MINUTES} min</span>
          </div>

          {activeUsers.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-sm text-slate-400">Nenhum usuário ativo no momento</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {activeUsers.map(u => (
                <div key={u.email} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {u.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{u.email}</p>
                    <p className="text-xs text-slate-400 truncate">{pageLabel(u.page)}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                    <Clock className="h-3 w-3" />
                    {format(new Date(u.last_seen), 'HH:mm')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gráfico últimos 7 dias */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <BarChart2 className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Page views — últimos 7 dias</h2>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-end gap-2 h-32">
              {last7Days.map(d => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-slate-400">{d.count > 0 ? d.count : ''}</span>
                  <div
                    className="w-full rounded-t-md bg-blue-500 dark:bg-blue-600 transition-all duration-500 min-h-[2px]"
                    style={{ height: `${Math.max((d.count / maxDay) * 100, 2)}%` }}
                  />
                  <span className="text-[10px] text-slate-400 capitalize">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Páginas mais acessadas */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <BarChart2 className="h-4 w-4 text-violet-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Páginas mais acessadas — 30 dias</h2>
          <span className="ml-auto text-xs text-slate-400">{topPages.length} telas</span>
        </div>
        {topPages.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm text-slate-400">Nenhum dado ainda. Navegue pelo app para gerar dados.</p>
          </div>
        ) : (
          // Dez telas à vista e o resto no rolar: a lista inteira empurrava o
          // restante do painel para baixo, e as primeiras são as que importam
          // no dia a dia.
          <div className="p-5 space-y-3 max-h-[26rem] overflow-y-auto">
            {topPages.map(({ page, views: v, users }) => {
              const pct = (v / (topPages[0]?.views || 1)) * 100
              return (
                <div key={page}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={v === 0
                      ? 'text-sm text-slate-400 dark:text-slate-500'
                      : 'text-sm font-medium text-slate-700 dark:text-slate-200'}>
                      {pageLabel(page)}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{users} usuário{users !== 1 ? 's' : ''}</span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300 w-16 text-right">{fmt(v)} views</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </div>)}

      {aba === 'negocio' && <BusinessTab refreshKey={refreshKey} />}

      {aba === 'usuarios' && <UsersPanel key={refreshKey} enabled={authorized === true} />}

      {aba === 'uso' && <UsageTab refreshKey={refreshKey} />}

      {aba === 'limites' && <LimitsTab refreshKey={refreshKey} />}

      {aba === 'erros' && (
        <ErrorsTab
          grupos={grupos}
          errosIndisponiveis={errorsUnavailable}
          statusIndisponivel={statusUnavailable}
          onMudou={carregarStatus}
        />
      )}

      {aba === 'sugestoes' && <SuggestionsPanel key={refreshKey} enabled={authorized === true} />}


      {/* Aviso legal */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
        <strong className="text-slate-500 dark:text-slate-400">LGPD:</strong> Este painel registra apenas navegação de página (URL + timestamp + e-mail) para fins de operação e melhoria do serviço — base legal Art. 7º, II (execução de contrato). Dados retidos por {RETENTION_DAYS} dias. Acesso restrito ao administrador.
      </div>
    </div>
  )
}
