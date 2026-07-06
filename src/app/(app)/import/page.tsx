'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { ImportCSVModal } from '@/components/transactions/import-csv-modal'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Upload, FileText, CheckCircle, Zap, ShieldCheck,
  FileSpreadsheet, Building2, CreditCard, AlertTriangle, File,
} from 'lucide-react'

const FORMATS = [
  {
    id: 'csv',
    icon: FileSpreadsheet,
    iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    title: 'CSV / Planilha',
    description: 'Arquivo CSV exportado de qualquer banco ou app financeiro. O app detecta automaticamente as colunas.',
    examples: ['Nubank', 'Inter', 'Banco do Brasil', 'Itaú', 'Bradesco'],
  },
  {
    id: 'ofx',
    icon: Building2,
    iconBg: 'bg-blue-50 dark:bg-blue-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    title: 'OFX / QFX',
    description: 'Formato padrão bancário com dados estruturados. Maior precisão que CSV.',
    examples: ['Itaú', 'Bradesco', 'Santander', 'Caixa', 'BB', 'Inter'],
  },
  {
    id: 'c6',
    icon: CreditCard,
    iconBg: 'bg-violet-50 dark:bg-violet-500/10',
    iconColor: 'text-violet-600 dark:text-violet-400',
    title: 'C6 Bank',
    description: 'CSV exportado diretamente do C6 Bank (conta corrente ou fatura do cartão de crédito).',
    examples: ['C6 Conta', 'C6 Cartão'],
  },
  {
    id: 'pdf',
    icon: File,
    iconBg: 'bg-amber-50 dark:bg-amber-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    title: 'PDF de fatura ou extrato',
    description: 'Fatura de cartão ou extrato de conta em PDF — o app lê o texto do arquivo direto no navegador. Só funciona com PDF gerado digitalmente (não com foto/scan).',
    examples: ['Inter', 'Mercado Pago', 'Itaú'],
  },
]

const STEPS = [
  { icon: Upload,       label: 'Escolher arquivo',    desc: 'Selecione o extrato do seu banco' },
  { icon: Zap,          label: 'Revisão automática',  desc: 'Categorização por regras e IA'  },
  { icon: CheckCircle,  label: 'Confirmar e salvar',  desc: 'Revise antes de importar'        },
]

export default function ImportPage() {
  const { boards, loading: boardsLoading } = useTransactionBoards()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedBoard, setSelectedBoard] = useState<string>('')
  const [imported, setImported] = useState(0)

  function handleImported() {
    setImported(n => n + 1)
    setModalOpen(false)
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Importar Extrato</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Importe transações do seu banco em segundos. O app categoriza automaticamente.
        </p>
      </div>

      {/* Sucesso */}
      {imported > 0 && (
        <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Importação {imported > 1 ? `${imported}×` : ''} concluída!
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
              Suas transações foram salvas. Você pode importar mais arquivos ou acessar as transações.
            </p>
          </div>
        </div>
      )}

      {/* Como funciona */}
      <div className="grid grid-cols-3 gap-3">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          return (
            <div key={i} className="bg-white dark:bg-[#111c2d] rounded-xl p-4 border border-slate-100 dark:border-white/[0.06] shadow-sm text-center">
              <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{step.label}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">{step.desc}</p>
            </div>
          )
        })}
      </div>

      {/* Formatos suportados */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">
          Formatos suportados
        </h2>
        <div className="space-y-3">
          {FORMATS.map(fmt => {
            const Icon = fmt.icon
            return (
              <div
                key={fmt.id}
                className="flex items-start gap-4 bg-white dark:bg-[#111c2d] rounded-xl p-4 border border-slate-100 dark:border-white/[0.06] shadow-sm"
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${fmt.iconBg}`}>
                  <Icon className={`h-5 w-5 ${fmt.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{fmt.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{fmt.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {fmt.examples.map(ex => (
                      <span key={ex} className="text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Garantias */}
      <div className="flex items-start gap-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06] rounded-xl p-4">
        <ShieldCheck className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 leading-relaxed">
          <p><strong className="text-slate-700 dark:text-slate-300">Seguro e privado:</strong> os arquivos são processados localmente no seu navegador. Nada é enviado para servidores externos.</p>
          <p><strong className="text-slate-700 dark:text-slate-300">Revisão antes de salvar:</strong> você vê e pode editar cada transação antes de confirmar a importação.</p>
          <p><strong className="text-slate-700 dark:text-slate-300">Categorização automática:</strong> as regras que você configurou são aplicadas automaticamente durante a importação.</p>
        </div>
      </div>

      {/* Conta de destino + botão */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-100 dark:border-white/[0.06] shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Iniciar importação</p>
        </div>

        {boardsLoading ? (
          <div className="h-11 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
        ) : boards.length === 0 ? (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Crie uma conta antes de importar</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                Toda transação importada precisa estar vinculada a uma conta ou cartão. Crie sua primeira conta em Contas e Cartões e volte aqui para importar o extrato.
              </p>
              <Link
                href="/transactions"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline mt-2"
              >
                Criar conta agora →
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">Conta de destino</Label>
              <Select value={selectedBoard} onValueChange={v => setSelectedBoard(v ?? '')}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Nenhuma (avulso)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma (avulso)</SelectItem>
                  {boards.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">As transações importadas serão associadas a esta conta.</p>
            </div>

            <Button
              size="lg"
              className="w-full gap-2 text-base"
              onClick={() => setModalOpen(true)}
            >
              <Upload className="h-5 w-5" />
              Selecionar arquivo para importar
            </Button>
          </>
        )}
      </div>

      <ImportCSVModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onImported={handleImported}
        boardId={selectedBoard || undefined}
      />
    </div>
  )
}
