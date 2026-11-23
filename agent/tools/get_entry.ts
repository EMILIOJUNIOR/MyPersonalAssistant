import { defineTool } from "eve/tools";
import { z } from "zod";
import { getEntryWithLinks } from "../../lib/entries";

export default defineTool({
  description:
    "Abre uma entrada completa do segundo cérebro, com conteúdo integral, projeto e vínculos com outras entradas.",
  inputSchema: z.object({
    entry_id: z.string().uuid().describe("ID da entrada."),
  }),
  async execute({ entry_id }) {
    const result = await getEntryWithLinks(entry_id);

    if (!result) {
      throw new Error("Entrada não encontrada.");
    }

    return result;
  },
});
