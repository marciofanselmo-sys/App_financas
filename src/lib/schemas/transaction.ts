import { z } from 'zod'

const transactionTypes = ['receita', 'despesa', 'transferencia'] as const

export const transactionInputSchema = z.object({
  description: z.string().trim().min(1, 'Informe a descrição.').max(500),
  amount: z.number().positive('Informe um valor válido.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.'),
  type: z.enum(transactionTypes),
  // Movimentação entre contas do próprio usuário: continua sendo receita ou
  // despesa (move o saldo), só não conta como renda nem gasto do mês.
  is_internal: z.boolean().optional().default(false),
  category: z.string().trim().min(1, 'Selecione uma categoria.').max(120),
  tags: z.array(z.string().trim().max(50)).max(20).optional().default([]),
  board_id: z.string().uuid().nullable().optional(),
  installment_current: z.number().int().positive().optional(),
  installment_total: z.number().int().positive().optional(),
})

export type TransactionInput = z.infer<typeof transactionInputSchema>

export function parseTransactionInput(data: unknown) {
  return transactionInputSchema.safeParse(data)
}
