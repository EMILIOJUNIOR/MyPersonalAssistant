import { defineTool } from "eve/tools";
import { z } from "zod";

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export default defineTool({
  description:
    "Retorna a data e a hora atuais da máquina, com dia da semana e fuso horário. Use sempre que o usuário disser 'hoje', 'amanhã', 'na sexta', 'semana que vem' ou qualquer data relativa, antes de calcular intervalos para list_appointments ou agendar um compromisso.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    iso: z.string(),
    utc: z.string(),
    date: z.string(),
    weekday: z.string(),
    timezoneOffsetMinutes: z.number().int(),
  }),
  label: false,
  async execute() {
    const now = new Date();
    return {
      iso: now.toISOString(),
      utc: now.toUTCString(),
      date: now.toLocaleDateString("pt-BR"),
      weekday: WEEKDAYS[now.getDay()],
      timezoneOffsetMinutes: -now.getTimezoneOffset(),
    };
  },
});
