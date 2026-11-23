import { z } from "zod";

/**
 * Domain model of an appointment. Storage implementations (JSON today, database later) must
 * produce and accept exactly this shape, so tools never depend on how it is persisted.
 */
export const appointmentSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1),
  start: z.string(),
  end: z.string(),
  location: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["confirmed", "cancelled"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Appointment = z.infer<typeof appointmentSchema>;

export const isoDateTime = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Use uma data/hora ISO, por exemplo 2026-11-20T15:00:00-03:00.",
  });

export function timeOf(value: string): number {
  return Date.parse(value);
}

export function overlaps(
  a: Pick<Appointment, "start" | "end">,
  b: Pick<Appointment, "start" | "end">,
): boolean {
  return timeOf(a.start) < timeOf(b.end) && timeOf(b.start) < timeOf(a.end);
}

export function sorted(appointments: Appointment[]): Appointment[] {
  return [...appointments].sort((a, b) => timeOf(a.start) - timeOf(b.start));
}

/** Entries that would collide with `candidate`, ignoring `ignoreId` and cancelled ones. */
export function conflictsWith(
  candidate: Pick<Appointment, "start" | "end">,
  appointments: Appointment[],
  ignoreId?: string,
): Appointment[] {
  return appointments.filter(
    (item) =>
      item.status === "confirmed" &&
      item.id !== ignoreId &&
      overlaps(candidate, item),
  );
}
