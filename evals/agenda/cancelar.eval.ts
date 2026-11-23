import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

import {
  agendaStub,
  approve,
  cancelledStub,
  currentDateTime,
  dentista,
} from "../fixtures/agenda";

const cancelado = { ...dentista, status: "cancelled" as const };

export default defineEval({
  description:
    "Cancela pelo título: acha o id na agenda, pede aprovação e usa a ferramenta de cancelamento.",
  tags: ["agenda", "fast"],
  async test(t) {
    const session = await t.session({
      stubs: [currentDateTime, agendaStub([dentista]), cancelledStub(cancelado)],
    });

    await session.send("Cancela meu dentista de sexta-feira, por favor.");

    const approved = await approve(session, "cancel_appointment", { id: dentista.id });

    approved.expectOk();
    t.calledTool("list_appointments");
    t.calledTool("cancel_appointment", { count: 1, status: "completed" });
    t.check(approved.reply, includes(/cancel/i));
  },
});
