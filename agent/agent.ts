import { createOpenAI } from "@ai-sdk/openai";
import { defineAgent } from "eve";
import { defineDynamic } from "eve/models";

const OPENCODE_BASE_URL = "https://opencode.ai/inference/go/v1";

export default defineAgent({
  defaultTools: false,
  model: defineDynamic((ctx) => {
    const opencode = createOpenAI({
      name: "opencode",
      baseURL: OPENCODE_BASE_URL,
      apiKey: process.env.OPENCODE_API_KEY ?? process.env.OPENCODE_GO_API_KEY,
      headers: {
        "x-opencode-session": ctx.session.id,
        "User-Agent": "lumia-agent/1.0",
      },
    });

    return {
      model: opencode.chat("gpt-6-luna"),
      reasoning: "high",
      modelContextWindowTokens: 1_050_000,
    };
  }),
});
