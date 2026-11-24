import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { appointmentSchema, isoDateTime } from "../lib/agenda";
import {
  cachedAppointment,
  updateAppointment as updateTursoAppointment,
} from "../../lib/appointments";

export default defineTool({
  description:
    "Altera um compromisso existente no Turso (título, horário, local, notas ou status). É preciso passar o id, obtido com list_appointments. Só os campos enviados são alterados; envie location ou notes como null para apagar o valor.",
  inputSchema: z.object({
    id: z.string().min(1),
    title: z.string().min(1).optional(),
    start: isoDateTime.optional(),
    end: isoDateTime.optional(),
    location: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    status: z.enum(["confirmed", "cancelled"]).optional(),
    allowOverlap: z.boolean().default(false),
  }),
  outputSchema: z.object({ appointment: appointmentSchema }),
  approval: {
    request: always(),
    prompt: ({ input }) => {
      const appointment = cachedAppointment(input.id);
      const title = appointment?.title ?? `compromisso ${input.id}`;
      const currentDate = appointment
        ? new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: "America/Sao_Paulo",
          }).format(new Date(appointment.start))
        : null;
      const change = input.start || input.end ? " o horário" : " os dados";

      return `Posso atualizar “${title}”${currentDate ? ` (${currentDate})` : ""}${change}?`;
    },
  },
  label: {
    start: () => "Solicitando atualização do compromisso",
    complete: (_input, output) => `Compromisso alterado: ${output.appointment.title}`,
  },
  async execute({ id, allowOverlap, ...changes }) {
    return {
      appointment: await updateTursoAppointment({ id, ...changes }, allowOverlap),
    };
  },
});
