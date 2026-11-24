---
type: Product Vision
title: Visão e escopo da LumIA
description: Assistente pessoal em português no Telegram, com rotina e segundo cérebro.
tags: [produto, visao, escopo]
status: stable
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T12:19:15Z }
sources:
  - id: plan
    resource: ../references/plan.md
    title: Plano de Projeto — Assistente Pessoal
  - id: tutorial
    resource: ../references/passo-a-passo.md
    title: Passo a passo — LumIA
---

# O que é

A LumIA é um assistente pessoal que vive no Telegram e ajuda a capturar, organizar, lembrar e conectar informações da vida real. Ela combina duas funções:

1. **Rotina:** tarefas, prazos, lembretes e agenda.
2. **Segundo cérebro:** ideias, notas, decisões, resumos, referências, projetos e vínculos.

O objetivo não é uma demo; é uma ferramenta de uso diário.

# Para quem

Uma única pessoa, em português, usando o Telegram no celular. O escopo é pessoal; não há multiusuário nem compartilhamento.

# Critérios de sucesso do v1

- Uso diário por duas semanas.
- Capturar uma tarefa leva menos de 10 segundos pelo Telegram.
- Nenhum lembrete combinado é perdido.
- Tarefas e conhecimento sobrevivem a redeploys.
- Nenhum segredo no repositório, na memória ou no histórico da conversa.

# Dentro do v1

| Capacidade | Estado |
| --- | --- |
| Conversa em português no Telegram | Implementado |
| Tarefas com prazo, prioridade e status | Implementado |
| Lembretes e agenda | Implementado |
| Projetos, entradas e vínculos | Implementado |
| Áudio transcrito via Groq | Implementado |
| Deploy na Vercel e banco Turso | Implementado |
| Preferências duráveis entre conversas | Implementado |
| Resumo matinal e revisão noturna | **Não implementado** |
| Google Calendar / Gmail | Fora do v1 |
| Frontend web | Fora do v1 |
| Multiusuário, WhatsApp, finanças | Fora do v1 |

# Realidade vs. plano

O [Plano de Projeto](/references/plan.md) é aspiracional em alguns pontos. Hoje:

- Existe apenas o schedule `due-reminders`; não existem `morning-digest` nem `evening-review`.
- Não existe `agent/memory/`; as instructions avisam que preferências duráveis ainda não têm tool. Veja [0005 — Memória](/decisions/0005-memoria-preferencias.md).
- O áudio funciona por uma rota própria com Groq, não pelo canal nativo. Veja [Telegram](/integrations/telegram.md).

# Princípios

- O modelo não inventa dados: se a tool não retornou, diga que não sabe.
- Leitura é livre; escrita destrutiva pede confirmação.
- O banco guarda UTC; a conversa mostra `America/Sao_Paulo`.
- O conhecimento deve ser fácil de recuperar, conectar e revisar.

# Relações

- [Arquitetura](/architecture/overview.md)
- [Entradas](/domain/entries.md)
- [Tarefas](/domain/tasks.md)
