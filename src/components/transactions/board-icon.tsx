import {
  Wallet, CreditCard, Building2, ShoppingCart,
  Home, Briefcase, PiggyBank, TrendingUp,
  Receipt, Car, Coins, DollarSign, LucideProps,
} from 'lucide-react'
import { BoardIconKey } from '@/types'

const ICON_MAP: Record<BoardIconKey, React.FC<LucideProps>> = {
  'wallet':        Wallet,
  'credit-card':   CreditCard,
  'building':      Building2,
  'shopping-cart': ShoppingCart,
  'home':          Home,
  'briefcase':     Briefcase,
  'piggy-bank':    PiggyBank,
  'trending-up':   TrendingUp,
  'receipt':       Receipt,
  'car':           Car,
  'coins':         Coins,
  'dollar-sign':   DollarSign,
}

interface BoardIconProps extends LucideProps {
  icon: BoardIconKey
}

export function BoardIcon({ icon, ...props }: BoardIconProps) {
  const Icon = ICON_MAP[icon] ?? Wallet
  return <Icon {...props} />
}
