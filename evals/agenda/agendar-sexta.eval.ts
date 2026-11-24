import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

import {
  agendaDbVazia,
  createdTask,
  currentDateTime,
  localDateTimeToUtc,
} from "../fixtures/agenda";

export default defineEval({
  description:
    "Cria uma tarefa com prazo relativo: consulta o relógio, converte o horário local e grava o prazo certo.",
  tags: ["agenda", "fast"],
  async test(t) {
    const session = await t.session({
      stubs: [currentDateTime, agendaDbVazia, localDateTimeToUtc, createdTask],
    });

    const turn = await session.send(
      "Crie uma tarefa chamada Dentista com prazo nesta sexta, dia 27/11, às 15h, horário de Brasília.",
    );

    turn.expectOk();
    t.calledTool("get_current_datetime");
    t.calledTool("create_task", { count: 1 });
    t.check(turn.reply, includes(/dentista/i));
  },
});
