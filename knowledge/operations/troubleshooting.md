---
type: Runbook
title: Troubleshooting
description: Sintomas comuns, causas prováveis e correções.
tags: [operacao, troubleshooting, telegram, audio, tempo]
status: stable
stale_after: 2027-05-19T00:00:00Z
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
---

# Telegram e webhook

| Sintoma | Causa provável | Correção |
| --- | --- | --- |
| Bot não responde | Webhook em URL errada | Revisar `getWebhookInfo.url`; apontar para `/telegram/inbound`. |
| `401` no webhook | Secret diferente entre Telegram e deploy | Regravar o webhook com o secret do deploy. |
| `401` no self-fetch | Deployment Protection na Vercel | Desativar para produção ou usar bypass. |
| Bot recebe update, mas não responde | `TELEGRAM_ALLOWED_USER_ID` ausente, inválido ou diferente de `message.from.id` | Capturar o ID pelo procedimento em `knowledge/integrations/telegram.md`, atualizar a Vercel e refazer o deploy. |
| `getMe` retorna `401 Unauthorized` | Token revogado ou pertencente a outro bot | Gerar novo token no BotFather, atualizar local/Vercel, refazer deploy e registrar o webhook. |
| `404` em `/telegram/inbound` | Deploy antigo ou rota não compilada | Conferir manifest e refazer deploy. |
| Bot para após renomear projeto | Domínio `*.vercel.app` mudou | Regravar webhook; evitar renomear. |

# Áudio

| Sintoma | Causa provável | Correção |
| --- | --- | --- |
| Bot responde "🎤 Tive um problema…" | Falha no Groq ou download | `npx vercel logs --since 30m`; filtrar `[telegram-audio]`. |
| `Groq HTTP 400: file must be one of…` | Arquivo enviado como `.oga` | Normalizar para `audio.ogg` (já implementado). |
| `404` em `/audio/transcriptions` no opencode-go | Provider não tem STT | Usar Groq. |
| Áudio chega vazio no modelo | Webhook ainda em `/eve/v1/telegram` | Apontar para `/telegram/inbound`. |

# Tempo e lembretes

| Sintoma | Causa provável | Correção |
| --- | --- | --- |
| Lembrete com hora errada | Data local gravada como UTC | Usar `local_datetime_to_utc` antes de gravar. |
| Lembrete duplicado | `sent_at` não gravado | Conferir `claimDueReminders` + `markReminderSent`. |
| Agenda mostra dia errado | Intervalo local mal calculado | Usar `localDayRangeUtc`/`localDayLabel`. |

# Ambiente e build

| Sintoma | Causa provável | Correção |
| --- | --- | --- |
| Env var nova não vale | Deploy antigo | `vercel env` + `eve deploy`. |
| `Cannot find module 'eve/...'` | Dependências desatualizadas | `npm install`. |
| Typecheck quebra em Zod | Versões incompatíveis | Manter `zod@4.6.7` e `ai@7`. |

# Logs

```sh
npx vercel logs --since 30m --non-interactive
```

# Relações

- [Telegram](/integrations/telegram.md)
- [Deploy](/operations/deploy.md)
- [Migrações](/operations/migrations.md)
