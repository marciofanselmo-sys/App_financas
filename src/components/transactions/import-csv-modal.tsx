'use client'

import { useState, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { TransactionType } from '@/types'
import { useCategories } from '@/hooks/use-categories'
import { useRules, applyUserRules } from '@/hooks/use-rules'
import { Upload, Download, CheckCircle, AlertCircle, FileText, Zap, Tag, ArrowRight, TrendingUp } from 'lucide-react'
import { parseOFX } from '@/utils/parse-ofx'
import { parseRICOXLSX } from '@/utils/parse-rico'
import { parseMercadoPagoPDF } from '@/utils/parse-mercadopago-pdf'

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

function uid() {
  return crypto.randomUUID()
}

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface PreviewRow {
  description: string
  amount: number
  date: string
  type: TransactionType
  category: string
  installment_current?: number | null
  installment_total?: number | null
  valid: boolean
  errors: string[]
}

interface ReviewItem {
  id: string
  description: string
  amount: number
  date: string
  type: TransactionType
  category: string
}

interface ImportCSVModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void
  boardId?: string
}

type Step = 'upload' | 'map' | 'preview' | 'review' | 'done'
type FileType = 'ofx' | 'csv' | 'c6-credit' | 'c6-checking' | 'rico-xlsx' | 'mercadopago-pdf' | null

// ─── GENERIC CSV HELPERS ─────────────────────────────────────────────────────

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

// ─── BANK PARSERS ────────────────────────────────────────────────────────────

function detectBankFormat(content: string): 'c6-credit' | 'c6-checking' | null {
  const firstLine = content.split('\n')[0].trim()
  if (firstLine.startsWith('EXTRATO DE CONTA CORRENTE C6 BANK')) return 'c6-checking'
  if (content.includes('Data de Compra') && content.includes('Parcela') && content.includes('Valor (em R$)')) return 'c6-credit'
  return null
}

const DESCRIPTION_PREFIX_RULES: Array<{ prefix: string; category: string }> = [
  { prefix: 'IFD*', category: 'iFood' },
]

function applyPrefixRules(description: string): string | null {
  const upper = description.toUpperCase()
  for (const rule of DESCRIPTION_PREFIX_RULES) {
    if (upper.startsWith(rule.prefix.toUpperCase())) return rule.category
  }
  return null
}

const DESCRIPTION_KEYWORD_RULES: Array<{ keyword: string; category: string }> = [
  { keyword: 'PAO & SONHO', category: 'Alimentação' },
  { keyword: 'BANNED BURGUER', category: 'Alimentação' },
  { keyword: 'IFOOD.COM', category: 'Alimentação' },
  { keyword: 'PADARIA CANDANGA', category: 'Alimentação' },
  { keyword: 'KAE CHOCOLATES', category: 'Alimentação' },
  { keyword: 'CASA ALVORADA', category: 'Alimentação' },
  { keyword: 'ALLSEU', category: 'Alimentação' },
  { keyword: 'CHARNECA', category: 'Alimentação' },
  { keyword: 'ALIEXPRESS', category: 'Aliexpress' },
  { keyword: 'APPLE.COM/BILL', category: 'Assinatura' },
  { keyword: 'APPLECOMBILL', category: 'Assinatura' },
  { keyword: 'DISNEY PLUS', category: 'Assinatura' },
  { keyword: 'PARAMOUNT', category: 'Assinatura' },
  { keyword: 'WALT DISNEY', category: 'Assinatura' },
  { keyword: 'SIAPI', category: 'Fies' },
  { keyword: 'ENVIO DE TED', category: 'Investimento' },
  { keyword: 'TERCEIRO SET SPORTS', category: 'Lazer' },
  { keyword: 'VIRTUS BEER', category: 'Lazer' },
  { keyword: 'CEMIG', category: 'Moradia' },
  { keyword: 'ZIP INTERNET', category: 'Moradia' },
  { keyword: 'FERNANDO AUGUSTO FERREIRA', category: 'Moradia' },
  { keyword: 'FONELIGHT', category: 'Moradia' },
  { keyword: 'GRUPO HOUMAX', category: 'Moradia' },
  { keyword: 'MARCIO FAGUNDES ANSELMO', category: 'Salário' },
  { keyword: 'ARAUJO LOJA', category: 'Saúde' },
  { keyword: 'DROGARIA WANESSA', category: 'Saúde' },
  { keyword: 'DROGARIAS PACHECO', category: 'Saúde' },
  { keyword: 'LOJAS REDE', category: 'Saúde' },
  { keyword: 'MICHELETTO', category: 'Saúde' },
  { keyword: 'RAISSA ALINE', category: 'Saúde' },
  { keyword: 'SIMPLES NACIONAL', category: 'Trabalho' },
  { keyword: 'TENIS COM CIENCIA', category: 'Trabalho' },
  { keyword: '99 TECNOLOGIA', category: 'Uber' },
  { keyword: 'UBER DO BRASIL', category: 'Uber' },
  { keyword: 'AIRBNB', category: 'Viagem' },
  { keyword: 'BLABLACAR', category: 'Viagem' },
  { keyword: 'BUSER', category: 'Viagem' },
]

