import { defineTool } from "eve/tools";
import { z } from "zod";
import { cancelReminder } from "../../lib/reminders";
import { tenantId } from "../lib/tenant";

export default defineTool({
  description:
    "Cancela um lembrete que ainda não foi enviado. Use quando a pessoa não quiser mais ser avisada sobre aquela tarefa.",
  inputSchema: z.object({
    reminder_id: z.string().uuid().describe("ID do lembrete."),
  }),
  async execute({ reminder_id }, ctx) {
    await cancelReminder(tenantId(ctx), reminder_id);
    return { id: reminder_id, cancelled: true };
  },
});
