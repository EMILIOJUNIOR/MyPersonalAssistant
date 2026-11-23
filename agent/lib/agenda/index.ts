import { createJsonAgendaRepository } from "./json-repository";
import type { AgendaRepository } from "./repository";

export * from "./errors";
export * from "./repository";
export * from "./types";

let singleton: AgendaRepository | null = null;

/**
 * Resolves the agenda driver.
 *
 * Today only "json" exists. When the database arrives, implement `AgendaRepository` in a new
 * file and add its case here (and in `LUMIA_STORAGE`); no tool needs to change.
 */
export function agenda(): AgendaRepository {
  if (singleton) return singleton;

  const driver = process.env.LUMIA_STORAGE?.trim().toLowerCase() || "json";
  switch (driver) {
    case "json":
      singleton = createJsonAgendaRepository();
      break;
    default:
      throw new Error(
        `LUMIA_STORAGE=${driver} ainda não tem driver. Use "json" até o driver de banco existir.`,
      );
  }

  return singleton;
}

/** Replaces the driver, for evals and future database wiring. */
export function setAgendaRepository(repository: AgendaRepository | null): void {
  singleton = repository;
}
