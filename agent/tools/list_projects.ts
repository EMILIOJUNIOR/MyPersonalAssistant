import { defineTool } from "eve/tools";
import { z } from "zod";
import { listProjects, type ProjectStatus } from "../../lib/projects";

const STATUSES = [
  "active",
  "paused",
  "done",
  "archived",
] as const satisfies readonly ProjectStatus[];

export default defineTool({
  description:
    "Lista projetos com contagem de tarefas abertas e entradas ativas. Use para acompanhar o que está em andamento ou responder 'quais são meus projetos'.",
  inputSchema: z.object({
    status: z.enum(STATUSES).optional().describe("Filtra por status."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Máximo de projetos (padrão: 20)."),
  }),
  async execute(input) {
    const projects = await listProjects(input);
    return { count: projects.length, projects };
  },
});
