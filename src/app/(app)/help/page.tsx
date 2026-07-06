'use client'

import { useState } from 'react'
import {
  LayoutDashboard, ArrowLeftRight, BarChart2, CalendarCheck,
  CreditCard, RefreshCw, Target, FileText, Settings, ChevronDown,
  Search, Lightbulb, Upload, Tag, Zap, TrendingUp, Building2,
  HelpCircle, Layers, Shield, BookOpen,
} from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Article {
  title: string
  body: string[]  // "• item" = bullet | "1. step" = numbered | "> text" = exemplo destacado | texto normal
  tip?: string
}

interface Section {
  id: string
  icon: React.ElementType
  color: string
  title: string
  summary: string
  content: Article[]
}

// ── Conteúdo ──────────────────────────────────────────────────────────────────
const SECTIONS: Section[] = [
  // ─── DASHBOARD ───────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    title: 'Dashboard',
    summary: 'Visão geral completa das suas finanças no período selecionado.',
    content: [
      {
        title: 'Cards de resumo (topo)',
        body: [
          'Os quatro cards no topo condensam as métricas mais importantes do mês:',
          '• Receitas: soma de todas as entradas (salário, freelance, aluguéis recebidos, etc.).',
          '• Despesas: soma de todos os gastos do mês.',
          '• Saldo: receitas menos despesas. Verde = positivo, vermelho = negativo.',
          '• Saúde financeira: pontuação de 0 a 100. Acima de 70 é considerado saudável.',
          '> Exemplo: em Junho/2026 você recebeu R$ 8.500 (salário + freelance) e gastou R$ 5.800. Saldo = R$ 2.700 ✓ Saúde = 78/100.',
        ],
        tip: 'A pontuação de saúde financeira considera: taxa de poupança, controle sobre o planejamento e regularidade de receitas.',
      },
      {
        title: 'Filtro de período',
        body: [
          'As setas ao lado do mês navegam entre os meses. Todos os dados da página se atualizam automaticamente.',
          'Clique diretamente no nome do mês para abrir o seletor de mês/ano e pular para qualquer período rapidamente.',
          '> Exemplo: para analisar Dezembro/2025, clique em "Junho" → escolha o ano 2025 → clique em "Dez".',
        ],
      },
      {
        title: 'Diagnóstico inteligente',
        body: [
          'O painel de diagnóstico analisa seu mês automaticamente e destaca:',
          '• Categorias que ultrapassaram o limite definido no Planejamento.',
          '• Comparação com o mês anterior (melhorou ou piorou?).',
          '• Sugestões práticas com base no seu padrão de gastos.',
          '> Exemplo: "Alimentação ultrapassou R$ 200 acima do limite — considere revisar o orçamento para o próximo mês."',
        ],
      },
      {
        title: 'Gráficos de evolução',
        body: [
          'O gráfico de barras compara receitas e despesas dos últimos 6 meses lado a lado.',
          'Use-o para identificar meses atípicos (férias, IPTU, etc.) e tendências de longo prazo.',
          '> Exemplo: se você percebe que Dezembro sempre tem despesas 40% maiores, pode criar um planejamento específico para esse mês.',
        ],
      },
      {
        title: 'Gastos fixos no dashboard',
        body: [
          'Na parte inferior do Dashboard aparece um resumo das suas Recorrências confirmadas — os gastos que se repetem todo mês.',
          'Isso mostra quanto do seu orçamento já está comprometido antes mesmo do mês começar.',
          '> Exemplo: Netflix R$ 55,90 + Academia R$ 89,90 + Plano de celular R$ 49,90 = R$ 195,70 fixos todo mês.',
        ],
      },
    ],
  },

  // ─── CONTAS E CARTÕES ─────────────────────────────────────────────────────────
  {
    id: 'transacoes',
    icon: ArrowLeftRight,
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    title: 'Contas e Cartões',
    summary: 'Organize seus lançamentos em contas separadas e importe extratos.',
    content: [
      {
        title: 'O que são "contas"?',
        body: [
          'O app permite criar múltiplas contas (também chamadas de "quadros") para organizar seus lançamentos por origem:',
          '• Uma conta para cada banco ou cartão de crédito.',
          '• Uma conta para gastos em espécie.',
          '• Uma conta compartilhada com o cônjuge.',
          '> Exemplo: "Conta Inter", "Cartão Nubank", "Cartão XP", "Caixa física".',
          'Cada conta tem nome, cor e ícone personalizáveis. Você pode ver o saldo de cada uma separadamente ou consolidado.',
        ],
        tip: 'Mantenha uma conta por cartão/banco para que a importação de extratos funcione perfeitamente sem misturar lançamentos.',
      },
      {
        title: 'Criar uma conta',
        body: [
          'Na tela de Contas e Cartões, clique em "+ Nova conta". Preencha:',
          '• Nome: ex. "Conta Corrente Itaú".',
          '• Cor: para identificação visual na lista.',
          '• Ícone: escolha o ícone que representa melhor (banco, cartão, carteira, etc.).',
          '• Descrição (opcional): ex. "Agência 1234 - Conta Empresarial".',
        ],
      },
      {
        title: 'Lançamento manual',
        body: [
          'Dentro de uma conta, clique em "+ Nova transação". Preencha:',
          '• Descrição: o nome do gasto ou receita.',
          '• Valor: em reais (ex: 1500,00).',
          '• Data: quando ocorreu.',
          '• Tipo: Receita, Despesa ou Transferência.',
          '• Categoria: associe a uma das suas categorias.',
          '• Tags (opcional): para filtros avançados.',
          '> Exemplo: Descrição "Supermercado Pão de Açúcar" | Valor R$ 347,50 | Data 15/06/2026 | Tipo Despesa | Categoria Alimentação.',
        ],
        tip: 'Transferências entre contas (ex: pagar fatura do cartão) não entram nos cálculos de receita nem despesa — use o tipo "Transferência" para não distorcer seu saldo.',
      },
      {
        title: 'Importar extrato bancário (OFX / CSV)',
        body: [
          'Dentro da conta, clique em "Importar dados para este quadro":',
          '• OFX / QFX: formato padrão de bancos brasileiros. Exporte direto do internet banking.',
          '• CSV: planilha exportada pelo banco. O app detecta automaticamente as colunas.',
          '> Bancos com suporte confirmado: Inter, Nubank, Itaú, Bradesco, Banco do Brasil, Santander, Caixa, XP.',
          'Após o upload, você revisa cada transação antes de confirmar — pode editar descrição, categoria ou excluir linhas indesejadas.',
          'Se você tiver Regras Automáticas configuradas, elas são aplicadas durante a importação (veja seção Configurações).',
        ],
        tip: 'Para exportar OFX no Inter: app → Extrato → Exportar → formato OFX. No Nubank: área Pix/Extrato → Exportar.',
      },
      {
        title: 'Filtros e busca',
        body: [
          'Dentro de uma conta, use a barra de busca para encontrar transações pelo texto da descrição.',
          'O filtro de período (mês/ano) funciona igual ao Dashboard.',
          'Tags permitem filtrar grupos específicos de lançamentos.',
          '> Exemplo: crie a tag "Viagem Europa" e aplique a todos os gastos da viagem para ver o total depois.',
        ],
      },
      {
        title: 'Mover transação entre contas',
        body: [
          'Se lançou um gasto na conta errada, clique nos 3 pontinhos (⋮) da transação → "Mover para conta" → escolha o destino.',
        ],
      },
      {
        title: 'Marcar como Fixo (Recorrência)',
        body: [
          'Na coluna "Recorrência" da tabela, clique em "Fixar" para marcar um lançamento como gasto fixo mensal.',
          'O lançamento aparecerá na aba Recorrências na fila "Aguardando revisão" — onde você confirma ou ignora.',
          '> Exemplo: o aluguel de R$ 2.100 aparece todo mês. Clique "Fixar" para adicioná-lo ao controle de gastos fixos.',
        ],
      },
    ],
  },

  // ─── ANÁLISE ─────────────────────────────────────────────────────────────────
  {
    id: 'analise',
    icon: BarChart2,
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    title: 'Análise',
    summary: 'Entenda exatamente para onde vai o seu dinheiro, por categoria.',
    content: [
      {
        title: 'Gráfico de despesas por categoria',
        body: [
          'Barras horizontais mostram quanto você gastou em cada categoria, ordenado do maior para o menor valor.',
          'A porcentagem indica a fatia de cada categoria no total de despesas do mês.',
          '> Exemplo: Moradia R$ 2.100 (36%) · Alimentação R$ 1.250 (22%) · Transporte R$ 580 (10%) · Lazer R$ 420 (7%) · Outros R$ 1.450 (25%).',
          'Clique em qualquer categoria para ver a lista detalhada de todos os lançamentos daquele grupo.',
        ],
      },
      {
        title: 'Detalhe de uma categoria (clique na barra)',
        body: [
          'Ao clicar em uma categoria, um painel lateral abre com todos os lançamentos daquele grupo no mês.',
          'Direto neste painel você pode mudar a categoria de qualquer lançamento individualmente (dropdown ao lado do valor).',
          'Se a nova categoria for uma categoria normal (não especial), o app cria/atualiza automaticamente uma regra de categorização e já corrige todas as outras transações com esse nome exato — sem precisar de nenhum botão extra.',
          '> Exemplo: você vê "UBER EATS" classificado como "Transporte". Muda para "Alimentação" → o app já cria a regra "UBER EATS → Alimentação" e corrige automaticamente todas as outras ocorrências anteriores.',
        ],
        tip: 'Categoria especial (presa a um mês específico) nunca entra nessa automação — muda só aquela transação, fica isolada.',
      },
      {
        title: 'Entradas por categoria',
        body: [
          'A seção abaixo das despesas mostra as receitas separadas por categoria (Salário, Freelance, Aluguel recebido, etc.).',
          '> Exemplo: Salário R$ 7.200 (85%) · Freelance R$ 1.300 (15%).',
          'Clique em qualquer categoria de receita para ver os detalhes.',
        ],
      },
      {
        title: 'Filtros disponíveis',
        body: [
          'No topo da página você pode filtrar por:',
          '• Mês e ano (padrão: mês atual).',
          '• Conta específica ou "Todas as contas".',
          '> Exemplo: filtre apenas "Cartão Nubank" para ver como estão os gastos daquele cartão no mês.',
        ],
      },
    ],
  },

  // ─── PLANEJAMENTO ─────────────────────────────────────────────────────────────
  {
    id: 'planejamento',
    icon: CalendarCheck,
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    title: 'Planejamento',
    summary: 'Defina um orçamento por categoria e acompanhe planejado × realizado.',
    content: [
      {
        title: 'Como funciona o orçamento',
        body: [
          'O Planejamento permite definir um limite de gasto para cada categoria no mês.',
          'O app compara automaticamente o que você planejou com o que realmente gastou.',
          '> Exemplo de orçamento para Junho/2026:',
          '> Alimentação: planejado R$ 1.200 · realizado R$ 1.087 → sobrou R$ 113 ✓',
          '> Lazer: planejado R$ 400 · realizado R$ 612 → estourou R$ 212 ✗',
          '> Moradia: planejado R$ 2.100 · realizado R$ 2.100 → exato ✓',
        ],
      },
      {
        title: 'Adicionar uma categoria ao orçamento',
        body: [
          '1. Selecione o mês no filtro de período.',
          '2. No dropdown "Adicionar categoria", escolha a categoria desejada.',
          '3. Digite o valor planejado no campo que aparece ao lado.',
          '4. O valor é salvo automaticamente (não precisa clicar em "Salvar").',
          'Para remover, clique no ícone × ao lado do nome da categoria.',
        ],
        tip: 'O planejamento é por mês. Se você define R$ 500 para Lazer em Junho, isso não se replica automaticamente para Julho — você define cada mês.',
      },
      {
        title: 'Renda esperada e Reserva',
        body: [
          'Além das categorias de despesa, você pode definir:',
          '• Renda esperada: quanto você espera receber no mês. Aparece como referência no topo.',
          '• Meta de investimento: valor que planeja separar para investimentos.',
          '• Meta de reserva: valor que planeja guardar como reserva de emergência.',
          '> Exemplo: Renda esperada R$ 8.500 | Meta de investimento R$ 1.000 | Meta de reserva R$ 500.',
          'O "realizado" de investimento e reserva é lido automaticamente das transações categorizadas como "Investimento" ou "Reserva de emergência".',
        ],
      },
      {
        title: 'Barra de progresso e cores',
        body: [
          'Cada categoria mostra uma barra de progresso colorida:',
          '• Verde (< 80% consumido): dentro do orçamento.',
          '• Amarelo (80%–100%): atenção, próximo do limite.',
          '• Vermelho (> 100%): orçamento estourado.',
          '> Exemplo: Alimentação planejado R$ 1.500, gasto atual R$ 1.200 → barra 80% amarela, momento de prestar atenção.',
        ],
      },
    ],
  },

  // ─── CARTÕES & PARCELAS ───────────────────────────────────────────────────────
  {
    id: 'parcelas',
    icon: CreditCard,
    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    title: 'Cartões & Parcelas',
    summary: 'Acompanhe compras parceladas e o total comprometido no futuro.',
    content: [
      {
        title: 'Como as parcelas são detectadas',
        body: [
          'Ao importar um extrato, o app identifica automaticamente transações parceladas pelos padrões:',
          '• Texto com "2/12", "3X", "PARC 04/10" na descrição.',
          '• Cobranças com valor idêntico repetidas em meses seguidos.',
          '> Exemplo: "MAGAZINE LUIZA PARC 3/6 R$ 248,33" é detectada como parcela 3 de 6, valor mensal R$ 248,33, ainda restam 3 meses.',
        ],
        tip: 'Se uma parcela não foi detectada automaticamente, você pode marcá-la manualmente na edição da transação (campo "Parcela X de Y").',
      },
      {
        title: 'Cards de resumo',
        body: [
          '• Total mensal de parcelas: quanto você paga por mês somando todas as compras parceladas ativas.',
          '• Total comprometido: soma de TODAS as parcelas restantes — o quanto do seu dinheiro futuro já está comprometido.',
          '• Número de compras ativas: quantas compras parceladas estão em andamento.',
          '> Exemplo: TV em 12x de R$ 185 (restam 8x) + Notebook em 10x de R$ 340 (restam 5x) + Sofá em 6x de R$ 210 (restam 3x).',
          '> Total mensal: R$ 735 | Total comprometido: R$ 185×8 + R$ 340×5 + R$ 210×3 = R$ 4.010.',
        ],
        tip: 'Especialistas indicam manter o total comprometido em parcelas abaixo de 30% da sua renda. Se a sua renda é R$ 8.000, o limite seguro é R$ 2.400 comprometidos.',
      },
      {
        title: 'Barra de progresso das parcelas',
        body: [
          'Cada card de compra mostra:',
          '• Nome da compra e loja.',
          '• Parcela atual / total (ex: 4/12).',
          '• Valor mensal.',
          '• Barra de progresso visual: mostra quanto já foi pago.',
          '• Data de encerramento estimada.',
          '> Exemplo: "Smart TV Samsung" | 4/12 | R$ 185,00/mês | ████░░░░░░░░ 33% pago | termina em Abr/2027.',
        ],
      },
    ],
  },

  // ─── RECORRÊNCIAS ────────────────────────────────────────────────────────────
  {
    id: 'fixos',
    icon: RefreshCw,
    color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    title: 'Recorrências',
    summary: 'Monitore seus gastos fixos mensais e agrupe variações com subcategorias que você mesmo cria.',
    content: [
      {
        title: 'O que é uma recorrência?',
        body: [
          'Uma recorrência é qualquer gasto que se repete todo mês com valor igual ou muito parecido: assinatura, aluguel, plano de celular, mensalidade, etc.',
          'O app detecta automaticamente esses padrões no seu extrato e sugere quais confirmar.',
          '> Exemplos comuns: Netflix R$ 55,90 · Spotify R$ 21,90 · Academia SmartFit R$ 89,90 · Plano TIM R$ 49,90 · Seguro auto R$ 312,00',
          'Importante: o app apenas sugere. Você confirma ou ignora cada uma — nada é automaticamente salvo como fixo.',
        ],
      },
      {
        title: 'Passo a passo: Confirmar ou Ignorar',
        body: [
          'Na aba "Aguardando revisão" você vê os candidatos detectados. Para cada card:',
          '• Confirmar → o gasto vira uma recorrência monitorada. Passa a aparecer no Dashboard e no Relatório de gastos fixos.',
          '• Ignorar → descarta a sugestão. O gasto continua nas transações normalmente, mas não é monitorado como fixo.',
          '> Exemplo passo a passo:',
          '> 1. O app encontrou "NETFLIX.COM R$ 55,90" repetido por 3 meses.',
          '> 2. O card aparece em "Aguardando revisão".',
          '> 3. Você clica Confirmar.',
          '> 4. O Netflix vira um card fixo monitorado todo mês.',
          '> 5. Se no mês seguinte o Netflix não aparecer no extrato, o app destaca o card em laranja avisando a ausência.',
        ],
        tip: 'Confirme só o que você paga de fato todo mês. Uma compra parcelada pode ter valor repetido mas não é recorrência — ignore nesses casos.',
      },
      {
        title: 'Marcar manualmente (pelo Contas e Cartões)',
        body: [
          'O app não detectou automaticamente? Você pode fixar qualquer gasto manualmente:',
          '1. Vá em Contas e Cartões → localize a transação na tabela.',
          '2. Na coluna de recorrência, clique em "Fixar".',
          '3. O lançamento vai para a fila "Aguardando revisão" em Recorrências.',
          '4. Confirme lá para ativar o monitoramento.',
          'Para desfazer: volte à transação e clique em "Desfixar" (o botão muda de nome após ser fixado).',
          '> Exemplo: o aluguel chegou como "TED RECEBIDO IMOBILIARIA PREMIUM" e o app não reconheceu. Você fixa manualmente e confirma.',
        ],
      },
      {
        title: 'Subcategorias — grupos que você cria para unir variações',
        body: [
          'Problema: alguns gastos chegam com descrição diferente a cada mês, mas são o mesmo gasto.',
          'Solução: você cria uma Subcategoria com o nome que quiser, e agrupa as variações dentro dela.',
          'O app calcula a média dos valores dos lançamentos agrupados e exibe um único card consolidado.',
          '',
          'Como criar e aplicar — passo a passo:',
          '1. Vá em Configurações → Subcategorias.',
          '2. Dê um nome ao grupo (ex: "Aluguel", "Internet" ou "Condomínio") e escolha o tipo — Despesa, Receita ou Transferência — e clique "Criar".',
          '3. Volte para Recorrências → abra o card de um dos lançamentos do grupo (do mesmo tipo da subcategoria).',
          '4. Clique em "+ subcat." e escolha o nome criado.',
          '5. Faça o mesmo para as outras variações do mesmo gasto.',
          '6. Pronto: os cards se unem em um único card com o nome da subcategoria e a média calculada automaticamente.',
          '',
          '> Exemplo sem subcategoria (confuso):',
          '> Mês 1: "PIX JOAO CARLOS SILVA" R$ 2.100 → aparece como card separado',
          '> Mês 2: "PIX IMOV PREMIUM LTDA" R$ 2.100 → aparece como outro card separado',
          '> Parece que você paga "aluguel" duas vezes, quando na verdade é o mesmo gasto.',
          '',
          '> Exemplo com subcategoria "Aluguel" (correto):',
          '> Os dois cards se unem → 1 único card "Aluguel" | Média R$ 2.100/mês ✓',
        ],
        tip: 'Você pode criar quantas subcategorias precisar, com o nome que fizer sentido para você. O app não cria subcategorias automaticamente — é sempre uma escolha sua.',
      },
      {
        title: 'Desfazer uma confirmação',
        body: [
          'Confirmou um gasto como fixo por engano? Abra o card em Recorrências e clique em "Desfazer".',
          'O gasto sai do monitoramento e volta a ser uma transação normal.',
        ],
      },
    ],
  },

  // ─── METAS ───────────────────────────────────────────────────────────────────
  {
    id: 'metas',
    icon: Target,
    color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    title: 'Metas',
    summary: 'Defina objetivos financeiros e acompanhe mês a mês até atingi-los.',
    content: [
      {
        title: 'Criar uma meta',
        body: [
          'Clique em "+ Nova meta" e preencha:',
          '• Tipo: Reserva de emergência, Viagem, Carro, Imóvel, Quitar dívida ou Personalizado.',
          '• Nome: algo que te motive, como "Viagem para Portugal" ou "Fundo de emergência 6 meses".',
          '• Valor alvo: o total que você quer juntar.',
          '• Valor atual: quanto já tem guardado hoje (pode ser R$ 0).',
          '• Prazo: mês e ano para atingir o objetivo.',
          '• Cor: para identificação visual no dashboard.',
          '> Exemplo: Tipo Viagem | Nome "Europa 2027" | Meta R$ 18.000 | Atual R$ 3.500 | Prazo Jun/2027.',
        ],
        tip: 'Com a meta configurada, o app calcula automaticamente quanto você precisa guardar por mês para atingir o objetivo no prazo.',
      },
      {
        title: 'Acompanhar o progresso',
        body: [
          'Cada card de meta mostra:',
          '• Barra de progresso: visualmente quanto você já avançou.',
          '• Quanto falta: em valor absoluto.',
          '• Sugestão mensal: quanto guardar por mês para atingir no prazo.',
          '• Status: "No prazo ✓", "Adiantada 🚀" ou "Atrasada ⚠".',
          '> Exemplo: Meta R$ 18.000 | Atual R$ 3.500 (19%) | Falta R$ 14.500 | Guardar R$ 1.209/mês | Prazo Jun/2027 → Status: No prazo ✓.',
        ],
      },
      {
        title: 'Atualizar o valor manualmente',
        body: [
          'Clique no ícone de lápis (✏) no card da meta e edite o campo "Valor atual".',
          'Faça isso toda vez que separar dinheiro para a meta — mesmo que seja mensalmente.',
          '> Exemplo: no dia 5 de cada mês, após receber o salário, você transfere R$ 1.200 para a conta de investimento e atualiza a meta no app.',
        ],
      },
      {
        title: 'Importar extrato de investimentos (RICO / XP)',
        body: [
          'Para metas de investimento, você pode importar o arquivo "PosicaoDetalhada.xlsx" da corretora:',
          '1. Acesse o site da RICO ou XP → Minha carteira → Exportar → PosicaoDetalhada.xlsx.',
          '2. No card da meta, clique em "Importar extrato" → "RICO / XP Investimentos".',
          '3. Selecione o arquivo. O app lê o patrimônio total e atualiza o valor da meta automaticamente.',
          'Após importar, o card mostra o detalhamento: total investido, rendimento acumulado e posições por ativo.',
        ],
        tip: 'O arquivo PosicaoDetalhada.xlsx é atualizado diariamente pela corretora. Importe toda vez que quiser ver o progresso atualizado.',
      },
      {
        title: 'Importar extrato de poupança (OFX)',
        body: [
          'Para metas de poupança em conta bancária:',
          '1. Exporte o extrato da conta poupança no formato OFX.',
          '2. No card da meta, clique em "Importar extrato" → "Extrato bancário OFX".',
          '3. O app lê o saldo da conta e atualiza o progresso.',
          '> Bancos suportados: Inter, Nubank, Itaú, Bradesco, Banco do Brasil, Santander, Caixa e qualquer banco com exportação OFX padrão.',
        ],
      },
    ],
  },

  // ─── RELATÓRIOS ──────────────────────────────────────────────────────────────
  {
    id: 'relatorios',
    icon: FileText,
    color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    title: 'Relatórios',
    summary: 'Gere visões consolidadas do seu histórico financeiro e exporte para PDF.',
    content: [
      {
        title: 'Relatório Mensal',
        body: [
          'Resumo completo de um mês específico:',
          '• Cards com totais de receita, despesa e saldo.',
          '• Tabela de despesas por categoria com valor, % do total e comparação com o planejado.',
          '• Gráfico de barras por categoria.',
          '• Lista completa de transações do mês.',
          '> Ideal para: revisar o fechamento mensal, compartilhar com contador, entender onde foi o dinheiro.',
        ],
      },
      {
        title: 'Relatório Anual',
        body: [
          'Visão dos 12 meses do ano:',
          '• Receita e despesa de cada mês em um gráfico de barras comparativo.',
          '• Mês com maior gasto e mês com maior saldo.',
          '• Tabela de totais por categoria no ano inteiro.',
          '> Exemplo: em 2025 você gastou R$ 68.400 no total. Maior gasto: Dezembro (R$ 7.200). Melhor mês: Março (saldo +R$ 4.100).',
        ],
      },
      {
        title: 'Relatório de Parcelas',
        body: [
          'Visão de todas as compras parceladas em andamento:',
          '• Lista de cada compra com valor mensal, parcela atual/total e valor restante.',
          '• Total comprometido e previsão de quando todas as parcelas terminam.',
          '> Ideal para: negociar com banco, planejar compras futuras sabendo o quanto já está comprometido.',
        ],
      },
      {
        title: 'Relatório de Gastos Fixos',
        body: [
          'Listagem de todas as recorrências confirmadas:',
          '• Nome de cada gasto fixo e valor mensal.',
          '• Total fixo mensal (quanto já sai garantido do seu orçamento).',
          '> Ideal para: encontrar assinaturas esquecidas, identificar o que pode cortar para aumentar a taxa de poupança.',
          '> Exemplo típico: Netflix R$ 55,90 + Spotify R$ 21,90 + iCloud R$ 5,90 + Academia R$ 89,90 + Plano cel. R$ 49,90 = R$ 223,50/mês em assinaturas.',
        ],
      },
      {
        title: 'Exportar para PDF',
        body: [
          'Selecione o tipo de relatório e o período, depois clique em "Exportar PDF".',
          'O navegador abre a janela de impressão. Selecione "Salvar como PDF" como impressora.',
          '> No macOS: janela de impressão → botão "PDF" no canto inferior esquerdo → "Salvar como PDF".',
          '> No Windows: janela de impressão → impressora "Microsoft Print to PDF" → Imprimir.',
        ],
        tip: 'Para o relatório ficar melhor no PDF, use o modo claro antes de exportar e configure a impressão como "horizontal" para tabelas largas.',
      },
    ],
  },

  // ─── CONFIGURAÇÕES ───────────────────────────────────────────────────────────
  {
    id: 'configuracoes',
    icon: Settings,
    color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
    title: 'Configurações',
    summary: 'Personalize categorias, subcategorias e regras de categorização automática.',
    content: [
      {
        title: 'Categorias — criar e editar',
        body: [
          'Em Configurações → Categorias você gerencia todas as categorias usadas no app:',
          '• Criar: clique em "+ Nova categoria". Defina nome, cor e tipo (Despesa, Receita, Transferência ou Ambos). Categorias de transferência usam sempre a mesma cor cinza, sem opção de escolher.',
          '• Editar: clique no lápis ao lado de qualquer categoria para mudar nome ou cor.',
          '• Mesclar: ao excluir uma categoria que tem transações, você pode mesclar (mover) todas as transações para outra categoria antes.',
          '• Excluir: remove a categoria. Transações, regras e limites de planejamento associados são movidos automaticamente para "Outros" (que por isso não pode ser excluída).',
          '> Sugestão de categorias de despesa: Alimentação, Moradia, Transporte, Saúde, Educação, Lazer, Assinatura, Vestuário, Pets.',
          '> Sugestão de categorias de receita: Salário, Freelance, Aluguel Recebido, Dividendos, Outros.',
        ],
        tip: 'Use cores diferentes para cada categoria — isso facilita muito a leitura dos gráficos de análise e planejamento.',
      },
      {
        title: 'Subcategorias — agrupar recorrências',
        body: [
          'Subcategorias são etiquetas exclusivas da aba Recorrências.',
          'Servem para agrupar cobranças que chegam com nomes diferentes no extrato, mas representam o mesmo gasto fixo.',
          '> Problema: o aluguel chega como "PIX JOAO DA SILVA" em um mês e "PIX IMOV PREMIUM" em outro. Sem agrupamento, aparecem como 2 gastos diferentes.',
          '> Solução: crie a subcategoria "Aluguel" em Configurações → Subcategorias. Em Recorrências, aplique a subcategoria nos dois cards. Eles viram um único card consolidado.',
          'Para criar: Configurações → Subcategorias → dê um nome, escolha o tipo (Despesa, Receita ou Transferência) → "Criar".',
          'Para aplicar: em Recorrências → card do gasto → "+ subcat." → escolha a subcategoria. Só aparecem as subcategorias do mesmo tipo do card (uma despesa não pode ganhar subcategoria de receita, por exemplo).',
        ],
      },
      {
        title: 'Regras automáticas — categorização inteligente',
        body: [
          'Regras associam palavras-chave a categorias. Toda vez que você importar um extrato, o app aplica as regras automaticamente.',
          'Como criar uma regra:',
          '1. Vá em Configurações → Regras auto. → "+ Nova regra".',
          '2. Escolha o tipo de correspondência: Contém, Começa com, Termina com ou Igual a.',
          '3. Digite a palavra-chave.',
          '4. Escolha a categoria de destino.',
          '5. Clique em "Criar regra" — a regra é aplicada imediatamente a todas as transações anteriores.',
          '> Exemplos de regras úteis:',
          '> "IFOOD" → Alimentação',
          '> "NETFLIX" → Assinatura',
          '> "UBER" → Transporte',
          '> "FARMACIA" → Saúde',
          '> "SPOTIFY" → Assinatura',
          '> "AMAZON" → Compras Online',
        ],
        tip: 'Você não precisa criar a regra manualmente pra corrigir uma transação errada: mude a categoria dela em qualquer lugar do app (Contas e Cartões ou Análise) e o app já cria/atualiza a regra automaticamente, com uma etiqueta "Automática" em Configurações → Regras.',
      },
      {
        title: 'Regras — ordem e prioridade',
        body: [
          'As regras são testadas na ordem em que aparecem na lista. A primeira que combinar com a descrição da transação é aplicada, as demais são ignoradas.',
          '> Exemplo: se você tem "UBER EATS → Alimentação" antes de "UBER → Transporte", um lançamento "UBER EATS PEDIDO 123" vai para Alimentação (correto). Ordem importa!',
          'Você pode ativar/desativar cada regra individualmente clicando no toggle ao lado dela.',
        ],
      },
    ],
  },
]

