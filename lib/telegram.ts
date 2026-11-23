function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN não configurado.");
  }

  return token;
}

export async function sendTelegramText(
  chatId: string,
  text: string,
): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${getBotToken()}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ chat_id: chatId, text }),
    },
  );

  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; description?: string }
    | null;

  if (!response.ok || !body?.ok) {
    throw new Error(
      `Telegram sendMessage falhou: ${
        body?.description ?? `HTTP ${response.status}`
      }`,
    );
  }
}
