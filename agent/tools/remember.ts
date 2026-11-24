import { defineTool } from "eve/tools";
import { z } from "zod";

import { remember } from "../lib/memory";
import { tenantId } from "../lib/tenant";

export default defineTool({
  description:
    "Guarda uma nota curta na memória permanente da LumIA, que é relida no início de cada conversa. Use para preferências estáveis, fatos sobre o usuário e pendências que valem lembrar depois. Não guarde segredos, senhas, tokens nem detalhes passageiros da conversa atual.",
  inputSchema: z.object({
    texto: z
      .string()
      .min(3)
      .max(2_000)
      .describe("Uma frase curta e autossuficiente, ex.: 'Prefere reuniões depois das 10h'."),
  }),
  outputSchema: z.object({
    added: z.boolean(),
    total: z.number().int(),
  }),
  label: {
    start: () => "Guardando na memória",
    complete: (_input, output) =>
      output.added ? `Anotado (${output.total} nota(s))` : "Já estava anotado",
  },
  async execute({ texto }, ctx) {
    return remember(tenantId(ctx), texto);
  },
});
