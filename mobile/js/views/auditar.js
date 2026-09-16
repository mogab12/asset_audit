// Formulário de auditoria de um equipamento (port de auditoria.auditar()/_salvar()).
import * as config from "../config.js";
import * as repositorio from "../repositorio.js";
import * as auditoria from "../auditoria.js";
import { escapeHtml, nomeCurto, tagValida } from "../utils.js";
import { estadoClasse, rotuloMotivo } from "../componentes.js";
import { caminhoSetor } from "../router-caminhos.js";
import { navegarPara } from "../router.js";
import { atualizarCabecalho, mostrarAviso } from "../layout.js";

export async function render(container, { params, query }) {
  const itemId = Number(params.id);
  const item = repositorio.porId(itemId);
  if (!item) {
    container.innerHTML = "<p>Equipamento não encontrado.</p>";
    return;
  }
  atualizarCabecalho();

  if (!repositorio.preferencia("auditor")) {
    mostrarAviso("Antes de auditar, informe o seu nome.", "aviso");
    const consultaProximo = new URLSearchParams();
    if (query.voltar) consultaProximo.set("voltar", query.voltar);
    const sufixo = consultaProximo.toString();
    navegarPara("/auditor", { proximo: `/item/${itemId}${sufixo ? `?${sufixo}` : ""}` });
    return;
  }

  const voltar = query.voltar || item.setor_grupo;
  let encontradoEm;
  if (query.encontrado_em) encontradoEm = query.encontrado_em;
  else if (item.pendente) encontradoEm = item.setor_origem || item.setor_atual;
  else encontradoEm = item.setor_atual;

  const opcoes = auditoria.opcoesMotivo(item);
  const motivoSelecionado = auditoria.motivoNaTela(item);
  const setoresConhecidos = repositorio.nomesSetores();

  container.innerHTML = `
    <a class="voltar" href="${caminhoSetor(voltar)}">${escapeHtml(voltar)}</a>

    <header class="cabecalho-item">
      <span class="selo selo--${estadoClasse(item)}">${escapeHtml(rotuloMotivo(item.motivo))}</span>
      <h1>${escapeHtml(nomeCurto(item.equipamento))}</h1>
      <p class="suave">
        Deveria estar em <strong>${escapeHtml(item.setor_origem || "setor não informado")}</strong>
        ${!item.pendente ? `<br>Auditado por ${escapeHtml(item.executante || "—")} em ${escapeHtml(item.data || "—")}` : ""}
      </p>
    </header>

    <form class="formulario" id="form-auditoria">
      <div class="campo">
        <label for="setor_atual">Onde foi encontrado</label>
        <select id="setor_atual" name="setor_atual" data-origem="${escapeHtml(item.setor_origem)}">
          ${setoresConhecidos.map((s) => `<option value="${escapeHtml(s)}" ${s === encontradoEm ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}
        </select>
        <p class="dica dica--azul" id="aviso-setor" hidden>
          Diferente do setor de origem. Será registrado como “Encontrado em outro local”
          se a situação da TAG for Conforme.
        </p>
      </div>

      <fieldset class="campo">
        <legend>Situação da TAG</legend>
        <div class="opcoes">
          ${Object.entries(opcoes).map(([valor, rotulo], indice) => `
            <label class="opcao opcao--${indice + 1}">
              <input type="radio" name="motivo" value="${escapeHtml(valor)}" ${valor === motivoSelecionado ? "checked" : ""}>
              <span>${escapeHtml(rotulo)}</span>
            </label>`).join("")}
        </div>
        <p class="dica">“Pendente” mantém o item como não auditado.</p>
      </fieldset>

      <details class="campo identificacao" ${!item.tag_ok ? "open" : ""}>
        <summary>Conferir TAG, nº de série, patrimônio e modelo</summary>
        <div class="grade">
          <div>
            <label for="tag">TAG</label>
            <input id="tag" name="tag" value="${escapeHtml(item.tag)}" class="maiusculo" autocomplete="off">
            <p class="dica dica--ambar" id="aviso-tag" ${item.tag_ok ? "hidden" : ""}>
              Fora do padrão (letras seguidas de números, ex.: BINF1234). Pode salvar, mas a TAG deve ser trocada.
            </p>
            ${(item.tag_anterior && item.tag_anterior !== item.tag) ? `<p class="dica">Cadastro: ${escapeHtml(item.tag_anterior)}</p>` : ""}
          </div>
          <div>
            <label for="ns">Nº de série</label>
            <input id="ns" name="ns" value="${escapeHtml(item.ns)}" autocomplete="off">
            ${(item.ns_anterior && item.ns_anterior !== item.ns) ? `<p class="dica">Cadastro: ${escapeHtml(item.ns_anterior)}</p>` : ""}
          </div>
          <div>
            <label for="patrimonio">Patrimônio</label>
            <input id="patrimonio" name="patrimonio" value="${escapeHtml(item.patrimonio)}" autocomplete="off">
            ${(item.patrimonio_anterior && item.patrimonio_anterior !== item.patrimonio) ? `<p class="dica">Cadastro: ${escapeHtml(item.patrimonio_anterior)}</p>` : ""}
          </div>
          <div>
            <label for="modelo">Modelo</label>
            <input id="modelo" name="modelo" value="${escapeHtml(item.modelo)}" autocomplete="off">
            ${(item.modelo_anterior && item.modelo_anterior !== item.modelo) ? `<p class="dica">Cadastro: ${escapeHtml(item.modelo_anterior)}</p>` : ""}
          </div>
        </div>
      </details>

      <div class="campo">
        <label for="observacao">Observação</label>
        <textarea id="observacao" name="observacao" rows="3"
                  placeholder="Ex.: plaqueta descolando, QR code cortado, local onde foi encontrado">${escapeHtml(item.observacao)}</textarea>
      </div>

      <div class="acoes">
        <button type="submit" class="botao botao--principal botao--grande">Salvar auditoria</button>
        <a class="botao" href="${caminhoSetor(voltar)}">Cancelar</a>
      </div>
    </form>

    ${!item.pendente ? `
      <form id="form-desfazer" class="desfazer">
        <button type="submit" class="botao botao--discreto">Desfazer auditoria</button>
      </form>` : ""}
  `;

  ligarComportamentos(container, item, voltar);
}

function ligarComportamentos(container, item, voltar) {
  const campoTag = container.querySelector("#tag");
  const avisoTag = container.querySelector("#aviso-tag");
  if (campoTag && avisoTag) {
    const verificar = () => {
      const valor = campoTag.value.trim().toUpperCase();
      avisoTag.hidden = valor === "" || tagValida(valor);
    };
    campoTag.addEventListener("input", verificar);
  }

  const campoSetor = container.querySelector("#setor_atual");
  const avisoSetor = container.querySelector("#aviso-setor");
  if (campoSetor && avisoSetor) {
    const origem = campoSetor.dataset.origem;
    const verificar = () => { avisoSetor.hidden = !origem || campoSetor.value === origem; };
    campoSetor.addEventListener("change", verificar);
    verificar();
  }

  const form = container.querySelector("#form-auditoria");
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    form.querySelectorAll("button[type=submit]").forEach((b) => { b.disabled = true; });

    const dados = new FormData(form);
    let escolha = dados.get("motivo") || config.MOTIVO_CONFORME;
    if (!(escolha in auditoria.opcoesMotivo(item))) escolha = config.MOTIVO_CONFORME;
    const setorEncontrado = (dados.get("setor_atual") || "").trim() || item.setor_atual;

    const motivo = await auditoria.aplicarAuditoria(item, setorEncontrado, escolha, {
      tag: (dados.get("tag") || "").trim().toUpperCase(),
      ns: (dados.get("ns") || "").trim(),
      patrimonio: (dados.get("patrimonio") || "").trim(),
      modelo: (dados.get("modelo") || "").trim(),
      observacao: (dados.get("observacao") || "").trim(),
    });

    const identificacao = auditoria.identificacaoDoItem(item);
    const rotulo = rotuloMotivo(motivo);
    if (motivo === config.MOTIVO_PENDENTE) {
      mostrarAviso(`${identificacao}: dados salvos, mas o item continua pendente.`, "aviso");
    } else {
      mostrarAviso(`${identificacao} registrado: ${rotulo}.`, "ok");
    }
    if (!tagValida(item.tag)) {
      mostrarAviso(`A TAG ${item.tag} está fora do padrão e deve ser trocada.`, "aviso");
    }
    navegarPara(`/setor/${voltar}`);
  });

  const formDesfazer = container.querySelector("#form-desfazer");
  if (formDesfazer) {
    formDesfazer.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      if (!window.confirm("Desfazer a auditoria e voltar o item para pendente?")) return;
      formDesfazer.querySelector("button").disabled = true;
      await auditoria.desfazer(item.id);
      mostrarAviso("Auditoria desfeita. O item voltou para pendente.", "ok");
      navegarPara(`/setor/${voltar}`);
    });
  }
}
