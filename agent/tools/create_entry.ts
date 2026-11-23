import { defineTool } from "eve/tools";
import { z } from "zod";
import { createEntry, type EntryKind } from "../../lib/entries";

const KINDS = [
  "idea",
  "note",
  "decision",
  "summary",
  "reference",
] as const satisfies readonly EntryKind[];

export default defineTool({
  description:
    "Registra uma entrada no segundo cérebro: ideia, nota, referência, resumo ou decisão. Use sempre que a pessoa compartilhar algo que vale guardar. Para decisões com opções, prós e contras, prefira record_decision.",
  inputSchema: z.object({
    kind: z
      .enum(KINDS)
      .describe(
        "Tipo da entrada: idea (ideia solta), note (nota/anotação), decision (decisão), summary (resumo), reference (link/referência).",
      ),
    title: z.string().min(1).max(200).describe("Título curto e buscável."),
    content: z
      .string()
      .min(1)
      .describe("Conteúdo completo em markdown, preservando o contexto."),
    tags: z
      .array(z.string().min(1).max(40))
      .max(10)
      .optional()
      .describe("Etiquetas para organizar e recuperar depois."),
    project_id: z
      .string()
      .uuid()
      .optional()
      .describe("ID do projeto ao qual a entrada pertence, se houver."),
  }),
  async execute(input) {
    const entry = await createEntry({
      kind: input.kind,
      title: input.title,
      content: input.content,
      tags: input.tags,
      project_id: input.project_id,
    });

    return {
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      tags: entry.tags,
      project_id: entry.project_id,
      created_at: entry.created_at,
    };
  },
});
