import { z } from "zod";

export const appointmentSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  start: z.string(),
  end: z.string(),
  location: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["confirmed", "cancelled"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const isoDateTime = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Use uma data/hora ISO, por exemplo 2026-11-20T15:00:00-03:00.",
  });
