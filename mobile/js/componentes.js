// Pedaços de interface reutilizados em várias telas (port de _componentes.html).
import * as config from "./config.js";
import { escapeHtml, nomeCurto } from "./utils.js";
import { caminhoItem } from "./router-caminhos.js";

export const ROTULOS_MOTIVO = { ...config.SITUACOES_TAG, ...config.OUTROS_MOTIVOS };

export function rotuloMotivo(motivo) {
  return ROTULOS_MOTIVO[motivo] ?? motivo;
}

export function progresso(auditados, total, percentual) {
  return `
    <div class="progresso" role="progressbar" aria-valuenow="${percentual}"
         aria-valuemin="0" aria-valuemax="100">
      <div class="progresso__barra" style="width: ${percentual}%"></div>
    </div>`;
}

export function estadoClasse(item) {
  if (item.pendente) return "pendente";
  if (item.motivo === config.MOTIVO_CONFORME || item.motivo === config.MOTIVO_OUTRO_LOCAL) return "conforme";
  return "atencao";
}

export function cartaoItem(item, voltar, { encontradoEm = null, mostrarSetor = false } = {}) {
  const classe = estadoClasse(item);
  const href = caminhoItem(item.id, { voltar, encontrado_em: encontradoEm });
  const notas = [];
  if (!item.tag_ok) notas.push('<span class="nota nota--ambar">TAG fora do padrão</span>');
  if (mostrarSetor) notas.push(`<span class="nota nota--azul">Setor de origem: ${escapeHtml(item.setor_grupo)}</span>`);
  if (!item.pendente && item.setor_origem && item.setor_atual !== item.setor_origem) {
    notas.push(`<span class="nota nota--azul">Encontrado em ${escapeHtml(item.setor_atual)}</span>`);
  }
  if (item.observacao) notas.push(`<span class="nota">${escapeHtml(item.observacao)}</span>`);
  const blocoNotas = notas.length ? `<div class="item__notas">${notas.join("")}</div>` : "";

  return `
    <a class="item item--${classe}" href="${href}">
      <div class="item__topo">
        <span class="item__nome">${escapeHtml(nomeCurto(item.equipamento))}</span>
        <span class="selo selo--${classe}">${escapeHtml(rotuloMotivo(item.motivo))}</span>
      </div>
      <dl class="item__ids">
        <div><dt>TAG</dt><dd>${escapeHtml(item.tag) || "—"}</dd></div>
        <div><dt>Nº série</dt><dd>${escapeHtml(item.ns) || "—"}</dd></div>
        <div><dt>Patrimônio</dt><dd>${escapeHtml(item.patrimonio) || "—"}</dd></div>
        <div><dt>Modelo</dt><dd>${escapeHtml(item.modelo) || "—"}</dd></div>
      </dl>
      ${blocoNotas}
    </a>`;
}

// Formulário de pesquisa: navega por hash (sem recarregar a página).
// "caminhoRaw" é o caminho sem codificar (ex.: "/" ou "/setor/Nome do setor"),
// no mesmo formato que router.navegarPara() espera.
export function busca(caminhoRaw, consulta, placeholder, { autofoco = true, id = "" } = {}) {
  const idAttr = id || `busca-${Math.random().toString(36).slice(2)}`;
  return `
    <form class="busca" data-caminho-raw="${escapeHtml(caminhoRaw)}" role="search" id="${idAttr}">
      <input type="search" name="q" value="${escapeHtml(consulta)}" placeholder="${escapeHtml(placeholder)}"
             autocomplete="off" ${autofoco ? "autofocus" : ""} aria-label="Pesquisar equipamento">
      <button type="submit" class="botao botao--principal">Pesquisar</button>
    </form>`;
}

// Liga o comportamento de todos os formulários de busca renderizados na tela.
export function ligarFormulariosBusca(container, navegarPara) {
  container.querySelectorAll("form.busca").forEach((form) => {
    form.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const valor = new FormData(form).get("q") || "";
      navegarPara(form.dataset.caminhoRaw, { q: valor.toString().trim() });
    });
  });
}
