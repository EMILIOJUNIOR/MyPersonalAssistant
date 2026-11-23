import path from "node:path";

import { createMutex, readTextIfExists, writeTextAtomic } from "./fs-utils";

const MAX_ENTRY_CHARS = 2_000;
const MAX_ENTRIES = 200;

/** Local notes file. Override with LUMIA_MEMORY_FILE; it will move into the database later. */
export function memoryFile(): string {
  return (
    process.env.LUMIA_MEMORY_FILE ??
    path.resolve(process.cwd(), "data", "memoria.md")
  );
}

const enqueue = createMutex();

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function entryOf(line: string): string {
  return normalize(line.replace(/^\s*[-*]\s*/, ""));
}

function linesOf(raw: string): string[] {
  return raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
}

/** Whole document, or null when there is nothing to remember yet. */
export async function readMemory(): Promise<string | null> {
  const raw = await readTextIfExists(memoryFile());
  if (raw === null) return null;
  const content = raw.trim();
  return content.length > 0 ? content : null;
}

export interface RememberResult {
  added: boolean;
  total: number;
}

/** Appends one bullet. Identical entries are ignored, so repeats don't pile up. */
export async function remember(text: string): Promise<RememberResult> {
  const entry = normalize(text);
  if (entry.length < 3) {
    throw new Error("A nota está vazia ou curta demais para ser lembrada.");
  }
  if (entry.length > MAX_ENTRY_CHARS) {
    throw new Error(
      `A nota tem ${entry.length} caracteres; o limite é ${MAX_ENTRY_CHARS}. Resuma em uma frase.`,
    );
  }

  return enqueue(async () => {
    const raw = (await readTextIfExists(memoryFile())) ?? "";
    const lines = linesOf(raw);

    if (lines.some((line) => entryOf(line).toLowerCase() === entry.toLowerCase())) {
      return { added: false, total: lines.length };
    }
    if (lines.length >= MAX_ENTRIES) {
      throw new Error(
        `A memória já tem ${lines.length} notas. Use forget para remover o que não vale mais antes de lembrar de algo novo.`,
      );
    }

    lines.push(`- ${entry}`);
    await writeTextAtomic(memoryFile(), `${lines.join("\n")}\n`);
    return { added: true, total: lines.length };
  });
}

export interface ForgetResult {
  removed: number;
  total: number;
}

/** Removes every entry containing the text (case-insensitive). */
export async function forget(text: string): Promise<ForgetResult> {
  const needle = normalize(text).toLowerCase();
  if (needle.length < 3) {
    throw new Error("Diga um trecho da nota que devo esquecer.");
  }

  return enqueue(async () => {
    const raw = await readTextIfExists(memoryFile());
    if (raw === null) {
      throw new Error("A memória está vazia; não há nada para esquecer.");
    }

    const lines = linesOf(raw);
    const kept = lines.filter((line) => !entryOf(line).toLowerCase().includes(needle));
    const removed = lines.length - kept.length;

    if (removed === 0) {
      throw new Error(`Não encontrei nenhuma nota com "${text}".`);
    }

    await writeTextAtomic(memoryFile(), kept.length > 0 ? `${kept.join("\n")}\n` : "");
    return { removed, total: kept.length };
  });
}
