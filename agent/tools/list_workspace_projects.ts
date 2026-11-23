import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { defineTool } from "eve/tools";
import { z } from "zod";

const projectSchema = z.object({
  name: z.string(),
  path: z.string(),
  packageName: z.string().optional(),
  scripts: z.array(z.string()).optional(),
  readmeTitle: z.string().optional(),
  isGitRepo: z.boolean(),
  lastModified: z.string(),
});

function resolveWorkspaceRoot(): string {
  return process.env.MYPROJECT_ROOT ?? path.resolve(process.cwd(), "..");
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

async function describeProject(name: string, directory: string) {
  const details: Partial<z.infer<typeof projectSchema>> = {
    name,
    path: directory,
    isGitRepo: await isDirectory(path.join(directory, ".git")),
    lastModified: (await stat(directory)).mtime.toISOString(),
  };

  try {
    const manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
    if (typeof manifest.name === "string") details.packageName = manifest.name;
    const scripts = Object.keys(manifest.scripts ?? {});
    if (scripts.length > 0) details.scripts = scripts;
  } catch {
    // Projetos sem package.json continuam sendo listados.
  }

  try {
    const readme = await readFile(path.join(directory, "README.md"), "utf8");
    const title = readme
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith("#") || line.length > 0);
    if (title) details.readmeTitle = title.replace(/^#+\s*/, "").slice(0, 160);
  } catch {
    // README é opcional.
  }

  return details as z.infer<typeof projectSchema>;
}

export default defineTool({
  description:
    "Lista projetos de código do workspace no filesystem, mostrando package name, scripts, README, Git e última alteração. Use para inspecionar projetos reais da máquina; para projetos pessoais persistidos, use list_projects.",
  inputSchema: z.object({
    query: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  outputSchema: z.object({
    root: z.string(),
    count: z.number().int(),
    projects: z.array(projectSchema),
  }),
  label: {
    start: () => "Listando projetos do workspace",
    complete: (_input, output) => `${output.count} projeto(s) do workspace`,
  },
  async execute({ query, limit }) {
    const root = resolveWorkspaceRoot();
    let entries;

    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      throw new Error(
        `A pasta ${root} não pôde ser lida. Configure MYPROJECT_ROOT para a pasta que contém os projetos.`,
      );
    }

    const names = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith(".") && name !== "node_modules")
      .filter((name) => (query ? name.toLowerCase().includes(query.toLowerCase()) : true))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, limit);

    const projects = await Promise.all(
      names.map((name) => describeProject(name, path.join(root, name))),
    );

    return { root, count: projects.length, projects };
  },
});
