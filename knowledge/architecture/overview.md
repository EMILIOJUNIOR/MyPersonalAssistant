---
type: Architecture
title: Visão geral da arquitetura
description: Como Telegram, eve, tools e Turso se conectam.
tags: [arquitetura, eve, telegram, turso, vercel]
status: stable
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
---

# Fluxo

```text
Pessoa no Telegram
  │ texto, foto, documento ou voz
  ▼
POST /telegram/inbound          agent/channels/telegram-audio.ts
  │ voz/áudio → Groq Whisper → texto
  ▼
POST /eve/v1/telegram          agent/channels/telegram.ts
  ▼
Agente eve                      agent/agent.ts + agent/instructions.md
  │ tools tipadas
  ▼
lib/                            camada de domínio
  ▼
Turso (libSQL)                  tasks, reminders, projects, entries
```

# Componentes

| Componente | Arquivo | Papel |
| --- | --- | --- |
| Modelo | `agent/agent.ts` | Provider opencode-go, modelo gpt-6-luna, reasoning high, contexto de 1M tokens. |
| Persona | `agent/instructions.md` | LumIA: segundo cérebro, rotina, estilo PT-BR e regras de tools. |
| Tools | `agent/tools/*.ts` | 20 tools tipadas; validam entrada e chamam `lib/`. |
| Canal eve | `agent/channels/eve.ts` | Acesso da TUI e de deployments via Vercel OIDC. |
| Canal Telegram | `agent/channels/telegram.ts` | Conversa privada multi-tenant; grupos falham fechados. |
| Rota de áudio | `agent/channels/telegram-audio.ts` | Transcreve voz/áudio e encaminha o update como texto. |
| Schedule | `agent/schedules/due-reminders.ts` | Cron a cada 15 minutos para lembretes vencidos. |
| Domínio | `lib/*.ts` | Regras de tarefas, lembretes, projetos, entradas e tempo. |
| Schema | `db/migrations/*.sql` | Tabelas e índices versionados. |
| Deploy | Vercel via eve | Build e publicação do agente. |

# Fluxos

## Mensagem de texto

1. O Telegram entrega o update em `/telegram/inbound`.
2. A rota de áudio valida o secret e, como não há voz, encaminha sem alteração.
3. O canal nativo verifica conversa privada e autentica o `message.from.id`.
4. O agente escolhe uma tool; a tool chama `lib/`; `lib/` lê ou escreve no Turso.
5. A resposta volta ao Telegram.

## Mensagem de voz

1. O update chega em `/telegram/inbound` com `message.voice`.
2. A rota baixa o arquivo, envia ao Groq (`whisper-large-v3-turbo`) e recebe o texto.
3. O update é reescrito com `message.text` e sem `voice`/`audio`.
4. O fluxo segue como uma mensagem de texto normal.

## Rotina proativa

1. O cron `*/15 * * * *` executa `sendDueReminders()`.
2. A função consulta lembretes vencidos com `sent_at IS NULL` e tarefa aberta.
3. Envia cada lembrete ao `tenant_id` correspondente e marca `sent_at`.
4. Falhas são logadas e não interrompem os demais lembretes.

# Limites e decisões

- Cada usuário privado é um tenant isolado; grupos são rejeitados.
- Telegram é a interface; não há frontend no v1.
- O áudio não é persistido; ele é enviado ao Groq só no momento da transcrição.
- O mesmo banco Turso é usado em local, preview e produção.
- Segredos vivem apenas em `.env.local` e nas env vars da Vercel.

# Relações

- [Tarefas](/domain/tasks.md)
- [Lembretes](/domain/reminders.md)
- [Entradas](/domain/entries.md)
- [Projetos](/domain/projects.md)
- [Tempo](/domain/time.md)
- [Telegram](/integrations/telegram.md)
- [Deploy](/operations/deploy.md)
