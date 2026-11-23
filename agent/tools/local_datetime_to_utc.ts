import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  localDateKey,
  localDateTimeToUtc,
  localDayLabel,
  localLabel,
  TIMEZONE,
} from "../../lib/time";

export default defineTool({
  description:
    "Converte uma data/hora local (America/Sao_Paulo) para ISO 8601 UTC. Use SEMPRE antes de create_task, update_task ou set_reminder quando a pessoa falar 'amanhã', 'sexta às 10h' etc. Exemplo: date='2026-11-20', time='10:00'.",
  inputSchema: z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("Data local no formato YYYY-MM-DD."),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional()
      .describe("Hora local no formato HH:mm (padrão: 09:00)."),
  }),
  async execute({ date, time }) {
    const isoUtc = localDateTimeToUtc(date, time ?? "09:00");

    return {
      iso_utc: isoUtc,
      timezone: TIMEZONE,
      date: localDateKey(isoUtc),
      local: localLabel(isoUtc),
      day_label: localDayLabel(date),
    };
  },
});
