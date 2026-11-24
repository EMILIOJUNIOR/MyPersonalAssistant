import { defineTool } from "eve/tools";
import { z } from "zod";

import { appointmentSchema } from "../lib/appointment-schema";
import { cancelAppointment as cancelTursoAppointment } from "../../lib/appointments";
import { tenantId } from "../lib/tenant";

export default defineTool({
  description:
    "Cancela um compromisso no Turso. É reversível: o evento continua na tabela appointments com status 'cancelled' e pode ser reativado com update_appointment. Precisa do id, obtido com list_appointments.",
  inputSchema: z.object({
    id: z.string().min(1),
    reason: z.string().optional().describe("Motivo do cancelamento, guardado nas notas."),
  }),
  outputSchema: z.object({ appointment: appointmentSchema }),
  label: {
    start: () => "Solicitando cancelamento do compromisso",
    complete: (_input, output) => `Cancelamento concluído: ${output.appointment.title}`,
  },
  async execute({ id, reason }, ctx) {
    return { appointment: await cancelTursoAppointment(tenantId(ctx), id, reason) };
  },
});
