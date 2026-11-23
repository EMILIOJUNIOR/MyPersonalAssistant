import { defaultTelegramAuth, telegramChannel } from "eve/channels/telegram";

const allowedUsers = new Set(
  (process.env.TELEGRAM_ALLOWED_USER_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

export default telegramChannel({
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
  onMessage(_ctx, message) {
    const senderId = message.from?.id;

    // Fail closed: sem allowlist configurada, ninguém é atendido.
    if (message.chat.type !== "private" || senderId === undefined) {
      return null;
    }

    if (!allowedUsers.has(String(senderId))) {
      return null;
    }

    return { auth: defaultTelegramAuth(message) };
  },
});
