import { defineTool } from "eve/tools";
import { z } from "zod";

import { appointmentSchema, isoDateTime } from "../lib/appointment-schema";
import { createAppointment } from "../../lib/appointments";
import { tenantId } from "../lib/tenant";

export default defineTool({
  description:
    "Agenda diretamente um novo compromisso na agenda local. Informe início e, se o usuário não informar fim, use automaticamente uma duração de 1 hora. Só pergunte se faltar informação essencial ou houver conflito de horário.",
  inputSchema: z.object({
    title: z.string().min(1).describe("Título do compromisso, por exemplo 'Dentista'."),
    start: isoDateTime.describe("Início em ISO 8601, de preferência com fuso, ex.: 2026-11-20T15:00:00-03:00."),
    end: isoDateTime.optional().describe("Fim em ISO 8601, no mesmo fuso. Se omitido, duração de 1 hora."),
    location: z.string().optional(),
    notes: z.string().optional(),
    allowOverlap: z
      .boolean()
      .default(false)
      .describe("Só use true se o usuário autorizou explicitamente o conflito de horário."),
  }),
  outputSchema: z.object({ appointment: appointmentSchema }),
  label: {
    start: ({ title }) => `Agendando ${title}`,
    complete: (_input, output) => `Agendado: ${output.appointment.title} (${output.appointment.id})`,
  },
  async execute({ title, start, end, location, notes, allowOverlap }, ctx) {
    const resolvedEnd = end ?? new Date(Date.parse(start) + 60 * 60 * 1000).toISOString();
    const appointment = await createAppointment(tenantId(ctx), { title, start, end: resolvedEnd, location, notes }, allowOverlap);

    return { appointment };
  },
});
