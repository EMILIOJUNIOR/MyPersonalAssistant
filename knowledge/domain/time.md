---
type: Domain Entity
title: Tempo e fusos
description: UTC no banco, America/Sao_Paulo na conversa, com conversão de dia local.
resource: ../../lib/time.ts
tags: [dominio, tempo, utc, timezone]
status: stable
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
---

# Regra

O banco guarda ISO 8601 UTC. A conversa mostra `America/Sao_Paulo`. Nunca grave data local como se fosse UTC.

# Funções

| Função | Papel |
| --- | --- |
| `nowIso` | Agora em ISO UTC. |
| `parseInstant` / `normalizeInstant` | Valida ISO com fuso e normaliza para UTC. |
| `localLabel` | Data e hora completas em pt-BR no fuso local. |
| `localDateKey` | `YYYY-MM-DD` local. |
| `localTimeLabel` | `HH:mm` local. |
| `localDayLabel` | Dia da semana e data por extenso. |
| `localDateTimeToUtc` | Converte data/hora local para UTC. |
| `localDayRangeUtc` | Intervalo `[start, endExclusive)` de um dia local. |
| `isPast` | Compara com agora. |

# Detalhe do offset

`localDateTimeToUtc` faz duas passagens de offset para acertar horários perto de mudanças de fuso. O Brasil não observa horário de verão desde 2019, mas o cálculo continua correto se a regra mudar.

# Tools

| Tool | Uso |
| --- | --- |
| `get_current_datetime` | Retorna UTC, hora local, fuso e dia da semana. |
| `local_datetime_to_utc` | Converte "amanhã", "sexta às 10h" etc. antes de gravar. |

# Erros comuns

- Passar data local em `due_at` ou `remind_at` sem converter.
- Comparar strings ISO com fusos diferentes sem normalizar.
- Usar `new Date("2026-11-20")` esperando meia-noite local; o padrão é UTC.
- Esquecer que o intervalo de agenda é half-open: inclui o início, exclui o fim.

# Relações

- [Tarefas](/domain/tasks.md)
- [Lembretes](/domain/reminders.md)
