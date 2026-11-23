---
type: Project Plan
title: Plano de Projeto — Assistente Pessoal
description: Plano original do v1, mantido como referência histórica.
tags: [plano, historico, produto]
status: deprecated
---

# Plano de Projeto — Assistente Pessoal

> **Documento histórico.** A fonte de verdade atual é [`../index.md`](../index.md). Este plano pode conter itens ainda não implementados; consulte o `status` dos conceitos de domínio.

**Stack:** eve (Vercel) · Telegram · Turso (libSQL) · Vercel Blob
**Status:** v1 em construção
**Última atualização:** 2026-11-17

---

## 1. Visão

Um assistente pessoal de rotina, em português, que vive no Telegram e ajuda a
capturar, organizar e lembrar tarefas. O objetivo não é uma demo: é uma
ferramenta que você usa todos os dias.

## 2. Critério de sucesso (v1)

- Você usa o assistente diariamente por 2 semanas.
- Capturar uma tarefa leva menos de 10 segundos pelo Telegram.
- Nenhum lembrete combinado é perdido.
- Tarefas e preferências sobrevivem a redeploys.
- Você consegue explicar o papel de `instructions`, `tools`, `memory`,
  `schedules` e `channels`.
- Nenhum segredo no repositório, na memória ou no histórico da conversa.

## 3. Decisões fechadas

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Canal | Telegram | Sem frontend, botões de aprovação, webhook simples. |
| Escopo v1 | Rotina: tarefas, lembretes e resumo diário | Entrega valor rápido e ensina tools, banco e schedules. |
| Banco | Turso (libSQL) | SQLite gerenciado, free tier, mesmo SQL do dev. |
| Ambiente | Turso Cloud desde o início | Banco já criado em `aws-sa-east-1`; um só banco no v1. |
| Acesso ao banco | `@libsql/client` | Cliente maduro para libSQL, com suporte a arquivo local e remoto. |
| Memória | `fileMemory()` + Vercel Blob | Preferências entre sessões sem construir um provider. |
| Interface | Sem frontend no v1 | O Telegram é a interface. |
| Modelo | `opencode-go` / `gpt-6-luna` | Já configurado; validar em produção na etapa 0. |
| Usuários | Um (você) | Sem multiusuário, mas com escopo por principal desde o início. |

## 4. Escopo

### Dentro do v1

1. Conversar em português pelo Telegram, restrito ao seu usuário.
2. Criar, listar, atualizar e concluir tarefas.
3. Definir lembretes e recebê-los no Telegram.
4. Receber um resumo de bom dia e uma revisão noturna.
5. Lembrar preferências duráveis entre conversas.
6. Pedir confirmação antes de ações destrutivas.

### Fora do v1

- E-mail, finanças, voz, WhatsApp, multiusuário.
- Criação automática de eventos em calendário.
- Subagentes e automações autoiniciadas.
- Interface web própria.

## 5. Arquitetura

```text
Você no Telegram
      │ webhook
      ▼
┌──────────────────────────────┐
│ eve na Vercel (1 agente)     │
│                              │
│ instructions.md → persona    │
│ memory/         → preferências│
│ tools/          → tarefas     │
│ connections/    → Google etc. │
│ skills/         → rotinas     │
│ schedules/      → bom dia/noite│
└──────────┬───────────────────┘
           │
      Turso (libSQL)
      tarefas e lembretes
```

### Estrutura de arquivos prevista

```text
agent/
├── agent.ts
├── instructions.md
├── memory/
│   └── file.ts
├── channels/
│   └── telegram.ts
├── tools/
│   ├── get_current_datetime.ts
│   ├── create_task.ts
│   ├── list_tasks.ts
│   ├── update_task.ts
│   ├── complete_task.ts
│   └── delete_task.ts
├── schedules/
│   ├── morning-digest.ts
│   ├── evening-review.ts
│   └── due-reminders.ts
└── skills/
    ├── planejar-dia.md
    └── revisao-semanal.md

lib/
├── db.ts          # cliente libSQL
├── time.ts        # fuso America/Sao_Paulo
└── tasks.ts       # queries e tipos

db/
├── migrations/
│   └── 0001_init.sql
└── README.md

scripts/
└── migrate.ts
```

## 6. Princípios de design

1. **Memória ≠ banco de dados.** Memória guarda preferências e fatos duráveis.
   Tarefas, prazos e status ficam no Turso e são sempre consultados por tool.
2. **O modelo não inventa dados.** Se a tool não retornou, o assistente diz que
   não sabe.
