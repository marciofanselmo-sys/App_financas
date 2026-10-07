/**
 * A jornada do teste grátis: 10 tarefas, 48 horas de bônus (decidido em
 * 07/10/2026). A ordem segue o caminho para a pessoa extrair o máximo do app;
 * pesa mais hora o que mais a aproxima de "não consigo ficar sem".
 * Quem confere se cada tarefa foi feita é o servidor (/api/teste/sincronizar),
 * olhando os dados reais da conta.
 */
export type TrialTaskId =
  | 'conta' | 'importar' | 'categorias' | 'resumo' | 'fixos'
  | 'planejamento' | 'meta' | 'segunda_conta' | 'entre_contas' | 'voltar'

export interface TrialTask {
  id: TrialTaskId
  etapa: string
  titulo: string
  dica: string
  horas: number
  /** Para onde o botão "Fazer agora" leva. 'resumo' abre a janela no Dashboard. */
  href: string | null
}

export const TRIAL_TASKS: TrialTask[] = [
  { id: 'conta', etapa: 'Colocar seus números', titulo: 'Criar sua primeira conta', dica: 'A conta ou cartão que você mais usa', horas: 2, href: '/transactions' },
  { id: 'importar', etapa: 'Colocar seus números', titulo: 'Importar o extrato do último mês', dica: 'OFX, CSV ou PDF do seu banco', horas: 8, href: '/transactions' },
  { id: 'categorias', etapa: 'Colocar seus números', titulo: 'Revisar suas categorias', dica: 'Arrume o que ficou em "Outros"', horas: 4, href: '/settings/categories?revisar=outros' },
  { id: 'resumo', etapa: 'Entender seu dinheiro', titulo: 'Ver "Seu mês em números"', dica: 'Seu mês organizado em uma tela', horas: 2, href: null },
  { id: 'fixos', etapa: 'Entender seu dinheiro', titulo: 'Confirmar seus gastos fixos', dica: 'Quanto da renda já tem dono', horas: 6, href: '/fixos' },
  { id: 'planejamento', etapa: 'Planejar', titulo: 'Definir sua renda e ver o 50/30/20', dica: 'Quanto vai para cada parte', horas: 6, href: '/planning' },
  { id: 'meta', etapa: 'Planejar', titulo: 'Criar uma meta', dica: 'Reserva, viagem, carro...', horas: 4, href: '/goals' },
  { id: 'segunda_conta', etapa: 'Completar o quadro', titulo: 'Adicionar a 2ª conta ou cartão e importar', dica: 'Com tudo junto, o retrato fica completo', horas: 8, href: '/transactions' },
  { id: 'entre_contas', etapa: 'Completar o quadro', titulo: 'Ligar as movimentações entre suas contas', dica: 'Para a fatura não contar duas vezes', horas: 4, href: '/ajustes' },
  { id: 'voltar', etapa: 'Criar o hábito', titulo: 'Voltar ao NOBLI em outro dia', dica: 'É só abrir o app amanhã', horas: 4, href: null },
]

export const TRIAL_TASK_BY_ID = Object.fromEntries(TRIAL_TASKS.map(t => [t.id, t])) as Record<TrialTaskId, TrialTask>
