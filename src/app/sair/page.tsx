import Image from 'next/image'
import { decodificar, tokenValido } from '@/lib/email/sair'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Cancelar inscrição · NOBLI' }

/** Página do link "Cancelar inscrição" dos e-mails de lembrete e oferta. */
export default async function SairPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams
  const email = q.e ? decodificar(q.e) : null
  const valido = !!email && !!q.t && tokenValido(email, q.t)

  let titulo: string
  let corpo: React.ReactNode
  if (q.ok) {
    titulo = 'Pronto, inscrição cancelada'
    corpo = <p>Você não vai mais receber lembretes e ofertas do NOBLI. Avisos da sua conta e de cobrança continuam chegando.</p>
  } else if (q.erro || !valido) {
    titulo = 'Não conseguimos cancelar por este link'
    corpo = <p>O link pode estar incompleto. Responda qualquer e-mail nosso com a palavra <b>SAIR</b> ou escreva para contato@noblifinance.com.br.</p>
  } else {
    titulo = 'Cancelar inscrição'
    corpo = (
      <>
        <p><b>{email}</b> vai parar de receber lembretes e ofertas do NOBLI. Avisos da sua conta e de cobrança continuam chegando.</p>
        <form method="post" action={`/api/email/sair?e=${encodeURIComponent(q.e!)}&t=${encodeURIComponent(q.t!)}`}>
          <button type="submit" className="mt-4 rounded-xl bg-[#2865E8] hover:bg-blue-700 text-white font-bold px-5 py-2.5">Cancelar inscrição</button>
        </form>
      </>
    )
  }

  return (
    <main className="min-h-screen bg-[#F7F9FC] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#E3E8F0] bg-white p-7 text-[#334155] space-y-3">
        <Image src="/nobli/email-logo.png" alt="NOBLI" width={150} height={47} />
        <h1 className="text-xl font-extrabold text-[#0D1E33] pt-2">{titulo}</h1>
        <div className="text-[15px] leading-relaxed space-y-2">{corpo}</div>
      </div>
    </main>
  )
}
