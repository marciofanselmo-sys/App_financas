/**
 * Conteúdo da Central de ajuda (/help). Revisado em 02/10/2026 contra as telas
 * atuais — ao mudar uma tela, atualizar o artigo dela aqui.
 *
 * Formato de `body`: "• item" = lista · "1. passo" = passo numerado ·
 * "> texto" = exemplo destacado · qualquer outra linha = parágrafo.
 */

export type HelpGroup = 'Visão geral' | 'Gestão' | 'Acompanhamento e conta'

export interface HelpArticle {
  id: string
  title: string
  body: string[]
  tip?: string
  /** Botão no fim do artigo, levando para a tela. */
  link?: { href: string; label: string }
}

export interface HelpSection {
  id: string
  group: HelpGroup
  /** Chave do ícone (mapeada na página). */
  icon: string
  /** Cor do ícone: classes Tailwind de fundo + texto. */
  color: string
  title: string
  summary: string
  badge?: 'novo' | 'atualizado'
  articles: HelpArticle[]
}

export const HELP_SECTIONS: HelpSection[] = [
  // ─── VISÃO GERAL ─────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    group: 'Visão geral',
    icon: 'dashboard',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    title: 'Dashboard',
    summary: 'Seu patrimônio e o mês num lugar só.',
    badge: 'atualizado',
    articles: [
      {
        id: 'patrimonio',
        title: 'Patrimônio',
        body: [
          'O bloco de patrimônio soma duas coisas:',
          '• Dinheiro em contas: o saldo de cada conta fixada no Dashboard (saldo inicial + entradas − saídas, até hoje).',
          '• Investimentos: o valor de cada conta de investimento — o extrato, se houver; senão a soma dos aportes.',
          '> Exemplo: C6 R$ 4.200 + Itaú R$ 1.800 + Rico R$ 25.000 = patrimônio de R$ 31.000.',
        ],
        tip: 'Cartão de crédito com saldo positivo ganha um aviso: quase sempre é fatura importada pela metade.',
        link: { href: '/dashboard', label: 'Abrir Dashboard' },
      },
      {
        id: 'mes',
        title: 'O mês selecionado',
        body: [
          'Use as setas ao lado do mês para navegar, ou clique no nome do mês para pular direto para outro período.',
          '• Receitas e despesas do mês, só com movimentos reais.',
          '• Saldo do mês: azul quando positivo, vermelho quando negativo.',
          'Pagamento de fatura e transferência entre suas contas ficam fora desses totais — veja "Entre minhas contas".',
        ],
      },
      {
        id: 'graficos',
        title: 'Gráficos e diagnóstico',
        body: [
          '• Receitas × Despesas e Evolução do saldo: os últimos 6 meses lado a lado.',
          '• Despesas por categoria: para onde foi o dinheiro do mês.',
          '• Comprometimento da renda: fixos, parcelas e gastos variáveis comparados com a receita do mês.',
          '• Planejado × Realizado: compara com os limites do Planejamento.',
          'O diagnóstico destaca categorias acima do limite e o que mudou em relação ao mês anterior.',
        ],
      },
      {
        id: 'fixar',
        title: 'Quais contas entram nos totais',
        body: [
          'Cada conta tem um alfinete. Só as contas fixadas entram nos totais do Dashboard, da Análise, dos Relatórios e das parcelas.',
          '> Exemplo: uma conta conjunta que você só acompanha pode ficar sem alfinete — os lançamentos continuam lá, mas não somam.',
        ],
        link: { href: '/transactions', label: 'Abrir Contas e Cartões' },
      },
    ],
  },
  {
    id: 'analise',
    group: 'Visão geral',
    icon: 'analise',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    title: 'Análise',
    summary: 'Para onde vai o seu dinheiro, por categoria.',
    articles: [
      {
        id: 'categorias',
        title: 'Despesas por categoria',
        body: [
          'Cada categoria mostra o ícone, o total do mês, a barra de proporção e o percentual.',
          'Clique numa categoria para ver as subcategorias e os lançamentos dela ali mesmo.',
          '> Exemplo: Moradia R$ 2.100 (36%) · Alimentação R$ 1.250 (22%) · Transporte R$ 580 (10%).',
        ],
        link: { href: '/analytics', label: 'Abrir Análise' },
      },
      {
        id: 'corrigir',
        title: 'Corrigir a categoria de um lançamento',
        body: [
          'Dentro da categoria aberta, cada lançamento tem um seletor de categoria.',
          'Ao trocar, o app cria (ou atualiza) uma regra automática com aquela descrição e corrige as outras transações iguais.',
          '> Exemplo: "UBER EATS" estava em Transporte. Você muda para Alimentação — a regra "UBER EATS → Alimentação" passa a valer para todas.',
        ],
        
      },
      {
        id: 'insight',
        title: 'Distribuição e insight do mês',
        body: [
          'A rosca mostra o peso de cada categoria. O insight compara com o mês anterior e aponta a categoria que mais subiu.',
          'As entradas por categoria ficam numa seção própria, recolhida.',
        ],
      },
      {
        id: 'filtros',
        title: 'Filtros',
        body: [
          '• Mês e ano.',
          '• Uma conta específica, ou todas as contas fixadas.',
          'Movimentos entre suas contas aparecem num aviso à parte — ficam fora dos totais, sem sumir.',
        ],
      },
    ],
  },
  {
    id: 'relatorios',
    group: 'Visão geral',
    icon: 'relatorios',
    color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    title: 'Relatórios',
    summary: 'Mensal, anual, parcelas, fixos e investimentos.',
    articles: [
      {
        id: 'tipos',
        title: 'Os relatórios',
        body: [
          '• Mensal: totais do mês e gastos por categoria, com subcategorias dentro da categoria.',
          '• Anual: a evolução mês a mês e as categorias no ano inteiro.',
          '• Parcelas: compras parceladas futuras.',
          '• Gastos Fixos: tudo confirmado como fixo em Recorrências.',
          '• Investimentos: as contas de investimento incluídas nos relatórios.',
        ],
        tip: 'Cada plano libera relatórios diferentes — veja em Minha assinatura.',
        link: { href: '/reports', label: 'Abrir Relatórios' },
      },
      {
        id: 'pdf',
        title: 'Salvar em PDF',
        body: [
          'Clique em "Exportar PDF". O navegador abre a janela de impressão: escolha "Salvar como PDF".',
          '> No Mac: botão "PDF" no canto da janela → "Salvar como PDF". No Windows: impressora "Microsoft Print to PDF".',
        ],
        tip: 'Salvar relatórios em PDF está no plano Anual.',
      },
    ],
  },
  {
    id: 'importar',
    group: 'Visão geral',
    icon: 'importar',
    color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    title: 'Importar extrato',
    summary: 'Bancos, formatos, duplicadas e parcelas.',
    badge: 'novo',
    articles: [
      {
        id: 'como',
        title: 'Como importar',
        body: [
          '1. Em Contas e Cartões, abra a conta do banco ou cartão.',
          '2. Clique em "Importar extrato" e escolha o arquivo (OFX, CSV, PDF ou planilha).',
          '3. O app reconhece o banco pelo conteúdo do arquivo e aplica suas regras de categoria.',
          '4. Revise a lista antes de salvar: dá para mudar categoria ou tirar linhas.',
        ],
        tip: 'Importe cada extrato na conta certa — um arquivo do cartão dentro da conta corrente mistura os saldos.',
        link: { href: '/transactions', label: 'Abrir Contas e Cartões' },
      },
      {
        id: 'formatos',
        title: 'Bancos e formatos aceitos',
        body: [
          '• C6 Bank: CSV da fatura do cartão e da conta corrente.',
          '• Nubank: CSV do cartão e da conta.',
          '• Inter: extrato em CSV ou PDF, e fatura do cartão em PDF.',
          '• Itaú: extrato em PDF.',
          '• Mercado Pago: extrato em PDF.',
          '• Rico / XP: extrato em planilha (XLSX).',
          '• Qualquer banco: OFX (o formato padrão do internet banking) ou o CSV modelo do app.',
        ],
        tip: 'A planilha de posição da corretora (PosicaoDetalhada.xlsx) não é extrato: ela vai em Investimentos → Importar posição.',
      },
      {
        id: 'duplicadas',
        title: 'Lançamentos repetidos',
        body: [
          'Ao importar, o app compara com o que já existe na conta e separa os lançamentos repetidos — eles não entram de novo.',
          '> Exemplo: você importa o extrato de 1 a 30/09 e depois o de 15/09 a 15/10. Só os dias novos entram.',
        ],
      },
      {
        id: 'parcelas',
        title: 'Parcelas na importação',
        body: [
          'Quando o extrato traz uma parcela (ex: "3/10"), o app oferece completar o plano inteiro: as parcelas que já passaram e as que ainda vão cair.',
          'Assim Cartões & Parcelas já sabe quanto falta pagar desde a primeira importação.',
        ],
      },
      {
        id: 'modelo',
        title: 'CSV modelo',
        body: [
          'Para um banco sem leitor próprio, baixe o modelo na janela de importação e preencha as colunas:',
          '> descricao, valor, data, tipo, categoria',
          '> Supermercado, 350.50, 2026-06-05, despesa, Alimentação',
        ],
        tip: 'O número de importações por mês depende do plano.',
      },
    ],
  },

  // ─── GESTÃO ─────────────────────────────────────────────────────────────────
  {
    id: 'contas',
    group: 'Gestão',
    icon: 'contas',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    title: 'Contas e Cartões',
    summary: 'Uma conta por banco ou cartão, com o saldo batendo com o banco.',
    badge: 'atualizado',
    articles: [
      {
        id: 'o-que',
        title: 'O que são contas',
        body: [
          'Cada banco, cartão ou carteira vira uma conta, com nome, cor e ícone.',
          '> Exemplo: "C6 Principal", "Cartão Inter", "Itaú", "Dinheiro".',
          'Contas de investimento (corretora, cripto, previdência) ficam em Investimentos.',
        ],
        tip: 'O número de contas depende do plano.',
        link: { href: '/transactions', label: 'Abrir Contas e Cartões' },
      },
      {
        id: 'saldo-inicial',
        title: 'Saldo inicial: bater com o banco',
        body: [
          '1. Abra a conta e veja o saldo que o app calculou.',
          '2. Compare com o saldo real no app do banco, na mesma data.',
          '3. Em Editar conta → Saldo inicial, informe a diferença (real − calculado).',
          '> Exemplo: o banco mostra R$ 3.200 e o app R$ 2.950. Saldo inicial = R$ 250. Daqui pra frente os dois andam juntos.',
        ],
        tip: 'O saldo inicial existe porque o extrato começa no meio da história: o que havia antes da primeira importação não vira lançamento.',
      },
      {
        id: 'manual',
        title: 'Lançamento manual',
        body: [
          'Dentro da conta, clique em "Nova transação" e preencha descrição, valor, data, tipo e categoria. Tags são opcionais.',
          '> Exemplo: "Feira" · R$ 85,00 · 05/10 · Despesa · Alimentação.',
        ],
      },
      {
        id: 'editar',
        title: 'Editar e corrigir',
        body: [
          'Ao mudar a categoria ou o tipo de uma transação, a opção "Mudar só esta transação" vem marcada.',
          '• Marcada: muda só aquela.',
          '• Desmarcada: muda todas com a mesma descrição e cria a regra automática.',
        ],
      },
      {
        id: 'massa',
        title: 'Mudar, mover e excluir em massa',
        body: [
          'Marque as caixinhas das linhas e use a barra de ações: mudar categoria, mover para outra conta ou excluir.',
          'Antes de confirmar, o app mostra quantas transações serão afetadas e como fica o saldo das contas.',
        ],
      },
      {
        id: 'mais-acoes',
        title: 'Menu ⋮ de cada transação',
        body: [
          '• Entre minhas contas: tira o lançamento dos totais (pagamento de fatura, TED para outra conta sua).',
          '• Aporte em…: marca a saída como aporte numa conta de investimento.',
        ],
      },
      {
        id: 'csv',
        title: 'Exportar CSV',
        body: [
          'Baixa os lançamentos da conta numa planilha.',
        ],
        tip: 'Disponível a partir do plano Trimestral.',
      },
    ],
  },
  {
    id: 'investimentos',
    group: 'Gestão',
    icon: 'investimentos',
    color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    title: 'Investimentos',
    summary: 'Valor de cada conta, aportes e rendimento.',
    badge: 'novo',
    articles: [
      {
        id: 'contas-inv',
        title: 'Contas de investimento',
        body: [
          'Crie uma conta para cada corretora, cripto, previdência ou Tesouro.',
          'Elas não têm "Nova transação": o dinheiro sempre vem de uma conta sua, como aporte.',
        ],
        link: { href: '/investments', label: 'Abrir Investimentos' },
      },
      {
        id: 'valor',
        title: 'Como o valor da conta é calculado',
        body: [
          '• Com extrato (planilha de posição importada ou "Atualizar valor"): vale o extrato.',
          '• Sem extrato: vale a soma dos aportes.',
          'Nunca os dois somados. É esse valor que entra no patrimônio do Dashboard, no total de Investimentos e nas metas ligadas.',
          '> Exemplo: Rico com extrato de R$ 25.000 vale R$ 25.000. Binance sem extrato, com 3 aportes de R$ 500, vale R$ 1.500.',
        ],
      },
      {
        id: 'aportes',
        title: 'Marcar um aporte',
        body: [
          '1. Abra a conta de onde o dinheiro saiu (ex: C6).',
          '2. No ⋮ da transação, escolha "Aporte em…" e a conta de investimento.',
          'A transação continua na conta de origem — só fica marcada. Por isso nada conta duas vezes.',
          'Na conta de investimento, cada aporte tem ⋮ com Mudar aporte, Não é aporte e Abrir na conta de origem.',
        ],
      },
      {
        id: 'rendimento',
        title: 'Ponto de partida e rendimento',
        body: [
          'Pelo botão "Aportes" da conta, informe quanto já estava aplicado antes (ponto de partida).',
          'Rendimento = valor atual − total aportado. Só aparece quando a conta tem extrato e aportes.',
        ],
      },
      {
        id: 'posicao',
        title: 'Importar posição e atualizar valor',
        body: [
          '• Importar posição: a planilha PosicaoDetalhada.xlsx da Rico/XP traz ativos, classes, proventos e um ponto na evolução.',
          '• Atualizar valor: para cripto, previdência ou outra corretora — informe o valor e a data.',
        ],
        tip: 'Investimentos completos estão no plano Anual.',
      },
    ],
  },
  {
    id: 'planejamento',
    group: 'Gestão',
    icon: 'planejamento',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    title: 'Planejamento',
    summary: 'Orçamento do mês e a divisão 50/30/20.',
    badge: 'atualizado',
    articles: [
      {
        id: '503020',
        title: 'A divisão 50/30/20',
        body: [
          'A renda do mês se divide em três pilares:',
          '• Essenciais: moradia, mercado, saúde, transporte.',
          '• Estilo de vida: lazer, restaurantes, assinaturas.',
          '• Futuro: investimentos, reserva e quitar dívidas.',
          'Escolha um perfil (Equilibrado, Investidor, Quitar dívidas…) para ajustar os percentuais. O pilar de cada categoria se define em Categorias.',
        ],
        link: { href: '/planning', label: 'Abrir Planejamento' },
      },
      {
        id: 'orcamento',
        title: 'Orçamento do mês',
        body: [
          'Defina um limite por categoria e, se quiser, por subcategoria.',
          'A tabela Planejado × Realizado mostra, durante o mês, quanto já foi usado de cada limite.',
          '> Exemplo: Alimentação planejado R$ 1.200 · realizado R$ 1.087 → sobram R$ 113.',
        ],
        tip: 'O planejamento é por mês: o de outubro não se copia sozinho para novembro.',
      },
      {
        id: 'proximos',
        title: 'Próximos gastos fixos e metas',
        body: [
          'O Planejamento mostra os fixos dos próximos 30 dias, pela data em que costumam cair, e o andamento das metas e da reserva.',
        ],
      },
    ],
  },
  {
    id: 'metas',
    group: 'Gestão',
    icon: 'metas',
    color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    title: 'Metas',
    summary: 'Objetivos com prazo, ritmo e conta ligada.',
    badge: 'atualizado',
    articles: [
      {
        id: 'criar',
        title: 'Criar uma meta',
        body: [
          'Clique em "Nova meta" e preencha tipo, nome, valor alvo, prazo, cor e quando começou (para o ritmo ficar certo).',
          '> Exemplo: Viagem · "Europa 2027" · R$ 18.000 · prazo jun/2027.',
        ],
        link: { href: '/goals', label: 'Abrir Metas' },
      },
      {
        id: 'valor',
        title: 'Valor atual: manual ou conta ligada',
        body: [
          '• Valor manual: você digita quanto já tem.',
          '• Vincular conta: a meta acompanha o valor de uma conta de investimento, sozinha — inclusive conta só com aportes.',
        ],
      },
      {
        id: 'ritmo',
        title: 'Ritmo, status e linha do tempo',
        body: [
          'O app calcula quanto guardar por mês para chegar no prazo e compara com o seu ritmo real: adiantada, no prazo ou atrasada.',
          'O gráfico de ritmo e a linha do tempo mostram todas as metas e seus prazos.',
        ],
      },
    ],
  },

  // ─── ACOMPANHAMENTO E CONTA ─────────────────────────────────────────────────
  {
    id: 'parcelas',
    group: 'Acompanhamento e conta',
    icon: 'parcelas',
    color: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400',
    title: 'Cartões & Parcelas',
    summary: 'Quanto sai em parcelas e quando alivia.',
    badge: 'atualizado',
    articles: [
      {
        id: 'deteccao',
        title: 'De onde vêm as parcelas',
        body: [
          'O app reconhece parcelas no extrato (ex: "PARC 3/10") e reúne cada compra num parcelamento.',
          'Faltou alguma? Use "Nova parcela" e informe nome, parcela atual, total, valor e cartão.',
        ],
        link: { href: '/recurring', label: 'Abrir Cartões & Parcelas' },
      },
      {
        id: 'numeros',
        title: 'Os números do topo',
        body: [
          '• Parcelas / mês: uma parcela de cada compra ativa.',
          '• Falta pagar: todas as parcelas futuras somadas.',
          '• Alivia em: quanto deixa de sair no mês que vem.',
          '• Fica livre em: o mês da última parcela das compras de hoje.',
        ],
      },
      {
        id: 'grafico',
        title: 'Gráfico e Por cartão',
        body: [
          'O gráfico mostra os próximos 12 meses, separado por cartão. "Por cartão" mostra o peso de cada um.',
          'O cartão é a conta onde a parcela foi lançada; sem conta, aparece como "Sem cartão".',
        ],
      },
      {
        id: 'lista',
        title: 'Lista, filtros e lixeira',
        body: [
          'Filtre por cartão e ordene por quem termina primeiro, maior valor ou maior total restante.',
          'A lixeira tira o parcelamento da lista — não apaga nenhuma transação.',
        ],
      },
    ],
  },
  {
    id: 'recorrencias',
    group: 'Acompanhamento e conta',
    icon: 'recorrencias',
    color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    title: 'Recorrências',
    summary: 'Receitas e despesas fixas, e quanto sobra livre.',
    badge: 'atualizado',
    articles: [
      {
        id: 'revisar',
        title: 'Para revisar: confirmar ou ignorar',
        body: [
          'O que se repete em 2 ou mais meses seguidos aparece em "Para revisar".',
          '• Confirmar: vira fixo. As próximas importações com a mesma descrição já chegam marcadas.',
          '• Ignorar: sai da lista, sem apagar nada. Dá para restaurar em "Ver ignorados".',
        ],
        link: { href: '/fixos', label: 'Abrir Recorrências' },
      },
      {
        id: 'numeros',
        title: 'Sobra livre e renda comprometida',
        body: [
          'Sobra livre = receita fixa − despesa fixa. Renda comprometida = quanto da receita fixa já tem destino.',
          'A despesa fixa inclui as parcelas de Cartões & Parcelas e é o valor de "Gastos Previstos" no Planejamento.',
        ],
      },
      {
        id: 'graficos',
        title: 'Para onde vai e quando cai',
        body: [
          '• A rosca mostra cada categoria como parte da receita fixa, com o valor livre no centro.',
          '• "Quando cai no mês" agrupa os fixos por semana, pelo dia da última cobrança.',
        ],
      },
      {
        id: 'sumiu',
        title: 'Fixo que não apareceu',
        body: [
          'Um fixo confirmado que não veio no mês passado ganha o aviso "Não veio em…".',
          'Se foi cancelado, use o botão Desfixar na linha do item e ele sai do total. Nada muda sozinho.',
        ],
        tip: 'Se o extrato do mês ainda não foi importado, o aviso aparece para os fixos daquela conta — importe e ele some.',
      },
      {
        id: 'agrupar',
        title: 'Juntar descrições diferentes',
        body: [
          'O mesmo gasto às vezes chega com nomes diferentes (ex: "PIX JOAO" e "PIX IMOBILIARIA" para o aluguel).',
          'Coloque essas transações na mesma subcategoria (ex: Moradia › Aluguel): em Recorrências elas viram um item só.',
        ],
      },
    ],
  },
  {
    id: 'entre-contas',
    group: 'Acompanhamento e conta',
    icon: 'entre',
    color: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    title: 'Entre minhas contas',
    summary: 'Fatura, TED entre contas e ajustes.',
    badge: 'novo',
    articles: [
      {
        id: 'o-que',
        title: 'O que é movimentação entre contas',
        body: [
          'Dinheiro que só muda de lugar entre contas suas: pagamento de fatura, TED para outra conta sua, dinheiro guardado.',
          'Ele aparece no extrato e conta no saldo das contas, mas fica fora dos totais de receita e despesa.',
          '> Exemplo: você gasta R$ 900 no cartão e paga a fatura pela conta corrente. O gasto é um só — a fatura não conta de novo.',
        ],
      },
      {
        id: 'como',
        title: 'Como marcar',
        body: [
          '• Automático: na importação, o app encontra a saída e a entrada do mesmo valor em contas suas.',
          '• Regra "Entre minhas contas": em Regras automáticas, diga que um texto (ex: "PAGAMENTO FATURA") é sempre entre contas.',
          '• Manual: no ⋮ da transação → "Entre minhas contas".',
        ],
        link: { href: '/settings/rules', label: 'Abrir Regras automáticas' },
      },
      {
        id: 'ajustes',
        title: 'Ajustes sugeridos',
        body: [
          'A tela Ajustes lista o que o app encontrou de possível movimentação entre contas, explica como encontrou e mostra o que muda — e o que não muda — nos seus números antes de aplicar.',
        ],
        tip: 'Marcar como entre contas nunca muda o saldo de uma conta: só tira o lançamento dos totais.',
        link: { href: '/ajustes', label: 'Abrir Ajustes' },
      },
    ],
  },
  {
    id: 'config',
    group: 'Acompanhamento e conta',
    icon: 'config',
    color: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    title: 'Categorias, regras e conta',
    summary: 'Categorias, eventos, regras, assinatura e sugestões.',
    badge: 'atualizado',
    articles: [
      {
        id: 'categorias',
        title: 'Categorias e subcategorias',
        body: [
          'As categorias têm dois níveis: Categoria › Subcategoria (ex: Moradia › Aluguel). Cada uma tem cor, ícone e pilar do 50/30/20.',
          '• Mesclar: junta duas categorias numa só.',
          '• Excluir: o que usava a categoria vai para "Outros" (que não pode ser excluída).',
        ],
        link: { href: '/settings/categories', label: 'Abrir Categorias' },
      },
      {
        id: 'eventos',
        title: 'Eventos',
        body: [
          'Evento é uma etiqueta por cima da categoria: uma viagem, uma reforma, um campeonato.',
          'O lançamento continua na categoria normal (Alimentação, Transporte…) e também soma no evento — você vê quanto custou sem bagunçar os relatórios do mês.',
          'Quando acabar, encerre o evento: ele some da lista ao lançar, mas continua nos relatórios.',
          'Cada evento mostra o gasto, o que voltou (estornos e reembolsos) e o custo final. Clique num evento para ver por categoria, dia a dia e os lançamentos de todas as contas.',
          'Em "Por mês", escolha um mês e veja quanto cada evento gastou naquele mês.',
          'Em "Encerrados", escolha o primeiro e o último dia do evento: o detalhe passa a mostrar todos os gastos das suas contas nessas datas, marcados ou não no evento — e dá para marcar no evento o que ficou de fora. As datas ficam salvas no filtro.',
        ],
      },
      {
        id: 'regras',
        title: 'Regras automáticas',
        body: [
          'Uma regra liga um texto da descrição a uma categoria: contém, começa com, termina com ou igual a.',
          '> "IFOOD" → Alimentação · "NETFLIX" → Assinatura · "UBER" → Transporte',
          'Corrigir a categoria de uma transação já cria a regra sozinho — ela aparece com a etiqueta "Automática".',
          'A tela tem três abas, uma para cada tipo de regra: Categorias (decide a categoria), Entre minhas contas (tira dos totais o que só mudou de conta) e Aportes (dinheiro que vai para uma conta de investimento).',
          'Em "Testar uma descrição", digite um texto do extrato e veja o que cada tipo de regra faria com ele.',
        ],
        link: { href: '/settings/rules', label: 'Abrir Regras automáticas' },
      },
      {
        id: 'assinatura',
        title: 'Minha assinatura',
        body: [
          '• Grátis: 1 conta e 1 importação por mês, para conhecer o app.',
          '• Mensal: até 3 contas e 3 importações por mês, relatório mensal.',
          '• Trimestral: até 5 contas e 5 importações, todos os relatórios e exportar CSV.',
          '• Anual: tudo sem limite, inclusive investimentos e PDF.',
          'Cada plano mostra uma janela de meses do histórico. Nada é apagado: o que fica fora volta inteiro quando você assina um plano maior.',
        ],
        link: { href: '/settings/assinatura', label: 'Abrir Minha assinatura' },
      },
      {
        id: 'minha-conta',
        title: 'Minha conta',
        body: [
          'Perfil, senha, exportar seus dados (LGPD) e excluir a conta.',
        ],
        link: { href: '/account', label: 'Abrir Minha conta' },
      },
      {
        id: 'sugestoes',
        title: 'Sugestões',
        body: [
          'Mande uma ideia, problema, dúvida ou elogio, dizendo de qual tela. Acompanhe o status (Nova, Lida, Em análise, Concluída) e veja a resposta da equipe embaixo da mensagem.',
        ],
        link: { href: '/suggestions', label: 'Abrir Sugestões' },
      },
    ],
  },
]

