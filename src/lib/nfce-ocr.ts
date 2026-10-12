'use client'

import { Gray, prepareForOcr, toGray } from '@/lib/nfce-image'
import { NfceReading, NfceResult, readNfceLines, resolveReadings } from '@/utils/parse-nfce'

/**
 * Leitura da nota no próprio navegador (Tesseract, sem IA e sem mandar a foto
 * para fora). Os arquivos ficam em /public/ocr — a política de segurança do
 * app não deixa carregar script nem worker de outro domínio.
 *
 * Primeira leitura baixa ~4,5 MB (motor + português) e fica em cache.
 */

interface TesseractWorker {
  setParameters(p: Record<string, string>): Promise<unknown>
  recognize(image: HTMLCanvasElement | Blob): Promise<{ data: { text: string } }>
  terminate(): Promise<unknown>
}
interface TesseractGlobal {
  createWorker(lang: string, oem: number, options: Record<string, unknown>): Promise<TesseractWorker>
}

let scriptPromise: Promise<TesseractGlobal> | null = null

// Motor com o .wasm em arquivo separado: a versão "tudo em um" busca o wasm
// por data: URL, que a política de segurança (connect-src) bloqueia. SIMD
// quando o navegador tem (mais rápido); senão, a versão comum.
function corePath(): string {
  const simdProbe = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])
  let simd = false
  try { simd = WebAssembly.validate(simdProbe) } catch { simd = false }
  return simd ? '/ocr/tesseract-core-simd-lstm.js' : '/ocr/tesseract-core-lstm.js'
}

function loadTesseract(): Promise<TesseractGlobal> {
  const w = window as unknown as { Tesseract?: TesseractGlobal }
  if (w.Tesseract) return Promise.resolve(w.Tesseract)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const el = document.createElement('script')
      el.src = '/ocr/tesseract.min.js'
      el.async = true
      el.onload = () => (w.Tesseract ? resolve(w.Tesseract) : reject(new Error('Leitor não carregou.')))
      el.onerror = () => { scriptPromise = null; reject(new Error('Não foi possível carregar o leitor de notas.')) }
      document.head.appendChild(el)
    })
  }
  return scriptPromise
}

/** Imagem (arquivo da galeria ou quadro da câmera) → tons de cinza. */
export async function imageToGray(source: Blob | HTMLCanvasElement): Promise<Gray> {
  let canvas: HTMLCanvasElement
  if (source instanceof HTMLCanvasElement) {
    canvas = source
  } else {
    // imageOrientation: foto de celular em pé vem deitada sem isso.
    const bmp = await createImageBitmap(source, { imageOrientation: 'from-image' })
    // Teto de 12 MP: o suficiente para a nota e sem estourar a memória do celular.
    const s = Math.min(1, Math.sqrt(12_000_000 / (bmp.width * bmp.height)))
    canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * s)
    canvas.height = Math.round(bmp.height * s)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return toGray(data, canvas.width, canvas.height)
}

function grayToCanvas(g: Gray): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = g.width
  canvas.height = g.height
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(g.width, g.height)
  for (let i = 0, j = 0; j < g.data.length; i += 4, j++) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = g.data[j]
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

export type OcrStage = 'carregando' | 'lendo' | 'conferindo'

const closesAll = (r: NfceResult) => r.total != null && r.items.length > 0 && r.items.every(i => !i.doubtful)
  && Math.round(r.items.reduce((s, i) => s + i.amount, 0) * 100) === Math.round(r.total * 100)

/**
 * Lê a nota em tamanhos diferentes — o OCR erra coisas diferentes em cada um —
 * e junta as leituras: cada item fica com o valor mais votado, e o valor da
 * transação desempata. Para na primeira leitura que já fecha tudo.
 */
export async function readReceipt(
  gray: Gray,
  /** Valor da transação; null na Nova nota fiscal (o total sai da própria nota). */
  target: number | null,
  onStage?: (stage: OcrStage, pass: number) => void,
): Promise<NfceResult> {
  onStage?.('carregando', 0)
  const T = await loadTesseract()
  const worker = await T.createWorker('por', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: corePath(),
    langPath: '/ocr',
    gzip: true,
    // Sem cache próprio (IndexedDB): um arquivo ruim guardado ali quebraria o
    // leitor para sempre naquele aparelho. O cache do navegador já evita
    // baixar de novo.
    cacheMethod: 'none',
    // Worker pelo endereço, não por blob: a política de segurança só libera 'self'.
    workerBlobURL: false,
  })
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' })
    const readings: NfceReading[] = []
    const widths = [2800, 2400, 3200]
    for (let i = 0; i < widths.length; i++) {
      onStage?.('lendo', i + 1)
      const prepared = prepareForOcr(gray, true, widths[i])
      const { data } = await worker.recognize(grayToCanvas(prepared))
      readings.push(readNfceLines(data.text))
      // Na nota nova também precisa da data; sem ela, lê de novo.
      const partial = resolveReadings(readings, target ?? undefined)
      if (i === 0 && closesAll(partial) && (target != null || partial.date)) break
    }
    onStage?.('conferindo', readings.length)
    return resolveReadings(readings, target ?? undefined)
  } finally {
    await worker.terminate()
  }
}
