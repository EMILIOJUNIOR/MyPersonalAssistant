---
type: Domain Entity
title: Lembretes
description: Aviso programado para uma tarefa, com controle de envio e agenda.
resource: ../../lib/reminders.ts
tags: [dominio, lembretes, agenda, cron]
status: stable
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
---

# Definição

Um lembrete guarda **quando avisar**. Ele pertence a uma tarefa; uma tarefa pode ter vários lembretes. O prazo da tarefa (`due_at`) não agenda aviso sozinho.

# Schema

Tabela `reminders`:

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | TEXT | UUID, chave primária. |
| `task_id` | TEXT | FK para `tasks`; `ON DELETE CASCADE`. |
| `remind_at` | TEXT | ISO 8601 UTC; precisa estar no futuro. |
| `sent_at` | TEXT | ISO UTC quando enviado; nulo = pendente. |
| `created_at` | TEXT | ISO UTC. |

# Invariantes

- `remind_at` precisa estar no futuro.
- Só tarefa `open` aceita lembrete.
- Cancelar só funciona antes do envio (`sent_at IS NULL`).
- `list_reminders` mostra pendentes por padrão; pode filtrar por tarefa e intervalo.
- `sendDueReminders` pega no máximo 20 lembretes por execução; o claim aceita até 50.
- `markReminderSent` só atualiza se `sent_at IS NULL`; isso evita duplicidade.

# Envio

`agent/schedules/due-reminders.ts` roda `*/15 * * * *` e chama `sendDueReminders()`:

1. Lê o primeiro ID da allowlist (`TELEGRAM_ALLOWED_USER_ID`).
2. `claimDueReminders(now, 20)` busca lembretes vencidos de tarefas abertas.
3. Envia `⏰ Lembrete: <título>` com horário local.
4. Marca `sent_at`; falhas são logadas e contabilizadas.

# Tools

| Tool | Uso |
| --- | --- |
| `set_reminder` | Cria um aviso futuro para uma tarefa aberta. |
| `list_reminders` | Lista lembretes pendentes. |
| `cancel_reminder` | Remove um lembrete ainda não enviado. |
| `get_agenda` | Agrupa tarefas por dia local, com lembretes pendentes. |

# Limites

- Cron da Vercel Hobby pode atrasar até 15 minutos.
- Sem `TELEGRAM_ALLOWED_USER_ID`, o envio falha com erro explícito.
- Lembrete não é evento de calendário; não há integração externa.

# Relações

- [Tarefas](/domain/tasks.md)
- [Tempo](/domain/time.md)
- [Telegram](/integrations/telegram.md)