// ── Quick links ───────────────────────────────────────────────────────────────
const QUICK_LINKS = [
  { icon: Upload,       label: 'Importar extrato',    id: 'transacoes'     },
  { icon: Target,       label: 'Criar meta',           id: 'metas'          },
  { icon: TrendingUp,   label: 'Importar RICO/XP',     id: 'metas'          },
  { icon: Building2,    label: 'Importar OFX',         id: 'metas'          },
  { icon: Tag,          label: 'Categorias',           id: 'configuracoes'  },
  { icon: Zap,          label: 'Regras automáticas',   id: 'configuracoes'  },
  { icon: Layers,       label: 'Subcategorias',        id: 'configuracoes'  },
  { icon: CalendarCheck,label: 'Planejamento',         id: 'planejamento'   },
  { icon: FileText,     label: 'Exportar PDF',         id: 'relatorios'     },
  { icon: RefreshCw,    label: 'Recorrências',         id: 'fixos'          },
  { icon: CreditCard,   label: 'Parcelas',             id: 'parcelas'       },
  { icon: BarChart2,    label: 'Corrigir categoria pelo gráfico', id: 'analise' },
]

// ── Primeiros passos ──────────────────────────────────────────────────────────
const QUICK_STEPS = [
  { label: 'Crie uma conta em "Contas e Cartões" (ex: "Conta Inter", "Cartão Nubank")',       href: '/transactions'           },
  { label: 'Importe seu extrato bancário OFX ou CSV dentro da conta criada',                  href: '/transactions'           },
  { label: 'Crie categorias personalizadas em Configurações → Categorias',                    href: '/settings/categories'    },
  { label: 'Configure regras automáticas em Configurações → Regras auto.',                    href: '/settings/rules'         },
  { label: 'Defina um orçamento mensal por categoria em Planejamento',                        href: '/planning'               },
  { label: 'Confirme seus gastos fixos em Recorrências',                                      href: '/fixos'                  },
  { label: 'Crie uma meta financeira (reserva de emergência, viagem, imóvel…)',               href: '/goals'                  },
]

