/**
 * Busca TODAS as páginas de uma consulta do Supabase.
 *
 * O Supabase corta o resultado em 1000 linhas por consulta — sem erro, sem
 * aviso, sem nada que denuncie o corte. Numa consulta ordenada por data
 * decrescente, some justamente o que é mais antigo.
 *
 * Isso já causou cinco bugs distintos neste app (14.5, 14.9, 14.10, 14.26,
 * 14.27), e o pior deles não exibia errado: a deduplicação da importação
 * concluía "essa transação não existe" porque a linha existente ficou fora do
 * corte, e gravava duplicata no banco.
 *
 * Uso:
 *   const { rows, error } = await selectAllPages<Linha>(() =>
 *     supabase.from('transactions').select('*').eq('user_id', id))
 *
 * A consulta é passada como FUNÇÃO porque cada página precisa de um builder
 * novo — reaproveitar o mesmo acumula `.range()` e devolve resultado errado.
 */
export async function selectAllPages<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: () => any,
): Promise<{ rows: T[]; error: { message: string } | null }> {
  const PAGE = 1000
  const rows: T[] = []

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1)
    if (error) return { rows, error }
    if (!data?.length) break
    rows.push(...(data as T[]))
    if (data.length < PAGE) break
  }

  return { rows, error: null }
}
