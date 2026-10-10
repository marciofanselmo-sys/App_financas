/**
 * Caixa de entrada do NOBLI na Resend (recebimento de e-mails).
 *
 * A Resend guarda os e-mails que chegam ao domínio; aqui só listamos e
 * abrimos. "Lido" é nosso (tabela inbox_read), porque a Resend não tem.
 * Só roda no servidor. Usa RESEND_INBOX_API_KEY, uma chave "Full access"
 * separada: a RESEND_API_KEY do app é "Sending access" (só envia) e fica
 * assim, para um erro aqui nunca parar os e-mails de cadastro e pagamento.
 */
const API = 'https://api.resend.com/emails/receiving'

export interface EmailResumo {
  id: string
  from: string
  to: string[]
  subject: string
  created_at: string
  anexos: number
}

export interface EmailCompleto extends EmailResumo {
  cc: string[]
  reply_to: string[]
  html: string | null
  text: string | null
  attachments: { id: string; filename: string; content_type: string; size: number }[]
  raw_url: string | null
  /** Message-ID do e-mail, para a resposta entrar na mesma conversa. */
  message_id: string | null
}

export class InboxError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

async function chamar<T>(path: string): Promise<T> {
  const key = process.env.RESEND_INBOX_API_KEY ?? process.env.RESEND_API_KEY
  if (!key) throw new InboxError('Falta configurar RESEND_INBOX_API_KEY na Vercel.', 503)
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // Chave só de envio: a Resend responde 401/403 com "restricted_api_key".
    if (res.status === 401 || res.status === 403) {
      throw new InboxError(
        'A chave da Resend não tem permissão para ler e-mails recebidos. Crie uma chave "Full access" na Resend e salve na Vercel como RESEND_INBOX_API_KEY.',
        res.status,
      )
    }
    throw new InboxError(body?.message ?? `Resend respondeu ${res.status}`, 502)
  }
  return res.json() as Promise<T>
}

const lista = (v: unknown): string[] => Array.isArray(v) ? v.map(String) : v ? [String(v)] : []

/** Os e-mails mais recentes (até 100), do mais novo para o mais antigo. */
export async function listarRecebidos(limite = 100): Promise<EmailResumo[]> {
  const r = await chamar<{ data: Record<string, unknown>[] }>(`?limit=${limite}`)
  return (r.data ?? []).map(e => ({
    id: String(e.id),
    from: String(e.from ?? ''),
    to: lista(e.to),
    subject: String(e.subject ?? ''),
    created_at: String(e.created_at),
    anexos: Array.isArray(e.attachments) ? e.attachments.length : 0,
  })).sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function abrirRecebido(id: string): Promise<EmailCompleto> {
  const e = await chamar<Record<string, unknown>>(`/${encodeURIComponent(id)}`)
  const anexos = Array.isArray(e.attachments) ? e.attachments as EmailCompleto['attachments'] : []
  const raw = e.raw as { download_url?: string } | null | undefined
  return {
    id: String(e.id),
    from: String(e.from ?? ''),
    to: lista(e.to),
    cc: lista(e.cc),
    reply_to: lista(e.reply_to),
    subject: String(e.subject ?? ''),
    created_at: String(e.created_at),
    html: typeof e.html === 'string' ? e.html : null,
    text: typeof e.text === 'string' ? e.text : null,
    anexos: anexos.length,
    attachments: anexos.map(a => ({ id: a.id, filename: a.filename, content_type: a.content_type, size: a.size })),
    raw_url: raw?.download_url ?? null,
    message_id: typeof e.message_id === 'string' ? e.message_id : null,
  }
}
