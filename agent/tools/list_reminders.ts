import { defineTool } from "eve/tools";
import { z } from "zod";
import { listReminders } from "../../lib/reminders";
import { tenantId } from "../lib/tenant";

export default defineTool({
  description:
    "Lista lembretes agendados, com tarefa, horário local e status. Use para conferir se um aviso foi combinado ou para ver os próximos lembretes.",
  inputSchema: z.object({
    task_id: z.string().uuid().optional().describe("Filtra por tarefa."),
    pending_only: z
      .boolean()
      .optional()
      .describe("Somente pendentes de tarefas abertas (padrão: true)."),
    from: z
      .string()
      .optional()
      .describe("Início do período em ISO UTC (inclusive)."),
    to: z
      .string()
      .optional()
      .describe("Fim do período em ISO UTC (inclusive)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Máximo de lembretes (padrão: 20)."),
  }),
  async execute(input, ctx) {
    const reminders = await listReminders(tenantId(ctx), input);
    return { count: reminders.length, reminders };
  },
});
