import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

import { remembered } from "../fixtures/agenda";

export default defineEval({
  description:
    "Quando o usuário ensina uma preferência, guarda na memória com uma frase curta e confirma.",
  tags: ["memoria", "fast"],
  async test(t) {
    const session = await t.session({ stubs: [remembered] });

    const turn = await session.send("Lembra que eu prefiro reuniões de manhã.");

    turn.expectOk();
    t.calledTool("remember", { count: 1, input: { texto: /reuni/i } });
    t.check(turn.reply, includes(/anotei|anotado|guardei|lembr/i));
  },
});
