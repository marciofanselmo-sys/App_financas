'use client'

import { PLANS } from '@/lib/plans'
import { useSubscription } from '@/hooks/use-subscription'
import { refreshTrial, useTrial } from '@/hooks/use-trial'

/**
 * Depois do teste, no Grátis: todas as contas continuam visíveis, mas só uma
 * fica ativa (importar e editar). A pessoa escolhe qual; sem escolha, vale a
 * mais antiga. Só vale para quem fez o teste — quem já era Grátis antes não
 * muda nada.
 */
export function useContaAtiva(boards: { id: string; created_at: string }[]) {
  const { isPro, inTrial, loading } = useSubscription()
  const { trial } = useTrial()
  const limite = PLANS.free.maxBoards ?? 1
  const aplica = !loading && !isPro && !inTrial && !!trial && boards.length > limite
  const maisAntiga = [...boards].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]?.id ?? null
  const escolhida = trial?.conta_ativa && boards.some(b => b.id === trial.conta_ativa) ? trial.conta_ativa : maisAntiga
  return {
    aplica,
    ativaId: aplica ? escolhida : null,
    travada: (id: string) => aplica && id !== escolhida,
  }
}

/** Grava a conta ativa. Devolve a mensagem de erro, ou null. */
export async function escolherContaAtiva(boardId: string): Promise<string | null> {
  try {
    const r = await fetch('/api/teste/fim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contaAtiva: boardId }) })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) return body.erro ?? 'Não deu para salvar agora.'
    await refreshTrial()
    return null
  } catch {
    return 'Sem conexão. Tente de novo.'
  }
}
