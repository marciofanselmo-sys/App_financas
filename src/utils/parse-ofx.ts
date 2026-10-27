import { TransactionType } from '@/types'
import { stripEmbeddedDate } from './strip-embedded-date'

interface OFXTransaction {
  description: string
  amount: number
  date: string
  type: TransactionType
  category: string
}

// A ordem importa: a primeira categoria que casa ganha. Assinaturas vem antes
// de Compras ("amazon prime" × "amazon"), Compras antes de Alimentação
// ("mercado livre" × "mercado") e Viagens antes de Transporte ("passagem aerea").
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Assinaturas: ['netflix', 'spotify', 'deezer', 'prime video', 'amazon prime', 'disney', 'hbo', 'max.com', 'globoplay', 'paramount', 'youtube premium', 'youtube music', 'apple.com', 'icloud', 'google one', 'google storage', 'microsoft 365', 'chatgpt', 'openai', 'dropbox', 'canva'],
  Viagens: ['viagem', 'hotel', 'pousada', 'hostel', 'airbnb', 'booking', 'decolar', '123milhas', 'hurb', 'passagem aerea', 'aérea', 'latam', 'gol ', 'azul ', 'buser', 'blablacar', 'clickbus', 'rodoviaria', 'rodoviária', 'localiza', 'movida', 'unidas'],
  Compras: ['shopee', 'mercado livre', 'mercadolivre', 'amazon', 'magalu', 'magazine luiza', 'americanas', 'aliexpress', 'shein', 'temu', 'renner', 'riachuelo', 'c&a', 'zara', 'casas bahia', 'kabum', 'leroy merlin', 'tok&stok', 'tokstok'],
  Alimentação: ['supermercado', 'mercado', 'restaurante', 'lanche', 'pizza', 'burger', 'hamburguer', 'ifood', 'rappi', 'delivery', 'ze delivery', 'zé delivery', 'padaria', 'açougue', 'hortifruti', 'conveniencia', 'conveniência', 'cafe', 'café', 'bar ', 'boteco', 'peixaria'],
  Transporte: ['uber', '99pop', '99app', 'taxi', 'táxi', 'onibus', 'ônibus', 'metro', 'metrô', 'trem', 'combustivel', 'combustível', 'gasolina', 'etanol', 'posto ', 'shell', 'ipiranga', 'br distribuidora', 'estacionamento', 'pedagio', 'pedágio', 'sem parar', 'veloe', 'conectcar', 'passagem'],
  Moradia: ['aluguel', 'condominio', 'condomínio', 'agua ', 'água ', 'sabesp', 'copasa', 'cemig', 'enel', 'cpfl', 'eletropaulo', 'luz ', 'energia', 'gas encanado', 'gás', 'comgas', 'internet', 'vivo', 'claro', 'tim', 'oi ', 'nextel', 'iptu', 'seguro resid'],
  Saúde: ['farmacia', 'farmácia', 'drogaria', 'droga', 'remedio', 'remédio', 'medico', 'médico', 'hospital', 'clinica', 'clínica', 'laboratorio', 'laboratório', 'plano de saude', 'unimed', 'bradesco saude', 'amil', 'dental', 'odonto', 'academia', 'smart fit', 'wellhub', 'gympass', 'totalpass'],
  Educação: ['escola', 'faculdade', 'universidade', 'curso', 'livro', 'mensalidade', 'colegio', 'colégio', 'educacao', 'educação', 'alura', 'udemy', 'coursera', 'material escolar'],
  'Família e pets': ['petz', 'cobasi', 'petshop', 'pet shop', 'veterinario', 'veterinário', 'creche', 'berçário'],
  Lazer: ['cinema', 'teatro', 'show', 'ingresso', 'clube', 'decathlon', 'esporte', 'jogo', 'game', 'steam', 'playstation', 'xbox'],
  Salário: ['salario', 'salário', 'pagamento sal', 'folha', 'remuneracao', 'remuneração', 'pro-labore', 'prolabore'],
  // "pix recebido" e "transferencia recebida" saíram daqui: Pix de familiar ou
  // da própria conta virava Freelance (ex.: o cônjuge mandando dinheiro).
  Freelance: ['freelance', 'honorario', 'honorário', 'servico prestado', 'serviço prestado', 'consultoria', 'autonomo', 'autônomo'],
  Outros: [],
}

