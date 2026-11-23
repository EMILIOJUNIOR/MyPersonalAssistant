---
type: Decision
title: "Modelo: opencode-go / gpt-6-luna"
description: Usar o provider opencode-go com gpt-6-luna e reasoning high.
tags: [decisao, modelo, opencode-go, deepseek]
status: stable
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
sources:
  - id: plan
    resource: ../references/plan.md
    title: Plano de Projeto — Assistente Pessoal
---

# Contexto

O agente precisa de tool calling confiável, boa qualidade em português e custo baixo para uso pessoal. O provider já estava configurado no projeto.

# Decisão

Usar `@ai-sdk/openai` com:

- `baseURL: https://opencode.ai/inference/go/v1`
- Modelo `gpt-6-luna`
- `reasoning: high`
- Contexto declarado de 1M tokens
- `OPENCODE_API_KEY` como segredo

# Alternativas

| Alternativa | Por que não |
| --- | --- |
| Vercel AI Gateway | Exige cartão de crédito no momento. |
| OpenAI/Anthropic direto | Mais custo e configuração para o v1. |
| Modelo local | Latência e infraestrutura incompatíveis com Vercel. |

# Consequências

- A disponibilidade do provider afeta o agente inteiro.
- O provider não oferece STT; áudio usa Groq.
- O modelo é definido em `agent/agent.ts`; não troque sem pedido explícito.
- `reasoning: high` aumenta latência e custo; ajuste se o uso diário pesar.

# Relações

- [Arquitetura](/architecture/overview.md)
- [Telegram](/integrations/telegram.md)
