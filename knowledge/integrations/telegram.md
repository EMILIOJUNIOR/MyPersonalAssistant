---
type: Integration
title: Telegram
description: Canal nativo multi-tenant, webhook e transcrição de áudio via Groq.
tags: [integracao, telegram, webhook, audio, groq]
status: stable
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
---

# Camadas

| Camada | Arquivo | Papel |
| --- | --- | --- |
| Canal nativo | `agent/channels/telegram.ts` | Conversa privada, tenant por `message.from.id` e sessão. |
| Rota de áudio | `agent/channels/telegram-audio.ts` | Valida secret, transcreve voz/áudio e encaminha. |

# Canal nativo

- `botUsername` vem de `TELEGRAM_BOT_USERNAME`.
- Só aceita `chat.type === "private"`.
- Usa `message.from.id` como `tenantId`.
- Filtra todos os dados do Turso pelo tenant.
- Retorna `null` para grupos, supergrupos e canais.

# Rota de áudio

- Endpoint: `POST /telegram/inbound`.
- Valida `X-Telegram-Bot-Api-Secret-Token` com `timingSafeEqual` contra `TELEGRAM_WEBHOOK_SECRET_TOKEN`.
- Se não houver `message.voice` nem `message.audio`, encaminha o update sem alteração para `/eve/v1/telegram`.
- Se houver áudio:
  1. Verifica conversa privada.
  2. Baixa via `getFile` (limite ~20 MB).
  3. Envia ao Groq com `whisper-large-v3-turbo`, `language=pt`, `temperature=0`.
  4. Reescreve `message.text` com a transcrição (e legenda, se houver).
  5. Remove `voice`/`audio` e encaminha para `/eve/v1/telegram`.
- Falhas avisam no chat com 🎤 e não criam turno vazio.

# Webhook

- URL de produção: `https://<projeto>.vercel.app/telegram/inbound`.
- Registrar com `setWebhook`, `secret_token` e `allowed_updates: ["message", "callback_query"]`.
- Conferir com `getWebhookInfo`; `last_error_message` deve ser `null`.
- Se o projeto for renomeado na Vercel, o domínio muda e o webhook quebra.

# Identidade multi-tenant

O tenant é o `message.from.id` enviado pelo Telegram. Ele identifica a conta, não o aparelho, e não precisa ser configurado em variável de ambiente.

Se o bot já estiver com webhook ativo, capture o ID temporariamente:

1. Remova o webhook:

   ```powershell
   node --env-file=.env.local --input-type=module -e "const r=await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/deleteWebhook',{method:'POST'}); console.log(await r.json())"
   ```

2. Envie `/start` para o bot correto.
3. Consulte o ID:

   ```powershell
   node --env-file=.env.local --input-type=module -e "const r=await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/getUpdates'); const b=await r.json(); console.log(JSON.stringify(b.result?.map(x=>({update_id:x.update_id,user_id:x.message?.from?.id,username:x.message?.from?.username,chat_id:x.message?.chat?.id})),null,2))"
   ```

4. Restaure o webhook:

   ```powershell
   node --env-file=.env.local --input-type=module -e "const r=await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/setWebhook',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://<projeto>.vercel.app/telegram/inbound',secret_token:process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN,allowed_updates:['message']})}); console.log(await r.json())"
   ```

Confira `getWebhookInfo` depois. Não cole tokens no chat ou no repositório. Depois de alterar variáveis de produção, execute `npx eve deploy --non-interactive --yes`.

# Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Bot API, envio e download. |
| `TELEGRAM_BOT_USERNAME` | Canal nativo. |
| `message.from.id` | Tenant e destinatário dos lembretes. |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | Validação do webhook. |
| `GROQ_API_KEY` | Transcrição de áudio. |

Nunca coloque valores no bundle; apenas nomes.

# Limites

- Download do Bot API: até 20 MB.
- Groq: até 25 MB por arquivo; timeout local de 30 s.
- Transcrição adiciona ~1–3 s à resposta.
- O áudio não é persistido no Turso.

# Relações

- [Decisão Telegram](/decisions/0001-telegram.md)
- [Arquitetura](/architecture/overview.md)
- [Deploy](/operations/deploy.md)
- [Troubleshooting](/operations/troubleshooting.md)
