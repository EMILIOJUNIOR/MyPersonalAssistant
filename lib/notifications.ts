import { nowIso } from "./time";
import { localLabel } from "./time";
import {
  claimDueAppointmentReminders,
  markAppointmentReminderSent,
  type AppointmentReminder,
} from "./appointments";
import {
  claimDueReminders,
  markReminderSent,
  type Reminder,
} from "./reminders";
import { sendTelegramText } from "./telegram";

export interface ReminderDispatchResult {
  checked: number;
  sent: number;
  failed: number;
}

function allowedChatId(): string {
  const chatId = (process.env.TELEGRAM_ALLOWED_USER_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)[0];

  if (!chatId) {
    throw new Error("TELEGRAM_ALLOWED_USER_ID não configurado.");
  }

  return chatId;
}

function reminderMessage(reminder: Reminder): string {
  return `⏰ Lembrete: ${reminder.task_title}\nHorário: ${reminder.remind_local}`;
}

function appointmentReminderMessage(reminder: AppointmentReminder): string {
  const lead = reminder.kind === "24h" ? "24 horas" : "15 minutos";
  return `⏰ Compromisso em ${lead}: ${reminder.title}\nHorário: ${localLabel(reminder.start)}`;
}

export async function sendDueReminders(): Promise<ReminderDispatchResult> {
  const chatId = allowedChatId();
  const reminders = await claimDueReminders(nowIso(), 20);
  const appointmentReminders = await claimDueAppointmentReminders(nowIso(), 20);
  let sent = 0;
  let failed = 0;

  for (const reminder of reminders) {
    try {
      await sendTelegramText(chatId, reminderMessage(reminder));
      await markReminderSent(reminder.id);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `Falha ao enviar lembrete ${reminder.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  for (const reminder of appointmentReminders) {
    try {
      await sendTelegramText(chatId, appointmentReminderMessage(reminder));
      await markAppointmentReminderSent(reminder.id);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `Falha ao enviar lembrete de compromisso ${reminder.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (reminders.length > 0 || appointmentReminders.length > 0) {
    console.log(
      `Lembretes: ${reminders.length + appointmentReminders.length} vencidos, ${sent} enviados, ${failed} falharam.`,
    );
  }

  return { checked: reminders.length, sent, failed };
}
