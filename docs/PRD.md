# PRD — FinanceApp: Gestão Financeira Pessoal

> Documento de requisitos do produto. Versão inicial — junho/2026.

---

## 1 — Problema Identificado

A maioria das pessoas não tem visibilidade real sobre para onde vai o seu dinheiro. Os aplicativos de banco mostram o extrato, mas não organizam, não agrupam e não ajudam a entender padrões. Planilhas funcionam, mas exigem trabalho manual constante e não escalam. Apps financeiros existentes (como Mobills, Organizze, Guiabolso) são genéricos demais ou cobram caro por funcionalidades básicas.

O problema central é: **falta de controle financeiro prático, sem fricção e sem custo**.

---

## 2 — Solução

Um app web de gestão financeira pessoal que centraliza todas as contas do usuário (bancos, cartões, carteiras digitais, investimentos) em um único painel. O diferencial é a importação automática de extratos com categorização inteligente por regras, detecção de gastos recorrentes, acompanhamento de parcelas e metas financeiras — tudo com uma interface limpa e sem necessidade de sincronização automática com bancos (sem Open Finance).

---

## 3 — Funcionalidades Principais

- **Multi-conta**: cada conta (banco, cartão, corretora) tem sua própria visão e pode ser pinada no dashboard
- **Importação de extratos**: CSV (genérico), OFX/QFX (padrão bancário), C6 Bank e RICO (XLS)
- **Categorização automática por regras**: o usuário cria uma vez, o app aplica em todas as importações futuras e retroativamente
- **Gastos recorrentes**: detecção automática, agrupamento por subcategoria, confirmação como gasto fixo
- **Parcelas ativas**: tracking de progresso por compra (X/Y parcelas, previsão de término)
- **Metas financeiras**: com status automático (no prazo / adiantada / atrasada)
- **Planejamento orçamentário**: templates (50/30/20) e comparativo planejado vs realizado
- **Relatórios**: mensal, anual, parcelas e gastos fixos — com filtro por conta
- **Analytics**: gráficos por categoria com drill-down nas transações
- **Dashboard inteligente**: diagnóstico financeiro e próxima ação recomendada
- **Tema claro/escuro** e **demo sem cadastro**

---

## 4 — Persona e Tipos de Usuários

### Persona principal — "O Controlador Iniciante"
Pessoa entre 25–40 anos, assalariada, que ganha bem mas sente que o dinheiro some sem saber por quê. Tem conta em 2–3 bancos, usa cartão de crédito, talvez tenha algum investimento. Quer entender seus gastos mas não tem disciplina (nem tempo) para preencher planilha todo mês.

### Persona secundária — "O Investidor Organizado"
Pessoa que já controla as finanças de alguma forma, mas quer consolidar tudo em um lugar, acompanhar metas de investimento e ter relatórios para tomar decisões melhores.

### Fora do escopo (por ora)
Empresas, MEIs, casais com finanças compartilhadas, usuários sem acesso a exportar extratos bancários.

---

## 5 — Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Estilização | Tailwind CSS v4 |
| Componentes UI | shadcn/ui (base-ui, não Radix) |
| Gráficos | Recharts |
| Backend / Banco | Supabase (PostgreSQL + Auth + RLS) |
| Deploy | Vercel |
| Autenticação | Supabase Auth (email/senha) |
| Segurança de dados | Row Level Security — cada usuário acessa apenas seus próprios dados |

---

## 6 — Referências de Design

- **Identidade visual**: azul royal (`#2563eb`) + índigo como gradiente, fundo branco/slate escuro no dark mode
- **Layout**: sidebar fixa no desktop, nav inferior no mobile
- **Referências de produto**: Notion (organização limpa), Linear (densidade de informação sem poluição), Vercel Dashboard (cards e métricas)
- **Referências de finanças**: Finary (francês, premium), Toshl Finance (visual moderno)
- **Login/Register**: split-screen SaaS — painel de marca com preview do produto à esquerda, formulário à direita; barra superior contém apenas o `ThemeToggle` (sem links de navegação cruzada entre login/cadastro)
- **Princípios**: dados densos mas legíveis, sem modal desnecessário, feedback visual imediato, dark mode de primeira classe
- **Confirmação de identidade (2026-07-01)**: redesign dark premium (navy + dourado) foi testado e revertido — o gradiente azul original permanece como identidade visual oficial das páginas de auth

---

## 7 — Estratégia de Aquisição e Funil de Vendas

O produto é vendido como assinatura mensal (**R$29,90/mês**) via **Cakto**. A aquisição não é venda direta — passa por um funil de qualificação:

`@no.blesse` (Instagram, orgânico + Meta Ads) → **Quiz diagnóstico financeiro** → Página de resultado personalizada → Checkout Cakto → Onboarding → Retenção

- **Canal principal**: `@no.blesse` no Instagram, identidade "Controle financeiro"
- **Qualificação pré-venda**: o quiz diagnóstico filtra e engaja o lead antes de expor o preço, aumentando a taxa de conversão
- **Onboarding, modo demo e polish visual** são tratados como requisitos críticos de conversão e retenção, não como "nice to have"
- O mapeamento completo do funil está documentado fora deste repositório, em `~/Gestão Financeira /funil-de-vendas/mapa-mental-funil.html`
