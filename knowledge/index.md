---
okf_version: "0.2"
---

# Como usar

Este bundle guarda o conhecimento durável da LumIA. Leia este índice primeiro e abra apenas os conceitos necessários. Conceitos sem `verified` são não verificados; revise antes de tratar como verdade absoluta.

# Produto

* [Visão e escopo](product/vision.md) - o que é a LumIA, para quem, critérios de sucesso e o que está fora do v1.

# Arquitetura

* [Visão geral](architecture/overview.md) - fluxo Telegram → eve → Turso, componentes e limites.

# Domínio

* [Tarefas](domain/tasks.md) - o quê e quando; status, prioridade e ciclo de vida.
* [Lembretes](domain/reminders.md) - quando avisar; cron, idempotência e agenda.
* [Entradas](domain/entries.md) - segundo cérebro; tipos, tags, busca e vínculos.
* [Projetos](domain/projects.md) - agrupamento de tarefas e entradas.
* [Tempo](domain/time.md) - UTC no banco, America/Sao_Paulo na borda.

# Decisões

* [0001 — Telegram](decisions/0001-telegram.md) - canal único do v1.
* [0002 — Turso](decisions/0002-turso.md) - libSQL gerenciado.
* [0003 — Modelo](decisions/0003-modelo-opencode-go.md) - opencode-go/gpt-6-luna.
* [0004 — Sem frontend](decisions/0004-sem-frontend.md) - o Telegram é a interface.
* [0005 — Memória](decisions/0005-memoria-preferencias.md) - decisão registrada, ainda não implementada.

# Integrações

* [Telegram](integrations/telegram.md) - canal multi-tenant, webhook e áudio/Groq.

# Operações

* [Deploy](operations/deploy.md) - Vercel, env vars e verificação.
* [Migrações](operations/migrations.md) - schema, runner e Turso.
* [Commits](operations/commits.md) - Conventional Commits com emoji antes do tipo.
* [Troubleshooting](operations/troubleshooting.md) - sintomas, causas e correções.

# Referências históricas

* [Plano de Projeto](references/plan.md) - plano original; pode conter itens aspiracionais.
* [Passo a passo](references/passo-a-passo.md) - tutorial de implementação; pode estar defasado.
