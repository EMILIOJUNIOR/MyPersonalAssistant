---
type: Agent Guide
title: Guia do diretório lib/
description: Regras da camada de domínio, acesso ao Turso, tempo, tarefas, lembretes, projetos e entradas.
tags: [dominio, libsql, turso, tempo]
status: stable
generated: { by: opencode/deepseek-v4.1-flash, at: 2026-11-19T12:19:15Z }
---

# Papel

`lib/` é a camada de domínio. Não importa `eve`, `ai` nem nada de `agent/`; é código puro de negócio e persistência.

# Módulos

| Arquivo | Responsabilidade |
| --- | --- |
| `db.ts` | Singleton do `@libsql/client`; único lugar que lê `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`. |
| `time.ts` | Fuso `America/Sao_Paulo`, conversão UTC/local, labels e intervalos de dia. |
| `tasks.ts` | CRUD de tarefas, status, prioridade, prazo e soft delete. |
| `reminders.ts` | Lembretes, claim de vencidos, marcação de enviados e agenda. |
| `projects.ts` | CRUD de projetos e contagens de tarefas/entradas. |
| `entries.ts` | Segundo cérebro: entradas, tags, busca, decisões e vínculos. |
| `notifications.ts` | Despacha lembretes vencidos para o Telegram. |
| `telegram.ts` | `sendMessage` de baixo nível para o Bot API. |

# Regras

- Todo SQL usa parâmetros (`?`); nunca interpole entrada de pessoa usuária.
- IDs com `crypto.randomUUID()`; timestamps com `nowIso()`.
- O banco guarda ISO 8601 UTC. Converta para local só na borda, com `localLabel`/`localDateKey`.
- Tags e `metadata` são JSON em `TEXT`; faça parse defensivo e ignore valor inválido.
- Limites de listagem são clampados (tarefas até 50; entradas até 20).
- Valide a existência do projeto antes de vincular tarefa ou entrada.
- Mensagens de erro são em português e explicam o que fazer.
- Tarefa usa soft delete por padrão (`cancelled`); `delete` definitivo só com confirmação.
- Lembretes usam `claimDueReminders` + `markReminderSent` para não duplicar envio.
- `notifications.ts` é best-effort: falha de envio não deve derrubar o webhook.

# Adicionar uma função de domínio

1. Defina tipos, input e um `rowTo...` que trate `null`.
2. Implemente o CRUD com validação e SQL parametrizado.
3. Exporte a função e use em uma tool de `agent/tools/`.
4. Crie ou atualize o conceito em `knowledge/domain/`.
5. Registre em `knowledge/log.md` e rode `npm run typecheck`.

# Conceitos relacionados

- [Tarefas](../knowledge/domain/tasks.md)
- [Lembretes](../knowledge/domain/reminders.md)
- [Entradas](../knowledge/domain/entries.md)
- [Projetos](../knowledge/domain/projects.md)
- [Tempo](../knowledge/domain/time.md)
