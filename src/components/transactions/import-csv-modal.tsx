'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CATEGORIES, Category, TransactionType } from '@/types'
import { Upload, Download, CheckCircle, AlertCircle, FileText } from 'lucide-react'

const TEMPLATE_HEADERS = ['descricao', 'valor', 'data', 'tipo', 'categoria']
const TEMPLATE_EXAMPLE = [
  ['Salário', '5000', '2026-06-01', 'receita', 'Salário'],
  ['Supermercado', '350.50', '2026-06-05', 'despesa', 'Alimentação'],
  ['Uber', '25.90', '2026-06-07', 'despesa', 'Transporte'],
  ['Freelance', '1200', '2026-06-10', 'receita', 'Freelance'],
]

const FIELD_LABELS: Record<string, string> = {
  descricao: 'Descrição',
  valor: 'Valor (R$)',
  data: 'Data (AAAA-MM-DD)',
  tipo: 'Tipo (receita/despesa)',
  categoria: 'Categoria',
}

function downloadTemplate() {
  const rows = [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'template_transacoes.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function guessMapping(headers: string[]): Record<string, string> {
  const normalized = headers.map(h => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
  const mapping: Record<string, string> = {}

  const patterns: Record<string, string[]> = {
    descricao: ['descricao', 'descr', 'historico', 'lancamento', 'nome', 'titulo', 'description'],
    valor: ['valor', 'quantia', 'montante', 'amount', 'value', 'preco', 'price'],
    data: ['data', 'dt', 'date', 'vencimento', 'competencia'],
    tipo: ['tipo', 'type', 'natureza', 'modalidade'],
    categoria: ['categoria', 'category', 'grupo', 'tag'],
  }

  for (const [field, keywords] of Object.entries(patterns)) {
    const idx = normalized.findIndex(h => keywords.some(k => h.includes(k)))
    if (idx !== -1) mapping[field] = headers[idx]
  }

  return mapping
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim()
  // AAAA-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD/MM/AAAA
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  // DD/MM/AA
  const br2 = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (br2) return `20${br2[3]}-${br2[2]}-${br2[1]}`
  return null
}

function normalizeType(raw: string): TransactionType | null {
  const s = raw.toLowerCase().trim()
  if (['receita', 'entrada', 'credito', 'crédito', 'credit', 'income'].some(k => s.includes(k))) return 'receita'
  if (['despesa', 'saida', 'saída', 'debito', 'débito', 'debit', 'expense'].some(k => s.includes(k))) return 'despesa'
  return null
}

function normalizeCategory(raw: string): Category {
  const s = raw.trim()
  const found = CATEGORIES.find(c => c.toLowerCase() === s.toLowerCase())
  return found ?? 'Outros'
}

interface PreviewRow {
  descricao: string
  valor: number
  data: string
  tipo: TransactionType
  categoria: Category
  valid: boolean
  errors: string[]
}

interface ImportCSVModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

type Step = 'upload' | 'map' | 'preview' | 'done'

export function ImportCSVModal({ open, onClose, onImported }: ImportCSVModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null)
  const [fileError, setFileError] = useState('')

  function reset() {
    setStep('upload')
    setHeaders([])
    setRawRows([])
    setMapping({})
    setPreview([])
    setImporting(false)
    setImportResult(null)
    setFileError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError('')

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data.length) {
          setFileError('Arquivo vazio ou sem dados.')
          return
        }
        const hs = results.meta.fields ?? []
        setHeaders(hs)
        setRawRows(results.data)
        setMapping(guessMapping(hs))
        setStep('map')
      },
      error: () => setFileError('Erro ao ler o arquivo. Verifique se é um CSV válido.'),
    })
  }

  function buildPreview() {
    const rows: PreviewRow[] = rawRows.map(raw => {
      const errors: string[] = []

      const descricao = (mapping.descricao ? raw[mapping.descricao] : '').trim()
      if (!descricao) errors.push('Descrição vazia')

      const valorRaw = (mapping.valor ? raw[mapping.valor] : '').replace(',', '.').replace(/[^\d.]/g, '')
      const valor = parseFloat(valorRaw)
      if (isNaN(valor) || valor <= 0) errors.push('Valor inválido')

      const dataRaw = mapping.data ? raw[mapping.data] : ''
      const data = normalizeDate(dataRaw)
      if (!data) errors.push(`Data inválida: "${dataRaw}"`)

      const tipoRaw = mapping.tipo ? raw[mapping.tipo] : ''
      const tipo = normalizeType(tipoRaw)
      if (!tipo) errors.push(`Tipo inválido: "${tipoRaw}"`)

      const categoriaRaw = mapping.categoria ? raw[mapping.categoria] : 'Outros'
      const categoria = normalizeCategory(categoriaRaw)

      return {
        descricao,
        valor: isNaN(valor) ? 0 : valor,
        data: data ?? '',
        tipo: tipo ?? 'despesa',
        categoria,
        valid: errors.length === 0,
        errors,
      }
    })

    setPreview(rows)
    setStep('preview')
  }

  async function handleImport() {
    setImporting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const valid = preview.filter(r => r.valid)
    const BATCH = 100
    let success = 0
    let errors = 0

    for (let i = 0; i < valid.length; i += BATCH) {
      const batch = valid.slice(i, i + BATCH).map(r => ({
        user_id: user.id,
        description: r.descricao,
        amount: r.valor,
        date: r.data,
        type: r.tipo,
        category: r.categoria,
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar transações via CSV</DialogTitle>
        </DialogHeader>

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4 pt-2">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">Como funciona:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-600 dark:text-blue-400">
                <li>Baixe o template ou use seu próprio CSV</li>
                <li>Mapeie as colunas do seu arquivo</li>
                <li>Revise e importe com um clique</li>
              </ol>
            </div>

            <Button variant="outline" onClick={downloadTemplate} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Baixar template CSV
            </Button>

            <div
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Clique para selecionar seu arquivo CSV</p>
              <p className="text-xs text-slate-400 mt-1">Suporte a arquivos exportados de bancos e planilhas</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </div>

            {fileError && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {fileError}
              </div>
            )}

            <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1">
              <p><strong>Categorias disponíveis:</strong> {CATEGORIES.join(', ')}</p>
              <p><strong>Formatos de data aceitos:</strong> AAAA-MM-DD ou DD/MM/AAAA</p>
              <p><strong>Tipo:</strong> receita ou despesa</p>
            </div>
          </div>
        )}

        {/* STEP 2: MAP */}
        {step === 'map' && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <FileText className="h-4 w-4" />
              <span>{rawRows.length} linhas encontradas no arquivo</span>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Associe as colunas do seu CSV aos campos do sistema. O mapeamento foi feito automaticamente onde possível.
            </p>

            <div className="space-y-3">
              {Object.entries(FIELD_LABELS).map(([field, label]) => (
                <div key={field} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 w-44 shrink-0">{label}</span>
                  <Select
                    value={mapping[field] ?? '__none__'}
                    onValueChange={v => setMapping(m => ({ ...m, [field]: v === '__none__' ? '' : v } as Record<string, string>))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione a coluna..." />
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

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep('upload')} className="flex-1">Voltar</Button>
              <Button
                onClick={buildPreview}
                className="flex-1"
                disabled={!mapping.descricao && !mapping.valor && !mapping.data}
              >
                Visualizar dados
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: PREVIEW */}
        {step === 'preview' && (
          <div className="space-y-4 pt-2">
            <div className="flex gap-3">
              <Badge className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-50">
                {validCount} válidas
              </Badge>
              {invalidCount > 0 && (
                <Badge className="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-50">
                  {invalidCount} com erro (serão ignoradas)
                </Badge>
              )}
            </div>

            <div className="border dark:border-slate-700 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"></th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Descrição</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Valor</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Data</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Tipo</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-t dark:border-slate-700 ${row.valid ? '' : 'bg-red-50/50 dark:bg-red-900/10'}`}
                    >
                      <td className="px-3 py-2">
                        {row.valid
                          ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          : <span title={row.errors.join(', ')}><AlertCircle className="h-3.5 w-3.5 text-red-500" /></span>
                        }
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200 max-w-[140px] truncate">{row.descricao}</td>
                      <td className="px-3 py-2 font-medium">
                        <span className={row.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}>
                          R$ {row.valor.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{row.data}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={`text-[10px] ${row.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                          {row.tipo}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{row.categoria}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {validCount === 0 && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                Nenhuma linha válida para importar. Verifique o mapeamento de colunas.
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('map')} className="flex-1">Voltar</Button>
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
