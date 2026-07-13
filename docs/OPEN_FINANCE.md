# Estudo: Open Finance no FinanceApp

> Documento vivo. Avalia se/quando faz sentido substituir ou complementar os
> parsers de extrato próprios por integração via Open Finance. Não é uma
> decisão tomada — é a base pra decidir com dados quando o assunto voltar à
> mesa.
>
> Última atualização: 2026-07-13.

---

## 1. Contexto

Hoje o app importa extratos via upload manual (CSV, OFX, parsers próprios
para C6, Itaú, Inter, Mercado Pago, RICO — ver `src/utils/parse-*.ts` e
`import-csv-modal.tsx`). Isso é hoje o maior diferencial de marketing do
produto ("funciona com o banco que você já usa, sem autorizar nada").

Open Finance eliminaria o passo de "baixar extrato todo mês" — o usuário
autoriza uma vez, e o app puxa dados direto do banco via um agregador
credenciado pelo Banco Central. Este documento resume o que existe no
mercado brasileiro, quanto custa, e se cabe no estágio atual do produto
(beta gratuito, 10 usuários, sem billing).

---

## 2. Provedores avaliados

| Provedor | Modelo de cobrança | Custo de entrada | Cobertura | Observações |
|---|---|---|---|---|
| **Pluggy** | Plano "Dados" com volume incluso + excedente por request; "Pagamentos" (Pix) separado | **R$ 2.500/mês** (Dados) + R$ 500/mês (Pagamentos), trial de 14 dias grátis em produção | Boa para PF, integração fácil pra dev; cobertura mais fraca em PJ com estrutura complexa | Autorizado pelo BC como iniciador de pagamento. Existe "Meu Pluggy", app gratuito onde o *usuário final* cadastra e conecta a conta — mas é um produto separado, não dá pra embutir como backend do FinanceApp sem o usuário sair do seu app |
| **Belvo** | Planos por volume/funcionalidade, sandbox grátis | **~R$ 6.000/mês** (relato de dev real, ver §3) | 60+ instituições, boa cobertura PJ | Mais cara que Pluggy no relato encontrado; foco maior em dados, não é iniciador de pagamento próprio |
| **Tecnospeed (PlugBank)** | Setup + mensalidade fixa | **R$ 1.500 (setup) + R$ 540/mês** | 47+ bancos habilitados, sem precisar de credenciamento próprio no BC | Opção mais barata das três com número concreto; vendida para ERPs/software houses, contrato comercial direto |
| **Celcoin** | Full-stack (Open Finance + BaaS + Core Banking), sob consulta | Não divulgado publicamente | Atende casos como Neon, BTG, PipeImob | Integração citada em ~1 semana; faz sentido se também for usar BaaS, não só dados |

**Fonte dos números**: página de preços da Pluggy (pluggy.ai/pricing) e um
relato público de um desenvolvedor brasileiro construindo um app de finanças
pessoais comparando cotações reais das três primeiras opções (TabNews,
jul/2026) — não são tabelas oficiais da Belvo/Tecnospeed (ambas não publicam
preço, só sob consulta), mas são a melhor referência real de mercado
encontrada.

---

## 3. Viabilidade no estágio atual do produto

O app hoje é **100% gratuito, sem billing implementado** (confirmado em
`docs/SAS.md`). Nenhum dos provedores acima tem plano abaixo de ~R$500/mês
fixo — e isso é só o custo da API, sem contar suporte/manutenção da
integração.

Um relato direto de outro desenvolvedor brasileiro no mesmo estágio (app de
finanças pessoais, ainda sem receita) resume o dilema: ele também achou os
três provedores caros demais para validar o produto. A resposta mais votada
na comunidade foi que **se um investimento de R$1.500 + R$540/mês já
inviabiliza o projeto, o modelo de negócio provavelmente é inviável de
qualquer forma** — ou seja, o problema não é "qual provedor é mais barato",
é "não faz sentido pagar mensalidade fixa de API antes de ter receita
recorrente que cubra esse custo com folga".

