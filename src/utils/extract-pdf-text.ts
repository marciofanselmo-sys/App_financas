'use client'

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] // "%PDF-"

// Alguns downloads de fatura vêm com um bloco de bytes de lixo (geralmente
// zeros) antes do cabeçalho real do PDF — visto na prática com fatura do
// Inter baixada pelo navegador. Procura "%PDF-" nos primeiros 2MB do arquivo
// em vez de assumir que ele começa logo no byte 0.
function findPdfHeaderOffset(bytes: Uint8Array): number {
  const limit = Math.min(bytes.length - PDF_SIGNATURE.length, 2_000_000)
  for (let i = 0; i <= limit; i++) {
    let match = true
    for (let j = 0; j < PDF_SIGNATURE.length; j++) {
      if (bytes[i + j] !== PDF_SIGNATURE[j]) { match = false; break }
    }
    if (match) return i
  }
  return -1
}

// Extração de texto de PDF via pdf.js — compartilhada por todos os parsers de
// PDF (Mercado Pago, Inter, e futuros). Lança 'empty-pdf' se não achar texto
// extraível (ex: arquivo escaneado, sem camada de texto).
export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  // Use local worker copy (public/pdf.worker.min.mjs) — CDN é instável nessa versão
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const original = new Uint8Array(buffer)

  let pdf
  try {
    // pdf.js "transfere" (detach) o buffer que recebe pro worker interno,
    // mesmo quando a promise acaba rejeitando — por isso passamos uma CÓPIA
    // pra essa primeira tentativa, nunca o `original` direto. Sem isso, a
    // segunda tentativa (com o cabeçalho recortado) já nasceria com um
    // ArrayBuffer inutilizável, mesmo achando o offset certo.
    pdf = await pdfjsLib.getDocument({ data: original.slice() }).promise
  } catch (firstErr) {
    // Primeira tentativa falhou — pode ser o problema do cabeçalho deslocado.
    // Só tenta de novo se achar um "%PDF-" real mais adiante; senão, era outro erro.
    const offset = findPdfHeaderOffset(original)
    if (offset <= 0) throw firstErr
    pdf = await pdfjsLib.getDocument({ data: original.slice(offset) }).promise
  }

  const parts: string[] = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const tc = await page.getTextContent()
    for (const item of tc.items) {
      if ('str' in item && item.str.trim()) parts.push(item.str.trim())
    }
  }

  const fullText = parts.join(' ').replace(/\s+/g, ' ')
  if (!fullText.trim()) throw new Error('empty-pdf')
  return fullText
}
