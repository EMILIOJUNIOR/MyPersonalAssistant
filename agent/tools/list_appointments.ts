import { defineTool } from "eve/tools";
import { z } from "zod";

import { agenda, appointmentSchema } from "../lib/agenda";

export default defineTool({
  description:
    "Lista os compromissos da agenda local. Use para responder 'o que tenho hoje/amanhã/nesta semana', verificar se um horário está livre e encontrar o id de um compromisso antes de alterá-lo ou cancelá-lo. Datas devem ser ISO (ex.: 2026-11-20T00:00:00-03:00).",
  inputSchema: z.object({
    from: z.string().optional().describe("Início do intervalo; se omitido, sem limite inferior."),
    to: z.string().optional().describe("Fim do intervalo; se omitido, sem limite superior."),
    query: z.string().optional().describe("Filtra por texto no título, local ou notas."),
    includeCancelled: z.boolean().default(false),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  outputSchema: z.object({
    count: z.number().int(),
    storage: z.string().describe("Onde a agenda está guardada; útil para depurar."),
    appointments: z.array(appointmentSchema),
  }),
  label: {
    start: () => "Consultando a agenda",
    complete: (_input, output) => `${output.count} compromisso(s) encontrado(s)`,
  },
  async execute({ from, to, query, includeCancelled, limit }) {
    const repository = agenda();
    const appointments = await repository.list({
      from,
      to,
      search: query,
      includeCancelled,
      limit,
    });

    return { count: appointments.length, storage: repository.location, appointments };
  },
});
