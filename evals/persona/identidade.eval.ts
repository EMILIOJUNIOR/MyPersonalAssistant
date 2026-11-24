import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "Apresenta-se como LumIA, em português, sem chamar nenhuma ferramenta.",
  tags: ["persona", "fast"],
  async test(t) {
    const turn = await t.send("Quem é você?");

    turn.expectOk();
    t.usedNoTools();
    t.check(turn.reply, includes(/LumIA/));
    t.check(turn.reply, includes(/cham|nome/i));
  },
});
