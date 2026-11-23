---
type: Domain Entity
title: Tarefas
description: Unidade de trabalho com prazo, prioridade e status, persistida no Turso.
resource: ../../lib/tasks.ts
tags: [dominio, tarefas, turso]
status: stable
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
---

# Definição

Uma tarefa guarda **o quê** precisa ser feito e **quando**. Lembretes são separados: uma tarefa pode ter vários avisos. Veja [lembretes](/domain/reminders.md).

# Schema

Tabela `tasks` (migrações `0001_init.sql` e `0002_knowledge.sql`):

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | TEXT | UUID, chave primária. |
| `title` | TEXT | Obrigatório, não vazio. |
| `notes` | TEXT | Contexto livre. |
| `status` | TEXT | `open`, `done` ou `cancelled`. |
| `priority` | TEXT | `low`, `normal` ou `high`; padrão `normal`. |
| `due_at` | TEXT | Prazo em ISO 8601 UTC; pode ser nulo. |
| `project_id` | TEXT | FK para `projects`; `ON DELETE SET NULL`. |
| `entry_id` | TEXT | FK para `entries`; `ON DELETE SET NULL`. |
| `created_at` | TEXT | ISO UTC. |
| `updated_at` | TEXT | ISO UTC. |
| `completed_at` | TEXT | ISO UTC quando concluída. |

# Invariantes

- Título vazio é rejeitado.
- `due_at`, quando informado, é normalizado para ISO UTC.
- Concluir é idempotente: tarefa já `done` retorna como está.
- Tarefa `cancelled` não pode ser concluída.
- Excluir usa `cancel` por padrão; `delete` remove a tarefa e seus lembretes.
- Projeto informado precisa existir.
- `entry_id` existe no schema, mas nenhuma tool o preenche hoje.

# Consultas

- `list_tasks` lista por padrão apenas `open`.
- Ordem: prazo mais próximo primeiro; sem prazo por último; depois criação mais recente.
- Limite padrão 20; máximo 50.
- `overdue_only` considera apenas tarefas abertas com `due_at` no passado.

# Tools

| Tool | Uso |
| --- | --- |
| `create_task` | Cria a tarefa; o prazo não cria lembrete sozinho. |
| `list_tasks` | Lista pendentes, atrasadas, concluídas ou todas. |
| `update_task` | Altera título, notas, prioridade, prazo ou projeto. |
| `complete_task` | Marca como concluída. |
| `delete_task` | Cancela ou apaga; sempre pede aprovação. |

# Relações

- [Lembretes](/domain/reminders.md)
- [Projetos](/domain/projects.md)
- [Entradas](/domain/entries.md)
- [Tempo](/domain/time.md)
