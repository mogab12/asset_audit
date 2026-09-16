// TAGs fora do padrão, agrupadas por setor (port de principal.tags_fora_do_padrao()).
import * as repositorio from "../repositorio.js";
import { escapeHtml } from "../utils.js";
import { cartaoItem } from "../componentes.js";
import { caminhoInicio } from "../router-caminhos.js";
import { atualizarCabecalho } from "../layout.js";

export async function render(container) {
  atualizarCabecalho();
  const itens = repositorio.tagsForaDoPadrao();

  const grupos = new Map();
  for (const item of itens) {
    if (!grupos.has(item.setor_grupo)) grupos.set(item.setor_grupo, []);
    grupos.get(item.setor_grupo).push(item);
  }

  container.innerHTML = `
    <a class="voltar" href="${caminhoInicio()}">Todos os setores</a>
    <h1>TAGs fora do padrão (${itens.length})</h1>
    <p class="suave">O padrão esperado é letras seguidas de números, como BINF1234 ou BINF-1234. Estas plaquetas devem ser trocadas.</p>

    ${!itens.length ? '<p class="vazio vazio--compacto">Todas as TAGs seguem o padrão.</p>' : ""}

    ${[...grupos.entries()].map(([setor, grupo]) => `
      <section class="bloco">
        <h2>${escapeHtml(setor)} (${grupo.length})</h2>
        <div class="lista">${grupo.map((item) => cartaoItem(item, setor)).join("")}</div>
      </section>`).join("")}
  `;
}
