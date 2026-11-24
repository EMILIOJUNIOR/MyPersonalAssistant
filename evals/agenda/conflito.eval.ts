import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

import {
  agendaStub,
  conflictStub,
  currentDateTime,
  reuniao,
} from "../fixtures/agenda";

const CONFLICT_HINT = /conflito|já (tenho|tem|existe)|ocupado|nesse horário|outro horário/i;

/**
 * She may ask a clarifying question (timezone, title) before touching the calendar, which the
 * instructions actually ask her to do. Answer once and keep going until the conflict appears,
 * instead of asserting on the very first reply.
 */
export default defineEval({
  description:
    "Com um compromisso no mesmo horário, a LumIA não força o agendamento: avisa o conflito e pergunta antes.",
  tags: ["agenda", "fast"],
  async test(t) {
    const session = await t.session({
      stubs: [currentDateTime, agendaStub([reuniao]), conflictStub],
    });

    let turn = await session.send(
      "Agende Dentista amanhã, 24/11, das 10h às 11h, no horário de Brasília.",
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
      // Caminho A: tentou gravar e a ferramenta recusou por conflito.
      if (session.pendingInteractions.length > 0) {
        const after = await session.respondAll("approve");
        after.expectOk();
        t.calledTool("add_appointment", { count: 1, status: "failed" });
        t.check(after.reply, includes(CONFLICT_HINT));
        return;
      }

      // Caminho B: percebeu o conflito na consulta e perguntou antes de gravar.
      if (CONFLICT_HINT.test(turn.reply ?? "")) {
        t.check(turn.reply, includes(CONFLICT_HINT));
        return;
      }

      if (attempt === 2) {
        t.check(turn.reply, includes(CONFLICT_HINT));
        return;
      }

      // Ela só pediu confirmação (fuso, título, etc.). Responde e segue.
      turn = await session.send(
        "Sim, pode usar o horário de Brasília. E esse horário está livre?",
      );
    }
  },
});