// Prefixos bancários comuns que não agregam informação
const BANKING_PREFIXES = [
  /^pix\s+enviado\s+a\s+/i,
  /^pix\s+recebido\s+de\s+/i,
  /^pix\s+enviado\s+/i,
  /^pix\s+recebido\s+/i,
  /^pix\s+/i,
  /^pgto\s+pix\s+/i,
  /^pagamento\s+pix\s+/i,
  /^pagto\s+pix\s+/i,
  /^compra\s+déb(ito)?\s+/i,
  /^compra\s+deb(ito)?\s+/i,
  /^compra\s+crédito\s+/i,
  /^compra\s+credito\s+/i,
  /^compra\s+/i,
  /^transferência\s+/i,
  /^transferencia\s+/i,
  /^transf\s+/i,
  /^ted\s+/i,
  /^doc\s+/i,
  /^débito\s+em\s+conta\s+/i,
  /^debito\s+em\s+conta\s+/i,
  /^saque\s+/i,
  /^retirada\s+/i,
  /^tarifa\s+/i,
]

function cleanDescription(raw: string): string {
  if (!raw.trim()) return raw

  let s = raw.trim()

  // Converte ALL CAPS para Title Case (bancos brasileiros geralmente exportam em maiúsculas)
  if (s === s.toUpperCase()) {
    s = s.toLowerCase().replace(/(?:^|\s|[-/])\S/g, c => c.toUpperCase())
  }

  // Remove prefixos bancários que não informam nada
  for (const prefix of BANKING_PREFIXES) {
    const replaced = s.replace(prefix, '')
    if (replaced.length > 3) { s = replaced; break }
  }

  // Remove datas embutidas no meio/fim: "10/06", "10/06/2026", "10/06/26"
  s = stripEmbeddedDate(s)

  // Remove códigos numéricos longos no fim (IDs de transação)
  s = s.replace(/\s+\d{6,}$/g, '')

  // Remove "- SP", "- RJ" (estados abreviados no final)
  s = s.replace(/\s+-\s+[A-Z]{2}$/g, '')

  // Limpa espaços extras
  s = s.replace(/\s+/g, ' ').trim()

  return s || raw
}

const stripAccents = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A palavra-chave precisa começar uma palavra: "tim" (a operadora) casava no
// meio de "inves-TIM-entos" e mandava aplicação para Moradia. Palavra-chave
// com espaço no fim ("bar ", "oi ") também precisa terminar a palavra.
function hasKeyword(text: string, keyword: string): boolean {
  const kw = stripAccents(keyword.toLowerCase())
  const word = escapeRegex(kw.trim())
  const end = kw.endsWith(' ') ? '(?![a-z0-9])' : ''
  return new RegExp(`(?:^|[^a-z0-9])${word}${end}`).test(text)
}

// Categorias que entraram na árvore padrão em out/2026. Quem criou a conta
// antes pode não ter: aí a sugestão cai na categoria antiga equivalente
// (ou em "Outros"), para nunca gravar um nome de categoria que não existe.
const NEW_CATEGORY_FALLBACK: Record<string, string[]> = {
  Viagens: ['Lazer'],
  Assinaturas: ['Lazer'],
  Compras: ['Pessoal', 'Cuidados pessoais'],
  'Família e pets': [],
}

export function fitGuessedCategory(category: string, available: string[]): string {
  const fallback = NEW_CATEGORY_FALLBACK[category]
  if (!fallback) return category
  const has = (name: string) => available.find(a => a.trim().toLowerCase() === name.toLowerCase())
  return has(category) ?? fallback.map(has).find(Boolean) ?? 'Outros'
}

export function guessCategory(description: string, type: TransactionType): string {
  const lower = stripAccents(description.toLowerCase())

  if (type === 'receita') {
    for (const kw of CATEGORY_KEYWORDS['Salário']) {
      if (hasKeyword(lower, kw)) return 'Salário'
    }
    for (const kw of CATEGORY_KEYWORDS['Freelance']) {
      if (hasKeyword(lower, kw)) return 'Freelance'
    }
    return 'Outros'
  }

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (cat === 'Salário' || cat === 'Freelance' || cat === 'Outros') continue
    for (const kw of keywords) {
      if (hasKeyword(lower, kw)) return cat
    }
  }

  return 'Outros'
}

function parseOFXDate(raw: string): string {
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
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  const matches = [...normalized.matchAll(trnRegex)]

  if (matches.length === 0) {
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

  const description = cleanDescription(memo)
  const category = guessCategory(description, type)

  return { description, amount: absAmount, date, type, category }
}
