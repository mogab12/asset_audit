// Funções pequenas e reutilizáveis (port de app/utils.py).
import { PADRAO_TAG } from "./config.js";

export function texto(valor) {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) {
    const dia = String(valor.getDate()).padStart(2, "0");
    const mes = String(valor.getMonth() + 1).padStart(2, "0");
    return `${dia}/${mes}/${valor.getFullYear()}`;
  }
  return String(valor).trim();
}

export function semAcentos(valor) {
  return texto(valor).normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

// 'Bomba de Infusão BINF-0321' -> 'BOMBADEINFUSAOBINF0321'
export function compactar(valor) {
  return semAcentos(valor).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function termosPesquisa(consulta) {
  return semAcentos(consulta)
    .split(/\s+/)
    .map((p) => compactar(p))
    .filter(Boolean);
}

// Siglas/abreviações comuns de setores hospitalares, para a busca de setores
// encontrar tanto a sigla quanto o nome por extenso (e vice-versa).
const SINONIMOS_SETOR = [
  ["CME", "CENTRAL DE MATERIAL E ESTERILIZACAO"],
  ["UTI", "CTI", "UNIDADE DE TERAPIA INTENSIVA", "CENTRO DE TERAPIA INTENSIVA"],
  ["PS", "PRONTO SOCORRO", "EMERGENCIA"],
  ["PA", "PRONTO ATENDIMENTO"],
  ["CC", "CENTRO CIRURGICO"],
  ["CO", "CENTRO OBSTETRICO"],
  ["UBS", "UNIDADE BASICA DE SAUDE"],
  ["RX", "RAIO X", "RADIOLOGIA", "DIAGNOSTICO POR IMAGEM"],
  ["NEO", "NEONATOLOGIA", "UTI NEONATAL"],
  ["PED", "PEDIATRIA"],
  ["MAT", "MATERNIDADE", "OBSTETRICIA"],
  ["AMB", "AMBULATORIO"],
  ["FARM", "FARMACIA"],
  ["LAB", "LABORATORIO"],
  ["UI", "UNIDADE DE INTERNACAO", "INTERNACAO"],
  ["ENF", "ENFERMARIA"],
].map((grupo) => grupo.map(compactar));

// Para uma palavra digitada, retorna as formas equivalentes (sigla e nome por
// extenso) já compactadas, incluindo a própria palavra.
function formasEquivalentes(palavraCompactada) {
  const formas = new Set([palavraCompactada]);
  for (const grupo of SINONIMOS_SETOR) {
    const igual = grupo.includes(palavraCompactada);
    const parcial = palavraCompactada.length >= 4 &&
      grupo.some((f) => f.includes(palavraCompactada) || palavraCompactada.includes(f));
    if (igual || parcial) grupo.forEach((f) => formas.add(f));
  }
  return [...formas];
}

// Pesquisa de setores: cada palavra digitada deve casar com o nome do setor,
// direto ou por uma sigla/forma por extenso equivalente (ex.: "CME" encontra
// "Central de Material e Esterilização", "unidade" encontra "UTI", "PS"
// encontra "Pronto Socorro").
export function setorCorresponde(nomeSetor, consulta) {
  const palavras = termosPesquisa(consulta);
  if (!palavras.length) return false;
  const alvo = compactar(nomeSetor);
  return palavras.every((palavra) => formasEquivalentes(palavra).some((forma) => alvo.includes(forma)));
}

export function tagValida(tag) {
  tag = texto(tag).toUpperCase();
  return !tag || PADRAO_TAG.test(tag);
}

export function hoje() {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getFullYear()}`;
}

// Remove o sufixo 'TAG:... NS:... PA:...' que o Effort coloca no nome.
export function nomeCurto(equipamento) {
  return texto(equipamento).split(/\s+TAG:/)[0].trim();
}

const ENTIDADES_HTML = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// Escapa texto antes de inserir em HTML (evita XSS vindo de dados de planilha).
export function escapeHtml(valor) {
  return texto(valor).replace(/[&<>"']/g, (c) => ENTIDADES_HTML[c]);
}

// Identificador único de um equipamento, estável entre planilhas.
export function gerarChave(item) {
  const up = (campo) => texto(item[campo]).toUpperCase();
  let partes;
  if (up("tag_anterior") || up("ns_anterior") || up("patrimonio_anterior")) {
    partes = ["CAD", up("tag_anterior"), up("ns_anterior"),
              up("patrimonio_anterior"), up("modelo_anterior"), up("setor_origem")];
  } else {
    partes = ["NOVO", up("tag"), up("ns"), up("patrimonio"), up("equipamento")];
  }
  return partes.join("|");
}
