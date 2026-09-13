import { z } from 'zod'

const transactionTypes = ['receita', 'despesa', 'transferencia'] as const
const transferDirections = ['entrada', 'saida'] as const

export const transactionInputSchema = z.object({
  description: z.string().trim().min(1, 'Informe a descrição.').max(500),
  amount: z.number().positive('Informe um valor válido.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.'),
  type: z.enum(transactionTypes),
  direction: z.enum(transferDirections).nullable().optional(),
  category: z.string().trim().min(1, 'Selecione uma categoria.').max(120),
  tags: z.array(z.string().trim().max(50)).max(20).optional().default([]),
  board_id: z.string().uuid().nullable().optional(),
  installment_current: z.number().int().positive().optional(),
  installment_total: z.number().int().positive().optional(),
}).superRefine((data, ctx) => {
  // Transferência sem direção não tem como mexer no saldo de conta nenhuma —
  // era assim que a linha virava um registro neutro e o saldo ficava errado.
  // No lançamento manual dá pra exigir a resposta, então exige.
  if (data.type === 'transferencia' && !data.direction) {
    ctx.addIssue({
      code: 'custom',
      path: ['direction'],
      message: 'Informe se o dinheiro saiu ou entrou nesta conta.',
    })
  }
})

export type TransactionInput = z.infer<typeof transactionInputSchema>

export function parseTransactionInput(data: unknown) {
  return transactionInputSchema.safeParse(data)
}
