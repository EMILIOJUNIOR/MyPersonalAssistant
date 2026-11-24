import { readFile } from "node:fs/promises";
import path from "node:path";

import { getDb } from "../lib/db";

type LegacyAppointment = {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  notes?: string;
  status: "confirmed" | "cancelled";
  createdAt: string;
  updatedAt: string;
};

type LegacyStore = {
  appointments?: LegacyAppointment[];
};

const file = process.env.LUMIA_DATA_FILE ?? path.resolve("data", "compromissos.json");
const raw = await readFile(file, "utf8");
const store = JSON.parse(raw) as LegacyStore;
const appointments = store.appointments ?? [];

for (const appointment of appointments) {
  await getDb().execute({
    sql: `INSERT OR IGNORE INTO appointments
          (id, title, start_at, end_at, location, notes, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      appointment.id,
      appointment.title,
      new Date(appointment.start).toISOString(),
      new Date(appointment.end).toISOString(),
      appointment.location ?? null,
      appointment.notes ?? null,
      appointment.status,
      appointment.createdAt,
      appointment.updatedAt,
    ],
  });
}

console.log(`${appointments.length} compromisso(s) importado(s) de ${file}.`);
