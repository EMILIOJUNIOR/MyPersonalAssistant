import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { appointmentSchema } from "../lib/agenda";
import { cancelAppointment as cancelTursoAppointment } from "../../lib/appointments";

export default defineTool({
  description:
    "Cancela um compromisso da agenda local. É um cancelamento reversível: o evento continua no arquivo com status 'cancelled' e pode ser reativado com update_appointment. Precisa do id, obtido com list_appointments.",
  inputSchema: z.object({
    id: z.string().min(1),
    reason: z.string().optional().describe("Motivo do cancelamento, guardado nas notas."),
  }),
  outputSchema: z.object({ appointment: appointmentSchema }),
  approval: always(),
  label: {
    start: ({ id }) => `Cancelando compromisso ${id}`,
    complete: (_input, output) => `Cancelado: ${output.appointment.title}`,
  },
  async execute({ id, reason }) {
    return { appointment: await cancelTursoAppointment(id, reason) };
  },
});
