import { defineTool } from "eve/tools";
import { z } from "zod";
import { createTask, type TaskPriority } from "../../lib/tasks";

const PRIORITIES = ["low", "normal", "high"] as const satisfies readonly TaskPriority[];

export default defineTool({
  description:
    "Cria uma tarefa, pendência ou compromisso. Se houver prazo, converta antes com local_datetime_to_utc e passe o ISO UTC em due_at. O prazo não agenda aviso sozinho: use set_reminder para o lembrete.",
  inputSchema: z.object({
    title: z.string().min(1).max(200).describe("O que precisa ser feito."),
    notes: z.string().optional().describe("Detalhes ou contexto."),
    priority: z.enum(PRIORITIES).optional().describe("Padrão: normal."),
    due_at: z
      .string()
      .optional()
      .describe(
        "Prazo em ISO 8601 UTC, ex.: 2026-11-20T13:00:00.000Z. Use local_datetime_to_utc para calcular.",
      ),
    project_id: z
      .string()
      .uuid()
      .optional()
      .describe("Projeto ao qual a tarefa pertence."),
  }),
  async execute(input) {
    const task = await createTask(input);

    return {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      due_at: task.due_at,
      project_id: task.project_id,
      created_at: task.created_at,
    };
  },
});
