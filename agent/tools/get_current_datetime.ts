import { defineTool } from "eve/tools";
import { z } from "zod";

const TIMEZONE = "America/Sao_Paulo";

export default defineTool({
  description:
    "Retorna a data e a hora atuais no fuso do usuário. Use sempre que precisar resolver datas relativas como hoje, amanhã, sexta ou daqui a duas horas.",
  inputSchema: z.object({}),
  async execute() {
    const now = new Date();

    return {
      isoUtc: now.toISOString(),
      timezone: TIMEZONE,
      local: new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: TIMEZONE,
      }).format(now),
      weekday: new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        timeZone: TIMEZONE,
      }).format(now),
    };
  },
});