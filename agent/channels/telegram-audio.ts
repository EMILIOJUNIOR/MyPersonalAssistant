import { timingSafeEqual } from "node:crypto";
import { defineChannel, POST } from "eve/channels";

/**
 * Porta de entrada do webhook do Telegram.
 *
 * O canal nativo do eve só entende `message.photo` e `message.document`.
 * Mensagens de voz (`message.voice`) e arquivos de áudio (`message.audio`)
 * chegam sem `text` e são descartadas antes do modelo. Esta rota baixa o
 * áudio, transcreve com Whisper (Groq) e reescreve o update como texto antes
 * de encaminhar para o canal nativo em `/eve/v1/telegram`.
 *
 * Todo o resto (texto, foto, documento, botões) passa direto, sem alteração.
 */

const EVE_TELEGRAM_PATH = "/eve/v1/telegram";
const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODEL = "whisper-large-v3-turbo";
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

interface TelegramChat {
  id: number | string;
  type?: string;
  title?: string;
  username?: string;
}

interface TelegramUser {
  id: number | string;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
}

interface TelegramAudio {
  file_id: string;
  file_size?: number;
  mime_type?: string;
  duration?: number;
}

interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  caption?: string;
  voice?: TelegramAudio;
  audio?: TelegramAudio;
}

interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
  [key: string]: unknown;
}

const allowedUsers = new Set(
  (process.env.TELEGRAM_ALLOWED_USER_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

function secretMatches(received: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN ?? "";
  if (!expected || !received || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

function isAllowedPrivateChat(message: TelegramMessage): boolean {
  if (message.chat?.type !== "private") return false;
  const senderId = message.from?.id;
  if (senderId === undefined) return false;
  return allowedUsers.has(String(senderId));
}

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN não configurado");
  return token;
}

async function callTelegramApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const payload = (await response.json()) as {
    ok: boolean;
    result?: T;
    description?: string;
  };
  if (!payload.ok) {
    throw new Error(`${method} falhou: ${payload.description ?? response.status}`);
  }
  return payload.result as T;
}

async function downloadAudio(fileId: string): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
  const file = await callTelegramApi<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!file.file_path) throw new Error("getFile não retornou file_path");

  const response = await fetch(
    `https://api.telegram.org/file/bot${botToken()}/${file.file_path}`,
    { signal: AbortSignal.timeout(TIMEOUT_MS) },
  );
  if (!response.ok) throw new Error(`download do áudio falhou (HTTP ${response.status})`);

  return {
    bytes: await response.arrayBuffer(),
    mimeType: response.headers.get("content-type") ?? "audio/ogg",
  };
}

/**
 * O Groq valida a extensão do arquivo enviado. O Telegram entrega voz como
 * `.oga` (OGG/Opus), que não está na lista aceita — embora `ogg` esteja.
 * Aqui normalizamos para uma extensão aceita.
 */
function audioUploadFormat(mimeType: string): { filename: string; contentType: string } {
  const mime = mimeType.toLowerCase();
  if (mime.includes("ogg") || mime.includes("opus")) return { filename: "audio.ogg", contentType: "audio/ogg" };
  if (mime.includes("mpeg") || mime.includes("mp3")) return { filename: "audio.mp3", contentType: "audio/mpeg" };
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return { filename: "audio.m4a", contentType: "audio/mp4" };
  if (mime.includes("wav")) return { filename: "audio.wav", contentType: "audio/wav" };
  if (mime.includes("webm")) return { filename: "audio.webm", contentType: "audio/webm" };
  if (mime.includes("flac")) return { filename: "audio.flac", contentType: "audio/flac" };
  return { filename: "audio.ogg", contentType: "audio/ogg" };
}

async function transcribe(bytes: ArrayBuffer, mimeType: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY não configurada");

  const upload = audioUploadFormat(mimeType);

  const form = new FormData();
  form.append("model", GROQ_MODEL);
  form.append("language", "pt");
  form.append("response_format", "json");
  form.append("temperature", "0");
  form.append("file", new Blob([bytes], { type: upload.contentType }), upload.filename);

  const response = await fetch(GROQ_TRANSCRIPTION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    text?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(`Groq HTTP ${response.status}: ${payload.error?.message ?? "erro"}`);
  }

  return (payload.text ?? "").trim();
}

async function notify(chatId: number | string, text: string): Promise<void> {
  try {
    await callTelegramApi("sendMessage", { chat_id: chatId, text });
  } catch {
    // Aviso é best-effort: não deve derrubar o webhook.
  }
}

async function forwardToEve(request: Request, update: TelegramUpdate): Promise<Response> {
  const target = new URL(EVE_TELEGRAM_PATH, request.url);
  const response = await fetch(target, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN ?? "",
    },
    body: JSON.stringify(update),
  });

  return new Response(response.body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}

async function handleAudio(
  request: Request,
  update: TelegramUpdate,
  message: TelegramMessage,
  audio: TelegramAudio,
): Promise<Response> {
  if (!isAllowedPrivateChat(message)) return forwardToEve(request, update);

  if ((audio.file_size ?? 0) > MAX_AUDIO_BYTES) {
    await notify(message.chat.id, "🎤 Esse áudio é grande demais para eu transcrever (limite ~20 MB).");
    return Response.json({ ok: true });
  }

  try {
    const { bytes, mimeType } = await downloadAudio(audio.file_id);
    const transcript = await transcribe(bytes, audio.mime_type ?? mimeType);

    if (!transcript) {
      await notify(message.chat.id, "🎤 Não consegui entender o áudio. Pode repetir ou digitar?");
      return Response.json({ ok: true });
    }

    const text = [message.caption?.trim(), transcript].filter(Boolean).join("\n\n");
    const rewritten: TelegramUpdate = {
      ...update,
      message: {
        ...message,
        text,
        caption: undefined,
        voice: undefined,
        audio: undefined,
      },
    };

    return forwardToEve(request, rewritten);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("[telegram-audio] falha ao transcrever:", reason);
    await notify(message.chat.id, "🎤 Tive um problema para transcrever o áudio. Pode repetir ou digitar?");
    return Response.json({ ok: true });
  }
}

export default defineChannel({
  routes: [
    POST("/telegram/inbound", async (request) => {
      if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"))) {
        return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }

      let update: TelegramUpdate;
      try {
        update = (await request.json()) as TelegramUpdate;
      } catch {
        return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
      }

      const message = update.message;
      const audio = message?.voice ?? message?.audio;

      if (!message || !audio) return forwardToEve(request, update);

      return handleAudio(request, update, message, audio);
    }),
  ],
});
