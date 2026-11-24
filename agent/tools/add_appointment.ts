import { defineTool } from "eve/tools";
import { z } from "zod";

import { appointmentSchema, isoDateTime } from "../lib/appointment-schema";
import { createAppointment } from "../../lib/appointments";
import { tenantId } from "../lib/tenant";

export default defineTool({
  description:
    "Agenda um novo compromisso na agenda local: cria o evento com título, início, fim, local e notas, e devolve o id gerado. Confirme data, hora e fuso com o usuário antes de chamar. Se houver conflito de horário, a chamada falha e você deve perguntar se ele quer manter assim.",
  inputSchema: z.object({
    title: z.string().min(1).describe("Título do compromisso, por exemplo 'Dentista'."),
    start: isoDateTime.describe("Início em ISO 8601, de preferência com fuso, ex.: 2026-11-20T15:00:00-03:00."),
    end: isoDateTime.describe("Fim em ISO 8601, no mesmo fuso."),
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
    const appointment = await createAppointment(tenantId(ctx), { title, start, end, location, notes }, allowOverlap);

    return { appointment };
  },
});
