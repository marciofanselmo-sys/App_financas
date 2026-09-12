'use client'

import { useRef, useState } from 'react'
import { TransactionBoard } from '@/types'
import { parseRICOXLSX, RICOData } from '@/utils/parse-rico'

type UpdateBoardFn = (id: string, data: Partial<Omit<TransactionBoard, 'id' | 'user_id' | 'created_at'>>) => void | Promise<void>

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

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError('')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        setPreview(parseRICOXLSX(ev.target?.result as ArrayBuffer))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao ler o arquivo.')
        setImportFor(null)
      } finally {
        setLoading(false)
      }
    }
    reader.onerror = () => {
      setError('Erro ao ler o arquivo.')
      setLoading(false)
      setImportFor(null)
    }
    reader.readAsArrayBuffer(file)
  }

  function confirm() {
    if (!importFor || !preview) return
    const prev = importFor.last_position_import
    const priorHistory = prev?.history ?? importFor.position_import_history ?? []
    const history = prev
      ? [...priorHistory, { patrimonio: prev.patrimonio, importedAt: prev.importedAt }]
      : [...priorHistory]
    const entry = { patrimonio: preview.patrimonio, importedAt: preview.importedAt }
    updateBoard(importFor.id, {
      last_position_import: {
        ...preview,
        history: [...history, entry].slice(-48),
      },
    })
    setImportFor(null)
    setPreview(null)
  }

  function cancel() {
    setPreview(null)
    setImportFor(null)
  }

  function dismissError() {
    setError('')
    setImportFor(null)
  }

  return { fileRef, importFor, preview, loading, error, open, handleFile, confirm, cancel, dismissError }
}
