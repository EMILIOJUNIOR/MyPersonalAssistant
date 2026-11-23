import { defineTool } from "eve/tools";
import { z } from "zod";

import { forget } from "../lib/memory";

export default defineTool({
  description:
    "Remove da memória permanente as notas que contenham o texto informado. Use quando o MilhoJr disser que algo mudou, que não vale mais, ou pedir para esquecer. A remoção é definitiva.",
  inputSchema: z.object({
    texto: z
      .string()
      .min(3)
      .describe("Trecho que identifica a nota, ex.: 'reuniões depois das 10h'."),
  }),
  outputSchema: z.object({
    removed: z.number().int(),
    total: z.number().int(),
  }),
  label: {
    start: () => "Esquecendo nota",
    complete: (_input, output) =>
      output.removed > 0 ? `${output.removed} nota(s) removida(s)` : "Nada para remover",
  },
  async execute({ texto }) {
    return forget(texto);
  },
});
