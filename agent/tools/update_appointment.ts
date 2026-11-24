import { defineTool } from "eve/tools";
import { z } from "zod";

import { appointmentSchema, isoDateTime } from "../lib/appointment-schema";
import { updateAppointment as updateTursoAppointment } from "../../lib/appointments";

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
