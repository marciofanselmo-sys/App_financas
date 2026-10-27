import { Category, CategoryBucket, CategoryType } from '@/types'

interface DefaultNode {
  name: string
  type: CategoryType
  color: string
  bucket?: CategoryBucket
  children?: { name: string; bucket?: CategoryBucket }[]
}

// Árvore inicial de quem cria conta. Nomes são únicos no geral (a tabela tem
// unique(user_id, name)), por isso "Manutenção da casa" e "Manutenção do carro".
export const DEFAULT_CATEGORY_TREE: DefaultNode[] = [
  { name: 'Renda', type: 'receita', color: '#16a34a', children: [
    { name: 'Salário' }, { name: 'Freelance' }, { name: 'Rendimentos' }, { name: 'Reembolsos' },
    { name: 'Vendas online' }, { name: 'Cashback' },
  ] },
  { name: 'Moradia', type: 'despesa', color: '#7e22ce', bucket: 'essencial', children: [
    { name: 'Aluguel' }, { name: 'Condomínio' }, { name: 'Energia' }, { name: 'Água' },
    { name: 'Gás' }, { name: 'Internet e telefone' }, { name: 'Manutenção da casa' },
  ] },
  { name: 'Alimentação', type: 'despesa', color: '#f97316', bucket: 'essencial', children: [
    { name: 'Mercado' }, { name: 'Padaria e café' },
    { name: 'Restaurantes e bares', bucket: 'estilo' }, { name: 'Delivery', bucket: 'estilo' },
  ] },
  { name: 'Transporte', type: 'despesa', color: '#2563eb', bucket: 'essencial', children: [
    { name: 'Combustível' }, { name: 'Corridas por app' }, { name: 'Transporte público' },
    { name: 'Estacionamento e pedágio' }, { name: 'Manutenção do carro' }, { name: 'IPVA e seguro' },
  ] },
  { name: 'Saúde', type: 'despesa', color: '#dc2626', bucket: 'essencial', children: [
    { name: 'Plano de saúde' }, { name: 'Farmácia' }, { name: 'Consultas e exames' },
    { name: 'Academia e apps de treino', bucket: 'estilo' },
  ] },
  { name: 'Educação', type: 'despesa', color: '#1e3a8a', bucket: 'essencial', children: [
    { name: 'Mensalidade' }, { name: 'Cursos' }, { name: 'Cursos online' }, { name: 'Livros' },
  ] },
  // "Com o quê" a pessoa gastou: viagem, assinatura e compra têm categoria
  // própria. A ocasião (ex.: "Viagem Rio") é um evento, que junta lançamentos
  // de várias categorias.
  { name: 'Viagens', type: 'despesa', color: '#22d3ee', bucket: 'estilo', children: [
    { name: 'Hospedagem' }, { name: 'Passagem aérea' }, { name: 'Ônibus e carona' }, { name: 'Aluguel de carro' },
  ] },
  { name: 'Assinaturas', type: 'despesa', color: '#facc15', bucket: 'estilo', children: [
    { name: 'Streaming' }, { name: 'Música' }, { name: 'Apps e nuvem' }, { name: 'Clubes de assinatura' },
  ] },
  { name: 'Compras', type: 'despesa', color: '#fda4af', bucket: 'estilo', children: [
    { name: 'Compras online' }, { name: 'Roupas e calçados' }, { name: 'Eletrônicos' },
    { name: 'Casa e decoração' }, { name: 'Presentes' },
  ] },
  { name: 'Lazer', type: 'despesa', color: '#ec4899', bucket: 'estilo', children: [
    { name: 'Passeios e shows' }, { name: 'Jogos' }, { name: 'Hobbies' },
  ] },
  { name: 'Cuidados pessoais', type: 'despesa', color: '#a78bfa', bucket: 'estilo', children: [
    { name: 'Beleza' },
  ] },
  { name: 'Família e pets', type: 'despesa', color: '#92400e', bucket: 'essencial', children: [
    { name: 'Filhos' }, { name: 'Pets' },
  ] },
  { name: 'Financeiro', type: 'despesa', color: '#065f46', bucket: 'essencial', children: [
    { name: 'Tarifas bancárias' }, { name: 'Juros e multas' }, { name: 'Impostos' },
    { name: 'Empréstimos e financiamentos' },
  ] },
  { name: 'Investimentos', type: 'despesa', color: '#84cc16', bucket: 'futuro', children: [
    { name: 'Aplicações' }, { name: 'Reserva de emergência' }, { name: 'Previdência' }, { name: 'Cripto' },
  ] },
  // Destino padrão do app (importação sem categoria, exclusão de categoria).
  // Existe nos dois tipos, com o mesmo nome: o lançamento resolve pelo tipo dele.
  { name: 'Outros', type: 'despesa', color: '#64748b' },
  { name: 'Outros', type: 'receita', color: '#64748b' },
]

/**
 * Linhas a inserir para completar a árvore padrão. Pula o que já existe (por
 * nome) e pendura a subcategoria na mãe existente quando ela já está lá —
 * serve tanto para a conta nova quanto para o "Restaurar padrões".
 */
export function buildDefaultCategoryRows(userId: string, existing: Category[]): Category[] {
  const byName = new Map(existing.map(c => [c.name.trim().toLowerCase(), c]))
  const now = new Date().toISOString()
  const rows: Category[] = []

  for (const node of DEFAULT_CATEGORY_TREE) {
    // Nome + tipo: "Outros" existe em despesa e em receita. Só vale como mãe
    // uma categoria principal — quem tem a subcategoria antiga "Viagens"
    // (dentro de Lazer) não pode ganhar a categoria nova pendurada nela.
    const sameName = (c: Category) => c.name.trim().toLowerCase() === node.name.toLowerCase()
    const found = existing.find(c => sameName(c) && c.type === node.type && !c.parent_id)
      ?? (node.children ? existing.find(c => sameName(c) && !c.parent_id) : undefined)
    // Nome já usado por uma subcategoria: não cria uma mãe com o mesmo nome
    // (nome é único) e deixa a árvore da pessoa como está.
    if (!found && byName.has(node.name.toLowerCase())) continue
    // No "Restaurar padrões", não cria uma mãe vazia quando todas as filhas
    // já existem em outro lugar (ex.: "Cuidados pessoais" para quem tem Pessoal › Beleza).
    if (!found && existing.length && node.children?.every(ch => byName.has(ch.name.toLowerCase()))) continue
    const parentId = found?.id ?? crypto.randomUUID()
    if (!found) {
      rows.push({
        id: parentId, user_id: userId, name: node.name, type: node.type,
        color: node.color, bucket: node.bucket ?? null, parent_id: null, created_at: now,
      })
    }
    for (const child of node.children ?? []) {
      if (byName.has(child.name.toLowerCase())) continue
      rows.push({
        id: crypto.randomUUID(), user_id: userId, name: child.name, type: node.type,
        color: node.color, bucket: child.bucket ?? null, parent_id: parentId, created_at: now,
      })
    }
  }
  return rows
}
