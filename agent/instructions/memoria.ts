import { defineDynamic, defineInstructions } from "eve/instructions";

import { readMemory } from "../lib/memory";

/**
 * Injects the user's memory document (data/memoria.md) as user-role context.
 *
 * The resolver runs before every model call, so the read is memoized per turn: one disk read
 * per turn, and changes written by `remember`/`forget` show up on the next turn. Returning null
 * adds nothing, which keeps the prompt clean while the memory is still empty.
 */
export default defineDynamic(async (ctx) => {
  const memory = await ctx.memo(ctx.turn?.id ?? null, () => readMemory());
  if (!memory) return null;

  return defineInstructions({
    role: "user",
    content: [
      "### Memória da LumIA",
      "Fatos, preferências e pendências que você aprendeu em conversas anteriores. Use quando for útil; não diga que leu um arquivo nem cite esta seção.",
      "",
      memory,
    ].join("\n"),
  });
});
