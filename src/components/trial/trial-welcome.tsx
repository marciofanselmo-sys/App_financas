'use client'

import { useEffect, useState } from 'react'
import { Hourglass } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { TRIAL_BASE_DAYS, TRIAL_MAX_BONUS_HOURS } from '@/lib/trial-config'

/**
 * Boas-vindas do teste, uma vez por conta (guardado no navegador). Explica o
 * relógio e a jornada antes de a pessoa começar.
 */
export function TrialWelcome({ userId }: { userId: string | null }) {
  const [aberto, setAberto] = useState(false)
  const chave = userId ? `nobli_teste_boasvindas_${userId}` : null

  useEffect(() => {
    if (!chave) return
    try { if (!localStorage.getItem(chave)) setAberto(true) } catch { /* sem storage: não mostra */ }
  }, [chave])

  const fechar = () => {
    setAberto(false)
    try { if (chave) localStorage.setItem(chave, '1') } catch { /* ok */ }
  }

  return (
    <Dialog open={aberto} onOpenChange={v => { if (!v) fechar() }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="nobli-gradient text-white px-6 py-5">
          <Hourglass className="h-7 w-7 opacity-90" />
          <DialogTitle className="text-xl font-extrabold mt-2">Seu teste de 7 dias começou</DialogTitle>
          <p className="text-sm opacity-85 mt-1">
            Você tem {TRIAL_BASE_DAYS} dias para conhecer o NOBLI e pode ganhar até {TRIAL_MAX_BONUS_HOURS / 24} dias extras completando a sua jornada.
          </p>
        </div>
        <div className="px-6 py-5 space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p><b className="text-slate-800 dark:text-slate-100">O relógio no topo</b> mostra quanto tempo falta.</p>
          <p><b className="text-slate-800 dark:text-slate-100">Cada tarefa da jornada</b> deixa seu dinheiro mais organizado e soma horas ao relógio. A primeira é criar a conta que você mais usa.</p>
          <p className="text-xs text-slate-500">No fim do teste nada é apagado. Você escolhe se assina ou continua no Grátis.</p>
          <button type="button" onClick={fechar} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 font-bold">
            Começar a jornada
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
