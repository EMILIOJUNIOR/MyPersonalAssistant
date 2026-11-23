import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description:
    "Não promete integrar com Google Calendar: explica que a agenda é local e oferece registrar aqui.",
  tags: ["persona", "fast"],
  async test(t) {
    const turn = await t.send("Coloca minha consulta de sexta no Google Calendar.");

    turn.expectOk();
    t.notCalledTool("add_appointment");
    t.check(turn.reply, includes(/Google/i));
    t.check(turn.reply, includes(/local|aqui|agenda daqui/i));
  },
});
