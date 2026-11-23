export const TIMEZONE = "America/Sao_Paulo";

const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseInstant(value: string, field = "data"): Date {
  if (!INSTANT_PATTERN.test(value)) {
    throw new Error(
      `${field} deve ser ISO 8601 com fuso, por exemplo 2026-11-20T13:00:00.000Z.`,
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} inválida.`);
  }

  return date;
}

export function normalizeInstant(value: string, field = "data"): string {
  return parseInstant(value, field).toISOString();
}

export function localLabel(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: TIMEZONE,
  }).format(parseInstant(iso, "data"));
}

export function localDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIMEZONE,
  }).format(parseInstant(iso, "data"));
}

export function localTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  }).format(parseInstant(iso, "data"));
}

export function localDayLabel(dateKey: string): string {
  const { year, month, day } = assertDateKey(dateKey);
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12));

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: TIMEZONE,
  }).format(noonUtc);
}

function assertDateKey(dateKey: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = DATE_PATTERN.exec(dateKey);

  if (!match) {
    throw new Error("Data deve estar no formato YYYY-MM-DD.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new Error(`Data inválida: ${dateKey}.`);
  }

  return { year, month, day };
}

function timeZoneOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour) % 24,
    Number(values.minute),
    Number(values.second),
  );

  return asUtc - date.getTime();
}

export function localDateTimeToUtc(dateKey: string, time = "09:00"): string {
  const { year, month, day } = assertDateKey(dateKey);
  const match = TIME_PATTERN.exec(time);

  if (!match) {
    throw new Error("Hora deve estar no formato HH:mm.");
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    throw new Error(`Hora inválida: ${time}.`);
  }

  const naive = Date.UTC(year, month - 1, day, hours, minutes);
  const firstOffset = timeZoneOffsetMs(new Date(naive));
  const candidate = new Date(naive - firstOffset);
  const secondOffset = timeZoneOffsetMs(candidate);

  return new Date(naive - secondOffset).toISOString();
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const { year, month, day } = assertDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

export function localDayRangeUtc(
  fromDateKey: string,
  toDateKey: string,
): { start: string; endExclusive: string } {
  const start = localDateTimeToUtc(fromDateKey, "00:00");
  const endExclusive = localDateTimeToUtc(
    addDaysToDateKey(toDateKey, 1),
    "00:00",
  );

  if (start >= endExclusive) {
    throw new Error("Período inválido: 'from' deve ser anterior a 'to'.");
  }

  return { start, endExclusive };
}

export function isPast(iso: string, now = new Date()): boolean {
  return parseInstant(iso).getTime() < now.getTime();
}
