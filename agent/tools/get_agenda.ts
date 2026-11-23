import { defineTool } from "eve/tools";
import { z } from "zod";
import { getAgenda } from "../../lib/reminders";

export default defineTool({
  description:
    "Mostra a agenda de compromissos com prazo entre duas datas locais, agrupada por dia, com lembretes pendentes. Use para 'o que tenho amanhã', 'minha semana' ou revisão do dia.",
  inputSchema: z.object({
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("Data inicial local, formato YYYY-MM-DD."),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("Data final local, formato YYYY-MM-DD."),
    include_done: z
      .boolean()
      .optional()
      .describe("Inclui tarefas concluídas (padrão: false)."),
  }),
  async execute(input) {
    return getAgenda(input.from, input.to, input.include_done);
  },
});
