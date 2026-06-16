import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FinanceApp — Gestão Financeira Pessoal',
  description: 'Controle suas finanças com simplicidade e visão clara do seu dinheiro.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-slate-50 dark:bg-slate-900 font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
