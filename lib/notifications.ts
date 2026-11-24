import { nowIso } from "./time";
import { localLabel } from "./time";
import { getDb } from "./db";
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

async function tenantIds(): Promise<string[]> {
  const result = await getDb().execute(`
    SELECT tenant_id FROM tasks
    UNION
    SELECT tenant_id FROM appointments
    UNION
    SELECT tenant_id FROM entries
    ORDER BY tenant_id
  `);
  return result.rows.map((row) => String(row.tenant_id));
}

function reminderMessage(reminder: Reminder): string {
  return `⏰ Lembrete: ${reminder.task_title}\nHorário: ${reminder.remind_local}`;
}

function appointmentReminderMessage(reminder: AppointmentReminder): string {
  const lead = reminder.kind === "24h" ? "24 horas" : "15 minutos";
  return `⏰ Compromisso em ${lead}: ${reminder.title}\nHorário: ${localLabel(reminder.start)}`;
}

export async function sendDueReminders(): Promise<ReminderDispatchResult> {
  let sent = 0;
  let failed = 0;
  let checked = 0;

  for (const tenantId of await tenantIds()) {
    const reminders = await claimDueReminders(tenantId, nowIso(), 20);
    const appointmentReminders = await claimDueAppointmentReminders(tenantId, nowIso(), 20);
    checked += reminders.length + appointmentReminders.length;

    for (const reminder of reminders) {
      try {
        await sendTelegramText(tenantId, reminderMessage(reminder));
        await markReminderSent(tenantId, reminder.id);
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error(`Falha ao enviar lembrete ${reminder.id}:`, error instanceof Error ? error.message : error);
      }
    }

    for (const reminder of appointmentReminders) {
      try {
        await sendTelegramText(tenantId, appointmentReminderMessage(reminder));
        await markAppointmentReminderSent(tenantId, reminder.id);
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error(`Falha ao enviar lembrete de compromisso ${reminder.id}:`, error instanceof Error ? error.message : error);
      }
    }

    if (reminders.length > 0 || appointmentReminders.length > 0) {
      console.log(`Tenant ${tenantId}: ${reminders.length + appointmentReminders.length} lembretes vencidos.`);
    }
  }

  return { checked, sent, failed };
}
