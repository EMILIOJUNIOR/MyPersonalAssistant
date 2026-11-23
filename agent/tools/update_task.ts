import { defineTool } from "eve/tools";
import { z } from "zod";
import { updateTask, type TaskPriority } from "../../lib/tasks";

const PRIORITIES = ["low", "normal", "high"] as const satisfies readonly TaskPriority[];

export default defineTool({
  description:
    "Atualiza título, notas, prioridade, prazo ou projeto de uma tarefa. Para mudar o prazo, converta antes com local_datetime_to_utc. Use due_at null para remover o prazo.",
  inputSchema: z.object({
    task_id: z.string().uuid().describe("ID da tarefa."),
    title: z.string().min(1).max(200).optional(),
    notes: z
      .string()
      .nullable()
      .optional()
      .describe("Use null para limpar as notas."),
    priority: z.enum(PRIORITIES).optional(),
    due_at: z
      .string()
      .nullable()
      .optional()
      .describe("Novo prazo em ISO UTC, ou null para remover."),
    project_id: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe("Novo projeto, ou null para desvincular."),
  }),
  async execute(input) {
    return updateTask(input.task_id, {
      title: input.title,
      notes: input.notes,
      priority: input.priority,
      due_at: input.due_at,
      project_id: input.project_id,
    });
  },
});
