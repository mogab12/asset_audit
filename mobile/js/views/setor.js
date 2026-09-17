// Lista de itens de um setor, com busca, filtros e leitor de QR code
// (port de principal.setor()).
import * as repositorio from "../repositorio.js";
import { termosPesquisa, compactar, escapeHtml } from "../utils.js";
import { busca, cartaoItem, progresso, ligarFormulariosBusca } from "../componentes.js";
import { caminhoInicio, caminhoSetor } from "../router-caminhos.js";
import { navegarPara, aoSairDaRota } from "../router.js";
import { atualizarCabecalho } from "../layout.js";
import { configurarLeitor } from "../qr.js";

const FILTROS = { pendentes: "Pendentes", auditados: "Auditados", todos: "Todos" };
const CAMPOS_EXATOS = ["tag", "tag_anterior", "ns", "ns_anterior", "patrimonio", "patrimonio_anterior"];

function correspondenciaExata(item, consulta) {
  const alvo = compactar(consulta);
  return Boolean(alvo) && CAMPOS_EXATOS.some((c) => compactar(item[c]) === alvo);
}

export async function render(container, { params, query }) {
  atualizarCabecalho();
  const nome = params.nome;
  let filtro = query.filtro || "pendentes";
  if (!(filtro in FILTROS)) filtro = "pendentes";
  const consulta = (query.q || "").trim();
  const termos = termosPesquisa(consulta);

  let itens;
  let emOutros = [];
  if (termos.length) {
    itens = repositorio.pesquisar(termos, { setor: nome });
    if (itens.length === 1 && itens[0].pendente && correspondenciaExata(itens[0], consulta)) {
      navegarPara(`/item/${itens[0].id}`, { voltar: nome });
      return;
    }
    if (!itens.length) emOutros = repositorio.pesquisar(termos, { foraDoSetor: nome });
  } else {
    itens = repositorio.itensDoSetor(nome, filtro);
  }

  const dadosSetor = repositorio.setores().find((s) => s.nome === nome) ||
    { nome, total: 0, auditados: 0, percentual: 0 };
  const vindos = repositorio.vindosDeOutroSetor(nome);

  container.innerHTML = `
    <a class="voltar" href="${caminhoInicio()}">Todos os setores</a>

    <header class="cabecalho-setor">
      <div class="cabecalho-setor__linha">
        <h1>${escapeHtml(nome)}</h1>
        <button type="button" class="botao botao--principal" id="botao-ler-qr">Ler QR code</button>
      </div>
      <p class="suave">${dadosSetor.auditados} de ${dadosSetor.total} auditados (${dadosSetor.percentual}%)</p>
      ${progresso(dadosSetor.auditados, dadosSetor.total, dadosSetor.percentual)}
    </header>

    <dialog id="leitor-qr" class="leitor-qr">
      <div class="leitor-qr__topo">
        <strong>Ler QR code</strong>
        <button type="button" class="botao botao--perigo" id="botao-fechar-qr">Fechar</button>
      </div>
      <div class="leitor-qr__camera" id="leitor-qr-camera">
        <video id="leitor-qr-video" playsinline muted autoplay></video>
        <canvas id="leitor-qr-canvas" hidden></canvas>
        <div class="leitor-qr__mira" aria-hidden="true"></div>
      </div>
      <div class="leitor-qr__zoom" id="leitor-qr-zoom" hidden>
        <span aria-hidden="true">−</span>
        <input type="range" id="leitor-qr-zoom-slider" min="1" max="4" step="0.1" value="1" aria-label="Zoom da câmera">
        <span aria-hidden="true">+</span>
      </div>
      <div class="campo" id="leitor-qr-foto" hidden>
        <label for="leitor-qr-arquivo">Câmera ao vivo não disponível aqui. Tire uma foto do QR code:</label>
        <input type="file" id="leitor-qr-arquivo" accept="image/*" capture="environment">
      </div>
      <button type="button" class="botao" id="botao-trocar-camera" hidden>Trocar câmera</button>
      <p class="leitor-qr__status" id="leitor-qr-status" aria-live="polite">Aponte a câmera para o QR code do equipamento.</p>
    </dialog>

    <div class="barra-fixa">
      ${busca(`/setor/${nome}`, consulta, "TAG, patrimônio, nº de série ou nome")}
    </div>

    ${consulta ? `
      <p class="resultado-info">
        ${itens.length} resultado(s) neste setor para “${escapeHtml(consulta)}”.
        <a href="${caminhoSetor(nome)}">Limpar pesquisa</a>
      </p>
      ${!itens.length ? (emOutros.length ? `
        <div class="alerta-outro-setor">
          <h2>Nenhum resultado neste setor, mas há ${emOutros.length} em outro(s) setor(es)</h2>
          <p>Se o equipamento está aqui na sua frente, abra-o para registrar que foi encontrado em ${escapeHtml(nome)}.</p>
          <div class="lista">${emOutros.map((item) => cartaoItem(item, nome, { encontradoEm: nome, mostrarSetor: true })).join("")}</div>
        </div>` : `
        <div class="vazio vazio--compacto">
          <h2>Nenhum equipamento encontrado em nenhum setor</h2>
          <p>Confira a digitação ou pesquise por outro dado (TAG, patrimônio ou nº de série).</p>
        </div>`) : ""}
      ` : `
      <nav class="abas" aria-label="Filtrar itens">
        ${Object.entries(FILTROS).map(([chave, rotulo]) => `
          <a class="aba ${chave === filtro ? "aba--ativa" : ""}" href="${caminhoSetor(nome, { filtro: chave })}">${rotulo}</a>
        `).join("")}
      </nav>
      ${!itens.length ? `<p class="suave vazio--compacto">${filtro === "pendentes" ? "Nenhum item pendente neste setor." : "Nenhum item nesta lista."}</p>` : ""}
      `}

    <div class="lista">
      ${itens.map((item) => cartaoItem(item, nome)).join("")}
    </div>

    ${(vindos.length && !consulta) ? `
      <section class="bloco">
        <h2>Encontrados aqui, mas pertencem a outro setor (${vindos.length})</h2>
        <div class="lista">${vindos.map((item) => cartaoItem(item, nome, { mostrarSetor: true })).join("")}</div>
      </section>` : ""}
  `;

  ligarFormulariosBusca(container, navegarPara);
  aoSairDaRota(configurarLeitor(container, { setorAtual: nome }));
}
