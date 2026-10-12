'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, CheckCircle2, Camera, Loader2, Plus, ReceiptText, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CategoryOptions } from '@/components/categories/category-options'
import { ReceiptCamera } from '@/components/transactions/receipt-camera'
import { categoriesForDate } from '@/lib/special-category-filter'
import { imageToGray, OcrStage, readReceipt } from '@/lib/nfce-ocr'
import { missingMigrationMessage, logSafeError } from '@/lib/supabase-error'
import { createClient } from '@/lib/supabase/client'
import { parseAmountBR } from '@/utils/parse-amount'
import { suggestDoubtfulValue } from '@/utils/parse-nfce'
import { shiftDaysISO, todayISO } from '@/utils/local-date'
import { Category, Transaction } from '@/types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
const toText = (n: number) => n.toFixed(2).replace('.', ',')
const cents = (n: number) => Math.round(n * 100)

interface Row {
  key: number
  description: string
  category: string
  amount: string
  /** Leitura duvidosa: fica em amarelo até o usuário mexer no valor. */
  doubtful: boolean
  /** Produto no catálogo de nomes (código de barras ou código do mercado). */
  productKey?: string
  /** Nome como veio da leitura — para saber se o usuário corrigiu. */
  readName?: string
  /** O nome veio do catálogo (aprendido antes): salvar confirma. */
  fromCatalog?: boolean
}

interface Props {
  /** Compra a diluir (ou já diluída, para "Editar itens"). */
  tx: Transaction | null
  /** "+ Novo › Nova nota fiscal": cria a compra pela nota, sem transação. */
  newNote?: { boardId: string } | null
  categories: Category[]
  onClose: () => void
  /** Itens gravados — a página recarrega a lista. */
  onSaved: () => void
}

/** Nomes aprendidos para estas chaves de produto (vazio se der erro). */
async function catalogNames(keys: string[]): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map()
  const { data, error } = await createClient().rpc('nomes_nf', { p_chaves: [...new Set(keys)] })
  if (error) { logSafeError('dilute.catalogNames', error); return new Map() }
  return new Map((data as { chave: string; nome: string }[] | null ?? []).map(r => [r.chave, r.nome]))
}

let rowKey = 0
const newRow = (r: Partial<Row>): Row => ({ key: ++rowKey, description: '', category: '', amount: '', doubtful: false, ...r })

/**
 * Diluir transação: separa uma compra em itens, cada um com a sua categoria.
 * Foto da nota (lida no próprio aparelho) ou preenchimento à mão; a soma dos
 * itens tem que fechar com o valor da compra para salvar.
 */
