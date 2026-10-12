/**
 * Tratamento da foto da nota antes do OCR, e a checagem da moldura da câmera.
 *
 * Tudo aqui trabalha em tons de cinza (um byte por pixel), sem canvas, para
 * rodar igual no navegador e nos testes. Papel térmico fotografado vem com
 * sombra, fundo e texto desbotado; sem este tratamento o OCR perdia itens
 * inteiros e trocava dígitos (teste com a nota real em 11/10/2026).
 */

export interface Gray { data: Uint8ClampedArray; width: number; height: number }

/** RGBA (canvas) → cinza. */
export function toGray(rgba: Uint8ClampedArray, width: number, height: number): Gray {
  const data = new Uint8ClampedArray(width * height)
  for (let i = 0, j = 0; j < data.length; i += 4, j++) {
    data[j] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000
  }
  return { data, width, height }
}

/** Limiar de Otsu: separa o papel (claro) do fundo. */
function otsu(data: Uint8ClampedArray): number {
  const hist = new Array(256).fill(0)
  for (const v of data) hist[v]++
  const total = data.length
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0, wB = 0, best = 0, threshold = 127
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB, mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > best) { best = between; threshold = t }
  }
  return threshold
}

/** Redimensiona (bilinear). */
export function resize(src: Gray, width: number, height: number): Gray {
  const data = new Uint8ClampedArray(width * height)
  const sx = src.width / width, sy = src.height / height
  for (let y = 0; y < height; y++) {
    const fy = Math.min(src.height - 1, (y + 0.5) * sy - 0.5)
    const y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(src.height - 1, y0 + 1), dy = Math.max(0, fy - y0)
    for (let x = 0; x < width; x++) {
      const fx = Math.min(src.width - 1, (x + 0.5) * sx - 0.5)
      const x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(src.width - 1, x0 + 1), dx = Math.max(0, fx - x0)
      const a = src.data[y0 * src.width + x0], b = src.data[y0 * src.width + x1]
      const c = src.data[y1 * src.width + x0], d = src.data[y1 * src.width + x1]
      data[y * width + x] = (a * (1 - dx) + b * dx) * (1 - dy) + (c * (1 - dx) + d * dx) * dy
    }
  }
  return { data, width, height }
}

function crop(src: Gray, x: number, y: number, w: number, h: number): Gray {
  const data = new Uint8ClampedArray(w * h)
  for (let r = 0; r < h; r++) data.set(src.data.subarray((y + r) * src.width + x, (y + r) * src.width + x + w), r * w)
  return { data, width: w, height: h }
}

/** Média numa janela (2r+1)² via imagem integral. */
function boxMean(src: Gray, r: number): Float32Array {
  const { width: w, height: h, data } = src
  const integ = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += data[y * w + x]
      integ[(y + 1) * (w + 1) + x + 1] = integ[y * (w + 1) + x + 1] + row
    }
  }
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1)
      const s = integ[y1 * (w + 1) + x1] - integ[y0 * (w + 1) + x1] - integ[y1 * (w + 1) + x0] + integ[y0 * (w + 1) + x0]
      out[y * w + x] = s / ((y1 - y0) * (x1 - x0))
    }
  }
  return out
}

/** Máximo numa janela (2r+1)² — "dilata" o claro. */
function maxFilter(src: Gray, r: number): Gray {
  const { width: w, height: h, data } = src
  const tmp = new Uint8ClampedArray(data.length), out = new Uint8ClampedArray(data.length)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0
    for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) m = Math.max(m, data[y * w + k])
    tmp[y * w + x] = m
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0
    for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) m = Math.max(m, tmp[k * w + x])
    out[y * w + x] = m
  }
  return { data: out, width: w, height: h }
}

/** Caixa do papel: linhas e colunas onde a maior parte é clara. */
function paperBox(g: Gray): { x: number; y: number; w: number; h: number } {
  const t = otsu(g.data)
  const { width: w, height: h, data } = g
  const rows = new Array(h).fill(0), cols = new Array(w).fill(0)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[y * w + x] > t) { rows[y]++; cols[x]++ }
  const firstLast = (arr: number[], len: number, min: number) => {
    let a = arr.findIndex(v => v > len * min)
    let b = arr.length - 1 - [...arr].reverse().findIndex(v => v > len * min)
    if (a < 0) { a = 0; b = arr.length - 1 }
    return [a, b]
  }
  const [x0, x1] = firstLast(cols, h, 0.25)
  const [y0, y1] = firstLast(rows, w, 0.2)
  return { x: x0, y: y0, w: Math.max(1, x1 - x0 + 1), h: Math.max(1, y1 - y0 + 1) }
}

/**
 * Foto → imagem pronta para o OCR: recorta o papel, aumenta, tira a sombra
 * (divide pelo fundo estimado) e binariza com limiar local.
 */
