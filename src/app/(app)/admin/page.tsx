'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Users, Activity, BarChart2, Clock, RefreshCw, Shield, Eye } from 'lucide-react'
import { format, subDays, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? ''
const ACTIVE_MINUTES = 15
const RETENTION_DAYS = 30

interface PageView {
  id: string
  user_id: string
  user_email: string
  page: string
  created_at: string
}

const PAGE_LABELS: Record<string, string> = {
  '/dashboard':              'Dashboard',
  '/analytics':              'Análise',
  '/reports':                'Relatórios',
  '/transactions':           'Contas e Cartões',
  '/planning':               'Planejamento',
  '/goals':                  'Metas',
  '/recurring':              'Cartões & Parcelas',
  '/fixos':                  'Recorrências',
  '/settings':               'Configurações',
  '/settings/categories':    'Categorias',
  '/settings/subcategories': 'Subcategorias',
  '/settings/rules':         'Regras Auto.',
  '/account':                'Conta',
  '/help':                   'Ajuda',
  '/admin':                  'Admin',
}

function pageLabel(page: string) {
  return PAGE_LABELS[page] ?? page
}

function fmt(n: number) { return n.toLocaleString('pt-BR') }

export default function AdminPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [views, setViews]           = useState<PageView[]>([])
  const [loading, setLoading]       = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Verifica autorização e carrega dados
  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.email !== ADMIN_EMAIL) {
      setAuthorized(false)
      setLoading(false)
      return
    }
    setAuthorized(true)

    // Cleanup: deleta registros com mais de 30 dias
    await supabase
      .from('admin_page_views')
      .delete()
      .lt('created_at', new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString())

    // Busca todos os views dos últimos 30 dias
    const { data } = await supabase
      .from('admin_page_views')
      .select('*')
      .gte('created_at', new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    setViews((data ?? []) as PageView[])
    setLastRefresh(new Date())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Redireciona se não autorizado
  useEffect(() => {
    if (authorized === false) router.replace('/dashboard')
  }, [authorized, router])

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
    for (const v of views) {
      const entry = map.get(v.page) ?? { views: 0, users: new Set() }
      entry.views++
      entry.users.add(v.user_id)
      map.set(v.page, entry)
    }
    return Array.from(map.entries())
      .map(([page, d]) => ({ page, views: d.views, users: d.users.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
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

  if (authorized === null || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!authorized) return null

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Painel Admin</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Atualizado às {format(lastRefresh, 'HH:mm:ss')} · últimos {RETENTION_DAYS} dias
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

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
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total usuários</span>
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{totalUsersEver}</p>
          <p className="text-xs text-slate-400 mt-0.5">30 dias</p>
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
        </div>
        {topPages.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm text-slate-400">Nenhum dado ainda. Navegue pelo app para gerar dados.</p>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            {topPages.map(({ page, views: v, users }) => {
              const pct = (v / (topPages[0]?.views || 1)) * 100
              return (
                <div key={page}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{pageLabel(page)}</span>
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

      {/* Aviso legal */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
        <strong className="text-slate-500 dark:text-slate-400">LGPD:</strong> Este painel registra apenas navegação de página (URL + timestamp + e-mail) para fins de operação e melhoria do serviço — base legal Art. 7º, II (execução de contrato). Dados retidos por {RETENTION_DAYS} dias. Acesso restrito ao administrador.
      </div>
    </div>
  )
}