3. **Leitura livre, escrita com cuidado.** Listar é direto. Criar evento externo,
   enviar mensagem e apagar pedem aprovação.
4. **Fuso horário explícito.** Banco em UTC; conversa em `America/Sao_Paulo`.
5. **Uma responsabilidade por tool.** Tools pequenas e testáveis valem mais que
   uma tool "faz tudo".
6. **Nada de segredo na conversa.** Tokens ficam em variáveis de ambiente.

## 7. Modelo de dados (v1)

SQLite não tem tipo de data nativo. Datas são `TEXT` em ISO-8601 UTC
(`2026-11-20T13:00:00.000Z`), o que ordena corretamente e é legível.

Duas tabelas: a tarefa guarda o "o quê" e o prazo; o lembrete guarda o
"quando avisar". Uma tarefa pode ter mais de um lembrete.

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'done', 'cancelled')),
  priority      TEXT NOT NULL DEFAULT 'normal'
                CHECK (priority IN ('low', 'normal', 'high')),
  due_at        TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  completed_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_due
  ON tasks (status, due_at);

CREATE TABLE IF NOT EXISTS reminders (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL
              REFERENCES tasks(id) ON DELETE CASCADE,
  remind_at   TEXT NOT NULL,
  sent_at     TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_pending
  ON reminders (remind_at)
  WHERE sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reminders_task
  ON reminders (task_id);
```

Regras:

- `id`: UUID gerado com `crypto.randomUUID()`.
- `due_at`: prazo da tarefa; `reminders.remind_at`: quando avisar.
- `sent_at`: preenchido depois do envio, para não repetir.
- `status = 'cancelled'`: tarefa removida logicamente; `delete` de verdade só
  com aprovação.
- O cron consulta `reminders` com `sent_at IS NULL` e ignora tarefas concluídas
  ou canceladas.
- Limite inicial de 20 itens por `list_tasks`.

### Conexão

`.env.local` (nunca commitado):

```env
TURSO_DATABASE_URL=libsql://<seu-banco>.aws-sa-east-1.turso.io
TURSO_AUTH_TOKEN=...
```

Na Vercel, as duas variáveis vão em Production e Preview. Se o cliente reclamar
de WebSocket, troque `libsql://` por `https://` na URL; o host e o token são os
mesmos.

## 8. Segurança e privacidade

- O bot do Telegram só responde ao seu `user.id` numérico. Qualquer outro
  remetente é ignorado.
- Segredos apenas em `.env.local` e nas env vars da Vercel. Nunca em memória,
  código ou mensagem.
- `delete_task` usa aprovação `always()`.
- Ações externas futuras (criar evento, enviar e-mail) usam aprovação e o menor
  escopo OAuth possível.
- A memória não guarda senhas, tokens, dados de pagamento ou códigos de uso
  único.
- Logs não devem despejar conteúdo sensível de mensagens.

## 9. Roadmap

### Etapa 0 — Fundação e deploy (2–3 h)

**Objetivo:** agente com identidade própria, uma tool real e deploy funcionando.

**Entregáveis:**
- `agent/instructions.md` reescrito para o seu assistente.
- `agent/tools/get_current_datetime.ts`.
- Deploy na Vercel com `OPENCODE_API_KEY`.

**Aceite:**
- A TUI responde em português com a persona definida.
- Perguntas de data/hora chamam a tool.
- `eve remote connect --url <produção> --print "Que dia é hoje?"` responde.
- Nenhum segredo no git.

**Aprende:** estrutura do eve, tool tipada, tool calling, env vars, deploy,
`eve remote connect`.

### Etapa 1 — Telegram (3–4 h)

**Objetivo:** conversar com o agente pelo celular, restrito a você.

**Entregáveis:**
- Bot criado no BotFather.
- Canal `agent/channels/telegram.ts`.
- Allowlist do seu `user.id`.
- Webhook registrado (Connect ou credenciais portáveis).

**Aceite:**
- Mensagem sua recebe resposta.
- Mensagem de outra conta é ignorada.
- A conversa mantém o contexto entre mensagens.

**Aprende:** channels, webhook, autenticação de canal, sessão.

### Etapa 2 — Memória (3–4 h)

**Objetivo:** preferências sobrevivem a novas sessões e redeploys.

**Entregáveis:**
- `agent/memory/file.ts`.
- Blob configurado na Vercel.
- Regras de memória nas instructions.

**Aceite:**
- "Prefiro reuniões de manhã" é lembrado no dia seguinte.
- "Guarde minha senha" é recusado.
- A memória não duplica entradas a cada conversa.

**Aprende:** memória vs. estado de sessão vs. banco, escopo por principal.

### Etapa 3 — Tarefas e lembretes (1–2 dias)

**Objetivo:** CRUD de tarefas no Turso, com datas no fuso correto.

**Entregáveis:**
- Banco libSQL no Turso Cloud, com URL e token em `.env.local`.
- `lib/db.ts`, `lib/time.ts`, `lib/tasks.ts`.
- Migração `0001_init.sql` e script `db:migrate`.
- Tools: `create_task`, `list_tasks`, `update_task`, `complete_task`,
  `delete_task`.

**Aceite:**
- "Pagar conta sexta às 10h" cria a tarefa com o `due_at` certo em UTC.
- `list_tasks` mostra pendentes e atrasadas.
- Concluir uma tarefa remove ela da lista de pendentes.
- Dados continuam após redeploy.
- `delete_task` pede aprovação.

**Aprende:** Zod, tools, SQL, schema, índices, migrações, UTC vs. local.

### Etapa 4 — Rotinas proativas (4–6 h)

**Objetivo:** o assistente toma a iniciativa nos horários combinados.

**Entregáveis:**
- `morning-digest` às 07:30 (`America/Sao_Paulo`).
- `evening-review` às 21:00.
- `due-reminders` a cada 15 min, consultando o banco antes de acordar o modelo.

**Aceite:**
- Resumo chega no horário.
- Lembrete chega com tolerância máxima de 15 min.
- Sem tarefas/lembretes, nenhuma mensagem vazia é enviada.
- Redisparo manual funciona via rota de dev.

**Aprende:** cron, `defineSchedule`, timezone, envio proativo, `no_reply`.

### Etapa 5 — Agenda (1–2 dias, opcional)

**Objetivo:** integrar a agenda que você mais sente falta.

**Entregáveis:**
- OAuth e connection de leitura.
- Criação de evento com aprovação (se for Google Calendar).

**Aceite:**
- "O que tenho amanhã?" retorna eventos reais.
- "Marca dentista sexta às 15h" pede aprovação antes de criar.
- Nenhum evento é criado sem confirmação.

**Aprende:** OAuth, connections, escopos, human-in-the-loop.

### Etapa 6 — Qualidade (1 dia)

**Objetivo:** consistência e segurança que sobrevivem a mudanças.

**Entregáveis:**
- Skills `planejar-dia` e `revisao-semanal`.
- 8 evals (tool choice, fuso, recusa de segredo, confirmação).
- Tratamento de erro amigável e revisão de logs.

**Aceite:**
- `npm run eval` passa.
- A skill certa é carregada quando o pedido combina.
- Erros de banco não viram resposta inventada.

**Aprende:** skills, evals, observabilidade, resiliência.

## 10. Riscos e mitigação

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Provider `opencode-go` falhar na Vercel | Bloqueia tudo | Validar na etapa 0 com tool boba e `remote connect`. |
| Webhook do Telegram não chegar | Sem canal | Deploy cedo; usar Connect ou conferir `setWebhook`. |
| Banco criado com `--tursodb` | `@libsql/client` não conecta | Criar outro banco sem `--tursodb`; conferir a URL `libsql://`. |
| Fuso horário errado | Lembretes errados | UTC no banco, `America/Sao_Paulo` na borda, testes. |
| Cron da Vercel Hobby | Lembrete atrasa até 15 min | Aceitar no v1; granularidade maior só se necessário. |
| Scope creep | Nada fica pronto | Backlog separado; v1 congelado até a etapa 4. |
| Custo/latência do modelo | Uso ruim | Resumos só com dados; `list_tasks` limitado; ajustar reasoning depois. |

## 11. Backlog pós-v1

- Google Calendar (leitura + criação com aprovação).
- Gmail (triagem somente leitura; rascunhos com aprovação).
- Transcrição de notas de voz.
- Revisão semanal guiada.
- Hábitos e streaks.
- Finanças e comprovantes.
- Interface web (Next.js + client SDK do eve).
- WhatsApp via Kapso.
- Notion/Todoist sync.
- Subagente de pesquisa.
- Observabilidade com traces.

## 12. Acordo de trabalho

- Uma etapa por vez, em formato de ticket.
- Você escreve o código; eu reviso o diff, explico o porquê e desbloqueio.
- Cada ticket termina com `npm run typecheck`, teste de aceite e commit.
- Em caso de erro, envie a mensagem completa e o comando executado.
- Nunca cole segredos no chat.
- Se um ticket passar do dobro da estimativa, paramos e reavaliamos o escopo.
