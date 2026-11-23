import { defineTool } from "eve/tools";
import { z } from "zod";
import { createProject, type ProjectStatus } from "../../lib/projects";

const STATUSES = [
  "active",
  "paused",
  "done",
  "archived",
] as const satisfies readonly ProjectStatus[];

export default defineTool({
  description:
    "Cria um projeto para agrupar objetivos, tarefas e entradas de conhecimento. Use quando a pessoa começar algo com várias etapas.",
  inputSchema: z.object({
    name: z.string().min(1).max(120).describe("Nome do projeto."),
    description: z
      .string()
      .optional()
      .describe("Objetivo ou descrição curta do projeto."),
    status: z.enum(STATUSES).optional().describe("Padrão: active."),
  }),
  async execute(input) {
    return createProject(input);
  },
});
