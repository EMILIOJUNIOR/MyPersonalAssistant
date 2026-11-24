import { defineTool } from "eve/tools";
import { z } from "zod";

import { setUserName } from "../../lib/preferences";
import { tenantId } from "../lib/tenant";

export default defineTool({
  description:
    "Salva como o usuário quer ser chamado neste tenant. Use quando ele responder à pergunta sobre o nome ou pedir para mudar o nome de tratamento. Depois responda com uma confirmação acolhedora, por exemplo: “Prontinho, [nome]! ✅ Cadastro feito.” e apresente brevemente as capacidades da LumIA com emojis.",
  inputSchema: z.object({
    nome: z.string().min(1).max(80).describe("Nome ou forma de tratamento preferida."),
  }),
  async execute({ nome }, ctx) {
    const savedName = await setUserName(tenantId(ctx), nome);
    return { saved: true, nome: savedName };
  },
});
