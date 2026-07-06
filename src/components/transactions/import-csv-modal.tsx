'use client'

import { useState, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { TransactionType } from '@/types'
import { useCategories } from '@/hooks/use-categories'
import { useRules, applyUserRules } from '@/hooks/use-rules'
import { Upload, Download, CheckCircle, AlertCircle, FileText, Zap, Tag, TrendingUp } from 'lucide-react'
import { parseOFX } from '@/utils/parse-ofx'
import { parseRICOXLSX } from '@/utils/parse-rico'
import { parseRicoExtratoXLSX, isRicoExtratoXLSX } from '@/utils/parse-rico-extrato'
import { extractPdfText } from '@/utils/extract-pdf-text'
import { parseMercadoPagoPDF, isMercadoPagoPDF } from '@/utils/parse-mercadopago-pdf'
import { parseInterInvoicePDF, isInterInvoicePDF } from '@/utils/parse-inter-pdf'
import { parseItauExtratoPDF, isItauExtratoPDF } from '@/utils/parse-itau-extrato-pdf'
import { stripEmbeddedDate } from '@/utils/strip-embedded-date'
import { isTransferDescription } from '@/utils/detect-transfer'
import { parseAmountBR } from '@/utils/parse-amount'
import { addMonths } from '@/utils/add-months'
import { installmentLabel } from '@/utils/format-installment'
import { categoriesForDate } from '@/lib/special-category-filter'

// ─── CSV TEMPLATE ────────────────────────────────────────────────────────────

function downloadTemplate() {
  const rows = [
    ['descricao', 'valor', 'data', 'tipo', 'categoria'],
    ['Salário', '5000', '2026-06-01', 'receita', 'Salário'],
    ['Supermercado', '350.50', '2026-06-05', 'despesa', 'Alimentação'],
    ['Uber', '25.90', '2026-06-07', 'despesa', 'Transporte'],
    ['Transferência para poupança', '500', '2026-06-10', 'transferencia', 'Outros'],
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
  subcategory?: string | null
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
  installment_current?: number | null
  installment_total?: number | null
}

// Uma parcela candidata a ser criada pra completar um plano detectado (passado
// ou futuro) — mesmo valor e categoria da parcela que foi realmente importada.
interface InstallmentPlanRow {
  description: string
  amount: number
  date: string
  type: TransactionType
  category: string
  board_id: string | null
  installment_current: number
  installment_total: number
}

interface ImportCSVModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void
  boardId?: string
}

type Step = 'upload' | 'map' | 'preview' | 'installments' | 'review' | 'done'
type FileType = 'ofx' | 'csv' | 'c6-credit' | 'c6-checking' | 'nubank' | 'rico-xlsx' | 'rico-extrato-xlsx' | 'mercadopago-pdf' | 'inter-pdf' | 'itau-extrato-pdf' | null

// ─── GENERIC CSV HELPERS ─────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  descricao: 'Descrição',
  valor: 'Valor (R$)',
  data: 'Data',
  tipo: 'Tipo (receita/despesa/transferência)',
  categoria: 'Categoria',
}

