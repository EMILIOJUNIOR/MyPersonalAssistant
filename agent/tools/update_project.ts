import { defineTool } from "eve/tools";
import { z } from "zod";
import { updateProject, type ProjectStatus } from "../../lib/projects";

const STATUSES = [
  "active",
  "paused",
  "done",
  "archived",
] as const satisfies readonly ProjectStatus[];

export default defineTool({
  description:
    "Atualiza nome, descrição ou status de um projeto. Use para pausar, concluir ou arquivar um projeto.",
  inputSchema: z.object({
    project_id: z.string().uuid().describe("ID do projeto."),
    name: z.string().min(1).max(120).optional(),
    description: z
      .string()
      .nullable()
      .optional()
      .describe("Use null para limpar a descrição."),
    status: z.enum(STATUSES).optional(),
  }),
  async execute(input) {
    return updateProject(input.project_id, {
      name: input.name,
      description: input.description,
      status: input.status,
    });
  },
});
