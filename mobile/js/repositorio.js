// Todas as "consultas" ficam aqui (port de app/repositorio.py). Em vez de SQL,
// mantém um cache em memória (carregado do IndexedDB na inicialização) e
// persiste cada mutação de volta no IndexedDB antes de resolver a promise.
import * as db from "./db.js";
import * as config from "./config.js";
import { compactar, gerarChave, tagValida, texto } from "./utils.js";

export const CAMPOS = Object.keys(config.COLUNAS);
export const CAMPOS_REFERENCIA_EFFORT = Object.keys(config.COLUNAS_REFERENCIA_EFFORT);
const CAMPOS_BUSCA = ["tag", "tag_anterior", "ns", "ns_anterior", "patrimonio",
  "patrimonio_anterior", "equipamento", "modelo"];

// --- Estado em memória --------------------------------------------------
let _equipamentos = [];
let _referenciaEffort = new Map(); // id_effort -> registro
let _conflitos = [];
let _preferencias = new Map();
let _proximoIdConflito = 1;

export async function inicializar() {
  _equipamentos = await db.getAll("equipamentos");
  const referencias = await db.getAll("referencia_effort");
  _referenciaEffort = new Map(referencias.map((r) => [r.id_effort, r]));
  _conflitos = await db.getAll("conflitos");
  _proximoIdConflito = 1 + _conflitos.reduce((max, c) => Math.max(max, c.id), 0);
  const preferencias = await db.getAll("preferencias");
  _preferencias = new Map(preferencias.map((p) => [p.nome, p.valor]));
}

export function ehPendente(item) {
  const motivo = texto(item.motivo);
  return motivo === "" || motivo === config.MOTIVO_PENDENTE;
}

// Limpa os campos e calcula os campos auxiliares (chave, setor, busca).
export function preparar(item) {
  const limpo = {};
  for (const campo of CAMPOS) limpo[campo] = texto(item[campo]);
  limpo.tag = limpo.tag.toUpperCase();
  if (!limpo.motivo) limpo.motivo = config.MOTIVO_PENDENTE;
  limpo.chave = item.chave || gerarChave(limpo);
  limpo.setor_grupo = limpo.setor_origem || limpo.setor_atual || "SEM SETOR";
  limpo.busca = CAMPOS_BUSCA.map((c) => compactar(limpo[c])).join("|");
  limpo.id_effort = texto(item.id_effort || "");
  return limpo;
}

function comFlags(item) {
  if (!item) return null;
  return { ...item, pendente: ehPendente(item), tag_ok: tagValida(item.tag) };
}

// --- Equipamentos --------------------------------------------------------

export function porId(itemId) {
  return comFlags(_equipamentos.find((i) => i.id === itemId) || null);
}

export function porChave(chave) {
  return comFlags(_equipamentos.find((i) => i.chave === chave) || null);
}

// Item já linkado a esse ID do Effort (leituras anteriores do mesmo QR code).
export function porIdEffort(idEffort) {
  idEffort = String(idEffort);
  return comFlags(_equipamentos.find((i) => i.id_effort === idEffort) || null);
}

// Primeira correspondência exata de TAG (atual ou anterior), para linkar um ID novo.
export function porTag(tag) {
  tag = tag.toUpperCase();
  return comFlags(_equipamentos.find((i) => i.tag === tag || i.tag_anterior === tag) || null);
}

export async function definirIdEffort(itemId, idEffort) {
  const item = _equipamentos.find((i) => i.id === itemId);
  if (!item) return;
  item.id_effort = String(idEffort);
  await db.put("equipamentos", item);
}

export async function inserir(itemBruto) {
  const item = preparar(itemBruto);
  const idGerado = await db.put("equipamentos", item);
  item.id = idGerado;
  _equipamentos.push(item);
  return idGerado;
}

export async function atualizar(itemId, itemBruto) {
  const item = preparar(itemBruto);
  item.id = itemId;
  const indice = _equipamentos.findIndex((i) => i.id === itemId);
  if (indice >= 0) _equipamentos[indice] = item;
  else _equipamentos.push(item);
  await db.put("equipamentos", item);
}

export function todos() {
  return [..._equipamentos].sort((a, b) => a.id - b.id);
}

export async function limparTudo() {
  _equipamentos = [];
  _conflitos = [];
  _proximoIdConflito = 1;
  await db.clear("equipamentos");
  await db.clear("conflitos");
}

// --- Setores ---------------------------------------------------------------

// Lista de setores com totais para a tela inicial.
export function setores() {
  const grupos = new Map();
  for (const item of _equipamentos) {
    const nome = item.setor_grupo;
    if (!grupos.has(nome)) grupos.set(nome, { nome, total: 0, auditados: 0 });
    const g = grupos.get(nome);
    g.total += 1;
    if (!ehPendente(item)) g.auditados += 1;
  }
  return [...grupos.values()]
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((s) => ({ ...s, percentual: s.total ? Math.round((100 * s.auditados) / s.total) : 0 }));
}

