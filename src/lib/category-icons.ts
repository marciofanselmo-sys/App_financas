import {
  type LucideIcon,
  UtensilsCrossed, House, Car, ShoppingCart, HeartPulse, Gamepad2, GraduationCap, Plane, PawPrint, PiggyBank,
  CreditCard, Receipt, Shirt, Sparkles, Repeat, Zap, Users, Gift, Ellipsis, Tag,
} from 'lucide-react'
import { createElement, type CSSProperties } from 'react'
import { Category } from '@/types'

// Ícones que o usuário pode escolher para a categoria principal. A chave é o
// que fica salvo em categories.icon; subcategorias usam o ícone da mãe.
export const CATEGORY_ICONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'utensils', label: 'Alimentação', Icon: UtensilsCrossed },
  { key: 'house', label: 'Moradia', Icon: House },
  { key: 'car', label: 'Transporte', Icon: Car },
  { key: 'cart', label: 'Compras', Icon: ShoppingCart },
  { key: 'health', label: 'Saúde', Icon: HeartPulse },
  { key: 'game', label: 'Lazer', Icon: Gamepad2 },
  { key: 'education', label: 'Educação', Icon: GraduationCap },
  { key: 'plane', label: 'Viagem', Icon: Plane },
  { key: 'pet', label: 'Pet', Icon: PawPrint },
  { key: 'piggy', label: 'Investimento', Icon: PiggyBank },
  { key: 'card', label: 'Cartão', Icon: CreditCard },
  { key: 'receipt', label: 'Impostos e taxas', Icon: Receipt },
  { key: 'shirt', label: 'Roupas', Icon: Shirt },
  { key: 'sparkles', label: 'Beleza e cuidados', Icon: Sparkles },
  { key: 'repeat', label: 'Assinaturas', Icon: Repeat },
  { key: 'bolt', label: 'Contas da casa', Icon: Zap },
  { key: 'users', label: 'Família', Icon: Users },
  { key: 'gift', label: 'Presentes', Icon: Gift },
  { key: 'more', label: 'Outros', Icon: Ellipsis },
  { key: 'tag', label: 'Etiqueta', Icon: Tag },
]

const BY_KEY = new Map(CATEGORY_ICONS.map(i => [i.key, i.Icon]))

// Sugestão pelo nome, para categorias que ainda não têm ícone escolhido.
const NAME_RULES: [RegExp, string][] = [
  [/aliment|mercado|restaur|comida|refei|supermerc/, 'utensils'],
  [/morad|casa|aluguel|condom/, 'house'],
  [/transport|carro|combust|uber|ve[ií]cul|gasolina/, 'car'],
  [/compra|shopping|loja/, 'cart'],
  [/sa[uú]de|farm[aá]c|m[eé]dic|hospital/, 'health'],
  [/lazer|divers|entret/, 'game'],
  [/educa|curso|escola|faculd/, 'education'],
  [/viage|turism/, 'plane'],
  [/pet|animal/, 'pet'],
  [/invest|poupan|reserva/, 'piggy'],
  [/cart[aã]o|fatura|financiam/, 'card'],
  [/imposto|taxa|tribut|tarifa/, 'receipt'],
  [/roupa|vestu/, 'shirt'],
  [/beleza|cuidado|est[eé]tic/, 'sparkles'],
  [/assinat|streaming/, 'repeat'],
  [/conta|luz|energia|[aá]gua|internet|telefon/, 'bolt'],
  [/filho|fam[ií]lia/, 'users'],
  [/presente|doa[cç]/, 'gift'],
  [/outro/, 'more'],
]

export function guessIconKey(name: string): string {
  const n = name.toLowerCase()
  return NAME_RULES.find(([re]) => re.test(n))?.[1] ?? 'tag'
}

// Chave do ícone da categoria: subcategoria herda da mãe; sem escolha salva,
// cai na sugestão pelo nome.
export function categoryIconKey(cat: Category, categories: Category[]): string {
  const mother = cat.parent_id ? categories.find(c => c.id === cat.parent_id) ?? cat : cat
  return mother.icon && BY_KEY.has(mother.icon) ? mother.icon : guessIconKey(mother.name)
}

export function iconByKey(key: string): LucideIcon {
  return BY_KEY.get(key) ?? Tag
}

// Desenha o ícone pela chave (createElement: o ícone vem de uma tabela, não é
// um componente criado durante a renderização).
export function CategoryIcon({ iconKey, className, style }: { iconKey: string; className?: string; style?: CSSProperties }) {
  return createElement(iconByKey(iconKey), { className, style })
}
