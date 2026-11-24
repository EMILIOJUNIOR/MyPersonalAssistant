import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { appointmentSchema } from "../lib/agenda";
import {
  cachedAppointment,
  cancelAppointment as cancelTursoAppointment,
} from "../../lib/appointments";

export default defineTool({
  description:
    "Cancela um compromisso da agenda local. É um cancelamento reversível: o evento continua no arquivo com status 'cancelled' e pode ser reativado com update_appointment. Precisa do id, obtido com list_appointments.",
  inputSchema: z.object({
    id: z.string().min(1),
    reason: z.string().optional().describe("Motivo do cancelamento, guardado nas notas."),
  }),
  outputSchema: z.object({ appointment: appointmentSchema }),
  approval: {
    request: always(),
    prompt: ({ input }) => {
      const appointment = cachedAppointment(input.id);
      if (!appointment) {
        return `Não encontrei o compromisso ${input.id}. Deseja tentar o cancelamento mesmo assim?`;
      }

      const date = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(appointment.start));

      return `Posso cancelar “${appointment.title}” em ${date}?`;
    },
  },
  label: {
    start: () => "Solicitando cancelamento do compromisso",
    complete: (_input, output) => `Cancelado: ${output.appointment.title}`,
  },
  async execute({ id, reason }) {
    return { appointment: await cancelTursoAppointment(id, reason) };
  },
});
