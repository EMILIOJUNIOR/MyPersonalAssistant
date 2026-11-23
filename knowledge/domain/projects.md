---
type: Domain Entity
title: Projetos
description: Agrupamento de tarefas e entradas por iniciativa.
resource: ../../lib/projects.ts
tags: [dominio, projetos]
status: stable
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
---

# Definição

Um projeto agrupa tarefas e entradas relacionadas a uma iniciativa. Não é uma pasta: é um vínculo opcional.

# Schema

Tabela `projects`:

| Coluna | Regra |
| --- | --- |
| `id` | UUID, chave primária. |
| `name` | Obrigatório, não vazio. |
| `description` | Opcional. |
| `status` | `active`, `paused`, `done` ou `archived`. |
| `created_at` | ISO UTC. |
| `updated_at` | ISO UTC. |

# Invariantes

- Nome vazio é rejeitado.
- `list_projects` retorna as contagens `open_tasks` e `active_entries`.
- Limite padrão 20; máximo 50.
- `deleteProject` existe em `lib/`, mas não há tool exposta; apagar projeto não faz parte do fluxo atual.
- Ao apagar um projeto (se exposto no futuro), tarefas e entradas ficam com `project_id = NULL`; elas não são apagadas.

# Tools

| Tool | Uso |
| --- | --- |
| `create_project` | Cria um projeto. |
| `list_projects` | Lista com status e contagens. |
| `update_project` | Altera nome, descrição ou status. |

# Relações

- [Tarefas](/domain/tasks.md)
- [Entradas](/domain/entries.md)
