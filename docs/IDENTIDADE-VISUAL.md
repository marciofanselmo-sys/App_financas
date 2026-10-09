# NOBLI — Identidade visual do app

Guia das telas logadas do app (não da página inicial, que é do sócio). Vale para
qualquer tela nova ou refeita. Ler antes de mexer em interface; o `CLAUDE.md` traz
só o resumo.

Consolidado em 09/10/2026, depois do redesign de Análise, Relatórios, Contas e
Cartões, Investimentos, Metas e Recorrências.

---

## 1. Princípios

1. **Cada tela responde uma pergunta.** Ex.: Relatório Mensal → "Como foi o meu mês?".
2. **Tela operacional ≠ relatório.** A tela mostra o *agora* e as ações
   (confirmar, editar, importar). O relatório mostra o *histórico* e a análise.
   Um **complementa** o outro — nunca copiar os mesmos cards de um no outro.
3. **Menos é mais.** Se a tela ficou carregada, recolher antes de remover.
   Gráficos pequenos lado a lado não funcionam: preferir um embaixo do outro.
4. **Não inventar peça nova quando já existe uma.** Remodelar a apresentação
   da que existe (componente, gráfico, tabela).
5. **Nunca prometer prazo na interface** ("resposta em até 3 dias") sem combinar.

## 2. Cores com significado

| O quê | Cor | Classe |
|---|---|---|
| Receita / entrada | verde | `text-emerald-600` / `text-green-600` (`dark:…-400`) |
| Despesa / saída | vermelho | `text-red-500` (`dark:text-red-400`) |
| Saldo positivo | azul | `text-blue-600 dark:text-blue-400` |
| Saldo negativo | vermelho | `text-red-500` |
| Saúde financeira | roxo | `text-purple-600 dark:text-purple-400` |
| Parcelas | roxo/violeta | `text-violet-600`, barras `#7c3aed` |
| Aportes / investimento | azul | `text-blue-600` |
| Entre contas / transferência | neutro | `text-slate-500` — nunca verde, vermelho ou azul |
| Valor neutro (falta pagar, média) | texto padrão | `text-slate-800 dark:text-slate-100` |

- Cor primária da marca: azul royal `#2563eb` (`blue-600`); títulos de página em `#0B2D6B`.
- **Categorias:** cada categoria-mãe tem cor e ícone próprios (escolhidos em
  Categorias); a subcategoria usa sempre a cor e o ícone da mãe. Paleta de 15 cores
  bem distintas em `CATEGORY_COLORS` (`src/types/index.ts`). Ícones em
  `src/lib/category-icons.ts` (`CategoryIcon`, `categoryIconKey`).
- **Etiquetas de status** (pílula `text-[10px] font-semibold rounded-full`):
  - ok / estável → verde claro (`bg-emerald-50 text-emerald-700`) ou cinza (`bg-slate-100 text-slate-500`)
  - perto / em andamento → âmbar (`bg-amber-50 text-amber-700`)
  - estourou / subiu → vermelho (`bg-red-50 text-red-600`)

## 3. Estrutura de uma página

De cima para baixo:

1. **Título** (`font-heading text-2xl font-extrabold text-[#0B2D6B]`) + subtítulo curto
   + botões de ação à direita (primário azul preenchido, secundários com contorno).
2. **Filtros** numa linha só (período + conta), também no celular.
3. **4 números no topo** (seção 4).
4. **Destaques** (opcional): até 3 frases automáticas, ícone colorido à esquerda.
5. **Seções** em cards (`OverviewSection`): gráficos, listas, tabelas.
6. **"Como funciona esta tela"** no fim, **recolhido por padrão**, com o mesmo ícone de cada botão explicado.

- Largura máxima: **1152 px** (`max-w-6xl mx-auto`) em todas as páginas, menos Minha conta.
- Fundo da página claro (`#f3f6fb`); cards brancos com borda `border-slate-100`,
  `rounded-2xl`, `shadow-sm`. Modo escuro: `dark:bg-[#111c2d]`, `dark:border-white/[0.06]`.

## 4. Os números do topo (KPIs)

- Componente: **`Kpi`** em `src/components/ui/overview-blocks.tsx`.
- **Sempre card branco.** Nada de card em degradê, nem o primeiro.
- Título pequeno em maiúsculas (`text-[11px] uppercase text-slate-400`), valor
  `text-xl font-bold` **na cor do significado** (seção 2), uma linha de apoio embaixo
  (`text-[11px] text-slate-400`). Barra de progresso fina (`h-1.5`) quando ajudar.
