import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";
import type { ToolStub } from "eve/evals";

import type { FixtureProject } from "../fixtures/agenda";

const projects: FixtureProject[] = [
  {
    name: "Crm",
    path: "C:/workspace/Crm",
    isGitRepo: true,
    lastModified: "2026-11-20T18:00:00.000Z",
    packageName: "crm",
    scripts: ["dev", "build"],
    readmeTitle: "CRM de vendas",
  },
  {
    name: "VendasBonus",
    path: "C:/workspace/VendasBonus",
    isGitRepo: true,
    lastModified: "2026-11-18T12:00:00.000Z",
    packageName: "vendas-bonus",
    scripts: ["start"],
    readmeTitle: "Cálculo de bônus de vendas",
  },
];

const listProjects: ToolStub = {
  id: "projetos",
  tool: "list_workspace_projects",
  outcome: {
    response: { root: "C:/workspace", count: projects.length, projects },
  },
};

export default defineEval({
    description: "Lista os projetos do workspace usando list_workspace_projects e cita os nomes reais.",
  tags: ["projetos", "fast"],
  async test(t) {
    const session = await t.session({ stubs: [listProjects] });

    const turn = await session.send("Quais projetos eu tenho no workspace?");

    turn.expectOk();
    t.calledTool("list_workspace_projects", { count: 1 });
    t.check(turn.reply, includes(/Crm/));
    t.check(turn.reply, includes(/VendasBonus/));
  },
});
