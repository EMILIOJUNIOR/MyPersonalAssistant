---
type: Decision
title: "Memória: preferências duráveis"
description: Preferências duráveis são armazenadas como entradas no Turso.
tags: [decisao, memoria, preferencias, pendente]
status: stable
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
sources:
  - id: plan
    resource: ../references/plan.md
    title: Plano de Projeto — Assistente Pessoal
---

# Contexto

Preferências como "prefiro reuniões de manhã" devem sobreviver a novas sessões e redeploys. A LumIA usa a tabela `entries` do Turso com a tag `preference`.

# Estado atual

**Implementado.** `remember` cria uma entrada `note` marcada como `preference`; `forget` arquiva as entradas correspondentes. `agent/instructions/memoria.ts` injeta as preferências ativas antes das chamadas do modelo.

# Decisão registrada

Regras:

- Guardar apenas preferências e fatos duráveis, nunca segredos.
- Evitar duplicatas por comparação case-insensitive.
- Arquivar ao esquecer, preservando histórico no banco.

# Alternativas

| Alternativa | Por que não agora |
| --- | --- |
| Provider próprio | Complexidade desnecessária para um usuário. |
| Vercel Blob | Adiciona outro armazenamento e não participa da transação do Turso. |
| Não ter memória | Limita a experiência. |

# Consequências

- Preferências ficam no mesmo banco que tarefas e conhecimento.
- O filtro por tag separa preferências de entradas comuns.
- Segredos continuam proibidos.

# Relações

- [Visão](/product/vision.md)
- [Arquitetura](/architecture/overview.md)
