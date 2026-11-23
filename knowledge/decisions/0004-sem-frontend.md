---
type: Decision
title: "Interface: sem frontend no v1"
description: O Telegram é a interface; não há app web próprio no v1.
tags: [decisao, interface, frontend]
status: stable
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
sources:
  - id: plan
    resource: ../references/plan.md
    title: Plano de Projeto — Assistente Pessoal
---

# Contexto

O valor do v1 está em capturar e lembrar, não em visualização. Um frontend exigiria autenticação, design, deploy separado e manutenção.

# Decisão

Não ter frontend no v1. O Telegram resolve conversa, notificações, botões de aprovação e mobile.

# Alternativas

| Alternativa | Por que não |
| --- | --- |
| Next.js | Atrasa o núcleo e adiciona superfície de segurança. |
| Só TUI | Não serve para uso diário no celular. |
| WhatsApp | API mais burocrática que o Telegram. |

# Consequências

- Sem dashboards, gráficos ou edição em massa.
- Aprovações usam botões nativos do Telegram.
- Uma interface web fica no backlog pós-v1.

# Relações

- [Telegram](/integrations/telegram.md)
- [Visão](/product/vision.md)