// ── Componentes ────────────────────────────────────────────────────────────────
function ArticleBlock({ article }: { article: Article }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{article.title}</h4>
      <div className="space-y-1.5">
        {article.body.map((line, i) => {
          if (line.startsWith('• ')) {
            return (
              <div key={i} className="flex gap-2">
                <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{line.slice(2)}</p>
              </div>
            )
          }
          if (/^\d+\./.test(line)) {
            return (
              <div key={i} className="flex gap-2">
                <span className="text-slate-400 mt-0.5 shrink-0 w-4 text-xs font-semibold">{line.split('.')[0]}.</span>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{line.replace(/^\d+\.\s*/, '')}</p>
              </div>
            )
          }
          if (line.startsWith('> ')) {
            return (
              <div key={i} className="bg-slate-50 dark:bg-slate-800/60 border-l-2 border-blue-400 dark:border-blue-500 rounded-r-lg px-3 py-2 ml-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-mono">{line.slice(2)}</p>
              </div>
            )
          }
          return <p key={i} className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{line}</p>
        })}
      </div>
      {article.tip && (
        <div className="flex gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg px-3 py-2.5 mt-2">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{article.tip}</p>
        </div>
      )}
    </div>
  )
}

function SectionAccordion({ section, defaultOpen }: { section: Section; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const Icon = section.icon
  const bgColor  = section.color.split(' ')[0]
  const textColor = section.color.split(' ').slice(1).join(' ')

  return (
    <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-100 dark:border-white/[0.06] overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${bgColor}`}>
          <Icon className={`h-4 w-4 ${textColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{section.title}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{section.summary}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-300 dark:text-slate-600 hidden sm:block">{section.content.length} tópicos</span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-700/50 px-5 pb-6 pt-4 space-y-6">
          {section.content.map((article, i) => (
            <div key={i}>
              {i > 0 && <div className="h-px bg-slate-100 dark:bg-slate-700/50 mb-6" />}
              <ArticleBlock article={article} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HelpPage() {
  const [search, setSearch]   = useState('')
  const [tourOpen, setTourOpen] = useState(false)

  const filtered = search.trim().length < 2
    ? SECTIONS
    : SECTIONS.filter(s => {
        const q = search.toLowerCase()
        return (
          s.title.toLowerCase().includes(q) ||
          s.summary.toLowerCase().includes(q) ||
          s.content.some(a =>
            a.title.toLowerCase().includes(q) ||
            a.body.some(b => b.toLowerCase().includes(q)) ||
            (a.tip?.toLowerCase().includes(q) ?? false)
          )
        )
      })

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Central de ajuda</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Guia completo com exemplos práticos de todas as funcionalidades
          </p>
        </div>
        <div className="h-11 w-11 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <HelpCircle className="h-5 w-5 text-blue-500" />
        </div>
      </div>

      {/* Primeiros passos */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-600/20">
        <div className="flex items-center justify-between gap-4 mb-1">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-200" />
              <p className="font-bold text-base">Primeiros passos</p>
            </div>
            <p className="text-blue-100 text-xs mt-0.5">7 etapas para ter o FinanceApp configurado do zero</p>
          </div>
          <button
            onClick={() => setTourOpen(o => !o)}
            className="text-xs font-semibold bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-lg shrink-0"
          >
            {tourOpen ? 'Fechar' : 'Ver etapas'}
          </button>
        </div>

        {tourOpen && (
          <div className="space-y-2 mt-4">
            {QUICK_STEPS.map((step, i) => (
              <a
                key={i}
                href={step.href}
                className="flex items-center gap-3 bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-3 py-2.5"
              >
                <div className="h-6 w-6 rounded-full bg-white/25 flex items-center justify-center shrink-0 text-xs font-bold">
                  {i + 1}
                </div>
                <p className="text-sm text-white leading-snug">{step.label}</p>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {QUICK_LINKS.map(({ icon: Icon, label, id }) => (
          <button
            key={label}
            onClick={() => {
              setSearch('')
              setTimeout(() => {
                document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }, 50)
            }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-[#111c2d] border border-slate-100 dark:border-white/[0.06] text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-500/40 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all shadow-sm text-left"
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Legenda dos exemplos */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
        <Shield className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Blocos <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded text-[10px]">com linha azul</span> são exemplos com dados fictícios para ilustrar o uso.
        </p>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar no manual... (ex: importar OFX, parcela, meta)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Seções */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 dark:text-slate-500 text-sm">Nenhum resultado para &ldquo;{search}&rdquo;.</p>
          <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">Tente buscar por: importar, meta, categoria, regra, parcela…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((section, i) => (
            <div key={section.id} id={`section-${section.id}`}>
              <SectionAccordion section={section} defaultOpen={i === 0 && !search} />
            </div>
          ))}
        </div>
      )}

      {/* Rodapé */}
      <div className="text-center py-4 text-xs text-slate-300 dark:text-slate-600">
        FinanceApp · Gestão Financeira Pessoal
      </div>
    </div>
  )
}