export function prepareForOcr(src: Gray, binarize = true, targetWidth = 2400): Gray {
  // A caixa do papel é achada numa versão pequena e aplicada na grande.
  const scaleDown = Math.min(1, 600 / Math.max(src.width, src.height))
  const small = resize(src, Math.max(1, Math.round(src.width * scaleDown)), Math.max(1, Math.round(src.height * scaleDown)))
  const box = paperBox(small)
  const pad = 4
  const bx = Math.max(0, Math.floor((box.x - pad) / scaleDown)), by = Math.max(0, Math.floor((box.y - pad) / scaleDown))
  const bw = Math.min(src.width - bx, Math.ceil((box.w + 2 * pad) / scaleDown))
  const bh = Math.min(src.height - by, Math.ceil((box.h + 2 * pad) / scaleDown))
  // Papel muito pequeno na detecção (fundo claro, por ex.): usa a foto inteira.
  const paper = bw * bh > src.width * src.height * 0.15 ? crop(src, bx, by, bw, bh) : src

  // Largura alvo: com a nota real, 2800–3200 px leu todos os valores; 2400 ou
  // menos trocava dígitos. Quem chama tenta mais de um tamanho.
  // Teto de ~14 MP: o Safari do iPhone não desenha canvas acima de 16,7 MP.
  const scale = Math.min(4, targetWidth / paper.width, Math.sqrt(14_000_000 / (paper.width * paper.height)))
  const g = resize(paper, Math.round(paper.width * scale), Math.round(paper.height * scale))

  // Fundo (iluminação) estimado numa versão reduzida: o máximo local apaga as
  // letras (escuras) e a média alisa — sobra só o papel com a sombra.
  const bgSmall = maxFilter(resize(g, Math.max(1, Math.round(g.width / 8)), Math.max(1, Math.round(g.height / 8))), 2)
  const blurred = boxMean(bgSmall, 3)
  const bgS: Gray = { data: Uint8ClampedArray.from(blurred), width: bgSmall.width, height: bgSmall.height }
  const bg = resize(bgS, g.width, g.height)

  const norm = new Uint8ClampedArray(g.data.length)
  for (let i = 0; i < norm.length; i++) norm[i] = 255 - Math.abs(g.data[i] - bg.data[i])
  let lo = 255, hi = 0
  for (const v of norm) { if (v < lo) lo = v; if (v > hi) hi = v }
  const span = Math.max(1, hi - lo)
  for (let i = 0; i < norm.length; i++) norm[i] = ((norm[i] - lo) * 255) / span

  const normG: Gray = { data: norm, width: g.width, height: g.height }
  // Segunda leitura: só sem sombra, sem binarizar. Em letra fina ou falhada o
  // preto e branco come pedaços do dígito; aqui eles ficam.
  if (!binarize) return normG
  const mean = boxMean(normG, 20)
  const out = new Uint8ClampedArray(norm.length)
  for (let i = 0; i < out.length; i++) out[i] = norm[i] > mean[i] - 15 ? 255 : 0
  return { data: out, width: g.width, height: g.height }
}

export interface FrameCheck {
  /** A nota cabe na moldura, com fundo em volta. */
  inteira: boolean
  /** Bordas do papel retas (até ~4°). */
  reta: boolean
  /** Papel bem iluminado, sem estourar. */
  luz: boolean
  /** Pouca diferença em relação à amostra anterior. */
  firme: boolean
}

/**
 * Checagem da moldura numa amostra pequena (≈ 120 × 180) do que está dentro
 * dela. `prev` é a amostra anterior, para medir tremor.
 */
export function checkFrame(g: Gray, prev: Gray | null): FrameCheck {
  const { width: w, height: h, data } = g
  const t = Math.max(otsu(data), 70)

  // Luz: o papel (parte clara) precisa estar claro, mas não estourado.
  let paperSum = 0, paperN = 0, burnt = 0
  for (const v of data) {
    if (v > t) { paperSum += v; paperN++ }
    if (v >= 250) burnt++
  }
  const paperFrac = paperN / data.length
  const luz = paperN > 0 && paperSum / paperN > 120 && burnt / data.length < 0.3

  // Inteira: papel ocupa boa parte, mas as bordas da moldura mostram fundo
  // (papel que encosta em cima e embaixo está cortado).
  const rowFrac = (y: number) => { let n = 0; for (let x = 0; x < w; x++) if (data[y * w + x] > t) n++; return n / w }
  const band = Math.max(2, Math.round(h * 0.03))
  let topPaper = 0, bottomPaper = 0
  for (let i = 0; i < band; i++) { topPaper += rowFrac(i); bottomPaper += rowFrac(h - 1 - i) }
  topPaper /= band; bottomPaper /= band
  const inteira = paperFrac > 0.3 && paperFrac < 0.92 && topPaper < 0.5 && bottomPaper < 0.5

  // Reta: borda esquerda e direita do papel ao longo da altura (meio da nota).
  const lefts: [number, number][] = [], rights: [number, number][] = []
  for (let y = Math.round(h * 0.2); y < h * 0.8; y += 2) {
    let l = -1, r = -1
    for (let x = 0; x < w; x++) if (data[y * w + x] > t) { l = x; break }
    for (let x = w - 1; x >= 0; x--) if (data[y * w + x] > t) { r = x; break }
    if (l > 0 && r < w - 1 && r - l > w * 0.3) { lefts.push([y, l]); rights.push([y, r]) }
  }
  const slope = (pts: [number, number][]) => {
    if (pts.length < 8) return Infinity
    const n = pts.length
    const my = pts.reduce((s, p) => s + p[0], 0) / n, mx = pts.reduce((s, p) => s + p[1], 0) / n
    let num = 0, den = 0
    for (const [y, x] of pts) { num += (y - my) * (x - mx); den += (y - my) ** 2 }
    return den ? num / den : Infinity
  }
  const maxSlope = Math.tan((4 * Math.PI) / 180)
  const reta = Math.abs(slope(lefts)) < maxSlope && Math.abs(slope(rights)) < maxSlope

  // Firme: diferença média para a amostra anterior.
  let firme = false
  if (prev && prev.data.length === data.length) {
    let diff = 0
    for (let i = 0; i < data.length; i++) diff += Math.abs(data[i] - prev.data[i])
    firme = diff / data.length < 6
  }
  return { inteira, reta, luz, firme }
}