function applyKeywordRules(description: string): string | null {
  const upper = description.toUpperCase()
  for (const rule of DESCRIPTION_KEYWORD_RULES) {
    if (upper.includes(rule.keyword.toUpperCase())) return rule.category
  }
  return null
}

function mapC6Category(raw: string): string {
  const s = (raw ?? '').toLowerCase()
  if (s.includes('supermercado') || s.includes('restaurante') || s.includes('alimenta') ||
      s.includes('lanchonete') || s.includes('padaria') || s.includes('conveni')) return 'Alimentação'
  if (s.includes('gasolina') || s.includes('combustív') || s.includes('transport') ||
      s.includes('estacionamento') || s.includes('pedágio') || s.includes('taxi') || s.includes('táxi')) return 'Transporte'
  if (s.includes('farmácia') || s.includes('drogaria') || s.includes('saúde') ||
      s.includes('clínica') || s.includes('médico') || s.includes('hospital') || s.includes('laborat')) return 'Saúde'
  if (s.includes('educacion') || s.includes('escola') || s.includes('curso') ||
      s.includes('livro') || s.includes('universidade') || s.includes('faculdade')) return 'Educação'
  if (s.includes('lazer') || s.includes('entretenimento') || s.includes('cinema') ||
      s.includes('jogo') || s.includes('streaming') || s.includes('esporte')) return 'Lazer'
  if (s.includes('moradia') || s.includes('aluguel') || s.includes('condomín') ||
      s.includes('energia') || s.includes('agua') || s.includes('internet')) return 'Moradia'
  return 'Outros'
}

function parseC6Credit(content: string): PreviewRow[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
  })

  return result.data
    .filter(row => {
      const desc = (row['Descrição'] ?? '').trim().toLowerCase()
      const valorStr = (row['Valor (em R$)'] ?? '').trim()
      if (!valorStr || valorStr === '0' || valorStr === '0.00') return false
      if (desc.includes('inclusao de pagamento') || desc.includes('inclusão de pagamento')) return false
      return true
    })
    .map(row => {
      const errors: string[] = []
      const description = (row['Descrição'] ?? '').trim()
      if (!description) errors.push('Descrição vazia')
      const dateRaw = (row['Data de Compra'] ?? '').trim()
      const date = normalizeDate(dateRaw) ?? ''
      if (!date) errors.push('Data inválida')
      const valorNum = parseFloat((row['Valor (em R$)'] ?? '0').trim())
      const amount = Math.abs(valorNum)
      if (isNaN(amount) || amount <= 0) errors.push('Valor inválido')
      const type: TransactionType = valorNum < 0 ? 'receita' : 'despesa'
      const category = applyPrefixRules(description) ?? applyKeywordRules(description) ?? mapC6Category(row['Categoria'] ?? '')
      let installment_current: number | null = null
      let installment_total: number | null = null
      const parcela = (row['Parcela'] ?? '').trim()
      const parcelaMatch = parcela.match(/^(\d+)\/(\d+)$/)
      if (parcelaMatch) {
        installment_current = parseInt(parcelaMatch[1])
        installment_total = parseInt(parcelaMatch[2])
      }
      return { description, amount: isNaN(amount) ? 0 : amount, date, type, category, installment_current, installment_total, valid: errors.length === 0, errors }
    })
}

