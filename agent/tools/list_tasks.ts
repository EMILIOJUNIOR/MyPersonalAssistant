import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  listTasks,
  type TaskPriority,
  type TaskStatus,
} from "../../lib/tasks";

const STATUSES = [
  "open",
  "done",
  "cancelled",
  "all",
] as const satisfies readonly (TaskStatus | "all")[];
const PRIORITIES = ["low", "normal", "high"] as const satisfies readonly TaskPriority[];

export default defineTool({
  description:
    "Lista tarefas, com prazo local, atraso e projeto. Use para responder o que está pendente, o que vence hoje ou o que está atrasado. Padrão: somente abertas.",
  inputSchema: z.object({
    status: z
      .enum(STATUSES)
      .optional()
      .describe("open (padrão), done, cancelled ou all."),
    priority: z.enum(PRIORITIES).optional(),
    project_id: z.string().uuid().optional().describe("Filtra por projeto."),
    overdue_only: z
      .boolean()
      .optional()
      .describe("Somente tarefas abertas com prazo vencido."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Máximo de tarefas (padrão: 20)."),
  }),
  async execute(input) {
    const tasks = await listTasks(input);
    return { count: tasks.length, tasks };
  },
});
