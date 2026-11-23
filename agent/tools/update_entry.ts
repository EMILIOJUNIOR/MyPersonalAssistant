import { defineTool } from "eve/tools";
import { z } from "zod";
import { updateEntry, type EntryStatus } from "../../lib/entries";

const STATUSES = ["active", "archived"] as const satisfies readonly EntryStatus[];

export default defineTool({
  description:
    "Atualiza título, conteúdo, tags, projeto ou arquiva uma entrada existente. Use para complementar ou reorganizar algo já capturado.",
  inputSchema: z.object({
    entry_id: z.string().uuid().describe("ID da entrada a atualizar."),
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).optional(),
    tags: z.array(z.string().min(1).max(40)).max(10).optional(),
    project_id: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe("Novo projeto; use null para desvincular."),
    status: z
      .enum(STATUSES)
      .optional()
      .describe("active mantém visível; archived tira das buscas padrão."),
  }),
  async execute(input) {
    const entry = await updateEntry(input.entry_id, {
      title: input.title,
      content: input.content,
      tags: input.tags,
      project_id: input.project_id,
      status: input.status,
    });

    return {
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      tags: entry.tags,
      project_id: entry.project_id,
      status: entry.status,
      updated_at: entry.updated_at,
    };
  },
});
