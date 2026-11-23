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

### Compatibilidade local

As ferramentas `add_appointment`, `list_appointments`, `update_appointment`, `cancel_appointment`, `remember` e `forget` foram mantidas temporariamente para compatibilidade com dados e conversas antigas. Novas ações devem usar o banco Turso.

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
| `TELEGRAM_ALLOWED_USER_ID` | Sim, Telegram | IDs autorizados, separados por vírgula |
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

O banco contém:

- `tasks`: tarefas, prazos, prioridade e status.
- `reminders`: avisos associados a tarefas.
- `projects`: projetos pessoais.
- `entries`: conhecimento, ideias e decisões.
- `entry_links`: relações entre entradas.

Instantes são armazenados em UTC. A conversão para `America/Sao_Paulo` ocorre apenas na borda da aplicação.

## Telegram

O endpoint do webhook é:

```text
/telegram/inbound
```

O canal aceita somente conversas privadas e usuários presentes em `TELEGRAM_ALLOWED_USER_ID`. O webhook valida `TELEGRAM_WEBHOOK_SECRET_TOKEN`. Grupos e usuários não autorizados falham de forma fechada.

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
- O Telegram usa allowlist e somente chats privados.
- SQL usa parâmetros; entradas não são interpoladas.
- Exclusão de tarefas exige aprovação.
- Arquivos sensíveis e diretórios internos são bloqueados pelas ferramentas de workspace.
- Áudios são enviados ao Groq somente para transcrição e não são persistidos.

## Estado da migração

O projeto local foi adequado à arquitetura do repositório `Concyline/PersonalAssistant`, mantendo:

- O nome e a persona **LumIA**.
- Os evals locais.
- A leitura de projetos reais no workspace.
- A compatibilidade temporária com agenda JSON e memória Markdown.

Para uma migração definitiva, os dados existentes em `data/compromissos.json` devem ser convertidos manualmente em tarefas e lembretes no Turso antes de remover as ferramentas legadas.
