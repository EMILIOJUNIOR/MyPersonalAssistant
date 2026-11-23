import { defineTool } from "eve/tools";
import { z } from "zod";
import { completeTask } from "../../lib/tasks";

export default defineTool({
  description:
    "Marca uma tarefa como concluída. Use quando a pessoa disser que já fez, terminou ou resolveu.",
  inputSchema: z.object({
    task_id: z.string().uuid().describe("ID da tarefa concluída."),
  }),
  async execute({ task_id }) {
    const task = await completeTask(task_id);

    return {
      id: task.id,
      title: task.title,
      status: task.status,
      completed_at: task.completed_at,
    };
  },
});
