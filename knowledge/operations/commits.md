---
type: Standard
title: Mensagens de commit
description: Conventional Commits com emoji antes do tipo; formato, tipos e exemplos.
tags: [operacao, git, commits, conventional-commits]
status: stable
stale_after: 2027-05-19T00:00:00Z
generated: { by: opencode/gpt-6-luna, at: 2026-11-19T10:30:43Z }
---

# Formato

Seguimos a convenção global da máquina, baseada em
[Conventional Commits 1.0.0](https://www.conventionalcommits.org/pt-br/v1.0.0/),
com um emoji antes do tipo.

```
<emoji> <tipo>[escopo opcional]: <descrição>

[corpo opcional]

[rodapé(s) opcional(is)]
```

O emoji vem antes do tipo, como prefixo visual. O detalhamento abaixo é
específico deste projeto.

# Tipos e emoji

| Tipo | Emoji | Quando usar |
| --- | --- | --- |
| `feat` | ✨ | novo recurso |
| `fix` | 🐛 | correção de problema |
| `docs` | 📝 | documentação |
| `refactor` | ♻️ | reestruturação sem mudar comportamento |
| `perf` | ⚡ | desempenho |
| `test` | ✅ | testes |
| `chore` | 🔧 | manutenção, configuração e dependências |
| `style` | 💄 | formatação sem mudar lógica |
| `revert` | ⏪ | reversão de commit anterior |
| `build` | 📦 | sistema de build e empacotamento |
| `ci` | 👷 | pipeline de CI/CD |

# Regras

- O emoji é obrigatório e corresponde ao tipo.
- Descrição em português, minúscula, no imperativo e sem ponto final.
- Assunto com até 72 caracteres.
- Escopo opcional é um substantivo da área: `telegram`, `tasks`, `db`, `deploy`.
- Corpo separado por linha em branco; bullets começam com `-`.
- Um commit por mudança lógica; se o assunto precisar de "e", avalie dividir.
- `BREAKING CHANGE` em maiúsculas no rodapé, ou `!` imediatamente antes dos
  dois-pontos. O emoji do tipo continua valendo.
- Rodapés usam `-` no token e `: ` ou ` #` como separador, por exemplo
  `Refs #123`.

# Exemplos

```
✨ feat(telegram): adiciona lembretes automáticos
🐛 fix(reminders): evita reenvio após marcar sent_at
📝 docs: documenta a convenção de commits
🔧 chore: atualiza dependências do eve
♻️ refactor(tasks): extrai consulta de tarefas para lib/
```

Quebra de compatibilidade:

```
✨ feat(api)!: remove o canal legado

BREAKING CHANGE: o canal eve padrão deixa de aceitar mensagens sem allowlist.
```

# Verificação

```sh
git log --oneline -10
```

# Relações

- [Deploy](/operations/deploy.md)
- [Migrações](/operations/migrations.md)
- [Troubleshooting](/operations/troubleshooting.md)