export function DiluteDialog({ tx, newNote, categories, onClose, onSaved }: Props) {
  const [step, setStep] = useState<'foto' | 'lendo' | 'revisar'>('foto')
  const [stage, setStage] = useState<{ stage: OcrStage; pass: number }>({ stage: 'carregando', pass: 0 })
  const [rows, setRows] = useState<Row[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)
  // Nova nota fiscal: loja, data e valor total vêm da foto e o usuário confere.
  const [store, setStore] = useState('')
  const [noteDate, setNoteDate] = useState(todayISO())
  const [noteTotal, setNoteTotal] = useState('')
  const [readFields, setReadFields] = useState<{ store?: boolean; date?: boolean; total?: boolean }>({})
  // Já existe um lançamento com esse valor nesta conta: perguntar antes de criar outro.
  const [existingMatch, setExistingMatch] = useState<Transaction | null>(null)

  const isNew = !tx && !!newNote
  const open = !!tx || isNew
  const parsedNoteTotal = parseAmountBR(noteTotal)
  const total = tx ? Number(tx.diluted_amount ?? tx.amount) : Number.isFinite(parsedNoteTotal) && parsedNoteTotal > 0 ? parsedNoteTotal : 0
  const editing = tx?.diluted_amount != null
  const purchaseDate = tx?.date ?? noteDate
  // Categoria inicial dos itens: a da compra; na nota nova, a de mercado do usuário.
  const defaultCategory = useMemo(() => {
    if (tx) return tx.category
    const despesa = categories.filter(c => c.type === 'despesa' || c.type === 'ambos')
    return (despesa.find(c => /supermerc/i.test(c.name)) ?? despesa.find(c => /mercad/i.test(c.name))
      ?? despesa.find(c => /aliment/i.test(c.name)) ?? despesa.find(c => /^outros$/i.test(c.name)))?.name ?? ''
  }, [tx, categories])

  // Nova nota fiscal: começa limpa, na câmera.
  useEffect(() => {
    if (!newNote || tx) return
    setError(null)
    setNotice(null)
    setRows([])
    setStore('')
    setNoteDate(todayISO())
    setNoteTotal('')
    setReadFields({})
    setExistingMatch(null)
    setStep('foto')
  }, [newNote, tx])

  // Abre direto na revisão quando a compra já foi diluída ("Editar itens").
  useEffect(() => {
    if (!tx) return
    setError(null)
    setNotice(null)
    if (tx.diluted_amount == null) {
      setRows([])
      setStep('foto')
      return
    }
    setStep('revisar')
    setLoadingItems(true)
    createClient().from('transactions').select('*').eq('diluted_from_id', tx.id).order('created_at')
      .then(({ data, error: e }) => {
        if (e) logSafeError('dilute.loadItems', e)
        setRows((data as Transaction[] | null ?? []).map(t => newRow({
          description: t.description, category: t.category, amount: toText(Number(t.amount)),
        })))
        setLoadingItems(false)
      })
  }, [tx])

  // Só as categorias que valem para esta compra (tipo e data), mais as que
  // os itens já têm — igual ao formulário de transação.
  const usable = useMemo(() => {
    if (!open) return []
    const base = categoriesForDate(categories, purchaseDate).filter(c => c.type === 'despesa' || c.type === 'ambos')
    const extra = rows.map(r => categories.find(c => c.name === r.category))
      .filter((c): c is Category => !!c && !base.some(b => b.id === c.id))
    return [...base, ...new Map(extra.map(c => [c.id, c])).values()]
  }, [categories, open, purchaseDate, rows])

  const amounts = rows.map(r => parseAmountBR(r.amount))
  const sum = amounts.reduce((s, v) => s + (Number.isFinite(v) && v > 0 ? v : 0), 0)
  const diff = cents(total) - cents(sum)
  const rowsValid = rows.length > 0 && rows.every((r, i) =>
    r.description.trim() !== '' && r.category !== '' && Number.isFinite(amounts[i]) && amounts[i] > 0)
  const headerValid = !isNew || (store.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(noteDate) && total > 0)
  const canSave = rowsValid && headerValid && diff === 0 && !saving

  // "Usar R$ X": com um único item duvidoso, o valor dele é o que falta.
  const suggestion = useMemo(() => {
    const list = rows.map((r, i) => ({ amount: Number.isFinite(amounts[i]) ? amounts[i] : 0, doubtful: r.doubtful }))
    const v = suggestDoubtfulValue(list, total)
    const idx = rows.findIndex(r => r.doubtful)
    return v != null && idx >= 0 && cents(v) !== cents(list[idx].amount) ? { idx, value: v } : null
  }, [rows, amounts, total])

  function update(key: number, patch: Partial<Row>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)))
  }

  function manual() {
    if (!open) return
    setNotice(null)
    setRows([newRow({ category: defaultCategory })])
    setStep('revisar')
  }

  async function read(source: HTMLCanvasElement | File) {
    if (!open) return
    setStep('lendo')
    setError(null)
    try {
      const gray = await imageToGray(source)
      const result = await readReceipt(gray, tx ? total : null, (s, pass) => setStage({ stage: s, pass }))
      if (isNew) {
        // Cabeçalho da nota: só preenche o que foi lido; o resto o usuário digita.
        const itemsSum = result.items.reduce((acc, i) => acc + i.amount, 0)
        const readTotal = result.total ?? (itemsSum > 0 ? Math.round(itemsSum * 100) / 100 : null)
        setStore(result.store ?? '')
        if (result.date) setNoteDate(result.date)
        setNoteTotal(readTotal != null ? toText(readTotal) : '')
        setReadFields({ store: !!result.store, date: !!result.date, total: result.total != null })
      }
      if (result.items.length === 0) {
        setNotice('Não conseguimos ler os itens desta foto. Tire outra, mais perto e com luz, ou preencha à mão.')
        setRows([newRow({ category: defaultCategory })])
      } else {
        const doubts = result.items.filter(i => i.doubtful).length
        setNotice(doubts > 0
          ? `Lemos ${result.items.length} ${result.items.length === 1 ? 'item' : 'itens'}. Confira os marcados em amarelo — a leitura do valor ficou em dúvida.`
          : `Lemos ${result.items.length} ${result.items.length === 1 ? 'item' : 'itens'}. Confira os nomes e escolha a categoria de cada um.`)
        // Nomes já corrigidos antes (por você ou por outros usuários) para o
        // mesmo produto substituem a leitura.
        const known = await catalogNames(result.items.map(i => i.key).filter((k): k is string => !!k))
        setRows(result.items.map(i => {
          const learned = i.key ? known.get(i.key) : undefined
          return newRow({
            description: learned ?? i.description, category: defaultCategory, amount: toText(i.amount), doubtful: i.doubtful,
            productKey: i.key, readName: learned ?? i.description, fromCatalog: !!learned,
          })
        }))
      }
    } catch (e) {
      logSafeError('dilute.ocr', e)
      setNotice('A leitura da nota falhou neste aparelho. Você pode preencher os itens à mão.')
      setRows([newRow({ category: defaultCategory })])
    }
    setStep('revisar')
  }

  /**
   * Nova nota fiscal: se a conta já tem um lançamento comum com esse valor
   * (até 3 dias de diferença), a nota provavelmente é dele — mesma regra da
   * importação. Pergunta antes de criar outra compra.
   */
  async function findExisting(): Promise<Transaction | null> {
    if (!newNote) return null
    const { data, error: e } = await createClient().from('transactions').select('*')
      .eq('board_id', newNote.boardId).eq('type', 'despesa').eq('amount', Math.round(total * 100) / 100)
      .gte('date', shiftDaysISO(noteDate, -3)).lte('date', shiftDaysISO(noteDate, 3))
    if (e) { logSafeError('note.findExisting', e); return null }
    const list = (data as Transaction[] | null ?? []).filter(t => t.diluted_amount == null && !t.diluted_from_id)
    const sameDay = list.filter(t => t.date === noteDate)
    return list.length === 1 ? list[0] : sameDay.length === 1 ? sameDay[0] : null
  }

  async function save(mode?: 'existing' | 'new') {
    if (!canSave) return
    setError(null)
    const itens = rows.map((r, i) => ({ description: r.description.trim(), category: r.category, amount: Math.round(amounts[i] * 100) / 100 }))
    let target = tx
    if (isNew && mode === 'existing') target = existingMatch
    if (isNew && !mode) {
      setSaving(true)
      const found = await findExisting()
      setSaving(false)
      if (found) { setExistingMatch(found); return }
    }
    setSaving(true)
    const supabase = createClient()
    let e: { code?: string; message: string } | null
    if (target) {
      ({ error: e } = await supabase.rpc('diluir_transacao', { p_id: target.id, p_itens: itens }))
    } else {
      // A compra fica na categoria do item de maior valor.
      const main = [...itens].sort((a, b) => b.amount - a.amount)[0]
      ;({ error: e } = await supabase.rpc('criar_nota_fiscal', {
        p_board: newNote!.boardId, p_descricao: store.trim(), p_data: noteDate, p_categoria: main.category, p_itens: itens,
      }))
    }
    setSaving(false)
    if (e) {
      logSafeError('dilute.save', e)
      setError(/diluir_transacao|criar_nota_fiscal|PGRST202|42883|diluted_|nota_pendente/.test(`${e.code} ${e.message}`)
        ? missingMigrationMessage(isNew ? 'migration_nota_fiscal.sql' : 'migration_diluir_transacao.sql')
        : `Não foi possível salvar os itens: ${e.message}`)
      return
    }
    // Ensina o catálogo: nome corrigido pelo usuário, ou nome do catálogo que
    // ele manteve. Nome lido e não mexido não entra (seria só a leitura crua).
    const taught = rows
      .filter(r => r.productKey && r.description.trim().length >= 2 && (r.fromCatalog || r.description.trim() !== r.readName))
      .map(r => ({ chave: r.productKey!, nome: r.description.trim().slice(0, 80) }))
    if (taught.length > 0) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const unique = [...new Map(taught.map(t => [t.chave, { ...t, user_id: user.id, updated_at: new Date().toISOString() }])).values()]
        const { error: te } = await supabase.from('nf_produtos').upsert(unique, { onConflict: 'chave,user_id' })
        if (te) logSafeError('dilute.teachNames', te)
      }
    }
    onSaved()
    onClose()
  }

  if (!open) return null

  const fieldTag = (on?: boolean) => on
    ? <span className="ml-1.5 text-[10px] font-semibold text-green-600 dark:text-green-400">lido da nota</span>
    : null

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !saving) onClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-blue-600" />
            {isNew ? 'Nova nota fiscal' : editing ? 'Editar itens' : 'Diluir transação'}
          </DialogTitle>
          <DialogDescription>Separe a compra em itens, cada um com a sua categoria.</DialogDescription>
        </DialogHeader>

        {/* A compra que está sendo diluída. */}
        {tx && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{tx.description}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {format(new Date(tx.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })} · Despesa · {tx.category}
            </p>
          </div>
          <span className="text-base font-bold text-red-500 tabular-nums">{formatCurrency(total)}</span>
        </div>
        )}

        {/* Nova nota fiscal: loja, data e total da própria nota, editáveis. */}
        {isNew && step === 'revisar' && (
          <div className="grid grid-cols-2 sm:grid-cols-[1.4fr_1fr_1fr] gap-2">
            <label className="col-span-2 sm:col-span-1 space-y-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loja{fieldTag(readFields.store)}</span>
              <Input value={store} onChange={e => { setStore(e.target.value); setReadFields(f => ({ ...f, store: false })) }} placeholder="Nome do mercado" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Data{fieldTag(readFields.date)}</span>
              <Input type="date" value={noteDate} onChange={e => { setNoteDate(e.target.value); setReadFields(f => ({ ...f, date: false })) }} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Valor total{fieldTag(readFields.total)}</span>
              <Input value={noteTotal} inputMode="decimal" placeholder="0,00" className="text-right font-semibold tabular-nums"
                onChange={e => { setNoteTotal(e.target.value); setReadFields(f => ({ ...f, total: false })) }} />
            </label>
          </div>
        )}

        {step === 'foto' && (
          <ReceiptCamera onCapture={read} onGallery={read} onManual={manual} onCancel={onClose} />
        )}

        {step === 'lendo' && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {stage.stage === 'carregando' ? 'Preparando o leitor…' : stage.stage === 'lendo' ? `Lendo a nota… (leitura ${stage.pass})` : 'Conferindo os valores…'}
            </p>
            <p className="max-w-xs text-xs text-slate-400">
              A leitura acontece no seu aparelho; a foto não é enviada nem guardada.
              Na primeira vez o leitor é baixado e pode levar alguns segundos a mais.
            </p>
          </div>
        )}

        {step === 'revisar' && (
          <div className="space-y-3">
            {notice && (
              <p className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">{notice}</p>
            )}
            {loadingItems ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : (
              <div className="space-y-2">
                <div className="hidden sm:grid grid-cols-[1fr_200px_110px_32px] gap-2 px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>Produto</span><span>Categoria</span><span className="text-right">Valor</span><span />
                </div>
                {rows.map((r, i) => {
                  const warn = r.doubtful ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20' : ''
                  return (
                    <div key={r.key} className="space-y-1.5">
                      <div className="grid grid-cols-[1fr_110px_32px] sm:grid-cols-[1fr_200px_110px_32px] gap-2 items-center">
                        <Input
                          value={r.description}
                          onChange={e => update(r.key, { description: e.target.value })}
                          placeholder="Nome do produto"
                          aria-label="Nome do produto"
                          className={`col-span-3 sm:col-span-1 ${warn}`}
                        />
                        <Select value={r.category} onValueChange={v => { if (v) update(r.key, { category: v }) }}>
                          <SelectTrigger className={`w-full min-w-0 ${warn}`} aria-label="Categoria do item">
                            <SelectValue placeholder="Categoria…" />
                          </SelectTrigger>
                          <SelectContent>
                            <CategoryOptions list={usable} all={categories} />
                          </SelectContent>
                        </Select>
                        <Input
                          value={r.amount}
                          onChange={e => update(r.key, { amount: e.target.value, doubtful: false })}
                          inputMode="decimal"
                          placeholder="0,00"
                          aria-label="Valor do item"
                          className={`text-right font-semibold tabular-nums ${warn}`}
                        />
                        <button
                          type="button"
                          onClick={() => setRows(prev => prev.filter(x => x.key !== r.key))}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500"
                          aria-label="Remover item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {suggestion?.idx === i && (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span className="flex-1">
                            Não conseguimos ler este valor com certeza. Para fechar a conta, ele seria <b>{formatCurrency(suggestion.value)}</b>.
                          </span>
                          <button
                            type="button"
                            onClick={() => update(r.key, { amount: toText(suggestion.value), doubtful: false })}
                            className="shrink-0 rounded-md border border-amber-300 bg-white dark:bg-slate-800 px-2.5 py-1 font-semibold"
                          >
                            Usar {toText(suggestion.value)}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setRows(prev => [...prev, newRow({ category: defaultCategory })])}
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                >
                  <Plus className="h-4 w-4" />Adicionar item
                </button>
              </div>
            )}

            {/* Tudo conferido e ainda falta dinheiro: um item não foi lido. */}
            {diff > 0 && !loadingItems && rows.length > 0 && rowsValid && !rows.some(r => r.doubtful) && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
                <span className="flex-1">Algum item ficou de fora? Faltam <b>{formatCurrency(diff / 100)}</b> para fechar a compra.</span>
                <button
                  type="button"
                  onClick={() => setRows(prev => [...prev, newRow({ category: defaultCategory, amount: toText(diff / 100) })])}
                  className="shrink-0 rounded-md border border-blue-300 bg-white dark:bg-slate-800 px-2.5 py-1 font-semibold"
                >
                  Adicionar item de {toText(diff / 100)}
                </button>
              </div>
            )}

            {/* Soma × valor da compra: o Salvar só libera quando fecha. Sem
                valor total (nota nova ainda vazia), não há o que fechar. */}
            {total <= 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                Informe o <b>valor total</b> da nota. A soma dos itens tem que fechar com ele.
              </div>
            ) : (
            <div className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${diff === 0
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'}`}
            >
              <span>Soma dos itens <b className="tabular-nums">{formatCurrency(sum)}</b> de {formatCurrency(total)}</span>
              <b className="flex items-center gap-1 tabular-nums">
                {diff === 0 ? <><CheckCircle2 className="h-4 w-4" />Fechou</>
                  : diff > 0 ? `Faltam ${formatCurrency(diff / 100)}` : `Passou ${formatCurrency(-diff / 100)}`}
              </b>
            </div>
            )}

            {/* Mesma regra da importação: a nota pode ser de um lançamento que já está na conta. */}
            {existingMatch && (
              <div className="space-y-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                <p>
                  Esta conta já tem <b>{existingMatch.description}</b> de <b>{formatCurrency(Number(existingMatch.amount))}</b> em{' '}
                  {format(new Date(existingMatch.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}. É a mesma compra?
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => save('existing')} disabled={saving}>Sim, separar esse lançamento em itens</Button>
                  <Button size="sm" variant="outline" onClick={() => save('new')} disabled={saving}>Não, criar a nota separada</Button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setNotice(null); setStep('foto') }}
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <Camera className="h-4 w-4" />{editing || rows.some(r => r.description) ? 'Ler outra nota' : 'Tirar foto da nota'}
              </button>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
                <Button onClick={() => save()} disabled={!canSave || !!existingMatch}>
                  {saving ? 'Salvando…' : isNew ? 'Salvar nota' : 'Salvar itens'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
