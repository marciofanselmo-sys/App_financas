'use client'

import { useRef, useState } from 'react'
import { TransactionBoard } from '@/types'
import { validateImportFile } from '@/lib/import-limits'
import { parseRICOXLSX, RICOData } from '@/utils/parse-rico'
import { syncGoalsLinkedToBoard } from '@/lib/goal-sync'

type UpdateBoardFn = (id: string, data: Partial<Omit<TransactionBoard, 'id' | 'user_id' | 'created_at'>>) => Promise<{ error: string | null }>

// Fluxo de "importar posição da carteira" (PosicaoDetalhada.xlsx) — usado
// tanto na lista de contas de investimento quanto na tela de detalhe da
// conta, sempre gravando no mesmo campo (board.last_position_import).
export function usePositionImport(updateBoard: UpdateBoardFn) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importFor, setImportFor] = useState<TransactionBoard | null>(null)
  const [preview, setPreview] = useState<RICOData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function open(board: TransactionBoard) {
    setImportFor(board)
    setPreview(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
    setTimeout(() => fileRef.current?.click(), 50)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const fileCheck = validateImportFile(file)
    if (!fileCheck.ok) {
      setError(fileCheck.error)
      setImportFor(null)
      return
    }

    setLoading(true)
    setError('')
    try {
      const buffer = await file.arrayBuffer()
      setPreview(await parseRICOXLSX(buffer))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ler o arquivo.')
      setImportFor(null)
    } finally {
      setLoading(false)
    }
  }

  async function confirm() {
    if (!importFor || !preview) return
    const prev = importFor.last_position_import
    const priorHistory = prev?.history ?? importFor.position_import_history ?? []
    const history = prev
      ? [...priorHistory, { patrimonio: prev.patrimonio, importedAt: prev.importedAt }]
      : [...priorHistory]
    const entry = { patrimonio: preview.patrimonio, importedAt: preview.importedAt }
    setLoading(true)
    const { error: saveError } = await updateBoard(importFor.id, {
      last_position_import: {
        ...preview,
        history: [...history, entry].slice(-48),
      },
    })
    setLoading(false)

    // Só fecha se o banco confirmou. Antes a gravação não era aguardada e o
    // modal fechava de qualquer jeito: uma falha desaparecia da tela junto com
    // ele, e o usuário ia embora achando que a posição tinha sido importada.
    // (14.11)
    if (saveError) {
      setError('Não foi possível salvar a posição importada. Tente novamente.')
      return
    }
    // Metas ligadas a esta conta acompanham o valor novo.
    await syncGoalsLinkedToBoard(importFor.id, importFor.name, preview.patrimonio, preview.importedAt)

    setImportFor(null)
    setPreview(null)
  }

  /**
   * "Atualizar valor": grava um valor informado à mão como a posição atual da
   * conta, no mesmo lugar da planilha — entra no patrimônio do Dashboard, nas
   * Metas ligadas e na evolução, e a posição anterior vai para o histórico.
   * Sem lista de ativos: a divisão por ativo só vem de uma planilha.
   */
  async function saveManual(board: TransactionBoard, value: number, date: string): Promise<{ error?: string }> {
    const prev = board.last_position_import
    const priorHistory = prev?.history ?? board.position_import_history ?? []
    const history = prev
      ? [...priorHistory, { patrimonio: prev.patrimonio, importedAt: prev.importedAt }]
      : [...priorHistory]
    const importedAt = new Date(`${date}T12:00:00`).toISOString()
    setLoading(true)
    const { error: saveError } = await updateBoard(board.id, {
      last_position_import: {
        patrimonio: value,
        totalInvestido: value,
        saldoDisponivel: 0,
        positions: [],
        proventos: [],
        importedAt,
        source: 'manual',
        history: [...history, { patrimonio: value, importedAt }].slice(-48),
      },
    })
    if (!saveError) await syncGoalsLinkedToBoard(board.id, board.name, value, importedAt)
    setLoading(false)
    return saveError ? { error: 'Não foi possível salvar o valor. Tente novamente.' } : {}
  }

  function cancel() {
    setPreview(null)
    setImportFor(null)
  }

  function dismissError() {
    setError('')
    setImportFor(null)
  }

  return { fileRef, importFor, preview, loading, error, open, handleFile, confirm, saveManual, cancel, dismissError }
}
