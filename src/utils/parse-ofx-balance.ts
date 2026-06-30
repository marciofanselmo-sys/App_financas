export interface OFXBalance {
  ledgerBalance: number
  availBalance?: number
  balanceDate: string   // YYYY-MM-DD
  bankName: string
  accountType: string   // CHECKING, SAVINGS, INVESTMENT
}

function extractTag(text: string, tag: string): string {
  const re = new RegExp(`<${tag}>([^<\r\n]*)`, 'i')
  return text.match(re)?.[1]?.trim() ?? ''
}

function parseOFXDate(raw: string): string {
  const s = raw.replace(/\[.*\]/, '').trim()
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(',', '.')) || 0
}

export function parseOFXBalance(content: string): OFXBalance {
  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const ledgerBalAmt  = extractTag(text, 'BALAMT')
  const availBalAmt   = extractTag(text.replace(/[\s\S]*?<AVAILBAL>/i, ''), 'BALAMT')
  const dtAsOf        = extractTag(text, 'DTASOF')
  const bankOrg       = extractTag(text, 'ORG')
  const bankFI        = extractTag(text, 'FI') // fallback inside FI block
  const accountType   = extractTag(text, 'ACCTTYPE') || extractTag(text, 'INVACCTFROM') || 'CHECKING'

  // INVSTMTRS = investment account (OFX investment)
  const isInvestment  = /<INVSTMTRS>/i.test(text)

  const ledgerBalance = parseAmount(ledgerBalAmt)

  if (ledgerBalance === 0 && !ledgerBalAmt) {
    throw new Error(
      'Saldo não encontrado no arquivo. Verifique se o arquivo é um extrato bancário OFX/QFX válido.'
    )
  }

  const availBalance = availBalAmt ? parseAmount(availBalAmt) : undefined
  const balanceDate  = dtAsOf ? parseOFXDate(dtAsOf) : new Date().toISOString().slice(0, 10)
  const bankName     = bankOrg || bankFI || 'Banco'
  const finalType    = isInvestment ? 'INVESTMENT' : (accountType || 'CHECKING')

  return { ledgerBalance, availBalance, balanceDate, bankName, accountType: finalType }
}
