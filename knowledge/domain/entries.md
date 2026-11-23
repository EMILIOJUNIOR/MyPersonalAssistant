---
type: Domain Entity
title: Entradas do segundo cérebro
description: Ideias, notas, decisões, resumos e referências com tags, projeto e vínculos.
resource: ../../lib/entries.ts
tags: [dominio, conhecimento, segundo-cerebro]
status: stable
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
---

# Definição

Uma entrada é a unidade de conhecimento: ideia, nota, decisão, resumo ou referência. O conteúdo é markdown livre; tags, projeto e vínculos ajudam a recuperar e conectar.

# Tipos

| `kind` | Uso |
| --- | --- |
| `idea` | Ideia solta, insight, hipótese. |
| `note` | Nota ou anotação. |
| `decision` | Decisão estruturada com opções, prós/contras e justificativa. |
| `summary` | Resumo de conversa, texto ou estudo. |
| `reference` | Link ou material externo. |

# Schema

Tabela `entries`:

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | TEXT | UUID, chave primária. |
| `kind` | TEXT | `CHECK` nos cinco tipos. |
| `title` | TEXT | Obrigatório. |
| `content` | TEXT | Markdown, obrigatório. |
| `tags` | TEXT | JSON array; padrão `[]`. |
| `project_id` | TEXT | FK para `projects`; `ON DELETE SET NULL`. |
| `status` | TEXT | `active` ou `archived`. |
| `metadata` | TEXT | JSON opcional. |
| `created_at` | TEXT | ISO UTC. |
| `updated_at` | TEXT | ISO UTC. |

Tabela `entry_links`:

| Coluna | Regra |
| --- | --- |
| `id` | UUID, chave primária. |
| `from_entry_id` | FK para `entries`; `ON DELETE CASCADE`. |
| `to_entry_id` | FK para `entries`; `ON DELETE CASCADE`. |
| `relation` | Rótulo até 40 caracteres; padrão `related`. |
| `created_at` | ISO UTC. |
| `UNIQUE` | `from_entry_id` + `to_entry_id` + `relation`. |

# Invariantes

- Título e conteúdo não podem ficar vazios.
- Entrada não pode se vincular a ela mesma.
- `link_entries` valida que as duas entradas existem e evita duplicata pela constraint.
- Projeto informado precisa existir.
- Busca padrão mostra apenas `active`; `include_archived` inclui arquivadas.
- Limite padrão 10; máximo 20.
- `record_decision` grava `kind = decision` e `metadata` com opções, escolha e justificativa.

# Tools

| Tool | Uso |
| --- | --- |
| `create_entry` | Cria ideia, nota, resumo ou referência. |
| `get_entry` | Lê uma entrada com seus vínculos. |
| `update_entry` | Altera título, conteúdo, tags, projeto ou status. |
| `search_entries` | Busca por texto, tipo, projeto ou tag. |
| `link_entries` | Cria vínculo entre duas entradas. |
| `record_decision` | Registra decisão estruturada. |

# Relação com OKF (proposta)

O schema já é compatível com um futuro exportador OKF. Mapeamento sugerido:

| Origem | Type OKF |
| --- | --- |
| `entries.kind = idea` | `Idea` |
| `entries.kind = note` | `Note` |
| `entries.kind = decision` | `Decision` |
| `entries.kind = summary` | `Summary` |
| `entries.kind = reference` | `Reference` |
| `projects` | `Project` |
| `tasks` | `Task` |

O exportador não existe hoje. Quando existir, cada entrada vira um `.md` com frontmatter e `entry_links` viram links markdown.

# Relações

- [Projetos](/domain/projects.md)
- [Tarefas](/domain/tasks.md)
- [Índice do bundle](/index.md)
