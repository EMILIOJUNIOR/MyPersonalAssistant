import type { ToolContext } from "eve/tools";

export function tenantId(ctx: ToolContext): string {
  const value = ctx.session.auth.current?.attributes.user_id;

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error("Não foi possível identificar o tenant do Telegram.");
  }

  return value;
}
