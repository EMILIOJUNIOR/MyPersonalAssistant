---
type: Guide
title: Passo a passo — LumIA
description: Tutorial de reconstrução do projeto, mantido como referência histórica.
tags: [guia, tutorial, historico]
status: deprecated
---

# Passo a passo — LumIA (assistente pessoal no Telegram)

> Documento de reconstrução do zero. Serve para outro agente de IA ou para uma
> pessoa que nunca viu o projeto.
>
> **Estado documentado:** novembro/2026 · eve `1.0.2` · Node `26.x` · TypeScript
> estrito · deploy na Vercel · banco Turso · bot `@<seu-bot>`.
>
> **Documento histórico.** A fonte de verdade atual é [`../index.md`](../index.md).
> Este tutorial permanece como referência de implementação e pode estar defasado
> em relação ao código.

---

## Sumário

1. [O que é o projeto](#1-o-que-é-o-projeto)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Estrutura de arquivos](#3-estrutura-de-arquivos)
4. [Criar o projeto eve](#4-criar-o-projeto-eve)
5. [Configurar o modelo](#5-configurar-o-modelo)
6. [Escrever a persona](#6-escrever-a-persona)
7. [Banco de dados (Turso)](#7-banco-de-dados-turso)
8. [Camada de domínio (`lib/`)](#8-camada-de-domínio-lib)
9. [Tools do agente](#9-tools-do-agente)
10. [Rotinas agendadas](#10-rotinas-agendadas)
11. [Canal do Telegram](#11-canal-do-telegram)
12. [Deploy na Vercel](#12-deploy-na-vercel)
13. [Áudio/voz (workaround obrigatório)](#13-áudiovoz-workaround-obrigatório)
14. [Checklist de aceite](#14-checklist-de-aceite)
15. [Troubleshooting](#15-troubleshooting)
16. [Manutenção](#16-manutenção)
17. [Segurança](#17-segurança)
18. [Referências](#18-referências)

---

## 1. O que é o projeto

A **LumIA** é uma assistente pessoal em português que vive no Telegram. Ela
funciona como um **segundo cérebro**: captura ideias, organiza projetos, controla
tarefas, agenda lembretes e ajuda a recuperar contexto.

### Escopo real (v1)

- Conversa em português no Telegram, restrita a **um** usuário.
- CRUD de tarefas com prazo, prioridade e projeto.
- CRUD de projetos.
- Entradas de conhecimento: `idea`, `note`, `decision`, `summary`, `reference`.
- Vínculos entre entradas.
- Lembretes enviados proativamente a cada 15 minutos.
- Agenda por período ("o que tenho amanhã", "minha semana").
- Áudio de voz transcrito para texto antes de chegar ao modelo.

### Fora de escopo

Multiusuário, e-mail, calendário externo, finanças, WhatsApp, interface web
própria, memória durável de preferências entre conversas (não há provider de
memória neste projeto — as instructions proíbem prometer isso).

### Arquitetura

```
Usuário no Telegram
      │  webhook (POST)
      ▼
/telegram/inbound
agent/channels/telegram-audio.ts
      │
      ├── é voice/audio? ──► getFile + Groq Whisper ──► reescreve update com text
      │
      ▼
/eve/v1/telegram
agent/channels/telegram.ts
      │  valida secret + allowlist + chat privado
      ▼
eve runtime (Vercel)
      ├── agent/agent.ts        → opencode-go / gpt-6-luna
      ├── agent/instructions.md → persona e regras
      ├── agent/tools/*         → 20 tools tipadas
      └── agent/schedules/*     → due-reminders a cada 15 min
      │
      ▼
Turso (libSQL) ── tasks, reminders, projects, entries, entry_links
```

### Decisões técnicas e por quê

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Framework | **eve** | Agente como diretório de arquivos; tools, canais e schedules nativos |
| Canal | **Telegram** | Sem frontend; webhook simples; botões de aprovação prontos |
| Banco | **Turso (libSQL)** | SQLite gerenciado, free tier, SQL familiar |
| Driver | `@libsql/client` | Suporta arquivo local e remoto; maduro |
| Modelo | `gpt-6-luna` via `opencode-go` | Provider OpenAI-compatible já contratado |
| Fuso | UTC no banco, `America/Sao_Paulo` na borda | Evita bug de horário em lembrete |
| Acesso | Allowlist por `user.id` | Bot privado; falha fechada |
| Áudio | Rota própria + Groq Whisper | O canal nativo do eve descarta `voice` |
| Deploy | Vercel | Webhook público + schedules + logs |

---

## 2. Pré-requisitos

### Ferramentas locais

| Ferramenta | Versão | Observação |
| --- | --- | --- |
| Node.js | 24+ (projeto fixa `26.x`) | `node -v` |
| npm | vem com o Node | `npm -v` |
| Git | qualquer recente | `git --version` |
| Turso CLI | opcional | só para criar o banco |
| Vercel CLI | via `npx` | não precisa instalar global |

### Contas necessárias

| Conta | Para quê | Onde |
| --- | --- | --- |
| **Telegram** | criar o bot no BotFather | dentro do app |
| **Vercel** | hospedar o agente e os schedules | vercel.com |
| **Turso** | banco libSQL | turso.tech |
| **Groq** | transcrição de áudio (grátis) | console.groq.com |
| **opencode** | chave do modelo `gpt-6-luna` | opencode.ai |

> A chave do Groq só é necessária se você quiser áudio. Texto, foto e documento
> funcionam sem ela.

### Pegar o seu ID numérico do Telegram

Fale com o [@userinfobot](https://t.me/userinfobot). Ele responde algo como
`Id: 123456789`. Esse número é o `TELEGRAM_ALLOWED_USER_ID` e também o `chat_id`
das mensagens proativas.

---

## 3. Estrutura de arquivos

```text
personal-assistant/
├── agent/
│   ├── agent.ts                    # modelo e reasoning
│   ├── instructions.md             # persona e regras de comportamento
│   ├── channels/
│   │   ├── eve.ts                  # canal web/TUI (OIDC da Vercel)
│   │   ├── telegram.ts             # canal nativo do Telegram
│   │   └── telegram-audio.ts       # rota de entrada + transcrição
│   ├── schedules/
│   │   └── due-reminders.ts        # cron */15 * * * *
│   └── tools/                      # 20 tools
│       ├── get_current_datetime.ts
│       ├── local_datetime_to_utc.ts
│       ├── create_task.ts
│       ├── list_tasks.ts
│       ├── update_task.ts
│       ├── complete_task.ts
│       ├── delete_task.ts
│       ├── set_reminder.ts
│       ├── list_reminders.ts
│       ├── cancel_reminder.ts
│       ├── create_project.ts
│       ├── update_project.ts
│       ├── list_projects.ts
│       ├── create_entry.ts
│       ├── update_entry.ts
│       ├── get_entry.ts
│       ├── search_entries.ts
│       ├── record_decision.ts
│       ├── link_entries.ts
│       └── get_agenda.ts
├── db/
│   └── migrations/
│       ├── 0001_init.sql
│       └── 0002_knowledge.sql
├── lib/                            # domínio puro, sem dependência de eve
│   ├── db.ts
│   ├── time.ts
│   ├── tasks.ts
│   ├── projects.ts
│   ├── entries.ts
│   ├── reminders.ts
│   ├── notifications.ts
│   └── telegram.ts
├── scripts/
│   └── migrate.ts
├── .env.local                      # NUNCA commitado
├── package.json
└── tsconfig.json
```

**Regra de ouro:** `lib/` não importa nada de `eve`. As tools importam `lib/`.
Isso mantém o domínio testável e desacoplado do framework.

---

## 4. Criar o projeto eve

```bash
npx eve@latest init personal-assistant
cd personal-assistant
```

O comando cria `agent/`, instala dependências, inicializa o Git e abre a TUI.
Se você já tem um `package.json` e quer adicionar o agente nele:

```bash
npx eve@latest init .
```

### Dependências usadas

```bash
npm install @ai-sdk/openai @libsql/client
npm install -D tsx
```

O `package.json` final fica assim (versões de novembro/2026):

```json
{
  "name": "PersonalAssistant",
  "type": "module",
  "imports": {
    "#*": "./agent/*",
    "#evals/*": "./evals/*"
  },
  "scripts": {
    "build": "eve build",
    "deploy": "eve deploy",
    "dev": "eve dev",
    "eval": "eve eval",
    "start": "eve start",
    "typecheck": "tsc",
    "db:migrate": "node --env-file=.env.local --import tsx scripts/migrate.ts"
  },
  "dependencies": {
    "@ai-sdk/openai": "^3.0.92",
    "@libsql/client": "^0.18.0",
    "@vercel/connect": "2.7.0",
    "ai": "^7.0.172",
    "eve": "^1.0.2",
    "zod": "4.6.7"
  },
  "devDependencies": {
    "@types/node": "26.x",
    "just-bash": "^3.6.1",
    "tsx": "^4.23.15",
    "typescript": "7.0.2"
  },
  "engines": {
    "node": "26.x"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["agent/**/*.ts", "evals/**/*.ts"]
}
```

### Rodar localmente

```bash
npm run dev
```

A TUI abre no terminal. `eve dev` recarrega os arquivos automaticamente.
O canal `eve.ts` libera o TUI e o `localhost` via `localDev()`.

---

## 5. Configurar o modelo

Arquivo `agent/agent.ts`:

```ts
import { createOpenAICompatible } from "@ai-sdk/openai";
import { defineAgent, defineDynamic } from "eve";

export default defineAgent({
  model: defineDynamic((ctx) => ({
    model: createOpenAICompatible({
      name: "opencode-go",
      baseURL: "https://opencode.ai/inference/go/v1",
      apiKey: process.env.OPENCODE_API_KEY,
      headers: {
        "x-opencode-session": ctx.session.id,
        "User-Agent": "eve-agent/1.0",
      },
      includeUsage: true,
    })("gpt-6-luna"),
    modelContextWindowTokens: 1_000_000,
  })),
  reasoning: "high",
});
```

Pontos importantes:

- `defineDynamic` permite usar dados da sessão (`ctx.session.id`) nos headers.
- `modelContextWindowTokens` precisa refletir o modelo real, senão o eve não
  compacta o histórico na hora certa.
- A chave vai em `OPENCODE_API_KEY` (`.env.local` e Vercel).
- **Não** troque o modelo para resolver áudio: o problema é no canal, não no
  modelo. Veja a [seção 13](#13-áudiovoz-workaround-obrigatório).

---

## 6. Escrever a persona

`agent/instructions.md` define identidade, responsabilidades e regras. Ele é
carregado em **toda** chamada do modelo, então seja objetivo.

Estrutura usada:

```markdown
# Segundo Cérebro

A LumIA também deve atuar como um segundo cérebro pessoal...

## Responsabilidades
- 🧠 Capturar ideias
- 📚 Organizar conhecimentos
- 🔎 Recuperar informações
- 🔗 Conectar ideias
- 💡 Desenvolver pensamentos
- 📋 Acompanhar projetos
- 📝 Criar resumos
- 🎯 Ajudar na tomada de decisões
- 🔔 Identificar pendências
- Gerenciar agendamentos, lembretes e compromissos

## Uso das ferramentas
1. Nunca diga que guardou/criou/alterou algo sem chamar a tool.
2. Antes de dizer que não lembra, use `search_entries` e `get_entry`.
3. Ideias/notas → `create_entry`; decisões → `record_decision`.
4. Pendências → `create_task`; lembretes → `set_reminder`.
5. Datas relativas → `get_current_datetime` + `local_datetime_to_utc`.
6. `due_at` (prazo) ≠ `remind_at` (quando avisar).
7. "O que tenho hoje/amanhã" → `get_agenda`.
8. Só cancele lembrete depois de confirmar qual.
9. Não mostre IDs longos sem necessidade.
10. Não prometa memória durável: não existe tool de memória neste projeto.

## Estilo das respostas
- Pelo menos 1 emoji relevante; no máximo 3 por resposta.
- Em listas, no máximo 1 emoji por item.
- Sem emojis em IDs, datas, comandos ou blocos de código.
- No Telegram: respostas curtas, parágrafos e listas; evitar tabelas largas.
```

### Regras que evitam alucinação

1. **Sem tool, sem afirmação.** Se a tool falhou, explique o erro.
2. **Leitura antes de memória.** "Não lembro" só depois de buscar.
3. **UTC explícito.** O modelo sempre converte antes de gravar.
4. **Confirmação antes de destruir.** `delete_task` usa aprovação.

---

## 7. Banco de dados (Turso)

### 7.1 Criar o banco

```bash
turso db create personal-assistant --location aws-sa-east-1
turso db show personal-assistant --url
turso db tokens create personal-assistant
```

A URL sai como `libsql://personal-assistant-<org>.aws-sa-east-1.turso.io`.

> ⚠️ Não crie o banco com a flag `--tursodb`. O `@libsql/client` espera a URL
> `libsql://`; bancos no modo antigo não conectam.

### 7.2 Variáveis

`.env.local`:

```env
TURSO_DATABASE_URL="libsql://personal-assistant-<org>.aws-sa-east-1.turso.io"
TURSO_AUTH_TOKEN="<token>"
```

### 7.3 Migrações

`db/migrations/0001_init.sql`:

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

`db/migrations/0002_knowledge.sql`:

```sql
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'paused', 'done', 'archived')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_status
  ON projects (status, updated_at);

CREATE TABLE IF NOT EXISTS entries (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL
             CHECK (kind IN ('idea', 'note', 'decision', 'summary', 'reference')),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  tags       TEXT NOT NULL DEFAULT '[]',
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('active', 'archived')),
  metadata   TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_kind_created
  ON entries (kind, created_at);

CREATE INDEX IF NOT EXISTS idx_entries_project
  ON entries (project_id, created_at);

CREATE INDEX IF NOT EXISTS idx_entries_status
  ON entries (status, updated_at);

CREATE TABLE IF NOT EXISTS entry_links (
  id            TEXT PRIMARY KEY,
  from_entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  to_entry_id   TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  relation      TEXT NOT NULL DEFAULT 'related',
  created_at    TEXT NOT NULL,
  UNIQUE (from_entry_id, to_entry_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_entry_links_from
  ON entry_links (from_entry_id);

CREATE INDEX IF NOT EXISTS idx_entry_links_to
  ON entry_links (to_entry_id);

ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN entry_id TEXT REFERENCES entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project
  ON tasks (project_id, status);
```

### 7.4 Runner de migração

`scripts/migrate.ts` — aplica cada `.sql` uma única vez, dentro de transação:

```ts
import { createClient } from "@libsql/client";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.TURSO_DATABASE_URL;

if (!url) {
  throw new Error("TURSO_DATABASE_URL não configurada. Adicione ao .env.local.");
}

const db = createClient({
  url,
  authToken: url.startsWith("file:") ? undefined : process.env.TURSO_AUTH_TOKEN,
});

await db.execute(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id         TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )
`);

const migrationsDir = path.resolve("db/migrations");
const files = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const file of files) {
  const alreadyApplied = await db.execute({
    sql: "SELECT 1 FROM _migrations WHERE id = ?",
    args: [file],
  });

  if (alreadyApplied.rows.length > 0) {
    console.log(`- ${file} (já aplicada)`);
    continue;
  }

  const sql = await readFile(path.join(migrationsDir, file), "utf8");
  const tx = await db.transaction("write");

  try {
    await tx.executeMultiple(sql);
    await tx.execute({
      sql: "INSERT INTO _migrations (id, applied_at) VALUES (?, ?)",
      args: [file, new Date().toISOString()],
    });
    await tx.commit();
    console.log(`+ ${file} aplicada`);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

const tables = await db.execute(
  "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
);
console.log("\nTabelas:", tables.rows.map((row) => row.name).join(", "));
```

Rodar:

```bash
npm run db:migrate
```

### 7.5 Cliente do banco

`lib/db.ts` — singleton preguiçoso:

```ts
import { createClient } from "@libsql/client";

let client: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error("TURSO_DATABASE_URL não configurada. Adicione ao .env.local.");
  }

  client = createClient({
    url,
    authToken: url.startsWith("file:") ? undefined : process.env.TURSO_AUTH_TOKEN,
  });

  return client;
}
```

### 7.6 Modelo de dados em uma frase

- `tasks`: o **quê** e o **prazo**.
- `reminders`: o **quando avisar** (uma tarefa pode ter vários).
- `projects`: agrupamento.
- `entries`: conhecimento capturado.
- `entry_links`: relações entre entradas.
- Datas: `TEXT` ISO-8601 **UTC** (`2026-11-20T13:00:00.000Z`).
- `delete` de tarefa = `status = 'cancelled'` (soft delete).

---

## 8. Camada de domínio (`lib/`)

| Arquivo | Responsabilidade |
| --- | --- |
| `db.ts` | cliente libSQL singleton |
| `time.ts` | fuso `America/Sao_Paulo`, conversão local→UTC, labels em pt-BR, ranges de agenda |
| `tasks.ts` | queries e tipos de tarefas |
| `projects.ts` | queries e tipos de projetos |
| `entries.ts` | queries, busca e vínculos de entradas |
| `reminders.ts` | criar/listar/cancelar, `claimDueReminders`, `markReminderSent`, agenda |
| `notifications.ts` | envia lembretes vencidos pelo Telegram |
| `telegram.ts` | `sendTelegramText(chatId, text)` |

### Conversão de fuso (o detalhe que evita bug)

`lib/time.ts` faz duas passadas de offset para acertar horário de verão:

```ts
const naive = Date.UTC(year, month - 1, day, hours, minutes);
const firstOffset = timeZoneOffsetMs(new Date(naive));
const candidate = new Date(naive - firstOffset);
const secondOffset = timeZoneOffsetMs(candidate);
return new Date(naive - secondOffset).toISOString();
```

Regra: **grave sempre UTC**, formate sempre no fuso local na saída.

### Lembretes sem duplicidade

`claimDueReminders(nowIso(), 20)` busca lembretes vencidos e **marca o claim**
antes de enviar. `markReminderSent(id)` grava `sent_at`. Se o envio falhar, o
lembrete não é marcado e será tentado de novo no próximo ciclo.

`sendDueReminders()`:

- pega o primeiro ID de `TELEGRAM_ALLOWED_USER_ID` como `chat_id`;
- envia `⏰ Lembrete: <título>\nHorário: <local>`;
- conta enviados/falhos e loga o resumo.

---

## 9. Tools do agente

Toda tool segue o mesmo padrão: `defineTool` + `zod` + chamada em `lib/`.

### Lista completa (20)

| Grupo | Tool | O que faz |
| --- | --- | --- |
| Tempo | `get_current_datetime` | data/hora atual no fuso do usuário |
| Tempo | `local_datetime_to_utc` | converte `YYYY-MM-DD` + `HH:mm` para ISO UTC |
| Tarefas | `create_task` | cria tarefa (título, notas, prioridade, prazo, projeto) |
| Tarefas | `list_tasks` | lista abertas, atrasadas, por projeto |
| Tarefas | `update_task` | altera título, notas, prioridade, prazo, projeto |
| Tarefas | `complete_task` | marca como concluída |
| Tarefas | `delete_task` | cancela (padrão) ou apaga — **pede aprovação** |
| Lembretes | `set_reminder` | agenda aviso para tarefa aberta, no futuro |
| Lembretes | `list_reminders` | lista lembretes com status |
| Lembretes | `cancel_reminder` | cancela lembrete ainda não enviado |
| Projetos | `create_project` | cria projeto |
| Projetos | `update_project` | edita nome/descrição/status |
| Projetos | `list_projects` | lista com contagem de tarefas/entradas |
| Entradas | `create_entry` | ideia, nota, referência, resumo |
| Entradas | `update_entry` | edita/arquiva entrada |
| Entradas | `get_entry` | abre entrada completa + vínculos |
| Entradas | `search_entries` | busca por texto, tipo, projeto, tag |
| Entradas | `record_decision` | decisão estruturada (contexto, opções, prós/contras, escolha) |
| Entradas | `link_entries` | cria vínculo entre duas entradas |
| Agenda | `get_agenda` | agenda por período local + lembretes pendentes |

### Exemplo de tool

`agent/tools/create_task.ts`:

```ts
import { defineTool } from "eve/tools";
import { z } from "zod";
import { createTask, type TaskPriority } from "../../lib/tasks";

const PRIORITIES = ["low", "normal", "high"] as const satisfies readonly TaskPriority[];

export default defineTool({
  description:
    "Cria uma tarefa, pendência ou compromisso. Se houver prazo, converta antes com local_datetime_to_utc e passe o ISO UTC em due_at. O prazo não agenda aviso sozinho: use set_reminder para o lembrete.",
  inputSchema: z.object({
    title: z.string().min(1).max(200).describe("O que precisa ser feito."),
    notes: z.string().optional().describe("Detalhes ou contexto."),
    priority: z.enum(PRIORITIES).optional().describe("Padrão: normal."),
    due_at: z
      .string()
      .optional()
      .describe("Prazo em ISO 8601 UTC, ex.: 2026-11-20T13:00:00.000Z."),
    project_id: z.string().uuid().optional().describe("Projeto da tarefa."),
  }),
  async execute(input) {
    const task = await createTask(input);
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      due_at: task.due_at,
      project_id: task.project_id,
      created_at: task.created_at,
    };
  },
});
```

### Aprovação humana (HITL)

`delete_task` usa `approval: { request: always(), prompt: ... }`. No Telegram,
isso vira botões inline. O usuário aprova antes de qualquer destruição.

```ts
import { always } from "eve/tools/approval";

approval: {
  request: always(),
  prompt: ({ input }) =>
    input.mode === "delete"
      ? `Apagar definitivamente a tarefa ${input.task_id}?`
      : `Cancelar a tarefa ${input.task_id}?`,
},
```

---

## 10. Rotinas agendadas

`agent/schedules/due-reminders.ts`:

```ts
import { defineSchedule } from "eve/schedules";
import { sendDueReminders } from "../../lib/notifications";

export default defineSchedule({
  cron: "*/15 * * * *",
  run({ waitUntil }) {
    waitUntil(sendDueReminders());
  },
});
```

- Cron a cada 15 minutos (limite aceitável no plano Hobby da Vercel).
- `waitUntil` mantém a execução viva depois da resposta do schedule.
- Não acorda o modelo: consulta o banco e envia texto direto pelo Bot API.
- Se não há lembrete vencido, nada é enviado.

---

## 11. Canal do Telegram

### 11.1 Criar o bot no BotFather

1. Abra [@BotFather](https://t.me/BotFather) e envie `/newbot`.
2. Nome de exibição: **LumIA** (pode ter acento e maiúsculas).
3. Username: precisa terminar em `bot`, 5–32 caracteres, só letras/números/`_`.
   Exemplo usado: `<seu-bot>`.
4. Guarde o token (`123456:ABC...`). **Nunca** cole em chat, issue ou commit.

Personalização opcional:

| Comando | Uso |
| --- | --- |
| `/setuserpic` | foto 512×512 (o Telegram corta em círculo) |
| `/setdescription` | texto antes de iniciar a conversa (até 512) |
| `/setabouttext` | resumo do perfil (até 120) |
| `/setjoingroups` | **Disable** — o canal só atende conversa privada |
| `/setcommands` | menu de comandos (opcional; não é necessário) |
| `/deletebot` | apaga o bot (irreversível) |

> Se o token vazar, use `/token` no BotFather para gerar outro e atualize as env
> vars. O token antigo deixa de valer.

### 11.2 Credenciais

O jeito guiado é:

```bash
npx eve add channel/telegram
```

Escolha **Use portable credentials**. O eve grava
`TELEGRAM_BOT_TOKEN` e `TELEGRAM_WEBHOOK_SECRET_TOKEN` no `.env.local` e cria
`agent/channels/telegram.ts`.

Variáveis completas:

```env
TELEGRAM_BOT_TOKEN="123456:ABC..."
TELEGRAM_BOT_USERNAME="<seu-bot>"
TELEGRAM_ALLOWED_USER_ID="123456789"
TELEGRAM_WEBHOOK_SECRET_TOKEN="<64 caracteres hex>"
```

- `TELEGRAM_BOT_USERNAME`: sem `@`. Usado para detectar menções em grupo.
- `TELEGRAM_ALLOWED_USER_ID`: aceita lista separada por vírgula. Falha fechada:
  vazio = ninguém é atendido.
- `TELEGRAM_WEBHOOK_SECRET_TOKEN`: gerado com `randomBytes(32).toString("hex")`.

### 11.3 Canal nativo

`agent/channels/telegram.ts`:

```ts
import { defaultTelegramAuth, telegramChannel } from "eve/channels/telegram";

const allowedUsers = new Set(
  (process.env.TELEGRAM_ALLOWED_USER_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

export default telegramChannel({
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
  onMessage(_ctx, message) {
    const senderId = message.from?.id;

    // Fail closed: sem allowlist configurada, ninguém é atendido.
    if (message.chat.type !== "private" || senderId === undefined) {
      return null;
    }

    if (!allowedUsers.has(String(senderId))) {
      return null;
    }

    return { auth: defaultTelegramAuth(message) };
  },
});
```

Observações:

- O `onMessage` **substitui** o filtro padrão do eve. Ele ignora grupos e
  qualquer usuário fora da allowlist.
- `botUsername` só importa para menções em grupo. Como o filtro só aceita
  conversa privada, não tem efeito prático aqui — mas mantenha correto.
- O eve monta `POST /eve/v1/telegram` automaticamente.

### 11.4 Registrar o webhook

Depois do deploy, com o bot token e o secret em mãos:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://SEU-PROJETO.vercel.app/telegram/inbound",
    "secret_token": "'"$TELEGRAM_WEBHOOK_SECRET_TOKEN"'",
    "allowed_updates": ["message", "callback_query"]
  }'
```

> Em produção **com áudio**, a URL é `/telegram/inbound` (rota da seção 13).
> Sem áudio, seria `/eve/v1/telegram`. Aponte para a rota certa.

Conferir:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

O que olhar:

- `url`: precisa bater exatamente com a rota escolhida.
- `pending_update_count`: deve ficar em `0`.
- `last_error_message`: `null` quando está saudável.

---

## 12. Deploy na Vercel

### 12.1 Vincular o projeto

```bash
npx eve link --non-interactive --project personal-assistant
```

Se a conta tiver mais de um time, acrescente `--team <id-ou-slug>`.

### 12.2 Variáveis de ambiente

| Variável | Obrigatória | Usada por |
| --- | --- | --- |
| `OPENCODE_API_KEY` | sim | `agent/agent.ts` |
| `TURSO_DATABASE_URL` | sim | `lib/db.ts`, `scripts/migrate.ts` |
| `TURSO_AUTH_TOKEN` | sim | idem |
| `TELEGRAM_BOT_TOKEN` | sim | canal, notificações, rota de áudio |
| `TELEGRAM_BOT_USERNAME` | sim | canal |
| `TELEGRAM_ALLOWED_USER_ID` | sim | allowlist e `chat_id` dos lembretes |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | sim | verificação do webhook |
| `GROQ_API_KEY` | só para áudio | `agent/channels/telegram-audio.ts` |

Adicionar (cria em Production + Preview; `--type secret` esconde o valor):

```bash
npx vercel env add NOME --environment production,preview --value "valor" --type secret --yes
```

Atualizar sem imprimir o valor:

```powershell
$line = (Get-Content .env.local | Where-Object { $_ -match '^NOME=' })
$v = ($line -split '=',2)[1].Trim().Trim('"')
npx vercel env update NOME --value $v --sensitive --yes
```

> `eve deploy` **puxa** as variáveis de desenvolvimento para o `.env.local`; ele
> **não** envia segredos locais para a Vercel. Quem envia é `vercel env`.

### 12.3 Publicar

```bash
npx eve deploy --non-interactive --yes
```

O comando instala dependências, roda o build e publica em produção.
Saída esperada: `Deployed: https://<projeto>.vercel.app`.

### 12.4 Verificar

```bash
npx vercel ls
npx vercel inspect <dominio-de-producao>
```

- O deploy mais novo deve estar `● Ready` em `Production`.
- O domínio de produção deve apontar para esse deploy.
- A rota de entrada deve responder `401` sem secret (prova que existe e está
  protegida). `404` significa que a rota não subiu.

> 🚫 **Nunca renomeie o projeto na Vercel** depois de registrar o webhook. O
> domínio `*.vercel.app` muda e o Telegram continua batendo no antigo. Neste
> repositório o projeto ainda se chama `LumIA-assistant` por herança do bot
> antigo — o nome é interno, não afeta a LumIA.

---

## 13. Áudio/voz (workaround obrigatório)

### 13.1 Por que o áudio não funciona nativo

O Telegram manda um campo diferente por tipo de mensagem:

```jsonc
// texto
{ "message": { "text": "oi" } }

// foto
{ "message": { "photo": [{ "file_id": "AgAC...", "width": 1280 }] } }

// voz gravada no microfone
{ "message": { "voice": { "file_id": "AwAC...", "duration": 7, "mime_type": "audio/ogg" } } }
```

O parser do canal nativo do eve só lê `photo` e `document`:

```ts
// simplificado de eve/dist/src/public/channels/telegram/inbound.js
function parseAttachments(message) {
  const files = [];
  const photo = parseLargestPhoto(message.photo); // ✅
  if (photo) files.push(photo);
  const doc = parseDocument(message.document);    // ✅
  if (doc) files.push(doc);
  return files;                                   // ❌ message.voice ignorado
}
```

Resultado: `text = ""` e `attachments = []`. O modelo recebe uma mensagem vazia.
**Trocar de modelo não resolve** — o áudio morre antes da camada do modelo.

Testes feitos neste projeto:

| Caminho | Resultado |
| --- | --- |
| `opencode-go` `/audio/transcriptions` | ❌ `404` (não tem STT) |
| Vercel AI Gateway `openai/whisper-1` | ⚠️ autentica via OIDC, mas exige cartão |
| **Groq `whisper-large-v3-turbo`** | ✅ grátis, sem cartão, bom em pt-BR |

### 13.2 Arquitetura da correção

```
Telegram
   │ POST /telegram/inbound        ← webhook aponta aqui
   ▼
agent/channels/telegram-audio.ts
   │ 1. valida X-Telegram-Bot-Api-Secret-Token
   │ 2. se voice/audio: getFile → download → Groq → texto
   │ 3. reescreve update.message.text e remove voice/audio
   ▼
POST /eve/v1/telegram             ← eve trata como texto normal
```

Tudo o mais (texto, foto, documento, botões, callback) passa direto.

### 13.3 Criar a chave do Groq

1. https://console.groq.com → criar conta (Google/GitHub).
2. **API Keys** → **Create API Key** → nome `LumIA`.
3. Copie a chave (`gsk_...`).
4. `.env.local`: `GROQ_API_KEY="gsk_..."`.
5. Vercel: adicione `GROQ_API_KEY` em Production + Preview.

Plano gratuito é suficiente para uso pessoal. O áudio é enviado ao Groq apenas
no momento da transcrição; nada é salvo no seu banco.

### 13.4 Código completo

`agent/channels/telegram-audio.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import { defineChannel, POST } from "eve/channels";

const EVE_TELEGRAM_PATH = "/eve/v1/telegram";
const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODEL = "whisper-large-v3-turbo";
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

interface TelegramChat {
  id: number | string;
  type?: string;
  title?: string;
  username?: string;
}

interface TelegramUser {
  id: number | string;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
}

interface TelegramAudio {
  file_id: string;
  file_size?: number;
  mime_type?: string;
  duration?: number;
}

interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  caption?: string;
  voice?: TelegramAudio;
  audio?: TelegramAudio;
}

interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
  [key: string]: unknown;
}

const allowedUsers = new Set(
  (process.env.TELEGRAM_ALLOWED_USER_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

function secretMatches(received: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN ?? "";
  if (!expected || !received || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

function isAllowedPrivateChat(message: TelegramMessage): boolean {
  if (message.chat?.type !== "private") return false;
  const senderId = message.from?.id;
  if (senderId === undefined) return false;
  return allowedUsers.has(String(senderId));
}

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN não configurado");
  return token;
}

async function callTelegramApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const payload = (await response.json()) as {
    ok: boolean;
    result?: T;
    description?: string;
  };
  if (!payload.ok) {
    throw new Error(`${method} falhou: ${payload.description ?? response.status}`);
  }
  return payload.result as T;
}

async function downloadAudio(fileId: string): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
  const file = await callTelegramApi<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!file.file_path) throw new Error("getFile não retornou file_path");

  const response = await fetch(
    `https://api.telegram.org/file/bot${botToken()}/${file.file_path}`,
    { signal: AbortSignal.timeout(TIMEOUT_MS) },
  );
  if (!response.ok) throw new Error(`download do áudio falhou (HTTP ${response.status})`);

  return {
    bytes: await response.arrayBuffer(),
    mimeType: response.headers.get("content-type") ?? "audio/ogg",
  };
}

/**
 * O Groq valida a extensão do arquivo enviado. O Telegram entrega voz como
 * `.oga` (OGG/Opus), que não está na lista aceita — embora `ogg` esteja.
 */
function audioUploadFormat(mimeType: string): { filename: string; contentType: string } {
  const mime = mimeType.toLowerCase();
  if (mime.includes("ogg") || mime.includes("opus")) return { filename: "audio.ogg", contentType: "audio/ogg" };
  if (mime.includes("mpeg") || mime.includes("mp3")) return { filename: "audio.mp3", contentType: "audio/mpeg" };
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return { filename: "audio.m4a", contentType: "audio/mp4" };
  if (mime.includes("wav")) return { filename: "audio.wav", contentType: "audio/wav" };
  if (mime.includes("webm")) return { filename: "audio.webm", contentType: "audio/webm" };
  if (mime.includes("flac")) return { filename: "audio.flac", contentType: "audio/flac" };
  return { filename: "audio.ogg", contentType: "audio/ogg" };
}

async function transcribe(bytes: ArrayBuffer, mimeType: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY não configurada");

  const upload = audioUploadFormat(mimeType);

  const form = new FormData();
  form.append("model", GROQ_MODEL);
  form.append("language", "pt");
  form.append("response_format", "json");
  form.append("temperature", "0");
  form.append("file", new Blob([bytes], { type: upload.contentType }), upload.filename);

  const response = await fetch(GROQ_TRANSCRIPTION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    text?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(`Groq HTTP ${response.status}: ${payload.error?.message ?? "erro"}`);
  }

  return (payload.text ?? "").trim();
}

async function notify(chatId: number | string, text: string): Promise<void> {
  try {
    await callTelegramApi("sendMessage", { chat_id: chatId, text });
  } catch {
    // Aviso é best-effort: não deve derrubar o webhook.
  }
}

async function forwardToEve(request: Request, update: TelegramUpdate): Promise<Response> {
  const target = new URL(EVE_TELEGRAM_PATH, request.url);
  const response = await fetch(target, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN ?? "",
    },
    body: JSON.stringify(update),
  });

  return new Response(response.body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}

async function handleAudio(
  request: Request,
  update: TelegramUpdate,
  message: TelegramMessage,
  audio: TelegramAudio,
): Promise<Response> {
  if (!isAllowedPrivateChat(message)) return forwardToEve(request, update);

  if ((audio.file_size ?? 0) > MAX_AUDIO_BYTES) {
    await notify(message.chat.id, "🎤 Esse áudio é grande demais para eu transcrever (limite ~20 MB).");
    return Response.json({ ok: true });
  }

  try {
    const { bytes, mimeType } = await downloadAudio(audio.file_id);
    const transcript = await transcribe(bytes, audio.mime_type ?? mimeType);

    if (!transcript) {
      await notify(message.chat.id, "🎤 Não consegui entender o áudio. Pode repetir ou digitar?");
      return Response.json({ ok: true });
    }

    const text = [message.caption?.trim(), transcript].filter(Boolean).join("\n\n");
    const rewritten: TelegramUpdate = {
      ...update,
      message: {
        ...message,
        text,
        caption: undefined,
        voice: undefined,
        audio: undefined,
      },
    };

    return forwardToEve(request, rewritten);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("[telegram-audio] falha ao transcrever:", reason);
    await notify(message.chat.id, "🎤 Tive um problema para transcrever o áudio. Pode repetir ou digitar?");
    return Response.json({ ok: true });
  }
}

export default defineChannel({
  routes: [
    POST("/telegram/inbound", async (request) => {
      if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"))) {
        return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }

      let update: TelegramUpdate;
      try {
        update = (await request.json()) as TelegramUpdate;
      } catch {
        return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
      }

      const message = update.message;
      const audio = message?.voice ?? message?.audio;

      if (!message || !audio) return forwardToEve(request, update);

      return handleAudio(request, update, message, audio);
    }),
  ],
});
```

### 13.5 Detalhes que quebram se você ignorar

| Detalhe | Consequência |
| --- | --- |
| Nome do arquivo `.oga` | Groq responde `400: file must be one of [flac mp3 mp4 mpeg mpga m4a ogg opus wav webm]` |
| Falta de verificação do secret | Qualquer um pode injetar updates |
| Forward sem o header do secret | eve responde `401` e o bot fica mudo |
| Esquecer de remover `voice`/`audio` | eve continua tratando como áudio vazio |
| Webhook em `/eve/v1/telegram` | Áudio volta a ser descartado |
| Deployment Protection ligada | O self-fetch interno recebe `401` |

### 13.6 Testar a rota

```bash
# sem secret → 401
curl -s -o NUL -w "%{http_code}\n" -X POST \
  "https://SEU-PROJETO.vercel.app/telegram/inbound" \
  -H "Content-Type: application/json" -d "{}"

# com secret + update inofensivo (user 1, fora da allowlist) → 200
```

Script Node para testar e registrar o webhook:

```js
// scripts/set-webhook.mjs
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
const url = "https://SEU-PROJETO.vercel.app/telegram/inbound";

const set = await (
  await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
    }),
  })
).json();

const info = await (
  await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
).json();

console.log({ set: set.description, url: info.result.url, error: info.result.last_error_message ?? null });
```

```bash
node --env-file=.env.local scripts/set-webhook.mjs
```

### 13.7 Limites conhecidos

- Download do Bot API: até 20 MB.
- Groq: até 25 MB por arquivo; timeout local de 30 s.
- A transcrição adiciona ~1–3 s ao tempo de resposta.
- O texto transcrito entra na sessão como mensagem normal, sem marcador.
- Se a transcrição falhar, o bot avisa com 🎤 e **não** cria turno vazio.

---

## 14. Checklist de aceite

Execute na ordem. Cada item é observável.

### Infraestrutura

- [ ] `npm run typecheck` passa sem erro.
- [ ] `npm run build` termina com `[BUILD] built output at .output`.
- [ ] `npm run db:migrate` mostra as migrações aplicadas e as tabelas.
- [ ] `npx vercel ls` mostra o último deploy `● Ready` em `Production`.
- [ ] `curl .../telegram/inbound` sem secret retorna `401`.

### Telegram

- [ ] Mensagem de texto no privado recebe resposta.
- [ ] Mensagem de outra conta é ignorada.
- [ ] Áudio de voz é transcrito e respondido.
- [ ] Foto é aceita (chega como anexo).
- [ ] Áudio sem fala responde "🎤 Não consegui entender…".

### Domínio

- [ ] "cria uma tarefa 'X' amanhã às 10h" grava `due_at` em UTC correto.
- [ ] "me lembra disso 1 hora antes" cria lembrete e ele chega no horário.
- [ ] "o que tenho amanhã?" usa `get_agenda` e mostra o dia local.
- [ ] "registra a ideia: …" cria `entry` e aparece em `search_entries`.
- [ ] "quais meus projetos?" lista com contagem.
- [ ] Concluir tarefa remove das pendentes.
- [ ] Apagar tarefa abre botões de aprovação.
- [ ] Nenhuma resposta afirma sucesso sem tool correspondente.

### Segurança

- [ ] `git status` não mostra `.env.local`.
- [ ] Nenhum token aparece em código, README ou histórico do Git.
- [ ] `getWebhookInfo` está com `last_error_message: null`.

---

## 15. Troubleshooting

| Sintoma | Causa provável | Correção |
| --- | --- | --- |
| Bot não responde nada | webhook aponta para URL errada | `setWebhook` na rota correta; conferir `getWebhookInfo.url` |
| `401` no webhook | `TELEGRAM_WEBHOOK_SECRET_TOKEN` diferente entre Telegram e deploy | regravar o webhook com o secret do deploy |
| `401` no self-fetch | Deployment Protection na Vercel | desativar para produção ou usar bypass |
| `404` em `/telegram/inbound` | deploy antigo ou rota não compilada | conferir manifest e refazer deploy |
| Bot responde "🎤 Tive um problema…" | falha no Groq/download | `npx vercel logs --since 30m` |
| `Groq HTTP 400: file must be one of…` | arquivo enviado como `.oga` | normalizar para `audio.ogg` (já implementado) |
| `AI Gateway requires a valid credit card` | tentativa de usar Gateway sem cartão | usar Groq ou cadastrar cartão |
| `404` em `/audio/transcriptions` no opencode-go | provider não tem STT | usar Groq |
| Áudio chega vazio no modelo | webhook ainda em `/eve/v1/telegram` | apontar para `/telegram/inbound` |
| Lembrete com hora errada | data local gravada como UTC | usar `local_datetime_to_utc` antes de gravar |
| Lembrete duplicado | `sent_at` não gravado | conferir `claimDueReminders` + `markReminderSent` |
| Env var nova não vale | deploy antigo | `npx vercel env update` + `npx eve deploy` |
| Bot para após renomear projeto na Vercel | domínio mudou | não renomear; se necessário, regravar webhook |
| `Cannot find module 'eve/...'` | dependências desatualizadas | `npm install` |
| Typecheck quebra em `Zod` | versões incompatíveis | manter `zod@4.6.7` e `ai@7` |

### Comando de logs

```bash
npx vercel logs --since 30m --non-interactive
```

Filtre por `[telegram-audio]` para ver falhas de transcrição.

---

## 16. Manutenção

### Adicionar uma migração

1. Crie `db/migrations/0003_descricao.sql`.
2. Use SQL idempotente (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN`).
3. Rode `npm run db:migrate`.
4. `npm run typecheck` e teste local.
5. Commit + `npx eve deploy`.

### Atualizar um segredo

```powershell
$line = (Get-Content .env.local | Where-Object { $_ -match '^NOME=' })
$v = ($line -split '=',2)[1].Trim().Trim('"')
npx vercel env update NOME --value $v --sensitive --yes
npx eve deploy --non-interactive --yes
```

Variáveis de ambiente só valem em **deploy novo**.

### Rotacionar o token do bot

1. BotFather → `/token` → escolher o bot.
2. Copiar o token novo.
3. Atualizar `.env.local` e a Vercel (`TELEGRAM_BOT_TOKEN`).
4. `npx eve deploy`.
5. `setWebhook` de novo (o token mudou; a URL não).

### Rotacionar a chave do Groq

1. console.groq.com → revogar a chave antiga.
2. Criar nova.
3. Atualizar `.env.local` + Vercel.
4. `npx eve deploy`.

### Ciclo de desenvolvimento

```bash
npm run dev          # TUI local
npm run typecheck
npm run build
npx eve deploy --non-interactive --yes
```

### Convenção de commits usada

Conventional Commits com emoji antes do tipo. A regra completa, os tipos e
os exemplos estão em [Commits](/operations/commits.md).

Exemplos reais anteriores a esta regra: `feat: canal Telegram e lembretes automaticos`,
`docs: renomeia persona de LumIA para LumIA`.

---

## 17. Segurança

1. **Nenhum segredo no repositório.** `.gitignore` cobre `.env*`.
2. **Allowlist obrigatória.** Sem `TELEGRAM_ALLOWED_USER_ID`, o canal não
   atende ninguém (falha fechada).
3. **Só conversa privada.** `onMessage` retorna `null` para grupos.
4. **Webhook assinado.** A rota de áudio compara o header do Telegram com o
   secret usando `timingSafeEqual`.
5. **Ações destrutivas com aprovação.** `delete_task` usa `always()`.
6. **Nada de segredo na conversa.** Tokens não vão para instructions, banco ou
   mensagens.
7. **Áudio sai do servidor.** A transcrição envia o arquivo ao Groq; o áudio não
   é persistido no Turso.
8. **Vazou? Rotacione.** Token do bot (`/token`), chave do Groq (console),
   `TELEGRAM_WEBHOOK_SECRET_TOKEN` (gerar novo + regravar webhook).

### Produção vs. desenvolvimento

| Ambiente | Banco | Bot | Webhook |
| --- | --- | --- | --- |
| Local (`eve dev`) | Turso (mesmo) | mesmo token | não recebe (webhook aponta para produção) |
| Preview | Turso (mesmo) | mesmo token | não recebe |
| Produção | Turso | mesmo token | `/telegram/inbound` |

> Para testar sem sujar produção, crie um **segundo bot** e um segundo conjunto
> de env vars no ambiente Preview. O eve suporta isso; o projeto atual usa um
> bot só para simplificar.

---

## 18. Referências

### Documentação local do eve (instalada)

```text
node_modules/eve/docs/
├── README.md                          # mapa de tarefas
├── getting-started.mdx                # criar projeto
├── channels/telegram/index.mdx        # setup do canal
├── channels/telegram/reference.mdx    # opções, anexos, webhook
├── channels/custom.mdx                # rotas próprias (usado no áudio)
├── patterns/voice-notes.md            # padrão de transcrição
├── schedules.mdx                      # cron
├── tools/index.mdx                    # tools
└── guides/deployment/vercel.mdx       # deploy
```

### Links

- eve: https://eve.dev/docs
- eve no GitHub: https://github.com/vercel/eve
- BotFather: https://t.me/BotFather
- Turso: https://turso.tech
- Groq Console: https://console.groq.com
- Vercel: https://vercel.com

---

## Apêndice A — Ordem de implementação recomendada

Para quem vai refazer, esta ordem evita retrabalho:

1. `eve init` + `agent.ts` + `instructions.md` → TUI funcionando.
2. Turso + migrações + `lib/` → dados persistindo.
3. Tools de tempo/tarefas → CRUD básico.
4. Canal Telegram + allowlist → conversa no celular.
5. Deploy + webhook → produção.
6. Projetos/entradas/vínculos → segundo cérebro.
7. Schedules de lembrete → proatividade.
8. Rota de áudio + Groq → voz.
9. BotFather (foto, descrição) → acabamento.
10. Checklist de aceite → validação final.

## Apêndice B — Variáveis de ambiente, resumo

```env
# modelo
OPENCODE_API_KEY="..."

# banco
TURSO_DATABASE_URL="libsql://..."
TURSO_AUTH_TOKEN="..."

# telegram
TELEGRAM_BOT_TOKEN="123456:..."
TELEGRAM_BOT_USERNAME="<seu-bot>"
TELEGRAM_ALLOWED_USER_ID="123456789"
TELEGRAM_WEBHOOK_SECRET_TOKEN="<64 hex>"

# áudio (opcional)
GROQ_API_KEY="gsk_..."
```

## Apêndice C — O que **não** fazer

- ❌ Trocar o modelo para "resolver" áudio.
- ❌ Apontar o webhook para `/eve/v1/telegram` e esperar voz funcionar.
- ❌ Renomear o projeto na Vercel depois do webhook.
- ❌ Commitar `.env.local`.
- ❌ Usar `deletebot`/`delete_task` sem confirmação.
- ❌ Criar tabela/coluna direto no Turso sem migração.
- ❌ Colar token em chat, issue, print ou vídeo.
- ❌ Confiar em `sent_at` sem `claimDueReminders` (lembrete duplicado).
- ❌ Gravar data local como se fosse UTC.
