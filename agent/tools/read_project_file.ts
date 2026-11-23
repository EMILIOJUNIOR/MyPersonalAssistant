import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { defineTool } from "eve/tools";
import { z } from "zod";

const MAX_FILE_BYTES = 1_000_000;
const DEFAULT_LINES = 400;
const MAX_LINES = 2_000;

/**
 * Tool modules run in the app runtime, so this reads the real workspace on the machine.
 * The built-in sandbox file tools see an empty virtual filesystem and are disabled in
 * `agent/agent.ts`.
 */
const BLOCKED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".eve",
  ".next",
  ".output",
  ".vercel",
  ".turbo",
  ".cache",
  "dist",
  "build",
]);

const BLOCKED_FILES = [
  /^\.env(\..*)?$/i,
  /^\.npmrc$/i,
  /^\.netrc$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /^credentials(\.json)?$/i,
  /\.(pem|key|pfx|p12|jks|keystore)$/i,
];

function workspaceRoot(): string {
  return process.env.MYPROJECT_ROOT ?? path.resolve(process.cwd(), "..");
}

interface Target {
  root: string;
  absolute: string;
  relative: string;
}

function resolveTarget(input: string): Target {
  const root = workspaceRoot();
  const absolute = path.resolve(root, input);
  const relative = path.relative(root, absolute);

  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `O caminho "${input}" fica fora do workspace (${root}). Informe um caminho relativo a essa pasta.`,
    );
  }

  const segments = relative.split(/[\\/]+/).filter(Boolean);
  const blockedDirectory = segments
    .slice(0, -1)
    .find((segment) => BLOCKED_DIRECTORIES.has(segment.toLowerCase()));
  if (blockedDirectory) {
    throw new Error(`Não leio arquivos dentro de ${blockedDirectory}/.`);
  }

  const name = segments[segments.length - 1]!;
  if (BLOCKED_FILES.some((pattern) => pattern.test(name))) {
    throw new Error(`Não abro ${name}: o arquivo pode conter segredos.`);
  }

  return { root, absolute, relative: segments.join("/") };
}

export default defineTool({
  description:
    "Lê um arquivo de texto de um dos projetos do workspace (a pasta que contém MyProject). Use caminhos relativos a essa pasta, como 'Crm/src/server.ts' ou 'VendasBonus/package.json'. Aceita offset e limit em linhas para arquivos grandes. Não abre .env, chaves, credenciais, node_modules nem .git.",
  inputSchema: z.object({
    path: z
      .string()
      .min(1)
      .describe("Caminho relativo à pasta do workspace, com barras normais, ex.: 'Crm/README.md'."),
    offset: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Primeira linha a devolver, começando em 1."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_LINES)
      .default(DEFAULT_LINES)
      .describe("Quantidade máxima de linhas devolvidas."),
  }),
  outputSchema: z.object({
    path: z.string(),
    root: z.string(),
    bytes: z.number().int(),
    totalLines: z.number().int(),
    startLine: z.number().int(),
    endLine: z.number().int(),
    truncated: z.boolean(),
    content: z.string(),
  }),
  label: {
    start: ({ path: target }) => `Lendo ${target}`,
    complete: (_input, output) =>
      output.truncated
        ? `${output.path} (linhas ${output.startLine}-${output.endLine} de ${output.totalLines})`
        : output.path,
  },
  async execute({ path: target, offset, limit }) {
    const resolved = resolveTarget(target);
    const realRoot = await realpath(resolved.root).catch(() => null);
    const realAbsolute = await realpath(resolved.absolute).catch(() => null);

    if (!realRoot || !realAbsolute) {
      throw new Error(`Não encontrei ${resolved.relative} em ${resolved.root}.`);
    }

    const realRelative = path.relative(realRoot, realAbsolute);
    if (realRelative === "" || realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      throw new Error(`O caminho "${target}" aponta para fora do workspace.`);
    }

    const info = await stat(realAbsolute).catch(() => null);

    if (!info) {
      throw new Error(`Não encontrei ${resolved.relative} em ${resolved.root}.`);
    }
    if (info.isDirectory()) {
      throw new Error(`"${resolved.relative}" é uma pasta; informe um arquivo.`);
    }
    if (!info.isFile()) {
      throw new Error(`"${resolved.relative}" não é um arquivo comum.`);
    }
    if (info.size > MAX_FILE_BYTES) {
      throw new Error(
        `"${resolved.relative}" tem ${info.size} bytes; o limite é ${MAX_FILE_BYTES}. Peça um trecho de outro jeito.`,
      );
    }

    const buffer = await readFile(realAbsolute);
    if (buffer.includes(0)) {
      throw new Error(`"${resolved.relative}" parece ser binário; não consigo ler como texto.`);
    }

    const lines = buffer.toString("utf8").split(/\r?\n/);
    const startLine = offset ?? 1;
    const start = Math.min(startLine, lines.length + 1) - 1;
    const end = Math.min(start + limit, lines.length);

    return {
      path: resolved.relative,
      root: resolved.root,
      bytes: info.size,
      totalLines: lines.length,
      startLine: start + 1,
      endLine: end,
      truncated: end < lines.length,
      content: lines.slice(start, end).join("\n"),
    };
  },
});
