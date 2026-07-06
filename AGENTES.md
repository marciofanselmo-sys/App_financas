# AGENTES — Agentes de IA usados neste projeto

> Documenta os agentes e skills de IA (Claude Code) já utilizados no desenvolvimento do FinanceApp, para consistência entre sessões. Novos agentes devem ser adicionados a este arquivo no mesmo formato assim que forem criados/usados pela primeira vez.
>
> Nota: este arquivo é distinto do `AGENTS.md` (sem acento) na raiz do projeto — aquele é gerado automaticamente pelo Next.js com instruções sobre a versão do framework, e não deve ser editado manualmente.

---

## Explore

**Descrição:** Agente de busca somente-leitura, rápido, para localizar código no repositório (arquivos por padrão, símbolos, strings, "onde X é definido").

**Quando usar:** Perguntas de localização — encontrar um componente, hook, parser ou tela específica sem precisar ler o projeto inteiro manualmente. Não serve para revisão de código ou análise de consistência entre arquivos.

**Ferramentas:** Todas exceto Agent, Artifact, ExitPlanMode, Edit, Write, NotebookEdit.

---

## general-purpose

**Descrição:** Agente genérico para pesquisa complexa, busca de código e execução de tarefas de múltiplas etapas.

**Quando usar:** Quando a busca por um termo/arquivo não tem resultado óbvio nas primeiras tentativas, ou quando a tarefa exige investigação + ação combinadas (ex: mapear todos os parsers de importação existentes antes de adicionar um novo banco).

**Ferramentas:** Todas.

---

## Plan

**Descrição:** Agente arquiteto de software para desenhar planos de implementação — retorna passos, identifica arquivos críticos e pondera trade-offs arquiteturais.

**Quando usar:** Antes de iniciar uma feature não trivial (ex: um novo milestone do `docs/PLAN.md`) quando é útil alinhar a estratégia de implementação antes de codar.

**Ferramentas:** Todas exceto Agent, Artifact, ExitPlanMode, Edit, Write, NotebookEdit.

---

## Skills relevantes ao projeto

Além dos agentes acima, as seguintes skills do Claude Code são usadas no fluxo deste projeto:

| Skill | Uso no projeto |
|---|---|
| `/code-review` | Revisão de diffs antes de commit — bugs, reuso, simplificação |
| `/verify` | Confirmar que uma mudança funciona de fato, rodando o app localmente |
| `/run` | Subir o dev server (`npm run dev`) e validar visualmente uma tela/feature |
| `/security-review` | Revisão de segurança das mudanças pendentes (relevante por lidar com dados financeiros + RLS) |

---

## Como adicionar um novo agente a este documento

Ao usar ou criar um agente específico para este projeto, adicionar uma seção seguindo o formato:

```markdown
## Nome do Agente

**Descrição:** O que o agente faz.

**Quando usar:** Em que situação/tarefa deste projeto ele deve ser acionado.

**Ferramentas:** Quais ferramentas ele tem acesso.
```
