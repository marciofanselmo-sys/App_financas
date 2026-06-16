import { TransactionType } from '@/types'

interface OFXTransaction {
  description: string
  amount: number
  date: string
  type: TransactionType
  category: string
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Alimentação: ['supermercado', 'mercado', 'restaurante', 'lanche', 'pizza', 'burger', 'hamburguer', 'ifood', 'rappi', 'delivery', 'padaria', 'açougue', 'hortifruti', 'conveniencia', 'conveniência', 'cafe', 'café', 'bar ', 'boteco', 'peixaria'],
  Transporte: ['uber', '99pop', '99app', 'taxi', 'táxi', 'onibus', 'ônibus', 'metro', 'metrô', 'trem', 'combustivel', 'combustível', 'gasolina', 'etanol', 'posto ', 'shell', 'ipiranga', 'br distribuidora', 'estacionamento', 'pedagio', 'pedágio', 'passagem'],
  Moradia: ['aluguel', 'condominio', 'condomínio', 'agua ', 'água ', 'sabesp', 'copasa', 'cemig', 'enel', 'cpfl', 'eletropaulo', 'luz ', 'energia', 'gas encanado', 'gás', 'comgas', 'internet', 'vivo', 'claro', 'tim', 'oi ', 'nextel', 'iptu', 'seguro resid'],
  Saúde: ['farmacia', 'farmácia', 'drogaria', 'droga', 'remedio', 'remédio', 'medico', 'médico', 'hospital', 'clinica', 'clínica', 'laboratorio', 'laboratório', 'plano de saude', 'unimed', 'bradesco saude', 'amil', 'dental', 'odonto', 'academia', 'smart fit'],
  Educação: ['escola', 'faculdade', 'universidade', 'curso', 'livro', 'mensalidade', 'colegio', 'colégio', 'educacao', 'educação', 'alura', 'udemy', 'coursera', 'material escolar'],
  Lazer: ['cinema', 'teatro', 'show', 'ingresso', 'netflix', 'spotify', 'prime video', 'disney', 'hbo', 'clube', 'viagem', 'hotel', 'airbnb', 'booking', 'passagem aerea', 'aérea', 'latam', 'gol ', 'azul ', 'decathlon', 'esporte', 'jogo', 'game'],
  Salário: ['salario', 'salário', 'pagamento sal', 'folha', 'remuneracao', 'remuneração', 'pro-labore', 'prolabore'],
  Freelance: ['freelance', 'honorario', 'honorário', 'servico prestado', 'serviço prestado', 'consultoria', 'autonomo', 'autônomo', 'pix recebido', 'transferencia recebida'],
  Outros: [],
}

function guessCategory(description: string, type: TransactionType): string {
  const lower = description.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  if (type === 'receita') {
    for (const kw of CATEGORY_KEYWORDS['Salário']) {
      if (lower.includes(kw.normalize('NFD').replace(/[̀-ͯ]/g, ''))) return 'Salário'
    }
    for (const kw of CATEGORY_KEYWORDS['Freelance']) {
      if (lower.includes(kw.normalize('NFD').replace(/[̀-ͯ]/g, ''))) return 'Freelance'
    }
    return 'Outros'
  }

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (cat === 'Salário' || cat === 'Freelance' || cat === 'Outros') continue
    for (const kw of keywords) {
      if (lower.includes(kw.normalize('NFD').replace(/[̀-ͯ]/g, '').trim())) {
        return cat
      }
    }
  }

  return 'Outros'
}

function parseOFXDate(raw: string): string {
  // YYYYMMDDHHMMSS or YYYYMMDD
  const s = raw.replace(/\[.*\]/, '').trim()
  const y = s.slice(0, 4)
  const m = s.slice(4, 6)
  const d = s.slice(6, 8)
  return `${y}-${m}-${d}`
}

function extractTagValue(block: string, tag: string): string {
  const re = new RegExp(`<${tag}>([^<\r\n]*)`, 'i')
  return block.match(re)?.[1]?.trim() ?? ''
}

export function parseOFX(content: string): OFXTransaction[] {
  // Normalize line endings and remove OFX header (before first <OFX>)
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Extract all STMTTRN blocks
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  const matches = [...normalized.matchAll(trnRegex)]

  if (matches.length === 0) {
    // Try SGML-style (no closing tags) — split by <STMTTRN>
    const parts = normalized.split(/<STMTTRN>/i).slice(1)
    return parts.map(block => parseSGMLBlock(block)).filter(Boolean) as OFXTransaction[]
  }

  return matches.map(m => parseXMLBlock(m[1])).filter(Boolean) as OFXTransaction[]
}

function parseXMLBlock(block: string): OFXTransaction | null {
  return buildTransaction(
    extractTagValue(block, 'MEMO') || extractTagValue(block, 'NAME'),
    extractTagValue(block, 'TRNAMT'),
    extractTagValue(block, 'DTPOSTED'),
  )
}

function parseSGMLBlock(block: string): OFXTransaction | null {
  // In SGML OFX, each field is on its own line: <TAG>value
  const memo = extractTagValue(block, 'MEMO') || extractTagValue(block, 'NAME')
  const amount = extractTagValue(block, 'TRNAMT')
  const date = extractTagValue(block, 'DTPOSTED')
  return buildTransaction(memo, amount, date)
}

function buildTransaction(memo: string, amountRaw: string, dateRaw: string): OFXTransaction | null {
  if (!memo || !amountRaw || !dateRaw) return null

  const amount = parseFloat(amountRaw.replace(',', '.'))
  if (isNaN(amount) || amount === 0) return null

  const type: TransactionType = amount > 0 ? 'receita' : 'despesa'
  const absAmount = Math.abs(amount)
  const date = parseOFXDate(dateRaw)
  const category = guessCategory(memo, type)

  return { description: memo, amount: absAmount, date, type, category }
}