- Grade: `grid-cols-2 lg:grid-cols-4 gap-3`.
- Comparação com o período anterior na linha de apoio: `▲ 12% vs agosto (R$ X)`,
  verde quando é bom, vermelho quando é ruim (despesa subir é ruim).
- Card clicável (ex.: Saúde → análise): envolver o `Kpi` num `button`.

## 5. Seções e listas

- Componente: **`OverviewSection`** (ícone azul + título + subtítulo + conteúdo).
- **Lista por categoria** no modelo "Despesas por categoria" da Análise: seta de
  abrir **antes** do ícone, ícone da categoria em círculo com a cor dela, nome,
  "N lançamentos · N subcategorias", barra proporcional, valor e %.
- **Categoria aberta:** linha lateral na cor da categoria; cada subcategoria é um
  grupo **recolhido por padrão** (bolinha na cor, nome, quantos, total); os
  lançamentos ficam dentro, **uma linha cada** (data · descrição · seletor · valor).
- **Tabelas de relatório:** categoria com subcategorias **aninhadas na mãe**, numa
  tabela só (nunca tabela separada de subcategoria). Coluna Status só com etiqueta
  (sem barrinha).
- **Recolhíveis:** seta `ChevronRight` que gira 90° ao abrir, sempre **à esquerda**
  do ícone/título. Listas longas (todos os lançamentos, evolução mensal) ficam
  recolhidas na tela e **abertas no PDF** (`hidden print:block`).

## 6. Cards de conta

- Padrão de Contas e Cartões: card branco pequeno, faixa de 1 px no topo com a cor
  da conta, ícone, nome, etiqueta, valor. **O card inteiro é clicável** (abre a conta);
  os botões do canto (fixar, editar, excluir…) param o clique.
- Agrupados por tipo com subtítulo (Contas correntes, Cartões de crédito…), 3 por
  linha no computador, 2 no tablet, 1 no celular. Mesmos grupos no menu lateral.

## 7. Gráficos (Recharts)

- **Um eixo só.** Nunca dois eixos Y. Para mostrar % junto de valor em reais,
  escrever o % **em cima da barra** (`LabelList`) e repetir no tooltip.
- Largura total, **um embaixo do outro**; altura 240–260 px. Lado a lado só se
  cada um couber com folga.
- Eixos e grade discretos (`#94a3b8`, grade tracejada), tooltip com `rounded 12px`.
- Cores seguem a seção 2 (receita verde, despesa vermelha, parcelas roxo, aportes azul,
  meta em cinza tracejado).
- Mês em andamento / futuro: mais claro ou marcado "previsto"; médias e
  "melhor/pior mês" usam só meses fechados.
- Peças prontas: `src/components/reports/annual-charts.tsx`, `month-charts.tsx`,
  `installment-charts.tsx`.

## 8. Relatórios

- Pergunta no topo (`REPORT_QUESTIONS` em `reports/page.tsx`), cabeçalho do relatório
  (título, período, NOBLI + data de geração), 4 KPIs, destaques, seções, listas
  recolhidas, "Como ler este relatório".
- Filtro de **ano** em todos, menos o Mensal (mês). Totais "até hoje".
- O relatório **complementa** a tela operacional (ver princípio 2).

## 9. Barras de ação e janelas

- **Seleção em massa:** uma linha, card branco com borda azul clara, presa no topo
  (`sticky`); contagem em bolinha azul; botões iguais com ícone; Excluir em vermelho
  por último; escolhas (categoria, evento, conta) abrem **janela** com "Aplicar em N".
- **Janelas de edição** que mexem em vários valores: só gravam no **Salvar**;
  Cancelar desfaz; fechar com alteração pergunta antes de descartar.
- Seletores (`Select`) abrem na largura do conteúdo; subcategoria aparece recuada
  embaixo da mãe, sem repetir o nome da mãe.

## 10. Celular

- Filtros na mesma linha; números do topo em 2 colunas.
- Em tabelas, colunas menos importantes somem e a informação desce para uma linha
  pequena embaixo da descrição — a descrição nunca some.
- Botões de barra quebram linha mantendo o mesmo tamanho.

## 11. Antes de publicar uma tela

- Proposta visual (imagem) aprovada pelo dono antes de grandes mudanças.
- Conferir no navegador: modo claro e escuro, 1440 px e celular.
- Clicar de verdade em cada controle novo e recarregar a página.
