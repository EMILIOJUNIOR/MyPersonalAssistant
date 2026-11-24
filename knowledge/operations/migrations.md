---
type: Runbook
title: Migrações do banco
description: Como criar, aplicar e diagnosticar migrações no Turso.
tags: [operacao, banco, turso, migracoes]
status: stable
stale_after: 2027-05-19T00:00:00Z
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
---

# Como funciona

`0005_multitenancy.sql` adiciona `tenant_id` às tabelas de domínio. `0006_tenant_preferences.sql` cria o nome de tratamento por tenant. `0007_all_appointment_reminders.sql` cria os lembretes dos compromissos existentes.

- `db/migrations/*.sql` são aplicadas em ordem lexicográfica.
- `scripts/migrate.ts` cria `_migrations`, roda cada arquivo uma vez em transação e registra o nome.
- Se uma migração falhar, a transação sofre rollback e o runner para.

# Schema completo para Turso

Para criar diretamente um banco Turso vazio:

```sh
turso db shell <nome-do-banco> < db/turso-schema.sql
```

O arquivo `db/turso-schema.sql` é idempotente, cria o schema final e registra `0001_init.sql`, `0002_knowledge.sql`, `0003_appointments.sql` e `0004_appointment_reminders.sql` em `_migrations`. Depois disso, `npm run db:migrate` reconhece essas migrações como aplicadas.

Para importar a agenda JSON legada sem duplicar registros:

```sh
npm run agenda:import
```

# Comando

```sh
npm run db:migrate
```

Equivale a:

```sh
node --env-file=.env.local --import tsx scripts/migrate.ts
```

# Criar uma migração

1. Crie `db/migrations/000N_descricao.sql`.
2. Use SQL idempotente (`IF NOT EXISTS`).
3. Rode `npm run db:migrate`.
4. Rode `npm run typecheck` e teste o fluxo.
5. Atualize o conceito de domínio e `knowledge/log.md`.
6. Commit e deploy quando Áureo pedir.

# Regras

- Nunca edite uma migração já aplicada.
- Nunca altere o schema direto no Turso de produção.
- `ALTER TABLE ADD COLUMN` é aceitável; recriar tabela exige plano de dados.
- Datas em `TEXT` ISO UTC; JSON em `TEXT`.
- Segredos nunca em migração.

# Turso

- URL `libsql://...`; não use `--tursodb`.
- `TURSO_AUTH_TOKEN` em `.env.local` e na Vercel.
- Se o cliente reclamar de WebSocket, troque `libsql://` por `https://` mantendo host e token.
- O mesmo banco é usado em local, preview e produção.

# Tabelas

| Tabela | Conceito |
| --- | --- |
| `tasks` | [Tarefas](/domain/tasks.md) |
| `reminders` | [Lembretes](/domain/reminders.md) |
| `projects` | [Projetos](/domain/projects.md) |
| `entries` | [Entradas](/domain/entries.md) |
| `entry_links` | [Entradas](/domain/entries.md) |
| `_migrations` | Controle interno |

# Relações

- [Deploy](/operations/deploy.md)
- [Troubleshooting](/operations/troubleshooting.md)
