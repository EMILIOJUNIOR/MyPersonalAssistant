import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

import {
  agendaStub,
  cancelledStub,
  currentDateTime,
  dentista,
} from "../fixtures/agenda";

const cancelado = { ...dentista, status: "cancelled" as const };

export default defineEval({
  description:
    "Cancela pelo título depois de confirmação explícita e usa a ferramenta de cancelamento.",
  tags: ["agenda", "fast"],
  async test(t) {
    const session = await t.session({
      stubs: [currentDateTime, agendaStub([dentista]), cancelledStub(cancelado)],
    });

    const turn = await session.send(
      "Confirmo o cancelamento do meu dentista de sexta-feira, pode cancelar.",
    );

    turn.expectOk();
    t.calledTool("list_appointments");
    t.calledTool("cancel_appointment", { count: 1, status: "completed" });
    t.check(turn.reply, includes(/cancel/i));
  },
});
