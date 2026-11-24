/**
 * Shared fixtures for Evals.
 *
 * Every agenda eval stubs the tools, so a run never touches data/compromissos.json and the
 * results don't depend on the real calendar. Dates are fixed: Monday, 2026-11-23, 12:00 UTC,
 * which is 09:00 in Brasília (UTC-03:00).
 */
import type {
  EveEvalInteractionMatchOptions,
  EveEvalSession,
  ToolStub,
} from "eve/evals";

/** Shape mirrors the appointment tool schema used by the Turso-backed agenda. */
export type FixtureAppointment = {
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

export type FixtureProject = {
  name: string;
  path: string;
  isGitRepo: boolean;
  lastModified: string;
  packageName?: string;
  scripts?: string[];
  readmeTitle?: string;
};

const CREATED_AT = "2026-11-20T12:00:00.000Z";

export function appointment(overrides: Partial<FixtureAppointment> = {}): FixtureAppointment {
  return {
    id: "appt_1a2b3c4d",
    title: "Dentista",
    start: "2026-11-27T15:00:00-03:00",
    end: "2026-11-27T16:00:00-03:00",
    status: "confirmed",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

export const dentista = appointment();

export const reuniao = appointment({
  id: "appt_reuniao",
  title: "Reunião com o time",
  start: "2026-11-24T10:00:00-03:00",
  end: "2026-11-24T11:00:00-03:00",
  location: "Sala 3",
});

export const currentDateTime: ToolStub = {
  id: "agora",
  tool: "get_current_datetime",
  outcome: {
    response: {
      isoUtc: "2026-11-23T12:00:00.000Z",
      timezone: "America/Sao_Paulo",
      local: "segunda-feira, 23 de novembro de 2026 às 09:00",
      weekday: "segunda-feira",
    },
  },
};

export const localDateTimeToUtc: ToolStub = {
  id: "conversao-data",
  tool: "local_datetime_to_utc",
  outcome: {
    response: { utc: "2026-11-27T18:00:00.000Z" },
  },
};

export const agendaDbVazia: ToolStub = {
  id: "agenda-db-vazia",
  tool: "get_agenda",
  outcome: {
    response: {
      from: "2026-11-23",
      to: "2026-11-30",
      start_utc: "2026-11-23T03:00:00.000Z",
      end_utc: "2026-12-01T03:00:00.000Z",
      days: [],
      count: 0,
    },
  },
};

export const agendaDbHoje: ToolStub = {
  id: "agenda-db-hoje",
  tool: "get_agenda",
  outcome: {
    response: {
      from: "2026-11-23",
      to: "2026-11-23",
      start_utc: "2026-11-23T03:00:00.000Z",
      end_utc: "2026-11-24T03:00:00.000Z",
      days: [
        {
          date: "2026-11-23",
          label: "segunda-feira, 23 de novembro",
          tasks: [
            { title: "Dentista" },
            { title: "Almoço com Ana" },
          ],
        },
      ],
      count: 2,
    },
  },
};

export const createdTask: ToolStub = {
  id: "tarefa-criada",
  tool: "create_task",
  outcome: {
    response: {
      id: "00000000-0000-4000-8000-000000000001",
      title: "Dentista",
      status: "open",
      priority: "normal",
      due_at: "2026-11-27T18:00:00.000Z",
      project_id: null,
      created_at: CREATED_AT,
    },
  },
};

export function agendaStub(
  items: readonly FixtureAppointment[],
  id = "agenda",
): ToolStub {
  return {
    id,
    tool: "list_appointments",
    outcome: {
      response: { count: items.length, storage: "fixture", appointments: [...items] },
    },
  };
}

export const agendaVazia: ToolStub = agendaStub([], "agenda-vazia");

export function createdStub(value: FixtureAppointment): ToolStub {
  return {
    id: "criado",
    tool: "add_appointment",
    outcome: { response: { appointment: value } },
  };
}

export function updatedStub(value: FixtureAppointment): ToolStub {
  return {
    id: "alterado",
    tool: "update_appointment",
    outcome: { response: { appointment: value } },
  };
}

export function cancelledStub(value: FixtureAppointment): ToolStub {
  return {
    id: "cancelado",
    tool: "cancel_appointment",
    outcome: { response: { appointment: value } },
  };
}

export const conflictStub: ToolStub = {
  id: "conflito",
  tool: "add_appointment",
  outcome: {
    throw: {
      message:
        "Conflito de horário com: Reunião com o time (2026-11-24T10:00:00-03:00 → 2026-11-24T11:00:00-03:00). Pergunte ao usuário se deseja manter assim.",
    },
  },
};

export const remembered: ToolStub = {
  id: "lembrado",
  tool: "remember",
  outcome: { response: { added: true, total: 4 } },
};

/**
 * Waits for the parked approval of `toolName`, asserts the requested input when given, and
 * approves it. Returns the resumed turn.
 */
export async function approve(
  session: EveEvalSession,
  toolName: string,
  input?: EveEvalInteractionMatchOptions["input"],
) {
  session.requireInteraction({ kind: "approval", toolName, ...(input ? { input } : {}) });
  return session.respondAll("approve");
}
