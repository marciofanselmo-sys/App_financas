'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { TransactionType } from '@/types'
import { useCategories } from '@/hooks/use-categories'
import { Upload, Download, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { parseOFX } from '@/utils/parse-ofx'

// ─── CSV TEMPLATE ────────────────────────────────────────────────────────────

function downloadTemplate() {
  const rows = [
    ['descricao', 'valor', 'data', 'tipo', 'categoria'],
    ['Salário', '5000', '2026-06-01', 'receita', 'Salário'],
    ['Supermercado', '350.50', '2026-06-05', 'despesa', 'Alimentação'],
    ['Uber', '25.90', '2026-06-07', 'despesa', 'Transporte'],
  ]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'template_transacoes.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ─── CSV HELPERS ─────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  descricao: 'Descrição',
  valor: 'Valor (R$)',
  data: 'Data',
  tipo: 'Tipo (receita/despesa)',
  categoria: 'Categoria',
}

function guessCSVMapping(headers: string[]): Record<string, string> {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const patterns: Record<string, string[]> = {
    descricao: ['descricao', 'descr', 'historico', 'lancamento', 'nome', 'titulo', 'description', 'estabelecimento'],
    valor: ['valor', 'quantia', 'montante', 'amount', 'value', 'preco'],
    data: ['data', 'dt', 'date', 'vencimento', 'competencia'],
    tipo: ['tipo', 'type', 'natureza'],
    categoria: ['categoria', 'category', 'grupo', 'tag'],
  }
  const mapping: Record<string, string> = {}
  for (const [field, kws] of Object.entries(patterns)) {
    const idx = headers.findIndex(h => kws.some(k => norm(h).includes(k)))
    if (idx !== -1) mapping[field] = headers[idx]
  }
  return mapping
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  const br2 = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (br2) return `20${br2[3]}-${br2[2]}-${br2[1]}`
  return null
}

function normalizeType(raw: string): TransactionType | null {
  const s = raw.toLowerCase().trim()
  if (['receita', 'entrada', 'credito', 'crédito', 'credit', 'income', 'c'].some(k => s === k || s.includes(k))) return 'receita'
  if (['despesa', 'saida', 'saída', 'debito', 'débito', 'debit', 'expense', 'd'].some(k => s === k || s.includes(k))) return 'despesa'
  return null
}

function normalizeCategory(raw: string, categoryNames: string[]): string {
  const found = categoryNames.find(c => c.toLowerCase() === raw.trim().toLowerCase())
  return found ?? 'Outros'
}

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface PreviewRow {
  description: string
  amount: number
  date: string
  type: TransactionType
  category: string
  valid: boolean
  errors: string[]
}

interface ImportCSVModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

type Step = 'upload' | 'map' | 'preview' | 'done'
type FileType = 'ofx' | 'csv' | null

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export function ImportCSVModal({ open, onClose, onImported }: ImportCSVModalProps) {
  const { categories } = useCategories()
  const categoryNames = categories.map(c => c.name)
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [fileType, setFileType] = useState<FileType>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null)
  const [fileError, setFileError] = useState('')

  function reset() {
    setStep('upload')
    setFileType(null)
    setHeaders([])
    setRawRows([])
    setMapping({})
    setPreview([])
    setImporting(false)
    setImportResult(null)
    setFileError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleClose() { reset(); onClose() }

  // ── OFX ──
  function handleOFX(content: string) {
    try {
      const rows = parseOFX(content)
      if (!rows.length) { setFileError('Nenhuma transação encontrada no arquivo OFX.'); return }

      const preview: PreviewRow[] = rows.map(r => ({
        description: r.description,
        amount: r.amount,
        date: r.date,
        type: r.type,
        category: r.category,
        valid: true,
        errors: [],
      }))
      setPreview(preview)
      setFileType('ofx')
      setStep('preview')
    } catch {
      setFileError('Erro ao ler o arquivo OFX. Verifique se é um arquivo válido do seu banco.')
    }
  }

  // ── CSV ──
  function handleCSV(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: '',       // auto-detect , or ;
      complete: (results) => {
        if (!results.data.length) { setFileError('Arquivo vazio ou sem dados.'); return }
        const hs = results.meta.fields ?? []
        setHeaders(hs)
        setRawRows(results.data)
        setMapping(guessCSVMapping(hs))
        setFileType('csv')
        setStep('map')
      },
      error: () => setFileError('Erro ao ler CSV. Verifique o arquivo.'),
    })
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError('')

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'ofx' || ext === 'qfx') {
      const reader = new FileReader()
      reader.onload = ev => handleOFX(ev.target?.result as string)
      reader.onerror = () => setFileError('Erro ao ler o arquivo.')
      reader.readAsText(file, 'latin1')   // most Brazilian banks use latin1
    } else {
      handleCSV(file)
    }
  }

  // ── CSV → Preview ──
  function buildCSVPreview() {
    const rows: PreviewRow[] = rawRows.map(raw => {
      const errors: string[] = []
      const description = (mapping.descricao ? raw[mapping.descricao] : '').trim()
      if (!description) errors.push('Descrição vazia')

      const valorRaw = (mapping.valor ? raw[mapping.valor] : '').replace(',', '.').replace(/[^\d.]/g, '')
      const amount = parseFloat(valorRaw)
      if (isNaN(amount) || amount <= 0) errors.push('Valor inválido')

      const date = normalizeDate(mapping.data ? raw[mapping.data] : '') ?? ''
      if (!date) errors.push('Data inválida')

      const type = normalizeType(mapping.tipo ? raw[mapping.tipo] : '') ?? 'despesa'
      if (!mapping.tipo || !normalizeType(raw[mapping.tipo])) errors.push('Tipo não mapeado — assumido "despesa"')

      const category = normalizeCategory(mapping.categoria ? raw[mapping.categoria] : 'Outros', categoryNames)

      return { description, amount: isNaN(amount) ? 0 : amount, date, type, category, valid: errors.filter(e => !e.includes('assumido')).length === 0, errors }
    })
    setPreview(rows)
    setStep('preview')
  }

  // ── Import ──
  async function handleImport() {
    setImporting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const valid = preview.filter(r => r.valid)
    const BATCH = 100
    let success = 0, errors = 0

    for (let i = 0; i < valid.length; i += BATCH) {
      const batch = valid.slice(i, i + BATCH).map(r => ({
        user_id: user.id,
        description: r.description,
        amount: r.amount,
        date: r.date,
        type: r.type,
        category: r.category,
      }))
      const { error } = await supabase.from('transactions').insert(batch)
      if (error) errors += batch.length
      else success += batch.length
    }

    setImportResult({ success, errors })
    setImporting(false)
    setStep('done')
    onImported()
  }

  const validCount = preview.filter(r => r.valid).length
  const invalidCount = preview.filter(r => !r.valid).length

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar transações</DialogTitle>
        </DialogHeader>

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="border dark:border-slate-700 rounded-lg p-3 space-y-1">
                <p className="font-semibold text-blue-600">OFX / QFX</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs">Exportado diretamente do seu banco (Itaú, Bradesco, Nubank, Caixa…). Mais confiável — data, valor e tipo já vêm prontos.</p>
              </div>
              <div className="border dark:border-slate-700 rounded-lg p-3 space-y-1">
                <p className="font-semibold text-slate-700 dark:text-slate-200">CSV</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs">Planilhas do Excel/Google Sheets. Você precisará mapear as colunas manualmente.</p>
              </div>
            </div>

            <div
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Clique para selecionar o arquivo</p>
              <p className="text-xs text-slate-400 mt-1">Aceita <strong>.ofx</strong>, <strong>.qfx</strong> e <strong>.csv</strong></p>
              <input ref={fileRef} type="file" accept=".ofx,.qfx,.csv" className="hidden" onChange={handleFile} />
            </div>

            {fileError && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {fileError}
              </div>
            )}

            <div className="border-t dark:border-slate-700 pt-3">
              <p className="text-xs text-slate-400 mb-2">Usando CSV? Baixe o template com o formato esperado:</p>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 text-xs">
                <Download className="h-3.5 w-3.5" />
                Baixar template CSV
              </Button>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500">
              <strong>Como exportar OFX:</strong> No app do seu banco → Extrato → Exportar → formato OFX
            </p>
          </div>
        )}

        {/* STEP 2: CSV MAPPING */}
        {step === 'map' && fileType === 'csv' && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <FileText className="h-4 w-4" />
              <span>{rawRows.length} linhas encontradas · Mapeie as colunas abaixo</span>
            </div>

            <div className="space-y-3">
              {Object.entries(FIELD_LABELS).map(([field, label]) => (
                <div key={field} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 w-44 shrink-0">{label}</span>
                  <Select
                    value={mapping[field] ?? '__none__'}
                    onValueChange={v => setMapping(m => ({ ...m, [field]: v === '__none__' ? '' : v } as Record<string, string>))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— não mapear —</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg space-y-1">
              <p><strong>Categorias válidas:</strong> {categoryNames.join(', ')}</p>
              <p><strong>Datas aceitas:</strong> AAAA-MM-DD ou DD/MM/AAAA</p>
              <p><strong>Tipo:</strong> receita ou despesa</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('upload')} className="flex-1">Voltar</Button>
              <Button onClick={buildCSVPreview} className="flex-1" disabled={!mapping.descricao || !mapping.valor || !mapping.data}>
                Visualizar ({rawRows.length} linhas)
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: PREVIEW */}
        {step === 'preview' && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-50">
                ✓ {validCount} prontas para importar
              </Badge>
              {invalidCount > 0 && (
                <Badge className="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-50">
                  ✗ {invalidCount} com erro (ignoradas)
                </Badge>
              )}
              {fileType === 'ofx' && (
                <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-50">
                  OFX — categorias auto-detectadas
                </Badge>
              )}
            </div>

            <div className="border dark:border-slate-700 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-semibold w-6"></th>
                    <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-semibold">Descrição</th>
                    <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-semibold">Valor</th>
                    <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-semibold">Data</th>
                    <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-semibold">Tipo</th>
                    <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-semibold">Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className={`border-t dark:border-slate-700 ${row.valid ? '' : 'bg-red-50/50 dark:bg-red-900/10'}`}>
                      <td className="px-3 py-2">
                        {row.valid
                          ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          : <span title={row.errors.join(', ')}><AlertCircle className="h-3.5 w-3.5 text-red-500" /></span>}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200 max-w-[140px] truncate">{row.description}</td>
                      <td className="px-3 py-2 font-medium">
                        <span className={row.type === 'receita' ? 'text-green-600' : 'text-red-500'}>
                          R$ {row.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{row.date}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={`text-[10px] ${row.type === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                          {row.type}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{row.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {validCount === 0 && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                Nenhuma linha válida. {fileType === 'csv' ? 'Verifique o mapeamento de colunas.' : 'Verifique o arquivo OFX.'}
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(fileType === 'csv' ? 'map' : 'upload')} className="flex-1">Voltar</Button>
              <Button onClick={handleImport} disabled={importing || validCount === 0} className="flex-1">
                {importing ? 'Importando...' : `Importar ${validCount} transações`}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: DONE */}
        {step === 'done' && importResult && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <div>
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">Importação concluída!</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {importResult.success} transações importadas com sucesso
                {importResult.errors > 0 && ` · ${importResult.errors} falharam`}
              </p>
            </div>
            <Button onClick={handleClose} className="w-full max-w-xs">Ver transações</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
