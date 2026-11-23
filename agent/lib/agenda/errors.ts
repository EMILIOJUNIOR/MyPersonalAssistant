import type { Appointment } from "./types";

/**
 * Domain errors. Tools surface their messages to the model, so they stay in Portuguese and
 * explain the next step. A database driver can throw the same errors without touching a tool.
 */
export class AgendaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgendaError";
  }
}

/** The stored data can't be read. Never overwrite it: it may be the user's only copy. */
export class AgendaCorruptedError extends AgendaError {
  constructor(readonly file: string) {
    super(
      `O arquivo de compromissos ${file} está corrompido ou em formato desconhecido; não vou sobrescrevê-lo.`,
    );
    this.name = "AgendaCorruptedError";
  }
}

export class AgendaNotFoundError extends AgendaError {
  constructor(readonly id: string) {
    super(`Não encontrei o compromisso ${id}. Use list_appointments para achar o id.`);
    this.name = "AgendaNotFoundError";
  }
}

export class AgendaAlreadyCancelledError extends AgendaError {
  constructor(readonly id: string) {
    super(`O compromisso ${id} já está cancelado.`);
    this.name = "AgendaAlreadyCancelledError";
  }
}

export class AgendaInvalidRangeError extends AgendaError {
  constructor(message = "O fim do compromisso precisa ser depois do início.") {
    super(message);
    this.name = "AgendaInvalidRangeError";
  }
}

export class AgendaConflictError extends AgendaError {
  constructor(readonly conflicts: Appointment[]) {
    const list = conflicts
      .map((item) => `${item.title} (${item.start} → ${item.end})`)
      .join("; ");
    super(`Conflito de horário com: ${list}. Pergunte ao usuário se deseja manter assim.`);
    this.name = "AgendaConflictError";
  }
}