**Conclusão prática**: com 10 usuários beta e zero monetização, nenhum
provedor de Open Finance se paga. Isso confirma a decisão já registrada
(ver memória `saas-roadmap`) de tratar Open Finance como item de fase 2,
não prioridade agora.

---

## 4. Quando reconsiderar

Faz sentido reabrir esse estudo quando **todas** as condições abaixo
estiverem próximas de verdadeiras:

- [ ] Billing já implementado e funcionando (ver `docs/SAS.md` §3.1)
- [ ] Base de usuários pagantes suficiente pra cobrir o custo fixo mensal
      do provedor mais barato (Tecnospeed, ~R$540/mês) com folga — regra
      de bolso: custo do provedor não deveria passar de ~10-15% da receita
      recorrente projetada
- [ ] Sinal real de usuários pedindo isso — hoje a fricção de "baixar
      extrato todo mês" não apareceu como reclamação recorrente; o consenso
      de mercado (§3) é que boa parte do público tolera entrada manual se a
      ferramenta entrega valor (categorização, relatórios, metas)

Se/quando chegar lá, a sequência recomendada seria: (1) Tecnospeed ou
Pluggy trial de 14 dias em paralelo, testando com um punhado de usuários
reais dispostos a autorizar conexão bancária; (2) manter os parsers atuais
como fallback — nunca remover a importação manual, ela continua servindo
quem não quiser autorizar Open Finance ou usa banco fora da cobertura do
agregador.

---

## 5. Como se encaixaria na arquitetura atual (se avançar)

Não é mudança de schema hoje — é só o desenho de referência pra quando
avançar:

- Open Finance viraria **mais uma fonte de importação** por
  `transaction_board`, ao lado de CSV/OFX/parsers manuais — não substitui,
  complementa. Um board poderia ter `import_source: 'manual' | 'open_finance'`.
- Guardar só o token de conexão do provedor (nunca credenciais bancárias em
  si — o agregador nunca repassa isso), reidratando a sessão a cada sync
  via API do provedor.
- Sync inicial + webhook do provedor pra atualizações incrementais (evita
  polling constante e custo de request desnecessário).
- Feature gate natural para o modelo de billing já cogitado em
  `docs/SAS.md` (plano pago libera Open Finance, grátis continua manual).

---

## 6. Riscos / requisitos adicionais

- **LGPD reforçado**: autorizar acesso a dados bancários de terceiros exige
  política de privacidade e termos de uso mais robustos que hoje (item já
  pendente na Fase 2, ver `docs/SAS.md` §3.5) — não dá pra ativar Open
  Finance sem isso pronto antes.
- **Dependência de terceiro**: instabilidade/mudança de preço do agregador
  vira risco direto de produto; parsers próprios não têm esse risco.
- **Suporte a usuário**: fluxo de consentimento bancário gera dúvida e
  ticket de suporte (usuário desconfia de autorizar acesso à conta) — exige
  UX de explicação clara, mais pesado que "arraste seu extrato aqui".

---

## 7. Recomendação

**Não seguir agora.** Confirma o que já estava registrado como decisão: o
diferencial de parsers próprios continua sendo o caminho certo pro estágio
atual (beta gratuito, validando produto). Open Finance é uma evolução de
médio prazo, condicionada a billing funcionando e base de pagantes real —
não um projeto técnico independente disso.

## 8. Perguntas em aberto

- Se/quando chegar a hora: começar por Tecnospeed (mais barato, número
  concreto) ou negociar direto com Pluggy/Celcoin um plano menor por
  volume baixo de usuários?
- Vale oferecer Open Finance só no plano pago desde o lançamento do
  billing, ou validar primeiro com um piloto pago à parte (ex.: cobrar
  setup de um pequeno grupo disposto a testar) antes de comprometer
  arquitetura?
