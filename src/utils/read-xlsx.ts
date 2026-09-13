import readXlsxFile, { readSheet } from 'read-excel-file/browser'

export type XlsxCell = string | number | boolean | Date | null | undefined
export type XlsxRow = XlsxCell[]

/** Converte serial de data do Excel em ISO (YYYY-MM-DD) */
export function excelSerialToISO(serial: number): string {
  const epoch = Date.UTC(1899, 11, 30)
  const d = new Date(epoch + serial * 86400000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function toInput(fileOrBuffer: File | Blob | ArrayBuffer): File | Blob {
  return fileOrBuffer instanceof ArrayBuffer ? new Blob([fileOrBuffer]) : fileOrBuffer
}

export async function readXlsxSheetRows(
  fileOrBuffer: File | Blob | ArrayBuffer,
  sheet: string | number = 1,
): Promise<XlsxRow[]> {
  const input = toInput(fileOrBuffer)

  if (typeof sheet === 'string') {
    return (await readSheet(input, sheet)) as XlsxRow[]
  }

  const sheets = await readXlsxFile(input)
  const target = sheets[sheet - 1]
  if (!target) throw new Error('Planilha não encontrada.')
  return target.data as XlsxRow[]
}

export async function readXlsxSheetNames(file: File | Blob): Promise<string[]> {
  const sheets = await readXlsxFile(file)
  return sheets.map(item => item.sheet)
}

export function rowsToHeaderObjects(rows: XlsxRow[]): Record<string, string>[] {
  if (!rows.length) return []
  const headers = rows[0].map(cell => String(cell ?? '').trim())
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {}
    headers.forEach((header, index) => {
      if (!header) return
      obj[header] = String(row[index] ?? '')
    })
    return obj
  })
}
