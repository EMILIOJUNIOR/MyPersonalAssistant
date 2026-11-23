---
type: Decision
title: "Canal: Telegram"
description: Usar Telegram como única interface do v1, sem frontend próprio.
tags: [decisao, canal, telegram]
status: stable
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
sources:
  - id: plan
    resource: ../references/plan.md
    title: Plano de Projeto — Assistente Pessoal
---

# Contexto

O assistente precisa estar disponível no celular, com captura rápida e notificações proativas. Construir um frontend próprio atrasaria o v1 e adicionaria autenticação, deploy e manutenção.

# Decisão

Usar o Telegram como interface única, com:

- Bot criado no BotFather.
- Canal nativo do eve em `agent/channels/telegram.ts`.
- Apenas conversas privadas.
- Allowlist por ID numérico; sem allowlist, ninguém é atendido.
- Webhook apontando para `/telegram/inbound`, que também trata áudio.

# Alternativas

| Alternativa | Por que não |
| --- | --- |
| WhatsApp | API mais burocrática; exigiria Kapso ou outro provedor. |
| Frontend web | Mais tempo; não resolve mobilidade nem notificações. |
| CLI/TUI | Ótimo para desenvolvimento, ruim para uso diário no celular. |

# Consequências

- O BotFather é parte do setup.
- O webhook precisa ser regravado se o token ou o domínio mudarem.
- O canal nativo não entende voz; a rota de áudio com Groq é obrigatória.
- Mensagens de outras contas são ignoradas.

# Relações

- [Telegram](/integrations/telegram.md)
- [Sem frontend](/decisions/0004-sem-frontend.md)
- [Deploy](/operations/deploy.md)
