import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";
import type { ToolStub } from "eve/evals";

const readFile: ToolStub = {
  id: "arquivo",
  tool: "read_project_file",
  outcome: {
    response: {
      path: "Crm/README.md",
      root: "C:/workspace",
      bytes: 96,
      totalLines: 4,
      startLine: 1,
      endLine: 4,
      truncated: false,
      content: "# CRM\n\nSistema de vendas e cadastro de clientes.",
    },
  },
};

export default defineEval({
  description:
    "Para perguntas sobre um projeto, lê o arquivo pedido pelo caminho certo em vez de responder de memória.",
  tags: ["projetos", "fast"],
  async test(t) {
    const session = await t.session({ stubs: [readFile] });

    const turn = await session.send("Leia o arquivo Crm/README.md e me diga o título.");

    turn.expectOk();
    t.calledTool("read_project_file", { input: { path: "Crm/README.md" }, count: 1 });
    t.check(turn.reply, includes(/CRM/));
  },
});
