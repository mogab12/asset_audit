// Tela inicial: setores, pesquisa (port de principal.inicio()).
import * as repositorio from "../repositorio.js";
import { setorCorresponde, escapeHtml } from "../utils.js";
import { busca, progresso, ligarFormulariosBusca } from "../componentes.js";
import { caminhoArquivos, caminhoSetor, caminhoTagsForaDoPadrao, caminhoConflitos } from "../router-caminhos.js";
import { navegarPara } from "../router.js";
import { atualizarCabecalho } from "../layout.js";

export async function render(container, { query }) {
  atualizarCabecalho();
  const consulta = (query.q || "").trim();
  const resumo = repositorio.resumo();

  if (!resumo.total) {
    container.innerHTML = `
      <section class="vazio">
        <h1>Nenhum equipamento carregado</h1>
        <p>Exporte a auditoria do Effort em Excel e importe o arquivo aqui para começar o inventário.</p>
        <a class="botao botao--principal" href="${caminhoArquivos()}">Importar planilha</a>
      </section>`;
    return;
  }

  const percentualGeral = resumo.total ? Math.round((100 * resumo.auditados) / resumo.total) : 0;
  const setores = repositorio.setores();
  const setoresExibidos = consulta ? setores.filter((s) => setorCorresponde(s.nome, consulta)) : setores;

  container.innerHTML = `
    <section class="painel">
      <div class="painel__principal">
        <p class="painel__numero">${resumo.auditados} <small>de ${resumo.total}</small></p>
        <p class="painel__legenda">equipamentos auditados</p>
        ${progresso(resumo.auditados, resumo.total, percentualGeral)}
      </div>
      <ul class="painel__extras">
        <li><strong>${resumo.pendentes}</strong> pendentes</li>
        <li><a href="${caminhoTagsForaDoPadrao()}"><strong>${resumo.tags_fora_padrao}</strong> TAGs fora do padrão</a></li>
        <li><a href="${caminhoConflitos()}"><strong>${resumo.conflitos}</strong> conflitos a resolver</a></li>
      </ul>
    </section>

    ${busca("/", consulta, "Pesquisar setor: nome ou sigla (CME, UTI, PS...)", { autofoco: false, ariaLabel: "Pesquisar setor" })}

    <section class="bloco">
      <h2>${consulta ? `${setoresExibidos.length} setor(es) para “${escapeHtml(consulta)}”` : "Setores"}</h2>
      ${consulta && !setoresExibidos.length ? '<p class="suave">Nenhum setor encontrado. Confira a digitação ou tente outra sigla/nome.</p>' : ""}
      <ul class="setores">
        ${setoresExibidos.map((s) => `
          <li>
            <a class="setor ${s.auditados === s.total ? "setor--completo" : ""}" href="${caminhoSetor(s.nome)}">
              <span class="setor__nome">${escapeHtml(s.nome)}</span>
              <span class="setor__conta">${s.auditados}/${s.total}</span>
              ${progresso(s.auditados, s.total, s.percentual)}
            </a>
          </li>`).join("")}
      </ul>
    </section>`;

  ligarFormulariosBusca(container, navegarPara);
}
