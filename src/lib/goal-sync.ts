import { createClient } from '@/lib/supabase/client'

/**
 * Meta ligada a uma conta de investimento acompanha o valor dela: sempre que
 * a conta ganha um valor novo (planilha importada ou "Atualizar valor"), as
 * metas ligadas a ela passam a ter esse valor — sem o usuário precisar clicar
 * em "Atualizar valor" na meta. Antes a meta era uma cópia que ficava velha.
 *
 * Só escreve em goals; não mexe na conta.
 */
export async function syncGoalsLinkedToBoard(
  boardId: string,
  boardName: string,
  patrimonio: number,
  importedAt: string,
): Promise<void> {
  const supabase = createClient()
  const { data } = await supabase
    .from('goals')
    .select('id, last_import')
    .eq('last_import->>source', 'board')
    .eq('last_import->>boardId', boardId)
  for (const row of data ?? []) {
    await supabase.from('goals').update({
      current_amount: patrimonio,
      last_import: { ...(row.last_import ?? {}), source: 'board', boardId, boardName, patrimonio, importedAt },
    }).eq('id', row.id)
  }
}
