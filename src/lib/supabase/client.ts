import { createBrowserClient } from '@supabase/ssr'
import { emitDemoBlocked, isDemoClient } from '@/lib/demo'

function baseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

type Client = ReturnType<typeof baseClient>

export function createClient(): Client {
  const client = baseClient()
  return isDemoClient() ? readOnly(client) : client
}

// ── Demonstração: só leitura ────────────────────────────────────────────────
// Na conta da demo, gravar não chega ao banco: devolve um erro e abre o
// convite para o teste grátis. O banco também recusa (migration_demo.sql).

const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete'])
const WRITE_RPCS = new Set(['diluir_transacao', 'criar_nota_fiscal', 'desfazer_diluicao'])
const DEMO_ERROR = { message: 'Demonstração: só para ver.', code: 'demo', details: '', hint: '' }

/** Builder falso: aceita qualquer encadeamento (.select().single()…) e responde com erro. */
function blocked(what: string): unknown {
  emitDemoBlocked(what)
  const result = { data: null, error: DEMO_ERROR, count: null, status: 403, statusText: 'demo' }
  const handler: ProxyHandler<() => unknown> = {
    get(_t, prop) {
      if (prop === 'then') return (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej)
      return () => proxy
    },
    apply() { return proxy },
  }
  const proxy: unknown = new Proxy(() => {}, handler)
  return proxy
}

function readOnly(client: Client): Client {
  const from = client.from.bind(client)
  const rpc = client.rpc.bind(client)
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => new Proxy(from(table), {
          get(qb, method, r) {
            if (typeof method === 'string' && WRITE_METHODS.has(method)) return () => blocked(`${method}:${table}`)
            const v = Reflect.get(qb, method, r)
            return typeof v === 'function' ? v.bind(qb) : v
          },
        })
      }
      if (prop === 'rpc') {
        return (fn: string, ...args: unknown[]) => (WRITE_RPCS.has(fn) ? blocked(`rpc:${fn}`) : (rpc as unknown as (...a: unknown[]) => unknown)(fn, ...args))
      }
      if (prop === 'auth') {
        const auth = target.auth
        return new Proxy(auth, {
          get(a, m, r) {
            if (m === 'updateUser') return async () => { emitDemoBlocked('auth:updateUser'); return { data: { user: null }, error: DEMO_ERROR } }
            const v = Reflect.get(a, m, r)
            return typeof v === 'function' ? v.bind(a) : v
          },
        })
      }
      if (prop === 'functions') {
        return { invoke: async () => { emitDemoBlocked('functions'); return { data: null, error: DEMO_ERROR } } }
      }
      if (prop === 'storage') {
        return { from: () => ({ upload: async () => { emitDemoBlocked('storage'); return { data: null, error: DEMO_ERROR } }, getPublicUrl: () => ({ data: { publicUrl: '' } }) }) }
      }
      const v = Reflect.get(target, prop, receiver)
      return typeof v === 'function' ? v.bind(target) : v
    },
  }) as Client
}
