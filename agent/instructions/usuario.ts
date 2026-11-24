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
        "O nome de tratamento deste tenant ainda não está cadastrado. Pergunte exatamente: “Como devo chamá-lo?” Antes de executar outras ações, salvo se o usuário já estiver respondendo essa pergunta.",
    });
  }

  return defineInstructions({
    role: "user",
    content: `O usuário prefere ser chamado de “${name}”. Use esse nome naturalmente, sem inventar outro.`,
  });
});
