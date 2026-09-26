import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Landing } from '@/components/landing/landing'

/**
 * Raiz do site. Quem já está logado vai direto para o app; quem não está vê
 * a página do produto — antes, todo visitante caía na tela de login sem
 * nunca ver o que o NOBLI faz, o que inviabilizava anúncio.
 */
export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  return <Landing />
}
