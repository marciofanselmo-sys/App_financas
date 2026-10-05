/**
 * Limites dos planos que o NOBLI usa hoje, para a aba Limites do Admin.
 * Conferidos em out/2026 nas páginas de preço de cada serviço — se um deles
 * mudar de plano ou de regra, é aqui que se ajusta.
 */
const MB = 1024 * 1024
const GB = 1024 * MB

export const VERCEL_PLANO: 'hobby' | 'pro' = 'hobby'

export const LIMITES = {
  supabaseDb:      { label: 'Banco de dados',          limite: 500 * MB,   unidade: 'bytes' },
  supabaseEgress:  { label: 'Tráfego (egress) no mês', limite: 5 * GB,     unidade: 'bytes' },
  supabaseMau:     { label: 'Usuários ativos no mês',  limite: 50_000,     unidade: 'n' },
  vercelTransfer:  { label: 'Transferência no mês',    limite: 100 * GB,   unidade: 'bytes' },
  vercelFunctions: { label: 'Execuções de funções',    limite: 1_000_000,  unidade: 'n' },
  resendMes:       { label: 'E-mails no mês',          limite: 3_000,      unidade: 'n' },
  resendDia:       { label: 'Maior dia do mês',        limite: 100,        unidade: 'n' },
} as const

export type LimiteKey = keyof typeof LIMITES

/** Valores que só existem nos painéis da Vercel/Supabase, digitados pelo admin. */
export const METRICAS_MANUAIS: { key: LimiteKey; onde: string; url: string }[] = [
  { key: 'supabaseEgress',  onde: 'painel do Supabase', url: 'https://supabase.com/dashboard/project/hemuwbzgxvvsepaupqzp/usage' },
  { key: 'vercelTransfer',  onde: 'painel da Vercel',   url: 'https://vercel.com/no-blesse/~/usage' },
  { key: 'vercelFunctions', onde: 'painel da Vercel',   url: 'https://vercel.com/no-blesse/~/usage' },
]

/** Verde até 60%, amarelo até 80%, vermelho acima. */
export function nivel(pct: number): 'ok' | 'atencao' | 'critico' {
  return pct < 60 ? 'ok' : pct < 80 ? 'atencao' : 'critico'
}

export function formatBytes(b: number): string {
  if (b >= GB) return `${(b / GB).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
  if (b >= MB) return `${(b / MB).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
  return `${Math.round(b / 1024).toLocaleString('pt-BR')} KB`
}

export function formatValor(key: LimiteKey, v: number): string {
  if (LIMITES[key].unidade === 'bytes') return formatBytes(v)
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} milhão`
  if (v >= 10_000) return `${Math.round(v / 1000).toLocaleString('pt-BR')} mil`
  return v.toLocaleString('pt-BR')
}
