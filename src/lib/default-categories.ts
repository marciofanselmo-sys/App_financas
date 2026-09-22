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
  { name: 'Renda', type: 'receita', color: '#10b981', children: [
    { name: 'Salário' }, { name: 'Freelance' }, { name: 'Rendimentos' }, { name: 'Reembolsos' },
  ] },
  { name: 'Moradia', type: 'despesa', color: '#8b5cf6', bucket: 'essencial', children: [
    { name: 'Aluguel' }, { name: 'Condomínio' }, { name: 'Energia' }, { name: 'Água' },
    { name: 'Gás' }, { name: 'Internet e telefone' }, { name: 'Manutenção da casa' },
  ] },
  { name: 'Alimentação', type: 'despesa', color: '#f59e0b', bucket: 'essencial', children: [
    { name: 'Mercado' }, { name: 'Padaria' },
    { name: 'Restaurante', bucket: 'estilo' }, { name: 'Delivery', bucket: 'estilo' },
  ] },
  { name: 'Transporte', type: 'despesa', color: '#3b82f6', bucket: 'essencial', children: [
    { name: 'Combustível' }, { name: 'Transporte por app' }, { name: 'Transporte público' },
    { name: 'Estacionamento' }, { name: 'Manutenção do carro' }, { name: 'IPVA e seguro' },
  ] },
  { name: 'Saúde', type: 'despesa', color: '#ef4444', bucket: 'essencial', children: [
    { name: 'Plano de saúde' }, { name: 'Farmácia' }, { name: 'Consultas e exames' },
    { name: 'Academia', bucket: 'estilo' },
  ] },
  { name: 'Educação', type: 'despesa', color: '#ec4899', bucket: 'essencial', children: [
    { name: 'Mensalidade' }, { name: 'Cursos' }, { name: 'Livros' },
  ] },
  { name: 'Lazer', type: 'despesa', color: '#f97316', bucket: 'estilo', children: [
    { name: 'Viagens' }, { name: 'Passeios' }, { name: 'Streaming' }, { name: 'Hobbies' },
  ] },
  { name: 'Pessoal', type: 'despesa', color: '#14b8a6', bucket: 'estilo', children: [
    { name: 'Roupas' }, { name: 'Beleza' }, { name: 'Presentes' },
  ] },
  { name: 'Financeiro', type: 'despesa', color: '#6366f1', bucket: 'essencial', children: [
    { name: 'Tarifas bancárias' }, { name: 'Juros e multas' }, { name: 'Impostos' },
  ] },
  { name: 'Investimentos', type: 'despesa', color: '#84cc16', bucket: 'futuro', children: [
    { name: 'Aplicações' }, { name: 'Reserva de emergência' }, { name: 'Previdência' },
  ] },
  // Destino padrão do app (importação sem categoria, exclusão de categoria).
  // Existe nos dois tipos, com o mesmo nome: o lançamento resolve pelo tipo dele.
  { name: 'Outros', type: 'despesa', color: '#6b7280' },
  { name: 'Outros', type: 'receita', color: '#6b7280' },
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
    // Nome + tipo: "Outros" existe em despesa e em receita.
    const found = existing.find(c => c.name.trim().toLowerCase() === node.name.toLowerCase() && c.type === node.type)
      ?? (node.children ? byName.get(node.name.toLowerCase()) : undefined)
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
