'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'

/**
 * Oferta do teste de 7 dias para quem já é Grátis (e-mail B). Envio único:
 * primeiro mostra quantas pessoas recebem, e só envia depois da confirmação.
 */
export function OfertaTesteCard() {
  const [total, setTotal] = useState<number | null>(null)
  const [estado, setEstado] = useState<'parado' | 'contando' | 'confirmar' | 'enviando' | 'feito'>('parado')
  const [msg, setMsg] = useState<string | null>(null)

  const contar = async () => {
    setEstado('contando'); setMsg(null)
    const r = await fetch('/api/admin/oferta-teste')
    const b = await r.json().catch(() => ({}))
    if (!r.ok) { setEstado('parado'); setMsg(b.error ?? 'Não deu para contar.'); return }
    setTotal(b.total); setEstado(b.total > 0 ? 'confirmar' : 'feito')
    if (b.total === 0) setMsg('Ninguém para receber: todos os Grátis já fizeram o teste ou já receberam a oferta.')
  }
  const enviar = async () => {
    setEstado('enviando')
    const r = await fetch('/api/admin/oferta-teste', { method: 'POST' })
    const b = await r.json().catch(() => ({}))
    setEstado('feito')
    setMsg(r.ok ? `Enviados ${b.enviados} de ${b.total}.${b.falhas?.length ? ` ${b.falhas.length} falharam (veja Erros).` : ''}` : (b.error ?? 'Falhou.'))
  }

  return (
    <section className="nobli-card p-5">
      <div className="flex items-center gap-2.5">
        <div className="nobli-chip h-8 w-8 rounded-lg"><Mail className="h-4 w-4" /></div>
        <div>
          <p className="nobli-card-title">Oferta do teste para o Grátis</p>
          <p className="text-xs text-slate-500">E-mail único “Liberamos 7 dias do NOBLI completo” para quem é Grátis e nunca fez o teste.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        {estado === 'parado' && <button type="button" onClick={contar} className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-1.5 font-semibold">Ver quantos recebem</button>}
        {estado === 'contando' && <span className="text-slate-500">Contando…</span>}
        {estado === 'confirmar' && (
          <>
            <span><b>{total}</b> pessoa{total === 1 ? '' : 's'} recebe{total === 1 ? '' : 'm'}.</span>
            <button type="button" onClick={enviar} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 font-semibold">Enviar para {total}</button>
            <button type="button" onClick={() => setEstado('parado')} className="text-slate-500 hover:underline">Cancelar</button>
          </>
        )}
        {estado === 'enviando' && <span className="text-slate-500">Enviando… (pode levar alguns minutos)</span>}
        {msg && <span className="text-slate-600 dark:text-slate-300">{msg}</span>}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">A Resend do plano grátis manda até 100 e-mails por dia; acima disso, envie em dias diferentes — quem já recebeu não recebe de novo.</p>
    </section>
  )
}
