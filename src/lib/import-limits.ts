/** Limites de importação — mitiga DoS no browser (checklist 12.19) */
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024 // 5 MB
export const MAX_IMPORT_ROWS = 10_000

export function validateImportFile(file: File): { ok: true } | { ok: false; error: string } {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return {
      ok: false,
      error: `Arquivo muito grande (máx. ${MAX_IMPORT_FILE_BYTES / (1024 * 1024)} MB).`,
    }
  }
  return { ok: true }
}

export function validateImportRowCount(count: number): { ok: true } | { ok: false; error: string } {
  if (count > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `Arquivo com muitas linhas (máx. ${MAX_IMPORT_ROWS.toLocaleString('pt-BR')}).`,
    }
  }
  return { ok: true }
}