function parseC6Checking(content: string): PreviewRow[] {
  const lines = content.split('\n')
  const headerIdx = lines.findIndex(l => l.trim().startsWith('Data Lançamento'))
  if (headerIdx === -1) return []
  const dataContent = lines.slice(headerIdx).join('\n')
  const result = Papa.parse<Record<string, string>>(dataContent, { header: true, delimiter: ',', skipEmptyLines: true })
  return result.data
    .filter(row => {
      const titulo = (row['Título'] ?? '').trim()
      if (titulo === 'SALDO DIA') return false
      const entrada = parseFloat(row['Entrada(R$)'] ?? '0')
      const saida = parseFloat(row['Saída(R$)'] ?? '0')
      if (entrada === 0 && saida === 0) return false
      return true
    })
    .map(row => {
      const errors: string[] = []
      const description = (row['Título'] ?? '').trim()
      if (!description) errors.push('Descrição vazia')
      const dateRaw = (row['Data Lançamento'] ?? '').split(' - ')[0].trim()
      const date = normalizeDate(dateRaw) ?? ''
      if (!date) errors.push('Data inválida')
      const entrada = parseFloat(row['Entrada(R$)'] ?? '0')
      const saida = parseFloat(row['Saída(R$)'] ?? '0')
      const type: TransactionType = entrada > 0 ? 'receita' : 'despesa'
      const amount = entrada > 0 ? entrada : saida
      if (isNaN(amount) || amount <= 0) errors.push('Valor inválido')
      return { description, amount: isNaN(amount) ? 0 : amount, date, type, category: applyPrefixRules(description) ?? applyKeywordRules(description) ?? 'Outros', valid: errors.length === 0, errors }
    })
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export function ImportCSVModal({ open, onClose, onImported, boardId }: ImportCSVModalProps) {
  const { categories } = useCategories()
  const { rules, createRule } = useRules()
  const categoryNames = categories.map(c => c.name)
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [fileType, setFileType] = useState<FileType>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; errors: number; duplicates: number } | null>(null)
  const [fileError, setFileError] = useState('')

  // Review state
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [reviewCategories, setReviewCategories] = useState<Record<string, string>>({})
  const [savingReview, setSavingReview] = useState(false)
  const [createRuleFor, setCreateRuleFor] = useState<{ itemId: string; description: string; category: string } | null>(null)
  const [newRuleKeyword, setNewRuleKeyword] = useState('')
  const [newRuleCategory, setNewRuleCategory] = useState('')
  const [savingRule, setSavingRule] = useState(false)
  const [duplicateItems, setDuplicateItems] = useState<ReviewItem[]>([])
  const [showDuplicates, setShowDuplicates] = useState(false)

  // Smart category suggestion: tries to match description words against category names
  function suggestCategory(description: string): string {
    const upper = description.toUpperCase()
    for (const cat of categories) {
      if (upper.includes(cat.name.toUpperCase()) && cat.name !== 'Outros') return cat.name
    }
    return 'Outros'
  }

  // Apply user-defined rules as last fallback (after prefix + keyword rules)
  const enhanceWithUserRules = useCallback((rows: PreviewRow[]): PreviewRow[] => {
    if (!rules.length) return rows
    return rows.map(r =>
      r.category === 'Outros'
        ? { ...r, category: applyUserRules(r.description, rules).category ?? 'Outros' }
        : r
    )
  }, [rules])

  function reset() {
    setStep('upload'); setFileType(null); setHeaders([]); setRawRows([]); setMapping({}); setPreview([])
    setImporting(false); setImportResult(null); setFileError('')
    setReviewItems([]); setReviewCategories({}); setCreateRuleFor(null)
    setDuplicateItems([]); setShowDuplicates(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleClose() { reset(); onClose() }

  // ── OFX ──
  function handleOFX(content: string) {
    try {
      const rows = parseOFX(content)
      if (!rows.length) { setFileError('Nenhuma transação encontrada no arquivo OFX.'); return }
      const preview: PreviewRow[] = rows.map(r => ({
        description: r.description, amount: r.amount, date: r.date, type: r.type,
        category: applyPrefixRules(r.description) ?? applyKeywordRules(r.description) ?? r.category,
        valid: true, errors: [],
      }))
      setPreview(enhanceWithUserRules(preview))
      setFileType('ofx')
      setStep('preview')
    } catch {
      setFileError('Erro ao ler o arquivo OFX. Verifique se é um arquivo válido do seu banco.')
    }
  }

  // ── CSV / bank detection ──
  function handleCSV(file: File) {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      const bankFormat = detectBankFormat(content)
      if (bankFormat === 'c6-credit') {
        const rows = parseC6Credit(content)
        if (!rows.length) { setFileError('Nenhuma transação encontrada na fatura C6.'); return }
        setPreview(enhanceWithUserRules(rows)); setFileType('c6-credit'); setStep('preview'); return
      }
      if (bankFormat === 'c6-checking') {
        const rows = parseC6Checking(content)
        if (!rows.length) { setFileError('Nenhuma transação encontrada no extrato C6.'); return }
        setPreview(enhanceWithUserRules(rows)); setFileType('c6-checking'); setStep('preview'); return
      }
      Papa.parse<Record<string, string>>(content, {
        header: true, skipEmptyLines: true, delimiter: '',
        complete: (results) => {
          if (!results.data.length) { setFileError('Arquivo vazio ou sem dados.'); return }
          const hs = results.meta.fields ?? []
          setHeaders(hs); setRawRows(results.data); setMapping(guessCSVMapping(hs)); setFileType('csv'); setStep('map')
        },
        error: () => setFileError('Erro ao ler CSV. Verifique o arquivo.'),
      })
    }
    reader.onerror = () => setFileError('Erro ao ler o arquivo.')
    reader.readAsText(file, 'utf-8')
  }

  // ── RICO / XP XLSX ──
  function handleRICOXLSX(buffer: ArrayBuffer, fileDate: string) {
    try {
      const ricoData = parseRICOXLSX(buffer)
      if (!ricoData.positions.length) {
        setFileError('Nenhuma posição encontrada no arquivo RICO. Verifique se é o PosicaoDetalhada.xlsx correto.')
        return
      }
      const rows: PreviewRow[] = ricoData.positions
        .filter(p => p.value > 0)
        .map(p => ({
          description: p.ticker,
          amount: p.value,
          date: fileDate,
          type: 'receita' as TransactionType,
          category: 'Investimento',
          valid: true,
          errors: [],
        }))
      if (!rows.length) {
        setFileError('Nenhuma posição com valor positivo encontrada no arquivo.')
        return
      }
      setPreview(rows)
      setFileType('rico-xlsx')
      setStep('preview')
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Erro ao ler o arquivo RICO.')
    }
  }

  // ── PDF (Mercado Pago) ──
  function handlePDF(file: File) {
    const reader = new FileReader()
    reader.onload = async (ev) => {
      setImporting(true)
      try {
        const buffer = ev.target?.result as ArrayBuffer
        const rows = await parseMercadoPagoPDF(buffer)
        if (!rows) {
          setFileError('Nenhuma transação encontrada no PDF. Verifique se é um Extrato de Conta do Mercado Pago.')
          return
        }
        setPreview(enhanceWithUserRules(rows.map(r => ({
          ...r,
          installment_current: null,
          installment_total: null,
        }))))
        setFileType('mercadopago-pdf')
        setStep('preview')
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (msg === 'empty-pdf') {
          setFileError('O PDF não contém texto extraível. Certifique-se de que não é um arquivo escaneado.')
        } else {
          setFileError('Erro ao processar o PDF. Verifique se o arquivo não está corrompido.')
        }
      } finally {
        setImporting(false)
      }
    }
    reader.onerror = () => setFileError('Erro ao ler o arquivo.')
    reader.readAsArrayBuffer(file)
  }

  // ── XLS / XLSX ──
  function handleXLS(file: File) {
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const buffer = ev.target?.result as ArrayBuffer
        const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })

        // Detect RICO / XP format by sheet name
        if (wb.SheetNames.includes('Sua carteira')) {
          const ws = wb.Sheets['Sua carteira']
          const rawRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })
          let fileDate = new Date().toISOString().split('T')[0]
          const headerCell = String(rawRows[0]?.[5] ?? '')
          const dateMatch = headerCell.match(/(\d{2})\/(\d{2})\/(\d{4})/)
          if (dateMatch) fileDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
          handleRICOXLSX(buffer, fileDate)
          return
        }

        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: false })
        if (!rows.length) { setFileError('Planilha vazia ou sem dados.'); return }
        const hs = Object.keys(rows[0])
        setHeaders(hs); setRawRows(rows); setMapping(guessCSVMapping(hs)); setFileType('csv'); setStep('map')
      } catch {
        setFileError('Erro ao ler o arquivo Excel. Verifique se não está corrompido.')
      }
    }
    reader.onerror = () => setFileError('Erro ao ler o arquivo.')
    reader.readAsArrayBuffer(file)
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
      reader.readAsText(file, 'latin1')
    } else if (ext === 'pdf') {
      handlePDF(file)
    } else if (ext === 'xls' || ext === 'xlsx') {
      handleXLS(file)
    } else {
      handleCSV(file)
    }
  }

  // ── Generic CSV → Preview ──
  function buildCSVPreview() {
    const rows: PreviewRow[] = rawRows.map(raw => {
      const errors: string[] = []
      const description = (mapping.descricao ? raw[mapping.descricao] : '').trim()
      if (!description) errors.push('Descrição vazia')
      const valorStr = (mapping.valor ? raw[mapping.valor] : '').trim().replace(',', '.')
      const valorNum = parseFloat(valorStr.replace(/[^\d.-]/g, ''))
      const amount = Math.abs(valorNum)
      if (isNaN(amount) || amount <= 0) errors.push('Valor inválido')
      const date = normalizeDate(mapping.data ? raw[mapping.data] : '') ?? ''
      if (!date) errors.push('Data inválida')
      let type: TransactionType
      const mappedType = mapping.tipo ? normalizeType(raw[mapping.tipo]) : null
      if (mappedType) { type = mappedType }
      else if (!isNaN(valorNum)) { type = valorNum < 0 ? 'receita' : 'despesa' }
      else { type = 'despesa'; errors.push('Tipo não mapeado — assumido "despesa"') }
      const category = applyPrefixRules(description) ?? applyKeywordRules(description) ?? normalizeCategory(mapping.categoria ? raw[mapping.categoria] : 'Outros', categoryNames)
      return { description, amount: isNaN(amount) ? 0 : amount, date, type, category, valid: errors.filter(e => !e.includes('assumido')).length === 0, errors }
    })
    setPreview(enhanceWithUserRules(rows))
    setStep('preview')
  }

  // ── Import with deduplication ──
  async function handleImport() {
    setImporting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setImporting(false); return }

    const { data: historyData } = await supabase
      .from('transactions').select('description, category').eq('user_id', user.id).neq('category', 'Outros')
    const historyMap = new Map<string, string>()
    for (const h of historyData ?? []) historyMap.set(h.description.toLowerCase(), h.category)

    const valid = preview.filter(r => r.valid).map(r => ({
      ...r,
      category: r.category === 'Outros' ? (historyMap.get(r.description.toLowerCase()) ?? r.category) : r.category,
    }))

    const BATCH = 100
    let success = 0, errors = 0, duplicates = 0
    const insertedOthers: ReviewItem[] = []

    for (let i = 0; i < valid.length; i += BATCH) {
      const batch = valid.slice(i, i + BATCH)
      const dates = [...new Set(batch.map(r => r.date))]

      const { data: existing } = await supabase
        .from('transactions').select('date, amount, description').eq('user_id', user.id).in('date', dates)
      const existingSet = new Set((existing ?? []).map(e => `${e.date}|${e.amount}|${e.description}`))

      const toInsert = batch.filter(r => !existingSet.has(`${r.date}|${r.amount}|${r.description}`))
      const dupBatch = batch.filter(r => existingSet.has(`${r.date}|${r.amount}|${r.description}`))
      for (const d of dupBatch) {
        const id = uid()
        insertedOthers.push({ id, description: d.description, amount: d.amount, date: d.date, type: d.type, category: '__duplicate__' })
      }
      duplicates += dupBatch.length
      if (!toInsert.length) continue

      // Build insert payload — track IDs separately so we only add to review AFTER confirmed insert
      const tracking = toInsert.map(r => ({ id: uid(), row: r }))
      const payload = tracking.map(({ id, row }) => ({
        id,
        user_id: user.id,
        description: row.description,
        amount: row.amount,
        date: row.date,
        type: row.type,
        category: row.category,
        board_id: boardId ?? null,
        tags: [],
        installment_current: row.installment_current ?? null,
        installment_total: row.installment_total ?? null,
      }))

      const { error } = await supabase.from('transactions').insert(payload)
      if (error) {
        console.error('[handleImport] insert error — message:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint)
        errors += toInsert.length
      } else {
        success += toInsert.length
        // Only track Outros items that were actually inserted
        for (const { id, row } of tracking) {
          if (row.category === 'Outros') {
            insertedOthers.push({ id, description: row.description, amount: row.amount, date: row.date, type: row.type, category: 'Outros' })
          }
        }
      }
    }

    setImportResult({ success, errors, duplicates })
    setImporting(false)
    onImported()

    const dups = insertedOthers.filter(i => i.category === '__duplicate__')
    const uncategorized = insertedOthers.filter(i => i.category !== '__duplicate__')

    setDuplicateItems(dups)

    // Only show review if there were actual successful inserts with uncategorized items
    if (uncategorized.length > 0 && success > 0) {
      setReviewItems(uncategorized)
      const initialCats: Record<string, string> = {}
      for (const item of uncategorized) initialCats[item.id] = suggestCategory(item.description)
      setReviewCategories(initialCats)
      setStep('review')
    } else {
      setStep('done')
    }
  }

  // ── Save review ──
  async function handleSaveReview() {
    setSavingReview(true)
    const supabase = createClient()
    const toUpdate = reviewItems.filter(item => reviewCategories[item.id] && reviewCategories[item.id] !== 'Outros')
    for (const item of toUpdate) {
      await supabase.from('transactions').update({ category: reviewCategories[item.id] }).eq('id', item.id)
    }
    setSavingReview(false)
    setStep('done')
  }

  // ── Create rule from review ──
  function openCreateRule(item: ReviewItem) {
    const suggested = item.description.trim().split(' ').slice(0, 2).join(' ').toUpperCase()
    setNewRuleKeyword(suggested)
    setNewRuleCategory(reviewCategories[item.id] !== 'Outros' ? reviewCategories[item.id] : '')
    setCreateRuleFor({ itemId: item.id, description: item.description, category: reviewCategories[item.id] })
  }

  async function handleSaveRule(e: React.FormEvent) {
    e.preventDefault()
    if (!newRuleKeyword || !newRuleCategory) return
    setSavingRule(true)
    await createRule(newRuleKeyword.trim().toUpperCase(), newRuleCategory)
    if (createRuleFor && newRuleCategory !== 'Outros') {
      setReviewCategories(prev => ({ ...prev, [createRuleFor.itemId]: newRuleCategory }))
    }
    setSavingRule(false)
    setCreateRuleFor(null)
  }

  const validCount = preview.filter(r => r.valid).length
  const invalidCount = preview.filter(r => !r.valid).length
  const othersCount = preview.filter(r => r.valid && r.category === 'Outros').length
  const isBankFormat = fileType === 'c6-credit' || fileType === 'c6-checking' || fileType === 'mercadopago-pdf'
  const bankFormatLabel: Record<string, string> = {
    'c6-credit': 'C6 Cartão de Crédito',
    'c6-checking': 'C6 Conta Corrente',
    'mercadopago-pdf': 'Mercado Pago — Extrato de Conta',
  }
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar transações</DialogTitle>
          </DialogHeader>

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="border dark:border-slate-700 rounded-lg p-3 space-y-1">
                  <p className="font-semibold text-blue-600">OFX / QFX</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">Exportado do banco. Mais confiável — data, valor e tipo já prontos.</p>
                </div>
                <div className="border dark:border-slate-700 rounded-lg p-3 space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">CSV / XLSX</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">C6 Bank reconhecido automaticamente. Outros bancos permitem mapeamento.</p>
                </div>
                <div className="border border-emerald-200 dark:border-emerald-800/50 rounded-lg p-3 space-y-1 bg-emerald-50/50 dark:bg-emerald-900/10">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />RICO / XP</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">PosicaoDetalhada.xlsx reconhecido automaticamente.</p>
                </div>
                <div className="border border-blue-200 dark:border-blue-800/50 rounded-lg p-3 space-y-1 bg-blue-50/50 dark:bg-blue-900/10">
                  <p className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Mercado Pago PDF</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">Extrato de Conta em PDF reconhecido automaticamente.</p>
                </div>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${importing ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-900/10 cursor-wait' : 'border-slate-300 dark:border-slate-600 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'}`}
                onClick={() => !importing && fileRef.current?.click()}
              >
                {importing ? (
                  <>
                    <div className="h-8 w-8 mx-auto mb-2 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Processando PDF...</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Clique para selecionar o arquivo</p>
                    <p className="text-xs text-slate-400 mt-1">Aceita <strong>.ofx</strong>, <strong>.qfx</strong>, <strong>.csv</strong>, <strong>.xls</strong>, <strong>.xlsx</strong> e <strong>.pdf</strong></p>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".ofx,.qfx,.csv,.xls,.xlsx,.pdf" className="hidden" onChange={handleFile} disabled={importing} />
              </div>

              {fileError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" />{fileError}
                </div>
              )}

              <div className="border-t dark:border-slate-700 pt-3">
                <p className="text-xs text-slate-400 mb-2">Usando CSV genérico? Baixe o template com o formato esperado:</p>
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 text-xs">
                  <Download className="h-3.5 w-3.5" />Baixar template CSV
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: CSV MAPPING (generic only) */}
          {step === 'map' && fileType === 'csv' && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <FileText className="h-4 w-4" /><span>{rawRows.length} linhas encontradas · Mapeie as colunas abaixo</span>
              </div>
              <div className="space-y-3">
                {Object.entries(FIELD_LABELS).map(([field, label]) => (
                  <div key={field} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 w-44 shrink-0">{label}</span>
                    <Select value={mapping[field] ?? '__none__'} onValueChange={v => setMapping(m => ({ ...m, [field]: v === '__none__' ? '' : v } as Record<string, string>))}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— não mapear —</SelectItem>
                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
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
                {othersCount > 0 && (
                  <Badge className="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-50">
                    ⚠ {othersCount} sem categoria — serão revisadas
                  </Badge>
                )}
                {fileType === 'ofx' && (
                  <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-50">OFX — categorias auto-detectadas</Badge>
                )}
                {isBankFormat && (
                  <Badge className="bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 hover:bg-violet-50 flex items-center gap-1">
                    <Zap className="h-3 w-3" />{bankFormatLabel[fileType as string]} — detectado automaticamente
                  </Badge>
                )}
                {fileType === 'rico-xlsx' && (
                  <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-50 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> RICO / XP — carteira detectada automaticamente
                  </Badge>
                )}
              </div>

              <div className="border dark:border-slate-700 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs table-fixed">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-semibold w-6"></th>
                      <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-semibold">Descrição</th>
                      <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-semibold w-24">Valor</th>
                      <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-semibold w-24">Data</th>
                      <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-semibold w-20">Tipo</th>
                      <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-semibold w-24">Categoria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className={`border-t dark:border-slate-700 ${!row.valid ? 'bg-red-50/50 dark:bg-red-900/10' : row.category === 'Outros' ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                        <td className="px-3 py-2">
                          {row.valid
                            ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                            : <span title={row.errors.join(', ')}><AlertCircle className="h-3.5 w-3.5 text-red-500" /></span>}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200 truncate overflow-hidden">{row.description}</td>
                        <td className="px-3 py-2 font-medium">
                          <span className={row.type === 'receita' ? 'text-green-600' : 'text-red-500'}>R$ {row.amount.toFixed(2)}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{row.date}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-[10px] ${row.type === 'receita' ? 'text-green-600' : 'text-red-500'}`}>{row.type}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <span className={row.category === 'Outros' ? 'text-amber-500 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}>
                            {row.category}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {validCount === 0 && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  Nenhuma linha válida. {fileType === 'csv' ? 'Verifique o mapeamento de colunas.' : 'Verifique o arquivo.'}
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

          {/* STEP 4: REVIEW — transações sem categoria */}
          {step === 'review' && (
            <div className="space-y-4 pt-2">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <Tag className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {reviewItems.length} transação{reviewItems.length > 1 ? 'ões' : ''} para revisar
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Categorias sugeridas automaticamente — confirme ou ajuste
                  </p>
                </div>
              </div>

              {/* Duplicatas detectadas */}
              {duplicateItems.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                  <button
                    className="flex items-center justify-between w-full text-left"
                    onClick={() => setShowDuplicates(v => !v)}
                  >
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
                      {duplicateItems.length} duplicata{duplicateItems.length > 1 ? 's' : ''} ignorada{duplicateItems.length > 1 ? 's' : ''} — já existem no sistema
                    </span>
                    <span className="text-[10px] text-slate-400">{showDuplicates ? 'ocultar' : 'ver'}</span>
                  </button>
                  {showDuplicates && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {duplicateItems.map((d, i) => (
                        <div key={i} className="flex justify-between text-xs text-slate-400 dark:text-slate-500 py-0.5">
                          <span className="truncate mr-2">{d.description}</span>
                          <span className="shrink-0">{fmt(d.amount)} · {d.date}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Lista de revisão */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {reviewItems.map(item => {
                  const isSuggested = reviewCategories[item.id] !== 'Outros'
                  return (
                    <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                      isSuggested
                        ? 'bg-blue-50/40 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30'
                        : 'bg-amber-50/40 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{item.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs ${item.type === 'receita' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                            {fmt(item.amount)}
                          </span>
                          <span className="text-xs text-slate-400">· {item.date}</span>
                          {isSuggested && (
                            <span className="text-[10px] text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full">
                              sugerido
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Select
                          value={reviewCategories[item.id] ?? 'Outros'}
                          onValueChange={v => setReviewCategories(prev => ({ ...prev, [item.id]: v ?? 'Outros' }))}
                        >
                          <SelectTrigger className="h-8 text-xs w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Outros">Outros</SelectItem>
                            {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost" size="sm"
                          className="h-8 text-xs gap-1 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 shrink-0"
                          onClick={() => openCreateRule(item)}
                        >
                          <Zap className="h-3 w-3" /> Regra
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep('done')} className="flex-1">Pular</Button>
                <Button onClick={handleSaveReview} disabled={savingReview} className="flex-1 gap-2">
                  {savingReview ? 'Salvando...' : <><CheckCircle className="h-4 w-4" /> Confirmar</>}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: DONE */}
          {step === 'done' && importResult && (() => {
            const allDates = preview.filter(r => r.valid).map(r => r.date).sort()
            const minD = allDates[0] ? new Date(allDates[0] + 'T12:00:00') : null
            const maxD = allDates[allDates.length - 1] ? new Date(allDates[allDates.length - 1] + 'T12:00:00') : null
            const fmtMonth = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
            const period = minD && maxD
              ? (minD.getMonth() === maxD.getMonth() && minD.getFullYear() === maxD.getFullYear()
                ? fmtMonth(minD)
                : `${fmtMonth(minD)} a ${fmtMonth(maxD)}`)
              : null
            const hasErrors = importResult.errors > 0
            return (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <CheckCircle className={`h-12 w-12 ${importResult.success > 0 ? 'text-green-500' : 'text-slate-300'}`} />
                <div>
                  <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {importResult.success > 0 ? 'Importação concluída!' : 'Nenhuma transação importada'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {importResult.success} transações importadas
                    {importResult.duplicates > 0 && ` · ${importResult.duplicates} duplicadas ignoradas`}
                    {importResult.errors > 0 && ` · ${importResult.errors} com erro`}
                  </p>
                  {period && importResult.success > 0 && (
                    <p className="text-xs text-blue-500 dark:text-blue-400 mt-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg">
                      Período: <strong>{period}</strong> — navegue até esse mês para visualizá-las
                    </p>
                  )}
                  {hasErrors && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-2 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg">
                      Erros ao salvar — verifique o console do navegador para detalhes
                    </p>
                  )}
                </div>
                <Button onClick={handleClose} className="w-full max-w-xs">Ver transações</Button>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* CREATE RULE DIALOG (from review) */}
      <Dialog open={!!createRuleFor} onOpenChange={v => { if (!v) setCreateRuleFor(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Criar regra de categorização</DialogTitle></DialogHeader>
          {createRuleFor && (
            <form onSubmit={handleSaveRule} className="space-y-4 pt-2">
              <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg truncate">
                Descrição: <strong className="text-slate-600 dark:text-slate-300">{createRuleFor.description}</strong>
              </div>
              <div className="space-y-2">
                <Label>Palavra-chave</Label>
                <Input
                  value={newRuleKeyword}
                  onChange={e => setNewRuleKeyword(e.target.value.toUpperCase())}
                  placeholder="Ex: UBER, NETFLIX..."
                  required
                  autoFocus
                />
                <p className="text-xs text-slate-400">Se a descrição contiver esta palavra → aplica a categoria abaixo</p>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={newRuleCategory} onValueChange={v => setNewRuleCategory(v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                <ArrowRight className="h-3 w-3 shrink-0" />
                A regra será aplicada em importações futuras automaticamente
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setCreateRuleFor(null)} className="flex-1">Cancelar</Button>
                <Button type="submit" disabled={!newRuleKeyword || !newRuleCategory || savingRule} className="flex-1">
                  {savingRule ? 'Salvando...' : 'Criar regra'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