export const HELP_FAQ: { q: string; a: string; link?: { section: string; article: string } }[] = [
  {
    q: 'Pagamento de fatura conta como gasto?',
    a: 'Não. É movimentação entre suas contas: aparece no extrato e no saldo, mas fica fora dos totais de gasto — senão a compra contaria duas vezes (no cartão e na fatura).',
    link: { section: 'entre-contas', article: 'o-que' },
  },
  {
    q: 'Por que o saldo não bate com o banco?',
    a: 'Quase sempre falta o saldo inicial: o que havia na conta antes da primeira importação. Em Editar conta, informe a diferença (saldo real − saldo do app).',
    link: { section: 'contas', article: 'saldo-inicial' },
  },
  {
    q: 'Como o valor de um investimento é calculado?',
    a: 'Com extrato (planilha de posição ou valor informado), vale o extrato. Sem extrato, vale a soma dos aportes. Nunca os dois somados.',
    link: { section: 'investimentos', article: 'valor' },
  },
  {
    q: 'Importei o mesmo extrato duas vezes. E agora?',
    a: 'Na importação o app separa o que já existe na conta, então os repetidos não entram de novo. Se algo entrou duplicado, selecione as linhas e exclua em massa — o app mostra o saldo antes e depois.',
    link: { section: 'importar', article: 'duplicadas' },
  },
  {
    q: 'Uma parcela não foi detectada. Como incluir?',
    a: 'Em Cartões & Parcelas, clique em "Nova parcela" e informe nome, parcela atual, total, valor e cartão.',
    link: { section: 'parcelas', article: 'deteccao' },
  },
  {
    q: 'O que muda de um plano para o outro?',
    a: 'O número de contas e de importações por mês, os relatórios, exportar CSV/PDF e Investimentos. Os detalhes estão em Minha assinatura.',
    link: { section: 'config', article: 'assinatura' },
  },
]

export const HELP_FORMATS: { bank: string; formats: string[]; note?: string }[] = [
  { bank: 'C6 Bank', formats: ['CSV'], note: 'cartão e conta' },
  { bank: 'Nubank', formats: ['CSV'], note: 'cartão e conta' },
  { bank: 'Inter', formats: ['CSV', 'PDF'], note: 'extrato e fatura' },
  { bank: 'Itaú', formats: ['PDF'], note: 'extrato' },
  { bank: 'Mercado Pago', formats: ['PDF'], note: 'extrato' },
  { bank: 'Rico / XP', formats: ['XLSX'], note: 'extrato' },
  { bank: 'Qualquer banco', formats: ['OFX', 'CSV'], note: 'CSV modelo do app' },
]
