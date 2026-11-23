import { defineEvalConfig } from "eve/evals";

export default defineEvalConfig({
  // The agent runs on a single OpenCode Go subscription and high reasoning,
  // so keep concurrency low and give each case room to finish.
  maxConcurrency: 2,
  timeoutMs: 240_000,
});
