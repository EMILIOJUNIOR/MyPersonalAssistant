---
type: Decision
title: "Memória: preferências duráveis"
description: Decisão registrada de usar fileMemory + Vercel Blob; ainda não implementada.
tags: [decisao, memoria, preferencias, pendente]
status: draft
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
sources:
  - id: plan
    resource: ../references/plan.md
    title: Plano de Projeto — Assistente Pessoal
---

# Contexto

Preferências como "prefiro reuniões de manhã" deveriam sobreviver a novas sessões e redeploys. O [Plano de Projeto](/references/plan.md) decidiu usar `fileMemory()` + Vercel Blob para não construir um provider próprio.

# Estado atual

**Não implementado.** Não existe `agent/memory/`; as instructions atuais avisam que preferências duráveis ainda não têm tool e que o assistente não deve prometer lembrar entre conversas.

# Decisão registrada

Quando for implementado:

- Usar `fileMemory()` com Vercel Blob.
- Guardar apenas preferências e fatos duráveis, nunca segredos.
- Escopo por principal.
- Evitar duplicatas a cada conversa.

# Alternativas

| Alternativa | Por que não agora |
| --- | --- |
| Provider próprio | Complexidade desnecessária para um usuário. |
| Tabela `entries` como memória | Mistura conhecimento curado com preferências operacionais. |
| Não ter memória | Limita a experiência, mas é o estado atual. |

# Consequências

- Hoje, o assistente não lembra preferências entre conversas.
- A decisão precisa ser implementada ou revista; enquanto isso, `status: draft`.
- Ao implementar, atualizar este conceito, as instructions e o `log.md`.

# Relações

- [Visão](/product/vision.md)
- [Arquitetura](/architecture/overview.md)
