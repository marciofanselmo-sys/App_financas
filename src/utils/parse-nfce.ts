/**
 * Leitor do texto de uma nota fiscal de consumidor (NFC-e / cupom), vindo do
 * OCR da foto. Mesma linha dos leitores de extrato: regras fixas, sem IA.
 *
 * O OCR de papel térmico erra dígitos (6,99 vira "659", 25,90 vira "25,30").
 * Por isso cada item é conferido pela própria nota — quantidade × valor
 * unitário tem que dar o total da linha. O que não fecha volta marcado como
 * duvidoso, e a tela de revisão pede para o usuário conferir.
 */

import { addAbbreviations, correctWord, knownWords } from './nfce-words'

export interface NfceItem {
  description: string
  amount: number
  /** Valor não conferido (quantidade × unitário não bateu ou não foi lido). */
  doubtful: boolean
  /**
   * Identidade do produto para o catálogo de nomes: "gtin:789…" (código de
   * barras conferido pelo dígito verificador) ou "loja:<cnpj>:<código>"
   * (código interno do mercado). Sem código confiável, fica vazio.
   */
  key?: string
}

export interface NfceResult {
  items: NfceItem[]
  /** Desconto lido na nota (já repartido entre os itens quando fechou a conta). */
  discount: number | null
  /** Cabeçalho e rodapé da nota — usados na "Nova nota fiscal", sem transação. */
  store?: string | null
  /** Data de emissão, AAAA-MM-DD. */
  date?: string | null
  /** Valor total (a pagar) da nota. */
  total?: number | null
}

// Unidades que aparecem entre a descrição e o preço ("1UN X 6,99", "1,006KG X 24,90").
// "UK"/"UH": o OCR troca o N do UN.
const UNIT = '(?:UN|UK|UH|UND|UNID|KG|LT|L|ML|G|CX|PC|PCT|FD|DZ|M|M2|M3|PAR|BD|SC)'

// Abreviações comuns nos cupons de mercado. Só troca a palavra inteira.
// CU: o OCR lê o V de "CV" como U.
const ABBREV: Record<string, string> = {
  LING: 'linguiça', LINGUICA: 'linguiça', CV: 'cerveja', CU: 'cerveja', CERV: 'cerveja', REFRIG: 'refrigerante', REFRI: 'refrigerante',
  LTE: 'leite', QJO: 'queijo', PRES: 'presunto', MUSS: 'muçarela', IOG: 'iogurte', MANT: 'manteiga', MARG: 'margarina',
  BISC: 'biscoito', CHOC: 'chocolate', CHOCOL: 'chocolate', ARR: 'arroz', FEIJ: 'feijão', FEIJAO: 'feijão',
  MACARRAO: 'macarrão', OLEO: 'óleo', ACUC: 'açúcar', ACUCAR: 'açúcar', CAFE: 'café', SABON: 'sabonete',
  DET: 'detergente', AMAC: 'amaciante', DESOD: 'desodorante', SHAMP: 'shampoo', FRANG: 'frango', BOV: 'bovina',
  SUIN: 'suína', REQ: 'requeijão', REQUEIJAO: 'requeijão', AGUA: 'água', TRAD: 'tradicional', INTEG: 'integral',
  DESN: 'desnatado', SEMID: 'semidesnatado', MORT: 'mortadela', SALS: 'salsicha', PAO: 'pão', HIGIEN: 'higiênico',
}

// Linhas que têm valor mas não são produto.
const NOT_ITEM = /TOTAL|SUBTOTAL|PAGAMENTO|PAGO|TROCO|DESCONTO|ACRESC|CREDITO|DEBITO|DINHEIRO|PIX|TRIBUT|CNPJ|CPF|IBPT|PROTOCOLO|EMISS|CHAVE|CONSULT|FEDERAL|ESTADUAL|LEI |NFC|SERIE|VALOR A PAGAR|CARTAO|MASTERCARD|VISA|ELO/i

