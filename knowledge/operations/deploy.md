---
type: Runbook
title: Deploy na Vercel
description: Vincular, publicar e verificar o agente na Vercel.
tags: [operacao, deploy, vercel, env]
status: stable
stale_after: 2027-05-19T00:00:00Z
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
---

# Pré-requisitos

- Projeto na Vercel.
- Variáveis de ambiente configuradas em Production e Preview.
- Banco Turso migrado.

# Variáveis

| Variável | Obrigatória | Usada por |
| --- | --- | --- |
| `OPENCODE_API_KEY` | Sim | `agent/agent.ts` |
| `TURSO_DATABASE_URL` | Sim | `lib/db.ts`, `scripts/migrate.ts` |
| `TURSO_AUTH_TOKEN` | Sim | `lib/db.ts`, `scripts/migrate.ts` |
| `TELEGRAM_BOT_TOKEN` | Sim | Canal, lembretes e áudio. |
| `TELEGRAM_BOT_USERNAME` | Sim | Canal nativo. |
| `TELEGRAM_ALLOWED_USER_ID` | Sim | Allowlist e lembretes. |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | Sim | Webhook. |
| `GROQ_API_KEY` | Só para áudio | Transcrição. |

# Comandos

```sh
eve link --non-interactive --project <name-or-id> [--team <team-id-or-slug>]
eve deploy --non-interactive --yes [--project <name-or-id>]
```

Verificação:

```sh
npx vercel ls
npx vercel inspect <dominio-de-producao>
```

# Critérios de aceite

- Deploy mais novo `● Ready` em Production.
- Domínio de produção aponta para esse deploy.
- `POST /telegram/inbound` sem secret retorna `401`.
- `404` significa que a rota não subiu.
- `getWebhookInfo` sem erro.

# Armadilhas

- `eve deploy` puxa variáveis para `.env.local`; ele **não** envia segredos locais para a Vercel. Use `vercel env`.
- Variável nova ou alterada só vale em deploy novo.
- Não renomeie o projeto na Vercel depois do webhook.
- Não commite `.env.local`.

# Relações

- [Telegram](/integrations/telegram.md)
- [Migrações](/operations/migrations.md)
- [Troubleshooting](/operations/troubleshooting.md)
