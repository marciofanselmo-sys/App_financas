/**
 * Erros de digitação em domínio de e-mail.
 *
 * Existe por um motivo específico: sem confirmação obrigatória, uma conta
 * criada em `joao@gmial.com` parece funcionar — até a pessoa comprar
 * escrevendo o endereço certo no checkout. Aí o webhook não acha a conta,
 * cria uma segunda, e o plano vai para a que está vazia.
 *
 * A lista é curta de propósito: cobre os enganos comuns de teclado nos
 * provedores que quase todo mundo usa no Brasil. Não é validação — é um
 * "você quis dizer?", que a pessoa pode ignorar.
 */
const CORRECOES: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.com.br': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'homail.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'yahoo.con': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahoo.com.b': 'yahoo.com.br',
  'bol.com': 'bol.com.br',
  'uol.com': 'uol.com.br',
  'icloud.con': 'icloud.com',
  'iclou.com': 'icloud.com',
  'terra.com': 'terra.com.br',
}

/** Sugestão de correção, ou null quando o domínio não parece engano. */
export function sugereCorrecao(email: string): string | null {
  const partes = email.trim().toLowerCase().split('@')
  if (partes.length !== 2 || !partes[1]) return null

  const certo = CORRECOES[partes[1]]
  return certo ? `${partes[0]}@${certo}` : null
}
