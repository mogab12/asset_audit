// Testes das regras principais, sem navegador (espelha tests/test_regras.py).
// Rode com: node --test mobile/tests/logica.test.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";

// xlsx.full.min.js é UMD (pensado para <script> no navegador ou require() no
// Node CJS). Como este projeto usa "type": "module", executa o arquivo à mão
// num sandbox com um "module.exports" de mentira, igual o Node faria em CJS.
const codigoXlsx = readFileSync(new URL("../js/vendor/xlsx.full.min.js", import.meta.url), "utf8");
// "exports" precisa ser o mesmo objeto que "module.exports" (como o Node faz
// de verdade em CJS), senão a lib popula um dos dois e o outro fica vazio.
const exportsCompartilhado = {};
const sandboxXlsx = { module: { exports: exportsCompartilhado }, exports: exportsCompartilhado };
vm.createContext(sandboxXlsx);
vm.runInContext(codigoXlsx, sandboxXlsx);
globalThis.XLSX = sandboxXlsx.module.exports;

const { tagValida, compactar, gerarChave } = await import("../js/utils.js");
const mesclagem = await import("../js/mesclagem.js");
const planilha = await import("../js/planilha.js");

function item(campos = {}) {
  return {
    status: "Não conforme", modelo_anterior: "AGILIA", modelo: "AGILIA",
    tag_anterior: "BSER-0010", tag: "BSER-0010",
    ns_anterior: "25508676", ns: "25508676",
    patrimonio_anterior: "", patrimonio: "",
    setor_origem: "UNIDADE NEONATAL", setor_atual: "UNIDADE NEONATAL",
    equipamento: "BOMBA DE SERINGA AGILIA  TAG:BSER-0010",
    motivo: "Pendente", observacao: "", executante: "", data: "",
    ...campos,
  };
}

const AUDITADO_A = { motivo: "Conforme", status: "Conforme", executante: "ANA", data: "15/09/2026" };
const AUDITADO_B = { motivo: "Sem Plaqueta", executante: "BRUNO", data: "15/09/2026" };

test("TAGs válidas", () => {
  for (const tag of ["BINF1234", "BINF-1234", "CENT-0002", "binf1234", ""]) {
    assert.ok(tagValida(tag), tag);
  }
});

test("TAGs inválidas", () => {
  for (const tag of ["174-0001", "2-0001", "1234", "1234BINF", "BINF 1234", "BINF-", "BINF"]) {
    assert.ok(!tagValida(tag), tag);
  }
});

test("pesquisa ignora pontuação", () => {
  assert.equal(compactar("200.021348"), "200021348");
  assert.equal(compactar("Bomba de Infusão"), "BOMBADEINFUSAO");
});

test("mesclagem: ambos pendentes mantém", () => {
  assert.equal(mesclagem.decidir(item(), item()), mesclagem.MANTER);
});

test("mesclagem: novo auditado substitui pendente", () => {
  assert.equal(mesclagem.decidir(item(), item(AUDITADO_A)), mesclagem.SUBSTITUIR);
});

test("mesclagem: novo pendente não substitui auditado", () => {
  assert.equal(mesclagem.decidir(item(AUDITADO_A), item()), mesclagem.MANTER);
});

test("mesclagem: auditados iguais mesmo com auditor diferente", () => {
  const outro = item({ ...AUDITADO_A, executante: "CARLA" });
  assert.equal(mesclagem.decidir(item(AUDITADO_A), outro), mesclagem.MANTER);
});

test("mesclagem: auditados diferentes geram conflito", () => {
  assert.equal(mesclagem.decidir(item(AUDITADO_A), item(AUDITADO_B)), mesclagem.CONFLITO);
});

test("planilha: gerar e ler de volta (round-trip)", async () => {
  const itens = [item(AUDITADO_A), item({ tag_anterior: "X-1", tag: "X-1", chave: gerarChave({ tag_anterior: "X-1" }) })];
  const blob = planilha.gerar(itens);
  const bytes = await blob.arrayBuffer();
  const lidos = planilha.ler(bytes);
  assert.equal(lidos.length, 2);
  assert.equal(lidos[0].executante, "ANA");
});

test("planilha: arquivo que não é Excel lança ErroPlanilha", () => {
  assert.throws(() => planilha.ler(new Uint8Array([0, 1, 2, 3])), planilha.ErroPlanilha);
});

test("planilha: mesclagem normal preserva motivos que o app deriva sozinho", async () => {
  // Regressão: importar (mesclar) a planilha exportada por outro celular NÃO
  // pode voltar essas classificações para "Pendente" — se voltasse, a regra
  // de mesclagem descartaria a auditoria já feita (pendente perde para
  // qualquer coisa não pendente), e o total de auditados cairia depois de
  // importar, o que nunca deveria acontecer numa mesclagem.
  const itens = [
    item({ motivo: "Encontrado em outro local", status: "Conforme" }),
    item({ motivo: "Equipamento Antigo", tag: "X-2", chave: "NOVO|X-2" }),
    item({ motivo: "Novo Equipamento", tag: "X-3", chave: "NOVO|X-3" }),
    item(AUDITADO_A),
  ];
  const blob = planilha.gerar(itens);
  const bytes = await blob.arrayBuffer();
  const lidos = planilha.ler(bytes);
  assert.deepEqual(lidos.map((i) => i.motivo),
    ["Encontrado em outro local", "Equipamento Antigo", "Novo Equipamento", "Conforme"]);
});

test("planilha: revisarMotivos volta para Pendente (usado só na planilha de exemplo)", async () => {
  const itens = [
    item({ motivo: "Encontrado em outro local", status: "Conforme" }),
    item({ motivo: "Equipamento Antigo", tag: "X-2", chave: "NOVO|X-2" }),
    item({ motivo: "Novo Equipamento", tag: "X-3", chave: "NOVO|X-3" }),
    item(AUDITADO_A), // "Conforme" não deve ser mexido
  ];
  const blob = planilha.gerar(itens);
  const bytes = await blob.arrayBuffer();
  const lidos = planilha.ler(bytes, { revisarMotivos: true });
  assert.deepEqual(lidos.map((i) => i.motivo),
    ["Pendente", "Pendente", "Pendente", "Conforme"]);
  assert.equal(lidos[0].status, "Não conforme");
});

test("planilha: lê a base real de equipamentos do Effort (dados/Equipamentos.xlsx)", async () => {
  const bytes = readFileSync(new URL("../dados/Equipamentos.xlsx", import.meta.url));
  const linhas = planilha.lerReferenciaEffort(bytes);
  assert.ok(linhas.length > 0);
  const encontrado = linhas.find((l) => l.id_effort === "13567");
  assert.ok(encontrado, "ID 13567 deveria existir na base padrão");
  assert.equal(encontrado.tag, "ACIOB-0004");
  assert.equal(encontrado.setor, "UNIDADE DE ADULTOS");
});
