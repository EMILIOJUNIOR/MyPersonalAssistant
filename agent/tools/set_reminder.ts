import { defineTool } from "eve/tools";
import { z } from "zod";
import { setReminder } from "../../lib/reminders";

export default defineTool({
  description:
    "Agenda um aviso no Telegram para uma tarefa. Converta a hora local antes com local_datetime_to_utc e passe o ISO UTC em remind_at. O lembrete precisa estar no futuro e a tarefa precisa estar aberta.",
  inputSchema: z.object({
    task_id: z.string().uuid().describe("ID da tarefa que será lembrada."),
    remind_at: z
      .string()
      .describe(
        "Quando avisar, em ISO 8601 UTC, ex.: 2026-11-20T13:00:00.000Z.",
      ),
  }),
  async execute(input) {
    return setReminder(input.task_id, input.remind_at);
  },
});
