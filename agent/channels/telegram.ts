import { defaultTelegramAuth, telegramChannel } from "eve/channels/telegram";

export default telegramChannel({
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
  onMessage(_ctx, message) {
    const senderId = message.from?.id;

    if (message.chat.type !== "private" || senderId === undefined) {
      return null;
    }

    return { auth: defaultTelegramAuth(message) };
  },
});
