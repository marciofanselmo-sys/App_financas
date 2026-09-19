# Teste — Memória de formato de CSV

**O que está sendo testado:** o app aprende o formato de um CSV de banco que ele não conhece e, na próxima importação do mesmo banco, reconhece sozinho.

**Antes de começar:** use um CSV que **não** seja de C6, Nubank ou Inter (esses têm leitura própria e não passam por este fluxo). Serve qualquer CSV com colunas de data, descrição e valor.

---

## Passo 1 — Importar um CSV de banco desconhecido

- [ ] Em uma conta, clique em **Importar extrato** e escolha o arquivo

**Esperado:** abre a tela de **mapeamento de colunas**, com o app já sugerindo qual coluna é data, descrição e valor.

**Se falhar:** se for direto para a prévia, o app reconheceu o formato — ou o arquivo tem parser próprio, ou você já importou esse formato antes.

---

## Passo 2 — Conferir "Valores negativos são"

- [ ] Na tela de colunas, veja a opção **Valores negativos são**

**Esperado:**
- Extrato de **conta corrente** → **Saídas (extrato de conta)**
- Fatura de **cartão** → **Entradas (fatura de cartão)**

Confira na prévia seguinte: os **gastos** devem aparecer em **vermelho** (Despesa) e o que entrou em **verde** (Receita).

**Se falhar:** se estiver invertido (gastos em verde), troque a opção. Me avise qual era o arquivo — o chute usa a maioria dos valores e pode errar em arquivos pequenos.

---

## Passo 3 — Importar

- [ ] Clique em **Visualizar** e depois em **Importar**

**Esperado:** as transações entram na conta, com a contagem de importadas na tela final.

---

## Passo 4 — Importar o mesmo arquivo de novo

- [ ] Clique em **Importar extrato** e escolha **o mesmo arquivo** outra vez

**Esperado — os dois ao mesmo tempo:**
1. O app **pula a tela de colunas** e vai direto para a prévia, com o aviso azul: *"Formato reconhecido — usamos as colunas que você definiu da última vez."*
2. Ao importar, a **deduplicação** informa que todas as linhas já existiam — **nada entra duplicado**.

**Se falhar:**
- Mostrou a tela de colunas de novo → a impressão digital do cabeçalho não bateu entre as duas leituras. **Me avise.**
- Entrou duplicado → problema na deduplicação, não na memória. **Me avise, é mais grave.**

---

**Resultado:** ☐ Passou  ☐ Falhou no passo ___

Observações:
