---
type: Decision
title: "Banco: Turso (libSQL)"
description: Persistir tarefas e conhecimento em Turso, com migrações versionadas no repositório.
tags: [decisao, banco, turso, libsql]
status: stable
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
sources:
  - id: plan
    resource: ../references/plan.md
    title: Plano de Projeto — Assistente Pessoal
---

# Contexto

O assistente precisa sobreviver a redeploys e manter tarefas, lembretes e conhecimento. O ambiente é serverless na Vercel, onde arquivo local não é durável.

# Decisão

Usar Turso (libSQL) com `@libsql/client`:

- Um banco em `aws-sa-east-1`.
- Schema versionado em `db/migrations/*.sql`.
- Runner `scripts/migrate.ts` com tabela `_migrations`.
- Acesso somente via `lib/db.ts`, com singleton preguiçoso.

# Alternativas

| Alternativa | Por que não |
| --- | --- |
| Postgres gerenciado | Mais operação e custo para um usuário. |
| SQLite local | Não persiste entre deploys serverless. |
| KV/Redis | Ruim para consultas relacionais e agregações. |

# Consequências

- `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` são obrigatórios.
- O mesmo banco é usado em local, preview e produção; testes sujam dados reais.
- Migrações precisam ser idempotentes e imutáveis.
- Datas são `TEXT` ISO UTC, porque SQLite não tem tipo de data.

# Relações

- [Migrações](/operations/migrations.md)
- [Tarefas](/domain/tasks.md)
- [Entradas](/domain/entries.md)
