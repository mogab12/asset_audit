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
