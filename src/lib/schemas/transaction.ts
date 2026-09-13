import { z } from 'zod'

const transactionTypes = ['receita', 'despesa'] as const

export const transactionInputSchema = z.object({
  description: z.string().trim().min(1, 'Informe a descrição.').max(500),
  amount: z.number().positive('Informe um valor válido.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.'),
  type: z.enum(transactionTypes),
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
