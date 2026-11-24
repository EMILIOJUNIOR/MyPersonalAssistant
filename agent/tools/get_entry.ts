import { defineTool } from "eve/tools";
import { z } from "zod";
import { getEntryWithLinks } from "../../lib/entries";
import { tenantId } from "../lib/tenant";

export default defineTool({
  description:
    "Abre uma entrada completa do segundo cérebro, com conteúdo integral, projeto e vínculos com outras entradas.",
  inputSchema: z.object({
    entry_id: z.string().uuid().describe("ID da entrada."),
  }),
  async execute({ entry_id }, ctx) {
    const result = await getEntryWithLinks(tenantId(ctx), entry_id);

    if (!result) {
      throw new Error("Entrada não encontrada.");
    }

    return result;
  },
});
