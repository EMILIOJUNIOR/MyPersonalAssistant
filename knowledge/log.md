# Histórico do bundle

## 2026-11-19

* **Creation**: Criado o bundle OKF v0.2 em `knowledge/`.
* **Creation**: Adicionados os conceitos de produto, arquitetura, domínio, decisões, integrações e operações.
* **Creation**: `AGENTS.md` raiz virou roteador; criados guias locais em `agent/`, `lib/` e `db/`.
* **Update**: `PLAN.md` e `passo_a_passo.md` receberam aviso de documento histórico.
* **Update**: Movidos `PLAN.md` e `passo_a_passo.md` para `knowledge/references/`, com frontmatter OKF e links atualizados.
* **Creation**: Adicionado `knowledge/operations/commits.md` com Conventional Commits 1.0.0 e emoji por tipo.
* **Update**: `knowledge/index.md` e `knowledge/references/passo-a-passo.md` passaram a apontar para a regra de commits.
* **Update**: Convenção de commits alinhada à máquina (emoji antes do tipo); README, índice e referência histórica ajustados.

## 2026-11-24

* **Update**: Agenda e preferências passaram a usar Turso como fonte oficial; compromissos legados foram importados para `appointments`.
* **Update**: Adicionado o procedimento operacional para descobrir `TELEGRAM_ALLOWED_USER_ID` com `deleteWebhook`, `getUpdates` e restauração do webhook.
* **Update**: Documentadas as causas de bot sem resposta: token inválido, allowlist incorreta, webhook ausente e Deployment Protection bloqueando o Telegram.
