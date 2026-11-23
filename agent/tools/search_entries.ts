import { defineTool } from "eve/tools";
import { z } from "zod";
import { searchEntries, type EntryKind } from "../../lib/entries";

const KINDS = [
  "idea",
  "note",
  "decision",
  "summary",
  "reference",
] as const satisfies readonly EntryKind[];

export default defineTool({
  description:
    "Busca entradas do segundo cérebro por texto, tipo, projeto ou tag. Use antes de dizer que não lembra de algo ou para reunir contexto sobre um assunto.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .optional()
      .describe("Texto livre para buscar no título, conteúdo e tags."),
    kind: z.enum(KINDS).optional().describe("Filtra por tipo de entrada."),
    project_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filtra por projeto."),
    tag: z.string().min(1).optional().describe("Filtra por uma tag exata."),
    include_archived: z
      .boolean()
      .optional()
      .describe("Inclui entradas arquivadas (padrão: false)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("Máximo de resultados (padrão: 10)."),
  }),
  async execute(input) {
    const entries = await searchEntries({
      query: input.query,
      kind: input.kind,
      project_id: input.project_id,
      tag: input.tag,
      include_archived: input.include_archived,
      limit: input.limit,
    });

    return { count: entries.length, entries };
  },
});
