import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

import {
  agendaDbHoje,
  currentDateTimeDb,
} from "../fixtures/agenda";

export default defineEval({
  description:
    "Responde 'o que tenho hoje' consultando o dia atual com a janela ISO certa e sem inventar compromissos.",
  tags: ["agenda", "fast"],
  async test(t) {
    const session = await t.session({
      stubs: [currentDateTimeDb, agendaDbHoje],
    });

    const turn = await session.send("O que eu tenho hoje?");

    turn.expectOk();
    t.calledTool("get_current_datetime");
    t.calledTool("get_agenda", { input: { from: /2026-11-23/ } });
    t.check(turn.reply, includes(/dentista/i));
    t.check(turn.reply, includes(/almoço/i));
  },
});
