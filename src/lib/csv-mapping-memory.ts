import { createClient } from '@/lib/supabase/client'
import { logSafeError } from '@/lib/supabase-error'

/**
 * Memória de formatos de CSV: o app aprende o layout de um banco sem parser
 * próprio na primeira importação e reconhece sozinho nas seguintes.
 *
 * Sem isso, todo CSV desconhecido passava pelo mapeamento manual de colunas a
 * cada importação — e o caminho mais curto para o usuário era desistir e
 * digitar os lançamentos à mão. Digitação manual foi a causa de uma conta
 * que divergia do banco por meses.
 */

/**
 * O que o sinal do valor significa. Depende do TIPO de arquivo, não do banco:
 *   - extrato de conta: negativo é dinheiro saindo (saída)
 *   - fatura de cartão: positivo é compra (saída), negativo é pagamento
 * Errar isso importa o arquivo inteiro invertido — todo gasto como receita.
 */
export type SignConvention = 'negativo-saida' | 'negativo-entrada'

export interface CsvMapping {
  data: string
  valor: string
  descricao: string
  tipo?: string
  categoria?: string
  sinal: SignConvention
}

function normalizeHeader(h: string): string {
  return h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Impressão digital do cabeçalho: identifica "o mesmo formato de arquivo".
 *
 * Normaliza caixa, acento e espaço, mas PRESERVA a ordem das colunas — dois
 * arquivos com as mesmas colunas em ordem diferente vêm de exportações
 * diferentes e podem ter significados diferentes. FNV-1a 32 bits: curto para
 * a chave única e sem dependência nenhuma; colisão entre cabeçalhos de
 * extrato é irrelevante na prática, e o mapeamento ainda é validado contra as
 * colunas reais antes de ser usado (ver loadSavedMapping).
 */
export function headerFingerprint(headers: string[]): string {
  const text = headers.map(normalizeHeader).join('|')
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * Chuta a convenção de sinal pela MAIORIA dos valores.
 *
 * Num extrato de conta a maioria das linhas é saída (gasta-se mais vezes do
 * que se recebe) e vem negativa. Numa fatura a maioria é compra e vem
 * positiva. É um chute — o usuário vê e confirma na tela —, mas acerta o caso
 * comum e evita o erro mais caro, que é importar tudo invertido.
 */
export function guessSignConvention(values: number[]): SignConvention {
  const valid = values.filter(v => !isNaN(v) && v !== 0)
  const negatives = valid.filter(v => v < 0).length
  // Empate vai para "negativo é saída": é a convenção universal de extrato
  // bancário — a de fatura (compra positiva) é a exceção. Arquivo pequeno
  // empata fácil: 2 saídas e 2 entradas.
  return negatives >= valid.length / 2 ? 'negativo-saida' : 'negativo-entrada'
}

/**
 * Formato salvo para este cabeçalho — ou null.
 *
 * Só devolve se TODAS as colunas mapeadas ainda existem no arquivo. Se o
 * banco renomeou uma coluna, aplicar o mapeamento antigo leria vazio, e é
 * melhor voltar a perguntar do que importar lançamentos sem valor.
 */
export async function loadSavedMapping(headers: string[]): Promise<CsvMapping | null> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('csv_mappings')
      .select('mapping')
      .eq('user_id', user.id)
      .eq('fingerprint', headerFingerprint(headers))
      .maybeSingle()

    if (error) { logSafeError('csvMapping.load', error); return null }
    if (!data) return null

    const mapping = data.mapping as CsvMapping
    const present = new Set(headers)
    const used = [mapping.data, mapping.valor, mapping.descricao, mapping.tipo, mapping.categoria].filter(Boolean)
    if (!used.every(col => present.has(col as string))) return null

    return mapping
  } catch (err) {
    logSafeError('csvMapping.load', err)
    return null
  }
}

/**
 * Guarda (ou atualiza) o formato. Falhar aqui não pode atrapalhar a
 * importação — no pior caso o usuário mapeia de novo na próxima vez.
 */
export async function saveMapping(headers: string[], mapping: CsvMapping): Promise<void> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const fingerprint = headerFingerprint(headers)
    const { data: existing } = await supabase
      .from('csv_mappings')
      .select('times_used')
      .eq('user_id', user.id)
      .eq('fingerprint', fingerprint)
      .maybeSingle()

    const { error } = await supabase
      .from('csv_mappings')
      .upsert({
        user_id: user.id,
        fingerprint,
        headers,
        mapping,
        times_used: (existing?.times_used ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,fingerprint' })

    if (error) logSafeError('csvMapping.save', error)
  } catch (err) {
    logSafeError('csvMapping.save', err)
  }
}
