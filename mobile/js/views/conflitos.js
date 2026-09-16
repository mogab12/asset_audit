// Resolução de conflitos de mesclagem (port de arquivos.conflitos()/resolver()).
import * as config from "../config.js";
import * as mesclagem from "../mesclagem.js";
import * as repositorio from "../repositorio.js";
import { escapeHtml, nomeCurto } from "../utils.js";
import { rotuloMotivo } from "../componentes.js";
import { caminhoArquivos } from "../router-caminhos.js";
import { atualizarCabecalho, mostrarAviso } from "../layout.js";

const CAMPOS = [...config.CAMPOS_COMPARACAO, "executante", "data"].map((c) => [c, config.COLUNAS[c]]);

export async function render(container) {
  atualizarCabecalho();
  const conflitos = repositorio.conflitos();

  container.innerHTML = `
    <h1>Conflitos</h1>
    <p class="suave">
      O mesmo equipamento foi auditado de formas diferentes. Escolha qual versão deve ficar.
      As linhas destacadas mostram o que é diferente.
    </p>

    ${!conflitos.length ? `
      <div class="vazio vazio--compacto">
        <h2>Nenhum conflito pendente</h2>
        <p>Tudo certo para exportar.</p>
        <a class="botao botao--principal" href="${caminhoArquivos()}">Ir para planilhas</a>
      </div>` : ""}

    ${conflitos.map((c) => renderConflito(c)).join("")}
  `;

  container.querySelectorAll("form[data-conflito-id]").forEach((form) => {
    form.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const escolha = evento.submitter?.value;
      if (escolha !== "atual" && escolha !== "importado") {
        mostrarAviso("Escolha uma das versões.", "erro");
        return;
      }
      await mesclagem.resolver(Number(form.dataset.conflitoId), escolha);
      mostrarAviso("Conflito resolvido.", "ok");
      render(container);
    });
  });
}

function renderConflito(c) {
  const atual = c.atual || {};
  const novo = c.importado;
  return `
    <section class="cartao conflito">
      <h2>${escapeHtml(nomeCurto(novo.equipamento || atual.equipamento))}</h2>
      <p class="suave">Setor de origem: ${escapeHtml(novo.setor_origem || atual.setor_origem || "—")}</p>
      <div class="tabela-rolagem">
        <table class="comparacao">
          <thead><tr><th>Campo</th><th>Versão A: na base</th><th>Versão B: ${escapeHtml(c.arquivo)}</th></tr></thead>
          <tbody>
            ${CAMPOS.map(([campo, titulo]) => {
              const va = atual[campo] || "";
              const vb = novo[campo] || "";
              const diferente = va.trim().toUpperCase() !== vb.trim().toUpperCase();
              const mostrar = (v) => (campo === "motivo" ? rotuloMotivo(v) : v) || "";
              return `
                <tr class="${diferente ? "diferente" : ""}">
                  <th scope="row">${escapeHtml(titulo)}</th>
                  <td>${escapeHtml(mostrar(va))}</td>
                  <td>${escapeHtml(mostrar(vb))}</td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
      <form class="acoes" data-conflito-id="${c.id}">
        <button class="botao" name="escolha" value="atual" type="submit">Manter versão A</button>
        <button class="botao" name="escolha" value="importado" type="submit">Usar versão B</button>
      </form>
    </section>`;
}