/** Dígitos trocados por letras parecidas, só dentro de números. */
function fixDigits(s: string): string {
  return s.replace(/[Oo]/g, '0').replace(/[IlJ|]/g, '1').replace(/G/g, '6').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2')
}

function toNumber(s: string): number {
  return Number(fixDigits(s).replace(/\s/g, '').replace(/[;:]/g, ',').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
}

const round2 = (n: number) => Math.round(n * 100) / 100

// Valor em reais: "25,05", "6;99", "1.234,50". O lookbehind evita pegar o meio de um código.
// Um dígito a mais depois dos centavos ("25,907") é sujeira do OCR.
const MONEY = /(?<![\d,.])(\d{1,3}(?:\.\d{3})+|\d{1,5})\s?[,.;:]\s?(\d{2})\d?(?!\d)(?![,.]\d)/g

interface MoneyHit { value: number; index: number; end: number }

function moneyHits(line: string): MoneyHit[] {
  const out: MoneyHit[] = []
  for (const m of line.matchAll(MONEY)) {
    out.push({ value: toNumber(`${m[1]},${m[2]}`), index: m.index!, end: m.index! + m[0].length })
  }
  return out
}

addAbbreviations(ABBREV)

/** "LING MISTA FINA" → "Linguiça mista fina"; "LTUG NISTA" (OCR) também. */
export function prettifyDescription(raw: string): string {
  const words = raw
    .replace(/[^A-Za-zÀ-ÿ0-9%/.,\- ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => {
      const key = w.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.$/, '')
      return ABBREV[key] ?? correctWord(w) ?? w.toLowerCase()
    })
  const text = words.join(' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''
}

/** Tira o número do item e o código do começo da linha; devolve o código lido. */
function stripPrefix(s: string): { rest: string; code: string | null } {
  const tokens = s.trim().split(/\s+/)
  const digitsOf = (t: string) => fixDigits(t.replace(/[^\w]/g, '')).replace(/\D/g, '')
  // Código de barras (6+ dígitos) entre os primeiros pedaços: tudo até ele sai,
  // inclusive letras soltas que o OCR inventou antes ("E T8985958547028").
  const barcode = tokens.slice(0, 4).findIndex(t => (t.match(/\d/g) ?? []).length >= 6)
  if (barcode >= 0) return { rest: tokens.slice(barcode + 1).join(' '), code: digitsOf(tokens[barcode]) }
  // Senão, até três pedaços iniciais que são "quase só números" (item, código curto, lixo).
  let i = 0
  const numeric: string[] = []
  while (i < tokens.length && i < 3) {
    const t = tokens[i].replace(/[^\w]/g, '')
    const digits = (t.match(/\d/g) ?? []).length
    if (t === '' || (digits > 0 && digits / t.length >= 0.6) || /^[\W_]+$/.test(tokens[i])) {
      if (digits > 0) numeric.push(digitsOf(tokens[i]))
      i++
    } else break
  }
  // "1 7702 LING…": o primeiro número é o do item; o segundo, o código.
  const code = numeric.length >= 2 ? numeric[1] : null
  return { rest: tokens.slice(i).join(' '), code: code && code.length >= 3 ? code : null }
}

/** Dígito verificador do código de barras (EAN-8, UPC-12, EAN-13, GTIN-14). */
export function validGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length) || /^0+$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()!
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

/** CNPJ com dígitos verificadores certos (só dígitos), ou null. */
export function validCnpj(raw: string): string | null {
  const c = fixDigits(raw).replace(/\D/g, '')
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return null
  const dv = (base: string) => {
    const w = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const r = base.split('').reduce((s, d, i) => s + Number(d) * w[i], 0) % 11
    return r < 2 ? 0 : 11 - r
  }
  const d1 = dv(c.slice(0, 12)), d2 = dv(c.slice(0, 12) + d1)
  return c.endsWith(`${d1}${d2}`) ? c : null
}

/** Chave do produto no catálogo de nomes (ver NfceItem.key). */
function productKey(code: string | null, cnpj: string | null): string | undefined {
  if (!code) return undefined
  if (validGtin(code)) return `gtin:${code}`
  // Código curto é do sistema do mercado: só vale junto com o CNPJ dele.
  if (cnpj && code.length >= 3 && code.length <= 7) return `loja:${cnpj}:${code}`
  return undefined
}

interface ParsedLine {
  description: string
  /** Código lido no começo da linha (só dígitos). */
  code: string | null
  /** Valores possíveis, do mais provável ao menos. */
  candidates: number[]
  /** Quantidade × unitário bateu com o total da linha. */
  confirmed: boolean
  /** Tem "quantidade + unidade" (1UN, 1,006KG): é linha de produto, mesmo sem valor legível. */
  structured: boolean
}

function parseItemLine(line: string): ParsedLine | null {
  const hits = moneyHits(line)
  // Total da linha: o último valor, colado no fim (sobra no máximo um lixo curto).
  let total: number | null = null
  let bareTotal: number | null = null
  let cutAt = line.length
  const last = hits[hits.length - 1]
  if (last && line.slice(last.end).replace(/[^\w]/g, '').length <= 2) {
    total = last.value
    cutAt = last.index
  } else {
    // "659" no fim: vírgula perdida no OCR. Só um palpite (6,59).
    const bare = line.match(/(?:^|\s)([\dOoIlSGBZ]{3,6})\W{0,2}$/)
    if (bare && /\d{2}/.test(bare[1])) {
      const digits = fixDigits(bare[1])
      bareTotal = Number(`${digits.slice(0, -2)}.${digits.slice(-2)}`)
      cutAt = line.length - bare[0].length
    }
  }

  // Quantidade, unidade e unitário: "1,006KG X 24,90", "1UN.% 6,99".
  const qtyRe = new RegExp(`((?:\\d|(?<=\\s)[JIl|])\\d{0,3}(?:[,.][\\dOoG]{1,3})?)\\s?(${UNIT})\\b\\.?\\s*[xX%*×yY]?\\s*`, 'gi')
  const head = line.slice(0, cutAt)
  // A ÚLTIMA quantidade da linha: "LTE COND MOCA 395G 2 UN X 7,49" — o 395G
  // é parte do nome; a quantidade comprada é a que vem antes do preço.
  const q = [...head.matchAll(qtyRe)].pop() ?? null
  let qty: number | null = null
  let unitPrice: number | null = null
  let unit = ''
  let descEnd = cutAt
  if (q) {
    // Na quantidade, ponto e vírgula são sempre decimais ("1.006KG" = 1,006 kg).
    qty = Number(fixDigits(q[1]).replace(',', '.'))
    unit = q[2].toUpperCase()
    descEnd = q.index!
    const after = moneyHits(head.slice(q.index! + q[0].length))
    if (after.length > 0) unitPrice = after[0].value
  } else {
    // Sem unidade legível: a descrição vai até o primeiro valor — ou até um
    // "1UN" ilegível ("JãA UN x"), o que vier antes.
    const first = moneyHits(head)[0]
    if (first) {
      unitPrice = first.value
      descEnd = first.index
    }
    const garbledQty = head.match(new RegExp(`\\s\\S{0,4}\\s?(?:UN|UK|UH|KG)\\b`, 'i'))
    if (garbledQty && garbledQty.index! < descEnd) descEnd = garbledQty.index!
  }

  // "BANANA PRATA KG": a unidade solta no fim do nome sai.
  // Também o resto de um "1UN X" mal lido ("tun x") que ficou grudado no nome.
  const prefix = stripPrefix(line.slice(0, descEnd))
  const rawDesc = prefix.rest
    .replace(/\s+\S?UN\.?\s*[xX%*]?\s*$/i, '')
    .replace(new RegExp(`\\s+${UNIT}\\.?$`, 'i'), '')
  if ((rawDesc.match(/[A-Za-zÀ-ÿ]/g) ?? []).length < 3) return null

  const computed = qty != null && unitPrice != null && qty > 0 ? round2(qty * unitPrice) : null
  let candidates: number[]
  let confirmed = false
  if (total != null && computed != null && Math.abs(total - computed) <= 0.011) {
    candidates = [total]
    confirmed = true
  } else if (total != null && unitPrice != null && qty == null && Math.abs(total - unitPrice) <= 0.011) {
    // "UN" ilegível, mas unitário = total (quantidade 1).
    candidates = [total]
    confirmed = true
  } else if (total == null && bareTotal != null && computed != null) {
    // Coluna do total ilegível ("659"), mas quantidade × unitário foi lido.
    candidates = [computed]
    confirmed = true
  } else {
    // Quantidade inteira pequena: o unitário (meio da linha) costuma sair mais
    // limpo que a coluna do total. Peso: o total da linha vem primeiro. O
    // número sem vírgula ("25590") é o palpite mais fraco, sempre por último.
    const qtyFirst = qty != null && Number.isInteger(qty) && qty <= 20
    const list = qtyFirst ? [computed, total] : [total, computed]
    if (qty == null) list.push(unitPrice)
    list.push(bareTotal)
    candidates = [...new Set(list.filter((v): v is number => v != null && v > 0).map(round2))]
  }
  // Sem valor legível só fica se for claramente produto (tem quantidade e
  // unidade): o valor sai do que falta para fechar a compra.
  if (candidates.length === 0 && (!q || (rawDesc.match(/[A-Za-zÀ-ÿ]/g) ?? []).length < 5)) return null

  let description = prettifyDescription(rawDesc)
  // Produto por peso: o peso ajuda a reconhecer o item depois.
  if (unit === 'KG' && qty != null && qty !== 1) description += ` ${String(qty).replace('.', ',')} kg`
  return { description, code: prefix.code, candidates, confirmed, structured: !!q }
}

/**
 * Escolhe um valor por item. Se alguma combinação dos valores possíveis
 * fecha exatamente com a transação, é ela — o total da compra confere a
 * leitura. Senão, fica o mais provável de cada um, marcado como duvidoso.
 */
function resolve(lines: ParsedLine[], target?: number): NfceItem[] {
  // Item sem valor lido: só dá para preencher se for o único — com o que falta.
  const blank = lines.map((l, i) => (l.candidates.length === 0 ? i : -1)).filter(i => i >= 0)
  if (blank.length > 0) {
    const rest = lines.filter(l => l.candidates.length > 0)
    if (blank.length > 1 || target == null) return resolve(rest, target)
    const others = resolve(rest)
    const left = round2(target - others.reduce((s, i) => s + i.amount, 0))
    if (left <= 0) return others
    const items = [...others]
    items.splice(blank[0], 0, { description: lines[blank[0]].description, amount: left, doubtful: true })
    return items
  }
  const pick = lines.map(l => l.candidates[0])
  const open = lines.map((l, i) => (l.confirmed ? -1 : i)).filter(i => i >= 0)
  if (target != null && open.length > 0 && open.length <= 10) {
    const fixed = lines.reduce((s, l, i) => (open.includes(i) ? s : s + pick[i]), 0)
    const want = Math.round((target - fixed) * 100)
    let found: number[] | null = null
    let count = 0
    const walk = (k: number, acc: number, chosen: number[]) => {
      if (count > 1) return
      if (k === open.length) {
        if (acc === want) { count++; if (!found) found = [...chosen] }
        return
      }
      for (const c of lines[open[k]].candidates) walk(k + 1, acc + Math.round(c * 100), [...chosen, c])
    }
    walk(0, 0, [])
    // Só confia quando a combinação é única.
    if (found && count === 1) {
      return lines.map((l, i) => {
        const k = open.indexOf(i)
        return { description: l.description, amount: k >= 0 ? found![k] : pick[i], doubtful: false }
      })
    }
  }
  return lines.map((l, i) => ({ description: l.description, amount: pick[i], doubtful: !l.confirmed }))
}

export interface NfceReading {
  lines: ParsedLine[]
  discount: number | null
  cnpj: string | null
  store: string | null
  /** Datas lidas (emissão, autorização…): a mais repetida entre as leituras vence. */
  dates: string[]
  /** Chave de acesso (44 dígitos) conferida pelo dígito verificador. */
  accessKey: string | null
  /** Ano e mês (AAMM) do começo da chave, mesmo sem a chave inteira conferida. */
  keyYm: string | null
  /** Valores que podem ser o total (linhas de total e de pagamento), do mais provável ao menos. */
  totals: number[]
}

const LEGAL_SUFFIX = /\b(LTDA|LIDA|LTD|ME|EPP|EIRELI|S\s?\/?\s?A|SA)\b\.?/gi

/** Nome da loja: a primeira linha do cabeçalho com cara de razão social. */
function readStore(lines: string[]): string | null {
  const cnpjAt = lines.findIndex(l => /CN[PF]J/i.test(l))
  const head = lines.slice(0, cnpjAt > 0 ? cnpjAt : 6)
  const clean = (l: string) => l.replace(/[^A-Za-zÀ-ÿ&\s]/g, ' ').replace(LEGAL_SUFFIX, ' ').replace(/\s+/g, ' ').trim()
  const looksLikeName = (l: string) => /LTDA|LIDA|S\/A|EIRELI|SUPERMERC|MERCAD|COMERCI|ATACAD|DISTRIBUI|PADARIA|PANIFICADORA|FARMACIA|DROGARIA|HORTI|ACOUGUE|EMPORIO/i.test(l)
  const chosen = head.find(looksLikeName) ?? head.find(l => (clean(l).match(/[A-Za-zÀ-ÿ]/g) ?? []).length >= 8)
  if (!chosen) return null
  const name = clean(chosen).split(' ').filter(w => w.length > 1 || /[A-Z]/i.test(w))
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  return name.length >= 4 ? name.slice(0, 80) : null
}

/**
 * Datas da nota (emissão e autorização primeiro). Data no futuro ou de mais
 * de 2 anos atrás é dígito trocado pelo OCR ("2076") e fica de fora.
 */
function readDates(lines: string[]): string[] {
  const now = new Date()
  const max = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const min = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())
  const out: string[] = []
  // Emissão e autorização primeiro (são a data da compra); depois as outras.
  const ordered = [...lines.filter(l => /EMISS|EMITID|AUTORIZ/i.test(l)), ...lines.filter(l => !/EMISS|EMITID|AUTORIZ/i.test(l))]
  for (const l of ordered) {
    for (const m of fixDigits(l).matchAll(/(\d{2})[/.-](\d{2})[/.-](\d{4})/g)) {
      const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
      const dt = new Date(y, mo - 1, d)
      if (mo < 1 || mo > 12 || d < 1 || d > 31 || dt.getMonth() !== mo - 1 || dt > max || dt < min) continue
      out.push(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
  }
  return out
}

/**
 * Valores que podem ser o total: "VALOR A PAGAR", "VALOR TOTAL", "VALOR PAGO"
 * e a linha do pagamento ("CREDITO (Mastercard…) 57,94"). O OCR erra um
 * dígito com facilidade, então todos viram candidatos — quem decide é a soma
 * dos itens.
 */
function readTotals(lines: string[]): number[] {
  const out: number[] = []
  for (const re of [/VALOR\s*A\s*PAGAR/i, /VALOR\s*TOTAL|TOTAL\s*R\$/i, /VALOR\s*PAGO/i,
    /CR[EÉ]DITO|D[EÉ]BITO|DINHEIRO|\bPIX\b|CART[AÃ]O|VALE/i]) {
    for (const l of lines) {
      if (!re.test(l) || /TRIBUT|TROCO|DESCONTO/i.test(l)) continue
      const hits = moneyHits(l)
      if (hits.length) out.push(hits[hits.length - 1].value)
    }
  }
  return out
}

/**
 * Chave de acesso da NFC-e: 44 dígitos (em grupos de 4) com dígito
 * verificador módulo 11. Posições 3–6 são o ano e o mês da emissão (AAMM).
 */
export function readAccessKey(lines: string[]): string | null {
  for (const l of lines) {
    const digits = fixDigits(l.replace(/[^\dOoIlSB\s]/g, ' ')).replace(/\D/g, '')
    for (let i = 0; i + 44 <= digits.length; i++) {
      const k = digits.slice(i, i + 44)
      const body = k.slice(0, 43).split('').map(Number)
      let w = 2, sum = 0
      for (let j = body.length - 1; j >= 0; j--) { sum += body[j] * w; w = w === 9 ? 2 : w + 1 }
      const r = sum % 11
      if ((r < 2 ? 0 : 11 - r) === Number(k[43])) return k
    }
  }
  return null
}

/**
 * Ano e mês da chave de acesso a partir da linha dela ("3126 0508 …": UF 31,
 * 26 = 2026, 05 = maio), quando a chave inteira não fecha o dígito
 * verificador. Votado entre as leituras — o começo da chave quase sempre sai igual.
 */
function readKeyYm(lines: string[]): string | null {
  for (const l of lines) {
    const groups = fixDigits(l).match(/\d{4}/g) ?? []
    if (groups.length < 9) continue
    const d = groups.join('')
    const uf = Number(d.slice(0, 2)), mo = Number(d.slice(4, 6))
    if (uf >= 11 && uf <= 53 && mo >= 1 && mo <= 12) return d.slice(2, 6)
  }
  return null
}

/** O valor mais repetido entre as leituras (empate: o da primeira). */
function mostCommon<T>(values: (T | null | undefined)[]): T | null {
  const list = values.filter((v): v is T => v != null)
  let best: T | null = null, bestN = 0
  for (const v of list) {
    const n = list.filter(x => x === v).length
    if (n > bestN) { best = v; bestN = n }
  }
  return best
}

/**
 * @param text   texto do OCR, uma linha por linha da nota
 * @param target valor da transação que está sendo diluída
 */
export function parseNfceText(text: string, target?: number): NfceResult {
  return resolveReadings([readNfceLines(text)], target)
}

/** Uma leitura do OCR → linhas de item, ainda sem decidir os valores. */
export function readNfceLines(text: string): NfceReading {
  const lines = text.split(/\r?\n/).map(l => l.replace(/[—–]/g, '-').trim()).filter(Boolean)

  // Região dos itens: depois do cabeçalho "Código Descrição…", antes de "QTD. TOTAL"/"VALOR TOTAL".
  let start = lines.findIndex(l => /C[OÓ0]D|DESCRI/i.test(l) && /(QT|V[LI1]R|UN|TOTAL)/i.test(l))
  start = start < 0 ? 0 : start + 1
  let end = lines.findIndex((l, i) => i >= start && /QT[DY0O]\.?\s*TOTAL|TOTAL\s+DE\s+[I1]TENS|VALOR\s+TOTAL|VALOR\s+A\s+PAGAR|FORMA\s+DE\s+PAG/i.test(l))
  if (end < 0) end = lines.length

  let discount: number | null = null
  for (const l of lines) {
    if (/DESCONTO/i.test(l)) {
      const hits = moneyHits(l)
      if (hits.length) discount = hits[hits.length - 1].value
    }
  }

  const parsed: ParsedLine[] = []
  for (let i = start; i < end; i++) {
    let line = lines[i]
    if (NOT_ITEM.test(line)) continue
    // Descrição numa linha e "1 UN X 6,99 6,99" na de baixo.
    const next = lines[i + 1]
    if (next && i + 1 < end && moneyHits(line).length === 0 && moneyHits(next).length > 0
        && (next.match(/[A-Za-zÀ-ÿ]/g) ?? []).length < 8) {
      line = `${line} ${next}`
      i++
    }
    const item = parseItemLine(line)
    if (item) parsed.push(item)
  }
  // CNPJ do mercado (para os códigos internos dele no catálogo).
  let cnpj: string | null = null
  for (const l of lines) {
    const m = l.match(/CN[PF]J[^\dOo]{0,4}([\dOoIlSB.\/\-\s]{14,24})/i)
    if (m && (cnpj = validCnpj(m[1]))) break
  }
  return { lines: parsed, discount, cnpj, store: readStore(lines), dates: readDates(lines), accessKey: readAccessKey(lines), keyYm: readKeyYm(lines), totals: readTotals(lines) }
}

// Semelhança entre dois nomes (pares de letras em comum, 0 a 1).
function similarity(a: string, b: string): number {
  const grams = (s: string) => {
    const t = s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')
    const out = new Map<string, number>()
    for (let i = 0; i < t.length - 1; i++) out.set(t.slice(i, i + 2), (out.get(t.slice(i, i + 2)) ?? 0) + 1)
    return out
  }
  const ga = grams(a), gb = grams(b)
  let inter = 0, na = 0, nb = 0
  for (const v of ga.values()) na += v
  for (const v of gb.values()) nb += v
  for (const [k, v] of ga) inter += Math.min(v, gb.get(k) ?? 0)
  return na + nb ? (2 * inter) / (na + nb) : 0
}

/**
 * Junta várias leituras da mesma nota (o OCR erra coisas diferentes em cada
 * tamanho de imagem). O mesmo item nas leituras vira um só; o valor é o mais
 * votado — leitura conferida (quantidade × unitário) vale mais.
 */
export function resolveReadings(readings: NfceReading[], target?: number): NfceResult {
  const clusters: { lines: ParsedLine[]; pos: number }[] = []
  readings.forEach((r, ri) => {
    const used = new Set<number>()
    r.lines.forEach((line, idx) => {
      let best = -1, bestSim = 0.4
      clusters.forEach((c, ci) => {
        if (used.has(ci)) return
        const sim = Math.max(...c.lines.map(l => similarity(l.description, line.description)))
        if (sim > bestSim) { best = ci; bestSim = sim }
      })
      if (best >= 0) { clusters[best].lines.push(line); used.add(best) }
      // Item que só uma leitura posterior viu entra logo antes do que estava
      // na mesma posição — mantém a ordem da nota.
      else { clusters.push({ lines: [line], pos: idx - ri * 0.001 }); used.add(clusters.length - 1) }
    })
  })
  const merged: ParsedLine[] = clusters
    .sort((a, b) => a.pos - b.pos)
    .map(c => {
      const votes = new Map<number, number>()
      const add = (v: number, w: number) => votes.set(v, (votes.get(v) ?? 0) + w)
      for (const l of c.lines) l.candidates.forEach((v, i) => add(v, l.confirmed ? 4 : i === 0 ? 2 : 1))
      const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v)
      const top = ranked[0]
      const confirmedTop = c.lines.some(l => l.confirmed && l.candidates[0] === top)
      // Nome: o que mais se parece com as outras leituras do mesmo item — o
      // erro de OCR de uma leitura raramente se repete nas outras.
      // Antes disso, a leitura com mais palavras de mercado reconhecidas.
      const named = [...c.lines].sort((a, b) =>
        (knownWords(b.description) - knownWords(a.description))
        || (c.lines.reduce((s, o) => s + similarity(b.description, o.description), 0)
          - c.lines.reduce((s, o) => s + similarity(a.description, o.description), 0)))[0]
      // Código: o que passa no dígito verificador; senão o mais repetido.
      const codes = c.lines.map(l => l.code).filter((x): x is string => !!x)
      const code = codes.find(validGtin)
        ?? [...new Set(codes)].sort((a, b) => codes.filter(x => x === b).length - codes.filter(x => x === a).length)[0] ?? null
      return { description: named.description, code, candidates: ranked, confirmed: confirmedTop, structured: c.lines.some(l => l.structured) }
    })
  // Item visto numa leitura só, sem valor conferido, entre várias leituras: ruído.
  const kept = readings.length >= 3
    ? merged.filter((m, i) => m.confirmed || m.structured || clusters[i].lines.length >= 2)
    : merged
  const discount = readings.map(r => r.discount).find(d => d != null) ?? null
  const cnpj = readings.map(r => r.cnpj).find(c => c != null) ?? null
  const store = mostCommon(readings.map(r => r.store)) ?? readings.map(r => r.store).find(s => s) ?? null
  // A chave de acesso diz o ano e o mês certos; das datas lidas, só valem as
  // desse mês. Nenhuma bate: o dia mais lido com o mês e o ano da chave.
  const accessKey = readings.map(r => r.accessKey).find(k => k) ?? null
  const keyYm = accessKey ? accessKey.slice(2, 6) : mostCommon(readings.map(r => r.keyYm))
  const allDates = readings.flatMap(r => r.dates)
  let date = mostCommon(allDates)
  if (keyYm) {
    const ym = `20${keyYm.slice(0, 2)}-${keyYm.slice(2, 4)}`
    const inMonth = allDates.filter(d => d.startsWith(ym))
    const day = mostCommon(allDates.map(d => d.slice(8, 10)))
    const keyed = day ? `${ym}-${day}` : null
    const valid = (d: string | null) => !!d && !Number.isNaN(new Date(`${d}T12:00:00`).getTime()) && new Date(`${d}T12:00:00`).getMonth() + 1 === Number(d.slice(5, 7))
    date = mostCommon(inMonth) ?? (valid(keyed) ? keyed : null) ?? date
  }
  // Sem transação (Nova nota fiscal), quem confere os itens é o total da nota:
  // entre os valores lidos como total, o que fecha com os itens; senão o mais repetido.
  let total: number | null = null
  if (target == null) {
    const all = readings.flatMap(r => r.totals)
    const ranked = [...new Set(all)].sort((a, b) => all.filter(x => x === b).length - all.filter(x => x === a).length)
    total = ranked.find(t => {
      const its = resolve(kept, t)
      return its.length > 0 && its.every(i => !i.doubtful)
        && Math.round(its.reduce((s, i) => s + i.amount, 0) * 100) === Math.round(t * 100)
    }) ?? ranked[0] ?? null
    target = total ?? undefined
  } else {
    total = target
  }
  // Com desconto, os itens somam o valor cheio: é isso que confere a leitura.
  const items = resolve(kept, target != null && discount ? round2(target + discount) : target)
  // resolve() devolve os itens com o mesmo nome das linhas: a chave vem por ele.
  const keyByDesc = new Map(kept.map(l => [l.description, productKey(l.code, cnpj)]))
  for (const it of items) {
    const key = keyByDesc.get(it.description)
    if (key) it.key = key
  }

  // Desconto no fim da nota: reparte proporcionalmente quando é isso que fecha a conta.
  if (discount && target != null && items.length > 0) {
    const sum = round2(items.reduce((s, it) => s + it.amount, 0))
    if (Math.abs(round2(sum - discount) - target) <= 0.011 && sum > 0) {
      let left = round2(discount)
      items.forEach((it, idx) => {
        const share = idx === items.length - 1 ? left : round2(discount * (it.amount / sum))
        it.amount = round2(it.amount - share)
        left = round2(left - share)
      })
    }
  }

  return { items, discount, store, date, total }
}

/**
 * Se só um item ficou duvidoso, o valor dele é o que falta para fechar a
 * transação. Devolve null quando não dá para saber.
 */
export function suggestDoubtfulValue(items: { amount: number; doubtful: boolean }[], target: number): number | null {
  const doubtful = items.filter(i => i.doubtful)
  if (doubtful.length !== 1) return null
  const others = items.filter(i => !i.doubtful).reduce((s, i) => s + i.amount, 0)
  const value = round2(target - others)
  return value > 0 ? value : null
}
