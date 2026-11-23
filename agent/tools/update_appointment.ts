import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { agenda, appointmentSchema, isoDateTime } from "../lib/agenda";

export default defineTool({
  description:
    "Altera um compromisso existente da agenda local (título, horário, local, notas ou status). É preciso passar o id, obtido com list_appointments. Só os campos enviados são alterados; envie location ou notes como null para apagar o valor.",
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
  approval: always(),
  label: {
    start: ({ id }) => `Alterando compromisso ${id}`,
    complete: (_input, output) => `Compromisso atualizado: ${output.appointment.title}`,
  },
  async execute({ id, allowOverlap, ...changes }) {
    return {
      appointment: await agenda().update({ id, ...changes }, { allowOverlap }),
    };
  },
});
