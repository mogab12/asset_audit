// Leitura e gravação de planilhas no formato exportado pelo Effort
// (port de app/planilha.py, usando SheetJS no lugar do openpyxl/xlrd).
import * as config from "./config.js";
import { semAcentos, texto } from "./utils.js";

// globalThis (não window) para o mesmo módulo funcionar tanto no navegador
// quanto nos testes em Node (mobile/tests/logica.test.mjs).
const XLSX = globalThis.XLSX;

export class ErroPlanilha extends Error {}

function normalizarTitulo(titulo) {
  return semAcentos(titulo).toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

function mapaTituloParaCampo(colunas) {
  const mapa = new Map();
  for (const [campo, titulo] of Object.entries(colunas)) {
    mapa.set(normalizarTitulo(titulo), campo);
  }
  return mapa;
}

const TITULO_PARA_CAMPO = mapaTituloParaCampo(config.COLUNAS);
const TITULO_PARA_CAMPO_EFFORT = mapaTituloParaCampo(config.COLUNAS_REFERENCIA_EFFORT);

// Classificações que o próprio app deriva sozinho durante a auditoria
// (comparando setor de origem/atual). A planilha de exemplo carregada na
// primeira abertura do app (dados_padrao/Auditoria.xlsx) não tem garantia de
// que essas classificações ainda estejam corretas, então elas voltam para
// "Pendente" nesse caso — ver `revisarMotivos` em `ler()`.
//
// Isso NÃO deve ser aplicado ao mesclar planilhas exportadas por este próprio
// aplicativo (fluxo normal entre auditores): esses valores já são o resultado
// de uma auditoria real feita em outro celular e devem ser respeitados; do
// contrário a mesclagem os transforma em "Pendente" e a regra de mesclagem
// (um pendente e outro não pendente -> fica o não pendente) descarta o
// trabalho já feito, fazendo o total de equipamentos auditados CAIR depois
// de importar uma planilha — que é exatamente o oposto do esperado.
const MOTIVOS_A_REVISAR_NA_IMPORTACAO = new Set([
  config.MOTIVO_OUTRO_LOCAL,
  ...Object.keys(config.OUTROS_MOTIVOS),
]);

function revisarMotivoImportado(item) {
  if (MOTIVOS_A_REVISAR_NA_IMPORTACAO.has(item.motivo)) {
    item.motivo = config.MOTIVO_PENDENTE;
    item.status = config.STATUS_NAO_CONFORME;
  }
  return item;
}

// Recebe os bytes do arquivo (ArrayBuffer/Uint8Array) e devolve a primeira
// aba como uma lista de linhas (cada linha uma lista de valores).
function linhasDaPrimeiraAba(bytes) {
  const dados = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let livro;
  try {
    livro = XLSX.read(dados, { type: "array", cellDates: true });
  } catch (erro) {
    throw new ErroPlanilha("O arquivo não parece ser uma planilha do Excel.");
  }
  const nomeAba = livro.SheetNames[0];
  if (!nomeAba) throw new ErroPlanilha("A planilha está vazia.");
  const aba = livro.Sheets[nomeAba];
  return XLSX.utils.sheet_to_json(aba, { header: 1, raw: false, defval: "" });
}

function lerComMapa(bytes, mapaTitulos) {
  const linhas = linhasDaPrimeiraAba(bytes);
  if (!linhas.length) throw new ErroPlanilha("A planilha está vazia.");

  const [cabecalho, ...resto] = linhas;
  const mapa = new Map(); // índice da coluna -> campo interno
  cabecalho.forEach((titulo, indice) => {
    const campo = mapaTitulos.get(normalizarTitulo(titulo));
    if (campo) mapa.set(indice, campo);
  });

  return { mapa, linhas: resto };
}

// Recebe os bytes do arquivo e devolve uma lista de objetos.
// `revisarMotivos`: true só para a planilha de exemplo (garantirAuditoriaInicial).
// Ao mesclar planilhas de auditores (uso normal), deixe false para não perder
// auditorias já feitas em outro celular — ver MOTIVOS_A_REVISAR_NA_IMPORTACAO acima.
export function ler(bytes, { revisarMotivos = false } = {}) {
  const { mapa, linhas } = lerComMapa(bytes, TITULO_PARA_CAMPO);
  const camposEncontrados = new Set(mapa.values());
  if (!camposEncontrados.has("equipamento") ||
      !(camposEncontrados.has("setor_origem") || camposEncontrados.has("setor_atual"))) {
    throw new ErroPlanilha(
      "Colunas obrigatórias não encontradas. A planilha precisa ter " +
      "pelo menos 'Equipamento' e 'Setor Origem' ou 'Setor Atual'.");
  }

  const itens = [];
  for (const linha of linhas) {
    const item = {};
    for (const [indice, campo] of mapa) item[campo] = texto(linha[indice]);
    if (Object.values(item).some(Boolean)) {
      itens.push(revisarMotivos ? revisarMotivoImportado(item) : item);
    }
  }
  return itens;
}

// Lê a planilha bruta de equipamentos exportada do Effort (ID, TAG, Setor...).
// É um formato bem mais largo; só as colunas de config.COLUNAS_REFERENCIA_EFFORT
// são aproveitadas, o resto é ignorado.
export function lerReferenciaEffort(bytes) {
  const { mapa, linhas } = lerComMapa(bytes, TITULO_PARA_CAMPO_EFFORT);
  if (![...mapa.values()].includes("id_effort")) {
    throw new ErroPlanilha("Coluna 'ID' não encontrada na planilha de equipamentos.");
  }

  const itens = [];
  for (const linha of linhas) {
    const item = {};
    for (const [indice, campo] of mapa) item[campo] = texto(linha[indice]);
    if (item.id_effort) itens.push(item);
  }
  return itens;
}

// Gera um .xlsx com as mesmas colunas da importação. Devolve um Blob.
export function gerar(itens) {
  const campos = Object.keys(config.COLUNAS);
  const linhas = [campos.map((c) => config.COLUNAS[c])];
  for (const item of itens) {
    linhas.push(campos.map((c) => texto(item[c]) || ""));
  }

  const aba = XLSX.utils.aoa_to_sheet(linhas);
  const larguras = { equipamento: 60, observacao: 35, setor_origem: 28,
    setor_atual: 28, executante: 30, motivo: 26 };
  aba["!cols"] = campos.map((c) => ({ wch: larguras[c] || 18 }));

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, aba, config.NOME_ABA_EXPORTACAO);
  const saida = XLSX.write(livro, { type: "array", bookType: "xlsx" });
  return new Blob([saida], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