function guessCSVMapping(headers: string[]): Record<string, string> {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const patterns: Record<string, string[]> = {
    descricao: ['descricao', 'descr', 'historico', 'lancamento', 'nome', 'titulo', 'title', 'description', 'estabelecimento', 'memo', 'movimentacao', 'transacao', 'detalhe'],
    valor: ['valor', 'quantia', 'montante', 'amount', 'value', 'preco', 'total'],
    data: ['data', 'dt', 'date', 'vencimento', 'competencia', 'dia'],
    tipo: ['tipo', 'type', 'natureza', 'direcao'],
    categoria: ['categoria', 'category', 'grupo', 'tag', 'classificacao'],
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
  if (['transferencia', 'transferência', 'transfer', 'ted', 'doc'].some(k => s === k || s.includes(k))) return 'transferencia'
  if (['receita', 'entrada', 'credito', 'crédito', 'credit', 'income', 'c'].some(k => s === k || s.includes(k))) return 'receita'
  if (['despesa', 'saida', 'saída', 'debito', 'débito', 'debit', 'expense', 'd'].some(k => s === k || s.includes(k))) return 'despesa'
  return null
}

function normalizeCategory(raw: string, categoryNames: string[]): string {
  const found = categoryNames.find(c => c.toLowerCase() === raw.trim().toLowerCase())
  return found ?? 'Outros'
}

// ─── COMPLETAR PLANO DE PARCELAMENTO (passado + futuro) ────────────────────
// A partir de UMA parcela detectada (ex: "2 de 12"), reconstrói o plano
// inteiro assumindo valor igual em todas as parcelas — comum em parcelamento
// sem juros. Consulta o banco pra não duplicar parcelas que já existem.
async function computeMissingInstallments(
  anchors: InstallmentPlanRow[],
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<InstallmentPlanRow[]> {
  if (!anchors.length) return []

  // Uma âncora por plano (description + total + valor da parcela) — o valor
  // entra aqui pelo mesmo motivo do handleImport: a mesma descrição pode ser
  // duas compras diferentes do mesmo estabelecimento, parceladas no mesmo
  // número de vezes por coincidência (ex: duas compras na "INFO ESPORTES
  // LTDA", uma 5x de R$309 e outra 5x de R$440, meses depois). Sem o valor,
  // as duas virariam "o mesmo plano" e uma delas seria perdida.
  const uniquePlans = Array.from(
    new Map(anchors.map(a => [`${a.description}|${a.installment_total}|${a.amount.toFixed(2)}`, a])).values()
  )

  const candidates: InstallmentPlanRow[] = []
  for (const plan of uniquePlans) {
    for (let n = 1; n <= plan.installment_total; n++) {
      if (n === plan.installment_current) continue
      candidates.push({ ...plan, installment_current: n, date: addMonths(plan.date, n - plan.installment_current) })
    }
  }
  if (!candidates.length) return []

  // Identidade da parcela é o "slot" (descrição + total + parcela X) com
  // valor PARECIDO (tolerância de R$2, cobre arredondamento de centavos sem
  // confundir com outra compra) — nunca a data, que aqui é só uma projeção e
  // pode não bater exatamente com a fatura real quando ela chegar (é o
  // handleImport que corrige depois).
  const AMOUNT_TOLERANCE = 2
  const descs = [...new Set(candidates.map(c => c.description))]
  const { data: existing } = await supabase
    .from('transactions')
    .select('description, amount, installment_current, installment_total')
    .eq('user_id', userId)
    .in('description', descs)
    .not('installment_total', 'is', null)

  const existingByGroup = new Map<string, number[]>()
  for (const e of existing ?? []) {
    const key = `${e.description}|${e.installment_total}|${e.installment_current}`
    const arr = existingByGroup.get(key) ?? []
    arr.push(Number(e.amount))
    existingByGroup.set(key, arr)
  }

  return candidates.filter(c => {
    const key = `${c.description}|${c.installment_total}|${c.installment_current}`
    const amounts = existingByGroup.get(key) ?? []
    return !amounts.some(a => Math.abs(a - c.amount) <= AMOUNT_TOLERANCE)
  })
}

// ─── BANK PARSERS ────────────────────────────────────────────────────────────

function detectBankFormat(content: string): 'c6-credit' | 'c6-checking' | 'nubank' | null {
  const firstLine = content.split('\n')[0].trim()
  if (firstLine.startsWith('EXTRATO DE CONTA CORRENTE C6 BANK')) return 'c6-checking'
  if (content.includes('Data de Compra') && content.includes('Parcela') && content.includes('Valor (em R$)')) return 'c6-credit'
  // Nubank (cartão de crédito): cabeçalho fixo "date,title,amount"
  if (firstLine.toLowerCase().replace(/\s/g, '') === 'date,title,amount') return 'nubank'
  return null
}

function parseNubankCSV(content: string): PreviewRow[] {
  const result = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true })
  return result.data
    .filter(row => (row['amount'] ?? '').trim() !== '')
    .map(row => {
      const errors: string[] = []
      const description = stripEmbeddedDate((row['title'] ?? '').trim())
      if (!description) errors.push('Descrição vazia')
      const date = normalizeDate((row['date'] ?? '').trim()) ?? ''
      if (!date) errors.push('Data inválida')
      const valorNum = parseAmountBR(row['amount'] ?? '')
      const amount = Math.abs(valorNum)
      if (isNaN(amount) || amount <= 0) errors.push('Valor inválido')
      // Fatura do cartão: valor positivo = compra (despesa); negativo = estorno/pagamento (receita)
      const type: TransactionType = isTransferDescription(description)
        ? 'transferencia'
        : (valorNum < 0 ? 'receita' : 'despesa')
      return { description, amount: isNaN(amount) ? 0 : amount, date, type, category: 'Outros', valid: errors.length === 0, errors }
    })
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
      const description = stripEmbeddedDate((row['Descrição'] ?? '').trim())
      if (!description) errors.push('Descrição vazia')
      const dateRaw = (row['Data de Compra'] ?? '').trim()
      const date = normalizeDate(dateRaw) ?? ''
      if (!date) errors.push('Data inválida')
      const valorNum = parseFloat((row['Valor (em R$)'] ?? '0').trim())
      const amount = Math.abs(valorNum)
      if (isNaN(amount) || amount <= 0) errors.push('Valor inválido')
      const type: TransactionType = isTransferDescription(description)
        ? 'transferencia'
        : (valorNum < 0 ? 'receita' : 'despesa')
      const category = mapC6Category(row['Categoria'] ?? '')
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
      const description = stripEmbeddedDate((row['Título'] ?? '').trim())
      if (!description) errors.push('Descrição vazia')
      const dateRaw = (row['Data Lançamento'] ?? '').split(' - ')[0].trim()
      const date = normalizeDate(dateRaw) ?? ''
      if (!date) errors.push('Data inválida')
      const entrada = parseFloat(row['Entrada(R$)'] ?? '0')
      const saida = parseFloat(row['Saída(R$)'] ?? '0')
      const type: TransactionType = isTransferDescription(description)
        ? 'transferencia'
        : (entrada > 0 ? 'receita' : 'despesa')
      const amount = entrada > 0 ? entrada : saida
      if (isNaN(amount) || amount <= 0) errors.push('Valor inválido')
      return { description, amount: isNaN(amount) ? 0 : amount, date, type, category: 'Outros', valid: errors.length === 0, errors }
    })
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export function ImportCSVModal({ open, onClose, onImported, boardId }: ImportCSVModalProps) {
  const { categories } = useCategories()
  const { rules, syncCategoryToRule } = useRules()
  const categoryNames = categories.map(c => c.name)
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [fileType, setFileType] = useState<FileType>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; errors: number; duplicates: number; fixed: number; errorMessage?: string } | null>(null)
  const [fileError, setFileError] = useState('')

  // Review state
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [reviewCategories, setReviewCategories] = useState<Record<string, string>>({})
  const [savingReview, setSavingReview] = useState(false)
  const [duplicateItems, setDuplicateItems] = useState<ReviewItem[]>([])
  const [showDuplicates, setShowDuplicates] = useState(false)

  // Completar plano de parcelamento (passado + futuro) a partir de uma parcela detectada
  const [pendingInstallments, setPendingInstallments] = useState<InstallmentPlanRow[]>([])
  const [creatingInstallments, setCreatingInstallments] = useState(false)

  // Smart category suggestion: tries to match description words against category names
  // do mesmo tipo da transação (ou "ambos", ex: "Outros") — uma transferência nunca
  // sugere uma categoria de despesa/receita e vice-versa.
  function suggestCategory(description: string, date: string, type: TransactionType): string {
    const upper = description.toUpperCase()
    for (const cat of categoriesForDate(categories, date)) {
      if (cat.type !== type && cat.type !== 'ambos') continue
      if (upper.includes(cat.name.toUpperCase()) && cat.name !== 'Outros') return cat.name
    }
    return 'Outros'
  }

  // Apply user-defined rules as last fallback (after prefix + keyword rules)
  const enhanceWithUserRules = useCallback((rows: PreviewRow[]): PreviewRow[] => {
    if (!rules.length) return rows
    return rows.map(r =>
      r.category === 'Outros'
        ? { ...r, category: applyUserRules(r.description, r.date, rules, categories, r.type).category ?? 'Outros' }
        : r
    )
  }, [rules, categories])

  function reset() {
    setStep('upload'); setFileType(null); setHeaders([]); setRawRows([]); setMapping({}); setPreview([])
    setImporting(false); setImportResult(null); setFileError('')
    setReviewItems([]); setReviewCategories({})
    setDuplicateItems([]); setShowDuplicates(false)
    setPendingInstallments([]); setCreatingInstallments(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Depois de completar (ou pular) o preenchimento de parcelas, segue pro
  // próximo passo natural: revisão de itens sem categoria, ou concluído.
  function goToReviewOrDone() {
    setStep(reviewItems.length > 0 ? 'review' : 'done')
  }

  async function handleConfirmInstallments() {
    setCreatingInstallments(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user && pendingInstallments.length > 0) {
      const payload = pendingInstallments.map(p => ({
        id: uid(),
        user_id: user.id,
        description: p.description,
        amount: p.amount,
        date: p.date,
        type: p.type,
        category: p.category,
        board_id: p.board_id,
        tags: [],
        installment_current: p.installment_current,
        installment_total: p.installment_total,
      }))
      const { error } = await supabase.from('transactions').insert(payload)
      if (error) console.error('[handleConfirmInstallments] insert error:', error.message, '| code:', error.code)
    }
    setCreatingInstallments(false)
    goToReviewOrDone()
  }

  function handleSkipInstallments() {
    goToReviewOrDone()
  }

  function handleClose() { reset(); onClose() }

  // ── OFX ──
  function handleOFX(content: string) {
    try {
      const rows = parseOFX(content)
      if (!rows.length) { setFileError('Nenhuma transação encontrada no arquivo OFX.'); return }
      const preview: PreviewRow[] = rows.map(r => ({
        description: r.description, amount: r.amount, date: r.date, type: r.type,
        category: r.category,
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
      if (bankFormat === 'nubank') {
        const rows = parseNubankCSV(content)
        if (!rows.length) { setFileError('Nenhuma transação encontrada no extrato Nubank.'); return }
        setPreview(enhanceWithUserRules(rows)); setFileType('nubank'); setStep('preview'); return
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

  // ── PDF (Mercado Pago, Inter — detectados pelo conteúdo do texto extraído) ──
  function handlePDF(file: File) {
    const reader = new FileReader()
    reader.onload = async (ev) => {
      setImporting(true)
      try {
        const buffer = ev.target?.result as ArrayBuffer
        const text = await extractPdfText(buffer)

        if (isInterInvoicePDF(text)) {
          const rows = parseInterInvoicePDF(text)
          if (!rows.length) {
            setFileError('Nenhuma transação encontrada na fatura Inter.')
            return
          }
          setPreview(enhanceWithUserRules(rows))
          setFileType('inter-pdf')
          setStep('preview')
          return
        }

        if (isMercadoPagoPDF(text)) {
          const rows = parseMercadoPagoPDF(text)
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
          return
        }

        if (isItauExtratoPDF(text)) {
          const rows = parseItauExtratoPDF(text)
          if (!rows) {
            setFileError('Nenhuma transação encontrada no PDF. Verifique se é um Extrato de Conta do Itaú.')
            return
          }
          setPreview(enhanceWithUserRules(rows.map(r => ({
            ...r,
            installment_current: null,
            installment_total: null,
          }))))
          setFileType('itau-extrato-pdf')
          setStep('preview')
          return
        }

        setFileError('Não reconhecemos o formato desse PDF. Hoje suportamos fatura do Inter, Extrato de Conta do Mercado Pago e Extrato de Conta do Itaú.')
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

        // Detect RICO / XP "Extrato da conta" (histórico de movimentações)
        if (isRicoExtratoXLSX(wb)) {
          const rows = parseRicoExtratoXLSX(buffer)
          if (!rows.length) {
            setFileError('Nenhuma movimentação encontrada nesse extrato. Verifique se o período selecionado no site da RICO/XP tem lançamentos.')
            return
          }
          setPreview(enhanceWithUserRules(rows))
          setFileType('rico-extrato-xlsx')
          setStep('preview')
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

  function processFile(file: File) {
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

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file)
  }

  const [dragOver, setDragOver] = useState(false)

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!importing) setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (importing) return
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    processFile(file)
  }

  // ── Generic CSV → Preview ──
  function buildCSVPreview() {
    const rows: PreviewRow[] = rawRows.map(raw => {
      const errors: string[] = []
      const description = stripEmbeddedDate((mapping.descricao ? raw[mapping.descricao] : '').trim())
      if (!description) errors.push('Descrição vazia')
      const valorNum = parseAmountBR(mapping.valor ? raw[mapping.valor] : '')
      const amount = Math.abs(valorNum)
      if (isNaN(amount) || amount <= 0) errors.push('Valor inválido')
      const date = normalizeDate(mapping.data ? raw[mapping.data] : '') ?? ''
      if (!date) errors.push('Data inválida')
      let type: TransactionType
      const mappedType = mapping.tipo ? normalizeType(raw[mapping.tipo]) : null
      if (mappedType) { type = mappedType }
      else if (isTransferDescription(description)) { type = 'transferencia' }
      else if (!isNaN(valorNum)) { type = valorNum < 0 ? 'receita' : 'despesa' }
      else { type = 'despesa'; errors.push('Tipo não mapeado — assumido "despesa"') }
      const category = normalizeCategory(mapping.categoria ? raw[mapping.categoria] : 'Outros', categoryNames)
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
    // Categoria especial nunca entra na herança por histórico — descrições genéricas
    // (ex: "DEBITO DE CARTAO") podem repetir em transações de eventos completamente
    // diferentes, então herdar uma categoria especial por coincidência de texto é sempre errado.
    const specialCategoryNames = new Set(
      categories.filter(c => c.special_dates && c.special_dates.length > 0).map(c => c.name)
    )
    const historyMap = new Map<string, string>()
    for (const h of historyData ?? []) {
      if (specialCategoryNames.has(h.category)) continue
      historyMap.set(h.description.toLowerCase(), h.category)
    }

    let valid = preview.filter(r => r.valid).map(r => ({
      ...r,
      category: r.category === 'Outros' ? (historyMap.get(r.description.toLowerCase()) ?? r.category) : r.category,
    }))

    // Corrige parcelas "fantasma": se já existe uma transação no mesmo "slot"
    // do plano (descrição + total de parcelas + número da parcela) com valor
    // PARECIDO, mas data diferente do que a fatura real agora traz, atualiza
    // ela em vez de inserir uma linha duplicada. Cobre o caso em que
    // "Completar parcelamento" projetou uma data aproximada antes da fatura
    // real daquele mês existir — quando ela chega, corrige em vez de duplicar.
    //
    // "Valor parecido" (tolerância de R$2) em vez de valor exato, porque a
    // primeira ou última parcela de um plano real às vezes vem com um
    // arredondamento de centavos diferente das demais (ex: 11 parcelas de
    // R$99,44 e 1 de R$99,49 pra fechar o total certinho) — exigir valor
    // idêntico faria essa parcela parecer uma transação nova.
    //
    // Ao mesmo tempo, dentro do mesmo "slot" pode haver mais de uma compra
    // diferente do mesmo estabelecimento coincidindo no número da parcela
    // (ex: "INFO ESPORTES LTDA" 5x de R$309 numa compra, e 5x de R$440 em
    // outra, meses depois) — por isso a tolerância é pequena (R$2), o
    // suficiente pra cobrir arredondamento sem confundir compras diferentes.
    const AMOUNT_TOLERANCE = 2
    let installmentsFixed = 0
    const installmentDescs = [...new Set(
      valid.filter(r => r.installment_total && r.installment_total > 1 && r.installment_current).map(r => r.description)
    )]
    if (installmentDescs.length > 0) {
      const { data: existingInstallments } = await supabase
        .from('transactions')
        .select('id, description, date, amount, installment_current, installment_total')
        .eq('user_id', user.id)
        .in('description', installmentDescs)
        .not('installment_total', 'is', null)

      // Agrupa por descrição+total+parcela (SEM valor) — pode haver mais de
      // uma "candidata" nesse slot se duas compras diferentes coincidirem.
      const existingByGroup = new Map<string, { id: string; date: string; amount: number }[]>()
      for (const e of existingInstallments ?? []) {
        const key = `${e.description}|${e.installment_total}|${e.installment_current}`
        const arr = existingByGroup.get(key) ?? []
        arr.push({ id: e.id, date: e.date, amount: Number(e.amount) })
        existingByGroup.set(key, arr)
      }

      const remaining: typeof valid = []
      for (const row of valid) {
        if (!(row.installment_total && row.installment_total > 1 && row.installment_current)) {
          remaining.push(row)
          continue
        }
        const groupKey = `${row.description}|${row.installment_total}|${row.installment_current}`
        const sameSlot = existingByGroup.get(groupKey) ?? []
        const match = sameSlot.find(e => Math.abs(e.amount - row.amount) <= AMOUNT_TOLERANCE)
        if (!match) { remaining.push(row); continue }

        if (match.date !== row.date || Math.abs(match.amount - row.amount) > 0.001) {
          await supabase.from('transactions').update({ date: row.date, amount: row.amount }).eq('id', match.id)
          installmentsFixed++
        }
        // Já existe e está idêntica, ou acabou de ser corrigida — não insere de novo.
      }
      valid = remaining
    }

    const BATCH = 100
    let success = 0, errors = 0, duplicates = 0
    let firstErrorMessage: string | undefined
    const insertedOthers: ReviewItem[] = []
    const insertedInstallmentAnchors: InstallmentPlanRow[] = []

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
        insertedOthers.push({ id, description: d.description, amount: d.amount, date: d.date, type: d.type, category: '__duplicate__', installment_current: d.installment_current, installment_total: d.installment_total })
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
        group_label: row.subcategory ?? null,
        installment_current: row.installment_current ?? null,
        installment_total: row.installment_total ?? null,
      }))

      const { error } = await supabase.from('transactions').insert(payload)
      if (error) {
        console.error('[handleImport] insert error — message:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint)
        errors += toInsert.length
        if (!firstErrorMessage) {
          firstErrorMessage = error.code === '23514'
            ? 'Categoria não permitida pelo banco de dados. Rode a migração migration_categories.sql no Supabase.'
            : error.message
        }
      } else {
        success += toInsert.length
        // Only track Outros items that were actually inserted
        for (const { id, row } of tracking) {
          if (row.category === 'Outros') {
            insertedOthers.push({ id, description: row.description, amount: row.amount, date: row.date, type: row.type, category: 'Outros', installment_current: row.installment_current, installment_total: row.installment_total })
          }
          // Parcela detectada (C6, Inter...) — candidata a completar o plano inteiro
          if (row.installment_total && row.installment_total > 1 && row.installment_current) {
            insertedInstallmentAnchors.push({
              description: row.description,
              amount: row.amount,
              date: row.date,
              type: row.type,
              category: row.category,
              board_id: boardId ?? null,
              installment_current: row.installment_current,
              installment_total: row.installment_total,
            })
          }
        }
      }
    }

    setImportResult({ success, errors, duplicates, fixed: installmentsFixed, errorMessage: firstErrorMessage })
    setImporting(false)
    onImported()

    const dups = insertedOthers.filter(i => i.category === '__duplicate__')
    const uncategorized = insertedOthers.filter(i => i.category !== '__duplicate__')

    setDuplicateItems(dups)

    if (uncategorized.length > 0 && success > 0) {
      setReviewItems(uncategorized)
      const initialCats: Record<string, string> = {}
      for (const item of uncategorized) initialCats[item.id] = suggestCategory(item.description, item.date, item.type)
      setReviewCategories(initialCats)
    }

    // Se algum parcelamento foi detectado, oferece completar o plano (passado
    // + futuro) antes de seguir pra revisão/conclusão.
    const missingInstallments = await computeMissingInstallments(insertedInstallmentAnchors, supabase, user.id)
    if (missingInstallments.length > 0) {
      setPendingInstallments(missingInstallments)
      setStep('installments')
    } else if (uncategorized.length > 0 && success > 0) {
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
      // Categoria normal: regra automática cuida de propagar pro histórico e
      // futuras importações (categoria especial nunca entra aqui).
      const syncResult = await syncCategoryToRule(item.description, reviewCategories[item.id], categories)
      if (syncResult.error) console.error('[handleSaveReview] syncCategoryToRule falhou:', syncResult.error)
    }
    setSavingReview(false)
    setStep('done')
  }

  const validCount = preview.filter(r => r.valid).length
  const invalidCount = preview.filter(r => !r.valid).length
  const othersCount = preview.filter(r => r.valid && r.category === 'Outros').length
  const isBankFormat = fileType === 'c6-credit' || fileType === 'c6-checking' || fileType === 'mercadopago-pdf' || fileType === 'nubank' || fileType === 'inter-pdf' || fileType === 'itau-extrato-pdf' || fileType === 'rico-extrato-xlsx'
  const bankFormatLabel: Record<string, string> = {
    'c6-credit': 'C6 Cartão de Crédito',
    'c6-checking': 'C6 Conta Corrente',
    'mercadopago-pdf': 'Mercado Pago — Extrato de Conta',
    'nubank': 'Nubank — Cartão de Crédito',
    'inter-pdf': 'Inter — Fatura de Cartão',
    'itau-extrato-pdf': 'Itaú — Extrato de Conta',
    'rico-extrato-xlsx': 'RICO/XP — Extrato da Conta',
  }
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const installmentPlansCount = new Set(pendingInstallments.map(p => `${p.description}|${p.installment_total}`)).size
  const todayStr = new Date().toISOString().split('T')[0]
  const pastInstallmentsCount = pendingInstallments.filter(p => p.date < todayStr).length
  const futureInstallmentsCount = pendingInstallments.length - pastInstallmentsCount

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
                  <p className="text-slate-500 dark:text-slate-400 text-xs">PosicaoDetalhada.xlsx (carteira) e Extrato da Conta (rendimentos, aportes) reconhecidos automaticamente.</p>
                </div>
                <div className="border border-blue-200 dark:border-blue-800/50 rounded-lg p-3 space-y-1 bg-blue-50/50 dark:bg-blue-900/10">
                  <p className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />PDF (fatura / extrato)</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">Inter, Mercado Pago e Itaú reconhecidos automaticamente.</p>
                </div>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  importing
                    ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-900/10 cursor-wait'
                    : dragOver
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 cursor-pointer'
                      : 'border-slate-300 dark:border-slate-600 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                }`}
                onClick={() => !importing && fileRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {importing ? (
                  <>
                    <div className="h-8 w-8 mx-auto mb-2 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Processando PDF...</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {dragOver ? 'Solte o arquivo aqui' : 'Clique ou arraste o arquivo aqui'}
                    </p>
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
                      <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-semibold w-20">Parcelas</th>
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
                          <span className={row.type === 'receita' ? 'text-green-600' : row.type === 'transferencia' ? 'text-slate-400 dark:text-slate-500' : 'text-red-500'}>R$ {row.amount.toFixed(2)}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{row.date}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{installmentLabel(row)}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-[10px] ${row.type === 'receita' ? 'text-green-600' : row.type === 'transferencia' ? 'text-slate-400 dark:text-slate-500' : 'text-red-500'}`}>{row.type}</Badge>
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

          {/* STEP: PARCELAS — completar plano de parcelamento detectado (passado + futuro) */}
          {step === 'installments' && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 text-violet-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {installmentPlansCount} parcelamento{installmentPlansCount > 1 ? 's' : ''} detectado{installmentPlansCount > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Podemos completar o plano inteiro, assumindo o mesmo valor em todas as parcelas
                  </p>
                </div>
              </div>

              <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700/50 rounded-xl p-3.5 text-sm text-violet-700 dark:text-violet-300">
                Vamos criar <strong>{pendingInstallments.length} lançamento{pendingInstallments.length > 1 ? 's' : ''}</strong> —{' '}
                {pastInstallmentsCount} no passado e {futureInstallmentsCount} no futuro.
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700 max-h-56 overflow-y-auto">
                {pendingInstallments.slice(0, 30).map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-700 dark:text-slate-200 truncate">{p.description}</p>
                      <p className="text-slate-400">{p.date} · parcela {p.installment_current}/{p.installment_total}</p>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400 shrink-0 ml-2">{fmt(p.amount)}</span>
                  </div>
                ))}
                {pendingInstallments.length > 30 && (
                  <p className="text-xs text-slate-400 text-center py-2">...e mais {pendingInstallments.length - 30}</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSkipInstallments} disabled={creatingInstallments} className="flex-1">
                  Pular
                </Button>
                <Button onClick={handleConfirmInstallments} disabled={creatingInstallments} className="flex-1">
                  {creatingInstallments ? 'Criando...' : `Criar ${pendingInstallments.length} lançamentos`}
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
                          <span className={`text-xs ${item.type === 'receita' ? 'text-green-600 dark:text-green-400' : item.type === 'transferencia' ? 'text-slate-400 dark:text-slate-500' : 'text-red-500'}`}>
                            {fmt(item.amount)}
                          </span>
                          <span className="text-xs text-slate-400">· {item.date}</span>
                          {installmentLabel(item) && (
                            <span className="text-xs text-slate-400">· Parcela {installmentLabel(item)}</span>
                          )}
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
                            {categoriesForDate(categories, item.date)
                              .filter(c => c.type === item.type || c.type === 'ambos')
                              .map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
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
                    {importResult.fixed > 0 && ` · ${importResult.fixed} parcela${importResult.fixed !== 1 ? 's' : ''} corrigida${importResult.fixed !== 1 ? 's' : ''}`}
                    {importResult.duplicates > 0 && ` · ${importResult.duplicates} duplicadas ignoradas`}
                    {importResult.errors > 0 && ` · ${importResult.errors} com erro`}
                  </p>
                  {period && importResult.success > 0 && (
                    <p className="text-xs text-blue-500 dark:text-blue-400 mt-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg">
                      Período: <strong>{period}</strong> — navegue até esse mês para visualizá-las
                    </p>
                  )}
                  {hasErrors && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-2 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg text-left">
                      Erro ao salvar: {importResult.errorMessage ?? 'verifique o console do navegador para detalhes'}
                    </p>
                  )}
                </div>
                <Button onClick={handleClose} className="w-full max-w-xs">Ver transações</Button>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </>
  )
}
