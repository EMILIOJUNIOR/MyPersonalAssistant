import { defineTool } from "eve/tools";
import { z } from "zod";
import { recordDecision } from "../../lib/entries";

export default defineTool({
  description:
    "Registra uma decisão estruturada com contexto, opções consideradas, prós, contras, escolha e justificativa. Use quando a pessoa precisar decidir algo ou quando uma decisão importante for tomada.",
  inputSchema: z.object({
    title: z.string().min(1).max(200).describe("Título da decisão."),
    context: z.string().min(1).describe("Situação e o que motivou a decisão."),
    options: z
      .array(
        z.object({
          label: z.string().min(1).describe("Nome da opção."),
          pros: z.array(z.string().min(1)).describe("Vantagens."),
          cons: z.array(z.string().min(1)).describe("Desvantagens."),
        }),
      )
      .min(2)
      .max(6)
      .describe("Opções avaliadas."),
    decision: z.string().min(1).describe("Opção escolhida ou decisão final."),
    rationale: z.string().min(1).optional().describe("Por que essa escolha."),
    project_id: z
      .string()
      .uuid()
      .optional()
      .describe("Projeto relacionado, se houver."),
    tags: z.array(z.string().min(1).max(40)).max(10).optional(),
  }),
  async execute(input) {
    const { entry } = await recordDecision({
      title: input.title,
      context: input.context,
      options: input.options,
      decision: input.decision,
      rationale: input.rationale,
      project_id: input.project_id,
      tags: input.tags,
    });

    return {
      id: entry.id,
      title: entry.title,
      decision: input.decision,
      options_count: input.options.length,
      project_id: entry.project_id,
      created_at: entry.created_at,
    };
  },
});
