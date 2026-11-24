import { defineDynamic, defineInstructions } from "eve/instructions";

import { getUserName } from "../../lib/preferences";

export default defineDynamic(async (ctx) => {
  const tenantId = ctx.session.auth.current?.attributes.user_id;
  if (typeof tenantId !== "string") return null;

  const name = await getUserName(tenantId);
  if (!name) {
    return defineInstructions({
      role: "user",
      content:
        "Este é o primeiro contato deste tenant. Cumprimente com uma mensagem acolhedora em português, use um emoji de saudação (por exemplo, “Olá! 👋”) e pergunte: “Como você gostaria de ser chamado(a)? 🙂” Não execute outras ações antes de receber o nome, salvo se o usuário já estiver respondendo essa pergunta.",
    });
  }

  return defineInstructions({
    role: "user",
    content: `O usuário prefere ser chamado de “${name}”. Use esse nome naturalmente, sem inventar outro. Em respostas de boas-vindas ou apresentação, seja acolhedora e use emojis coerentes, como ✅, 💡, 📋, 📅 e 🔎, sem exagerar.`,
  });
});
