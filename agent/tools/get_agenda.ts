import { defineTool } from "eve/tools";
import { z } from "zod";
import { getAgenda } from "../../lib/reminders";
import { tenantId } from "../lib/tenant";

export default defineTool({
  description:
    "Mostra a agenda com tarefas, compromissos e lembretes entre duas datas locais, agrupada por dia. Por padrão, oculta itens já encerrados; use include_past=true somente quando o usuário pedir histórico ou todos os itens.",
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
    include_past: z
      .boolean()
      .optional()
      .describe("Inclui compromissos e tarefas já passados; só use quando o usuário pedir explicitamente."),
  }),
  async execute(input, ctx) {
    return getAgenda(tenantId(ctx), input.from, input.to, input.include_done, input.include_past);
  },
});