// Todos os setores conhecidos (para o campo 'Encontrado em').
export function nomesSetores() {
  const nomes = new Set();
  for (const item of _equipamentos) {
    if (item.setor_origem) nomes.add(item.setor_origem);
    if (item.setor_atual) nomes.add(item.setor_atual);
  }
  return [...nomes].sort();
}

export function itensDoSetor(setor, filtro = "pendentes") {
  let itens = _equipamentos.filter((i) => i.setor_grupo === setor);
  if (filtro === "pendentes") itens = itens.filter(ehPendente);
  else if (filtro === "auditados") itens = itens.filter((i) => !ehPendente(i));
  return itens
    .map(comFlags)
    .sort((a, b) => a.equipamento.localeCompare(b.equipamento));
}

// Itens de outros setores que foram encontrados neste setor.
export function vindosDeOutroSetor(setor) {
  return _equipamentos
    .filter((i) => i.setor_atual === setor && i.setor_grupo !== setor && !ehPendente(i))
    .map(comFlags)
    .sort((a, b) => a.equipamento.localeCompare(b.equipamento));
}

// Pesquisa por patrimônio, nº de série, TAG ou nome (todas as palavras).
export function pesquisar(termos, { setor = null, foraDoSetor = null, limite = 100 } = {}) {
  if (!termos || !termos.length) return [];
  let itens = _equipamentos.filter((i) => termos.every((t) => i.busca.includes(t)));
  if (setor) itens = itens.filter((i) => i.setor_grupo === setor);
  if (foraDoSetor) itens = itens.filter((i) => i.setor_grupo !== foraDoSetor);
  itens.sort((a, b) => a.setor_grupo.localeCompare(b.setor_grupo) || a.equipamento.localeCompare(b.equipamento));
  return itens.slice(0, limite).map(comFlags);
}

export function resumo() {
  const total = _equipamentos.length;
  const auditados = _equipamentos.filter((i) => !ehPendente(i)).length;
  const tagsForaPadrao = _equipamentos.filter((i) => i.tag && !tagValida(i.tag)).length;
  return {
    total,
    auditados,
    pendentes: total - auditados,
    tags_fora_padrao: tagsForaPadrao,
    conflitos: totalConflitos(),
  };
}

export function tagsForaDoPadrao() {
  return _equipamentos
    .filter((i) => i.tag)
    .map(comFlags)
    .filter((i) => !i.tag_ok)
    .sort((a, b) => a.setor_grupo.localeCompare(b.setor_grupo) || a.tag.localeCompare(b.tag));
}

// --- Conflitos ---------------------------------------------------------------

export function totalConflitos() {
  return _conflitos.length;
}

export async function registrarConflito(chave, dados, arquivo) {
  const conteudo = JSON.stringify(dados, Object.keys(dados).sort());
  const repetido = _conflitos.some((c) => c.chave === chave && c.dadosTexto === conteudo);
  if (repetido) return;
  const registro = { id: _proximoIdConflito++, chave, dados, dadosTexto: conteudo, arquivo };
  _conflitos.push(registro);
  await db.put("conflitos", registro);
}

export function conflitos() {
  return _conflitos.map((c) => ({
    id: c.id,
    arquivo: c.arquivo,
    importado: c.dados,
    atual: porChave(c.chave),
  }));
}

export function conflito(conflitoId) {
  const c = _conflitos.find((c) => c.id === conflitoId);
  if (!c) return null;
  return { id: c.id, chave: c.chave, importado: c.dados };
}

export async function removerConflito(conflitoId) {
  _conflitos = _conflitos.filter((c) => c.id !== conflitoId);
  await db.del("conflitos", conflitoId);
}

// --- Base de equipamentos do Effort (leitor de QR code) -----------------------

// Substitui a base de referência inteira pelas linhas informadas.
export async function salvarReferenciaEffort(linhas) {
  const registros = linhas.map((linha) => {
    const registro = {};
    for (const campo of CAMPOS_REFERENCIA_EFFORT) registro[campo] = texto(linha[campo]);
    return registro;
  });
  _referenciaEffort = new Map(registros.map((r) => [r.id_effort, r]));
  await db.clear("referencia_effort");
  await db.putVarios("referencia_effort", registros);
}

export function totalReferenciaEffort() {
  return _referenciaEffort.size;
}

export function referenciaPorId(idEffort) {
  return _referenciaEffort.get(String(idEffort)) || null;
}

// --- Preferências -----------------------------------------------------------

export function preferencia(nome, padrao = "") {
  return _preferencias.has(nome) ? _preferencias.get(nome) : padrao;
}

export async function salvarPreferencia(nome, valor) {
  _preferencias.set(nome, valor);
  await db.put("preferencias", { nome, valor });
}
