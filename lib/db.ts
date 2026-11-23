import { createClient } from "@libsql/client";

let client: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;

  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL não configurada. Adicione ao .env.local.",
    );
  }

  client = createClient({
    url,
    authToken: url.startsWith("file:")
      ? undefined
      : process.env.TURSO_AUTH_TOKEN,
  });

  return client;
}