import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { deleteTask } from "../../lib/tasks";

export default defineTool({
  description:
    "Cancela ou apaga uma tarefa. O padrão é cancelar (soft delete); mode='delete' remove definitivamente. Sempre pede aprovação antes de executar.",
  inputSchema: z.object({
    task_id: z.string().uuid().describe("ID da tarefa."),
    mode: z
      .enum(["cancel", "delete"])
      .optional()
      .describe("cancel (padrão) mantém o histórico; delete apaga de vez."),
  }),
  approval: {
    request: always(),
    prompt: ({ input }) =>
      input.mode === "delete"
        ? `Apagar definitivamente a tarefa ${input.task_id}?`
        : `Cancelar a tarefa ${input.task_id}?`,
  },
  async execute(input) {
    return deleteTask(input.task_id, input.mode ?? "cancel");
  },
});
