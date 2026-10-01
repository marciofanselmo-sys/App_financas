import { BoardKind, TransactionBoard } from '@/types'

// Grupos da tela Contas e Cartões, na ordem em que aparecem. São os mesmos
// tipos da janela "Que tipo de conta?".
export const BOARD_KINDS: { key: BoardKind; label: string; group: string }[] = [
  { key: 'corrente', label: 'Conta corrente', group: 'Contas correntes' },
  { key: 'credito', label: 'Cartão de crédito', group: 'Cartões de crédito' },
  { key: 'digital', label: 'Carteira digital', group: 'Carteiras digitais' },
  { key: 'poupanca', label: 'Poupança', group: 'Poupança' },
  { key: 'dinheiro', label: 'Dinheiro físico', group: 'Dinheiro físico' },
  { key: 'outro', label: 'Outro', group: 'Outros' },
]

// Contas criadas antes de o tipo existir não têm `kind`: deduz pelo nome e
// pelo ícone escolhido. O usuário corrige em "Editar conta" se errar.
export function boardKind(board: Pick<TransactionBoard, 'kind' | 'icon' | 'name'>): BoardKind {
  if (board.kind) return board.kind
  const name = board.name.toLowerCase()
  if (board.icon === 'credit-card' || /cr[eé]dito|cart[aã]o|fatura/.test(name)) return 'credito'
  if (board.icon === 'piggy-bank' || /poupan/.test(name)) return 'poupanca'
  if (board.icon === 'coins' || board.icon === 'dollar-sign' || /esp[eé]cie|dinheiro/.test(name)) return 'dinheiro'
  if (/picpay|paypal|mercado ?pago|carteira digital|pagbank|ame\b/.test(name)) return 'digital'
  if (board.icon === 'building' || /conta|banco|ita[uú]|bradesco|nubank|santander|caixa|inter\b|c6/.test(name)) return 'corrente'
  return 'outro'
}
