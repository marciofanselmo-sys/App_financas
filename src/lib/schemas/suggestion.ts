import { z } from 'zod'

export const suggestionInputSchema = z.object({
  message: z
    .string()
    .trim()
    .min(3, 'Escreva pelo menos 3 caracteres.')
    .max(2000, 'Máximo de 2000 caracteres.'),
})

export type SuggestionInput = z.infer<typeof suggestionInputSchema>
