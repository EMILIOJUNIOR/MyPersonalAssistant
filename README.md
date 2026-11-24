# LumIA

Assistente pessoal em português, construída com [eve](https://eve.dev), para organizar tarefas, lembretes, projetos e conhecimento pessoal.

## O que a LumIA faz

- Cria, lista, atualiza, conclui e cancela tarefas.
- Agenda lembretes e envia avisos automaticamente pelo Telegram.
- Mantém ideias, notas, referências, resumos e decisões no “segundo cérebro”.
- Relaciona entradas de conhecimento e organiza tudo por projetos.
- Consulta a agenda por dia ou período.
- Lê projetos de código do workspace local sem expor segredos.
- Aceita mensagens de voz no Telegram e usa Groq Whisper para transcrição.

O escopo atual é de uma pessoa, em português, usando o Telegram. Não há frontend web, multiusuário ou integração com Google Calendar.

## Arquitetura

```text
Telegram
  ├─ texto/foto/documento ───────────────┐
  └─ voz/áudio → Groq Whisper ────────────┤
                                         ▼
                               Canal nativo do eve
                                         ▼
                                      LumIA
                                         │
                    tools tipadas → lib/ domínio
                                         │
                                         ▼
                                Turso / libSQL

Schedule */15 * * * * → busca lembretes vencidos → Telegram
```

### Estrutura

| Diretório | Responsabilidade |
|---|---|
| `agent/agent.ts` | Modelo, provider e runtime do agente |
| `agent/instructions.md` | Identidade LumIA e regras de comportamento |
| `agent/channels/` | Eve, Telegram e entrada de áudio |
| `agent/tools/` | Ferramentas tipadas com Zod |
| `agent/schedules/` | Execuções recorrentes |
| `lib/` | Domínio e acesso ao banco |
| `db/migrations/` | Schema versionado do Turso |
| `knowledge/` | Documentação funcional e operacional |
| `scripts/migrate.ts` | Executor de migrações |
| `evals/` | Avaliações comportamentais do agente |

## Ferramentas

### Rotina

`get_current_datetime`, `local_datetime_to_utc`, `create_task`, `list_tasks`, `update_task`, `complete_task`, `delete_task`, `set_reminder`, `list_reminders`, `cancel_reminder` e `get_agenda`.

### Segundo cérebro

`create_entry`, `get_entry`, `update_entry`, `search_entries`, `link_entries` e `record_decision`.

### Projetos

`create_project`, `list_projects` e `update_project` trabalham com projetos pessoais armazenados no banco.

`list_workspace_projects` e `read_project_file` trabalham com projetos de código reais no filesystem.

### Persistência

As ferramentas de agenda gravam exclusivamente no Turso. O arquivo `data/compromissos.json` não é usado em runtime.

## Configuração

Requisitos:

- Node.js 26.
- Um banco Turso ou libSQL local.
- Bot do Telegram.
- Chave do OpenCode Go.
- Groq opcional para áudio.

Crie `.env.local` na raiz. Nunca versione esse arquivo.

| Variável | Obrigatória | Uso |
|---|---:|---|
| `OPENCODE_API_KEY` | Sim | Acesso ao modelo via OpenCode Go |
| `OPENCODE_GO_API_KEY` | Alternativa | Nome compatível com o repositório de referência |
| `TURSO_DATABASE_URL` | Sim | URL `libsql://...` ou `file:...` |
| `TURSO_AUTH_TOKEN` | Sim, remoto | Token do Turso |
| `TELEGRAM_BOT_TOKEN` | Sim, Telegram | Token do Bot API |
| `TELEGRAM_BOT_USERNAME` | Sim, Telegram | Username do bot |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | Sim, Telegram | Segredo do webhook |
| `GROQ_API_KEY` | Só áudio | Transcrição de voz |
| `MYPROJECT_ROOT` | Opcional | Pasta que contém projetos de código |

## Desenvolvimento

```bash
npm install
npm run db:migrate
npm run dev
```

Para validar o código:

```bash
npm run typecheck
npm run eval
npm run build
```

Os evals usam stubs locais quando necessário e não devem alterar o banco de produção.

## Banco e migrações

As migrações são aplicadas em ordem e registradas na tabela `_migrations`:

```bash
npm run db:migrate
```

Para criar o schema diretamente em um banco Turso vazio:

```bash
turso db shell <nome-do-banco> < db/turso-schema.sql
```

O arquivo `db/turso-schema.sql` é idempotente, contém o schema final completo e registra as migrações em `_migrations`.

Para importar compromissos existentes do arquivo legado `data/compromissos.json`:

```bash
npm run agenda:import
```

O banco contém:

- `tasks`: tarefas, prazos, prioridade e status.
- `reminders`: avisos associados a tarefas.
- `projects`: projetos pessoais.
- `entries`: conhecimento, ideias e decisões.
- `entry_links`: relações entre entradas.
- `appointments`: compromissos com início, fim e status.
- `appointment_reminders`: avisos automáticos de 24 horas e 15 minutos antes.

Instantes são armazenados em UTC. A conversão para `America/Sao_Paulo` ocorre apenas na borda da aplicação.

Nas consultas de agenda por semana ou mês, a LumIA oculta compromissos e tarefas já encerrados por padrão. Para consultar o histórico, peça explicitamente todos os itens ou os eventos passados.

### Horários padrão de compromissos

Quando o usuário não informar um horário:

- Manhã: `08:00–12:00`.
- Tarde: `13:30–18:00`.
- Dia todo ou dia útil sem horário: dois compromissos, `08:00–12:00` e `13:30–18:00`, preservando o intervalo de almoço.
- Almoço sem horário: `12:00–13:30`.

Horários informados explicitamente pelo usuário sempre têm prioridade.

Nomes de dias da semana são resolvidos dentro da janela domingo–domingo da semana indicada. A LumIA consulta `get_current_datetime` antes de calcular a data; “próxima semana” desloca a janela em sete dias.

## Telegram

O endpoint do webhook é:

```text
/telegram/inbound
```

O canal aceita somente conversas privadas. Cada `message.from.id` identifica o `tenantId` e todos os dados do usuário são filtrados por esse valor no Turso. O webhook valida `TELEGRAM_WEBHOOK_SECRET_TOKEN`; grupos, supergrupos e canais falham de forma fechada.

Para configurar em produção:

```bash
npx eve link --project <projeto> --non-interactive
npx eve deploy --non-interactive --yes
```

Depois, registre no Telegram:

```text
https://<projeto>.vercel.app/telegram/inbound
```

enviando o mesmo `secret_token` configurado no ambiente.

### Descobrir o ID autorizado

O `message.from.id` identifica a conta Telegram. Se os bots auxiliares não responderem, capture-o temporariamente pelo Bot API:

```powershell
node --env-file=.env.local --input-type=module -e "const r=await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/deleteWebhook',{method:'POST'}); console.log(await r.json())"
```

Envie `/start` ao bot e consulte:

```powershell
node --env-file=.env.local --input-type=module -e "const r=await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/getUpdates'); const b=await r.json(); console.log(JSON.stringify(b.result?.map(x=>({user_id:x.message?.from?.id,username:x.message?.from?.username})),null,2))"
```

Depois restaure o webhook. O passo completo está em `knowledge/integrations/telegram.md`.

## Lembretes automáticos

`agent/schedules/due-reminders.ts` executa a cada 15 minutos. Ele:

1. Busca lembretes vencidos e ainda não enviados.
2. Envia a mensagem ao primeiro usuário autorizado.
3. Marca o lembrete como enviado.
4. Continua processando os demais mesmo se um envio falhar.

## Documentação complementar

Comece por `knowledge/index.md`. Os principais documentos são:

- `knowledge/product/vision.md`
- `knowledge/architecture/overview.md`
- `knowledge/domain/tasks.md`
- `knowledge/domain/reminders.md`
- `knowledge/domain/entries.md`
- `knowledge/domain/projects.md`
- `knowledge/integrations/telegram.md`
- `knowledge/operations/migrations.md`
- `knowledge/operations/deploy.md`

## Segurança

- Segredos ficam apenas em `.env.local` e nas variáveis da Vercel.
- O webhook do Telegram exige segredo.
- O Telegram aceita somente chats privados e isola os dados por `message.from.id`.
- SQL usa parâmetros; entradas não são interpoladas.
- Exclusão de tarefas exige aprovação.
- Arquivos sensíveis e diretórios internos são bloqueados pelas ferramentas de workspace.
- Áudios são enviados ao Groq somente para transcrição e não são persistidos.

## Estado da migração

O projeto local foi adequado à arquitetura do repositório `Concyline/PersonalAssistant`, mantendo:

- O nome e a persona **LumIA**.
- Os evals locais.
- A leitura de projetos reais no workspace.
- O script de importação inicial da agenda JSON, sem usar JSON em runtime.

Os compromissos existentes foram importados para a tabela `appointments`; o JSON permanece apenas como backup local.
