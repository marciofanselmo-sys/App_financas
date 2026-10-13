'use client'

import { useEffect, useState } from 'react'
import { TransactionBoard, RICOPosition } from '@/types'
import { formatCurrency } from '@/components/investments/rico-position-summary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { todayISO } from '@/utils/local-date'
import { CRYPTO_IDS } from '@/lib/quotes'

type SaveManual = (board: TransactionBoard, value: number, date: string, positions?: RICOPosition[]) => Promise<{ error?: string }>

/**
 * "Atualizar valor": para contas sem planilha (cripto, previdência, Tesouro,
 * outra corretora) — o valor informado vira a posição atual da conta. Em
 * cripto dá para informar a QUANTIDADE (ex.: 0,05 BTC): o valor passa a andar
 * sozinho com o preço de hoje. Usado em Investimentos e na tela da conta.
 */
export function ManualValueDialog({ board, onClose, saveManual, saving }: {
  board: TransactionBoard | null
  onClose: () => void
  saveManual: SaveManual
  saving: boolean
}) {
  return (
    <Dialog open={!!board} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Atualizar valor — {board?.name}</DialogTitle></DialogHeader>
        {board && <ManualValueForm key={board.id} board={board} onClose={onClose} saveManual={saveManual} saving={saving} />}
      </DialogContent>
    </Dialog>
  )
}

function ManualValueForm({ board, onClose, saveManual, saving }: {
  board: TransactionBoard
  onClose: () => void
  saveManual: SaveManual
  saving: boolean
}) {
  const todayStr = todayISO()
  // Já guardada por quantidade: abre nela, com a moeda e a quantidade de antes.
  const coinPos = board.last_position_import?.source === 'manual'
    ? board.last_position_import.positions.find(p => p.ticker in CRYPTO_IDS)
    : undefined
  const [manualValue, setManualValue] = useState('')
  const [manualDate, setManualDate] = useState(todayStr)
  const [manualError, setManualError] = useState('')
  const [manualMode, setManualMode] = useState<'valor' | 'quantidade'>(coinPos ? 'quantidade' : 'valor')
  const [manualCoin, setManualCoin] = useState(coinPos?.ticker ?? 'BTC')
  const [manualQty, setManualQty] = useState(coinPos?.quantity ? String(coinPos.quantity).replace('.', ',') : '')
  const [coinPrice, setCoinPrice] = useState<{ coin: string; price: number } | null>(null)
  const parsedQty = parseFloat(manualQty.replace(',', '.'))
  const qtyValue = coinPrice && coinPrice.coin === manualCoin && parsedQty > 0 ? parsedQty * coinPrice.price : NaN
  const parsedManual = manualMode === 'quantidade' ? qtyValue : parseFloat(manualValue.replace(/\./g, '').replace(',', '.'))
  const manualPrev = board.last_position_import ?? null
  const manualMinDate = manualPrev ? manualPrev.importedAt.slice(0, 10) : undefined

  // Preço de hoje da moeda escolhida (sem preço, não deixa salvar por quantidade).
  useEffect(() => {
    let cancelled = false
    fetch(`/api/quotes?crypto=${manualCoin}`)
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        const price = json?.quotes?.[manualCoin]?.price
        if (!cancelled && price > 0) setCoinPrice({ coin: manualCoin, price })
      })
      .catch(() => { /* sem preço */ })
    return () => { cancelled = true }
  }, [manualCoin])

  function pickCoin(coin: string) {
    setManualCoin(coin)
  }

  async function confirmManual() {
    if (!(parsedManual >= 0) || !manualDate) return
    const positions: RICOPosition[] = manualMode === 'quantidade' && coinPrice
      ? [{
          ticker: manualCoin, quantity: String(parsedQty), value: parsedManual, lastPrice: coinPrice.price,
          category: 'Criptomoedas', subcategory: '', allocation: '100%', rentabilidade: '',
        }]
      : []
    const { error } = await saveManual(board, parsedManual, manualDate, positions)
    if (error) { setManualError(error); return }
    onClose()
  }

  return (
    <div className="space-y-4 pt-1">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Informe quanto vale esta conta hoje, como aparece no app do banco ou da corretora. O valor entra no seu patrimônio, na evolução e nas metas ligadas a esta conta.
      </p>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 dark:bg-white/[0.06] p-1 text-xs font-medium">
        {(['valor', 'quantidade'] as const).map(m => (
          <button key={m} type="button" onClick={() => setManualMode(m)}
            className={`rounded-md py-1.5 transition-colors ${manualMode === m ? 'bg-white dark:bg-[#111c2d] shadow-sm text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}>
            {m === 'valor' ? 'Valor em R$' : 'Quantidade de cripto'}
          </button>
        ))}
      </div>
      {manualMode === 'quantidade' && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[96px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="manual-coin" className="text-xs">Moeda</Label>
              <select id="manual-coin" value={manualCoin} onChange={e => pickCoin(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30">
                {Object.keys(CRYPTO_IDS).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manual-qty" className="text-xs">Quantidade</Label>
              <Input id="manual-qty" inputMode="decimal" placeholder="0,05" value={manualQty} onChange={e => setManualQty(e.target.value)} autoFocus />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            {coinPrice?.coin === manualCoin
              ? <>1 {manualCoin} = {formatCurrency(coinPrice.price)} hoje{parsedQty > 0 && <> · <strong className="text-slate-600 dark:text-slate-300">{formatCurrency(qtyValue)}</strong></>}. O valor desta conta passa a acompanhar o preço sozinho.</>
              : 'Buscando o preço de hoje…'}
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {manualMode === 'valor' ? (
          <div className="space-y-1.5">
            <Label htmlFor="manual-value" className="text-xs">Valor atual (R$)</Label>
            <Input id="manual-value" inputMode="decimal" placeholder="0,00" value={manualValue} onChange={e => setManualValue(e.target.value)} autoFocus />
          </div>
        ) : <div />}
        <div className="space-y-1.5">
          <Label htmlFor="manual-date" className="text-xs">Valor de</Label>
          <Input id="manual-date" type="date" value={manualDate} min={manualMinDate} max={todayStr} onChange={e => setManualDate(e.target.value)} />
        </div>
      </div>
      {manualPrev && parsedManual >= 0 && (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
          {formatCurrency(manualPrev.patrimonio)} ({new Date(manualPrev.importedAt).toLocaleDateString('pt-BR')}) → <strong>{formatCurrency(parsedManual)}</strong>
          <span className={parsedManual - manualPrev.patrimonio >= 0 ? 'text-green-600' : 'text-red-500'}>
            {' '}({parsedManual - manualPrev.patrimonio >= 0 ? '+' : '−'}{formatCurrency(Math.abs(parsedManual - manualPrev.patrimonio))})
          </span>
        </div>
      )}
      {(manualPrev?.positions?.length ?? 0) > 0 && manualPrev?.source !== 'manual' && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          Esta conta tem a lista de ativos da última planilha. Com um valor informado, a divisão por ativo deixa de aparecer — para tê-la de volta, use &ldquo;Importar posição&rdquo; com a planilha nova.
        </p>
      )}
      {manualError && <p className="text-xs text-red-500">{manualError}</p>}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button onClick={confirmManual} disabled={!(parsedManual >= 0) || !manualDate || saving} className="flex-1">
          {saving ? 'Salvando...' : 'Salvar valor'}
        </Button>
      </div>
    </div>
  )
}
