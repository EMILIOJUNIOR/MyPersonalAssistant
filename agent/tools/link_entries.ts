import { defineTool } from "eve/tools";
import { z } from "zod";
import { linkEntries } from "../../lib/entries";

export default defineTool({
  description:
    "Cria um vínculo entre duas entradas do segundo cérebro, por exemplo 'ideia X virou o projeto Y' ou 'decisão A substitui a decisão B'.",
  inputSchema: z.object({
    from_entry_id: z.string().uuid().describe("Entrada de origem."),
    to_entry_id: z.string().uuid().describe("Entrada de destino."),
    relation: z
      .string()
      .min(1)
      .max(40)
      .optional()
      .describe("Rótulo do vínculo, como 'related', 'origem', 'substitui'."),
  }),
  async execute(input) {
    return linkEntries(
      input.from_entry_id,
      input.to_entry_id,
      input.relation,
    );
  },
});
