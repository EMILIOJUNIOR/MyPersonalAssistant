import { defineSchedule } from "eve/schedules";
import { sendDueReminders } from "../../lib/notifications";

export default defineSchedule({
  cron: "*/15 * * * *",
  run({ waitUntil }) {
    waitUntil(sendDueReminders());
  },
});
