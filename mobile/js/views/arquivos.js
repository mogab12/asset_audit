// Importar/exportar planilhas, base de equipamentos e apagar a base
// (port de app/rotas/arquivos.py + templates/arquivos.html).
import * as arquivos from "../arquivos.js";
import * as repositorio from "../repositorio.js";
import { caminhoConflitos } from "../router-caminhos.js";
import { navegarPara } from "../router.js";
import { atualizarCabecalho, mostrarAviso } from "../layout.js";

export async function render(container) {
  atualizarCabecalho();
  const resumo = repositorio.resumo();
  const totalReferencia = repositorio.totalReferenciaEffort();

  container.innerHTML = `
    <h1>Planilhas</h1>

    <section class="bloco cartao">
      <h2>Importar</h2>
      <p class="suave">
        Aceita a planilha exportada pelo Effort e as planilhas exportadas por este aplicativo.
        Você pode selecionar vários arquivos de uma vez para juntar o trabalho de vários auditores.
      </p>
      <form class="formulario" id="form-importar">
        <div class="campo">
          <label for="arquivos">Arquivos (.xls ou .xlsx)</label>
          <input id="arquivos" type="file" name="arquivos" accept=".xls,.xlsx" multiple required>
        </div>
        <fieldset class="campo">
          <legend>O que fazer com a base atual (${resumo.total} equipamentos)</legend>
          <div class="opcoes opcoes--coluna">
            <label class="opcao">
              <input type="radio" name="modo" value="mesclar" checked>
              <span><strong>Juntar</strong> com o que já existe. Itens repetidos seguem as regras de mesclagem.</span>
            </label>
            <label class="opcao">
              <input type="radio" name="modo" value="substituir">
              <span><strong>Substituir</strong> tudo. Apaga a base atual antes de importar (use para iniciar uma nova auditoria).</span>
            </label>
          </div>
        </fieldset>
        <button type="submit" class="botao botao--principal">Importar planilhas</button>
      </form>
      <details class="regras">
        <summary>Como os itens repetidos são tratados</summary>
        <ul>
          <li>Os dois pendentes: mantém qualquer um.</li>
          <li>Um pendente e outro auditado: fica o auditado.</li>
          <li>Os dois auditados e iguais: mantém qualquer um.</li>
          <li>Os dois auditados e diferentes: vira conflito e você escolhe qual fica.</li>
        </ul>
      </details>
    </section>

    <section class="bloco cartao">
      <h2>Exportar</h2>
      <p class="suave">
        Gera uma planilha com as mesmas colunas do Effort, contendo todos os equipamentos
        (${resumo.auditados} auditados, ${resumo.pendentes} pendentes).
        Envie esse arquivo para quem vai consolidar a auditoria.
      </p>
      ${resumo.conflitos ? `
        <p class="dica dica--ambar">Há ${resumo.conflitos} conflito(s) sem decisão.</p>
        <div class="acoes">
          <a class="botao botao--principal" href="${caminhoConflitos()}">Resolver conflitos</a>
          <button type="button" class="botao" id="botao-exportar-mesmo">Exportar assim mesmo</button>
        </div>` : `
        <button type="button" class="botao botao--principal" id="botao-exportar">Exportar planilha</button>`}
    </section>

    <section class="bloco cartao">
      <h2>Base de equipamentos (Effort)</h2>
      <p class="suave">
        Planilha bruta de equipamentos exportada do Effort (colunas ID, TAG, Setor...), usada
        pelo leitor de QR code para achar o equipamento a partir do ID lido no código.
        Atualmente com <strong>${totalReferencia}</strong> equipamentos carregados.
      </p>
      <form class="formulario" id="form-importar-equipamentos">
        <div class="campo">
          <label for="arquivo_equipamentos">Planilha de equipamentos (.xls ou .xlsx)</label>
          <input id="arquivo_equipamentos" type="file" name="arquivo_equipamentos" accept=".xls,.xlsx" required>
        </div>
        <button type="submit" class="botao botao--principal">Atualizar base</button>
      </form>
      <form class="linha-form" id="form-reverter-equipamentos">
        <button type="submit" class="botao botao--discreto">Reverter para o padrão</button>
      </form>
    </section>

    <section class="bloco cartao cartao--perigo">
      <h2>Apagar base</h2>
      <p class="suave">Remove todos os equipamentos e conflitos deste celular. Exporte antes se precisar guardar o trabalho.</p>
      <form class="linha-form" id="form-limpar">
        <input name="confirmacao" placeholder="Digite APAGAR" autocomplete="off" aria-label="Confirmação">
        <button type="submit" class="botao botao--perigo">Apagar tudo</button>
      </form>
    </section>
  `;

  ligarComportamentos(container);
}

function ligarComportamentos(container) {
  container.querySelector("#form-importar").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const form = evento.target;
    const arquivosSelecionados = [...form.querySelector("#arquivos").files];
    if (!arquivosSelecionados.length) {
      mostrarAviso("Selecione pelo menos uma planilha.", "erro");
      return;
    }
    const modo = new FormData(form).get("modo");
    form.querySelector("button[type=submit]").disabled = true;
    const { totais, mensagens } = await arquivos.importarArquivos(arquivosSelecionados, modo);
    mensagens.forEach((m) => mostrarAviso(m.texto, m.tipo));
    if (totais.conflitos) navegarPara("/conflitos");
    else render(container);
  });

  async function exportarComAviso() {
    try {
      await arquivos.exportar();
    } catch (erro) {
      mostrarAviso("Não foi possível exportar a planilha. Tente de novo.", "erro");
    }
  }
  const botaoExportar = container.querySelector("#botao-exportar");
  const botaoExportarMesmo = container.querySelector("#botao-exportar-mesmo");
  if (botaoExportar) botaoExportar.addEventListener("click", exportarComAviso);
  if (botaoExportarMesmo) botaoExportarMesmo.addEventListener("click", exportarComAviso);

  container.querySelector("#form-importar-equipamentos").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const form = evento.target;
    const arquivo = form.querySelector("#arquivo_equipamentos").files[0];
    if (!arquivo) {
      mostrarAviso("Selecione a planilha de equipamentos.", "erro");
      return;
    }
    form.querySelector("button[type=submit]").disabled = true;
    try {
      const total = await arquivos.importarEquipamentos(arquivo);
      mostrarAviso(`Base de equipamentos atualizada: ${total} equipamentos carregados.`, "ok");
    } catch (erro) {
      mostrarAviso(`${arquivo.name}: ${erro.message || "não foi possível ler o arquivo."}`, "erro");
    }
    render(container);
  });

  container.querySelector("#form-reverter-equipamentos").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!window.confirm("Reverter a base de equipamentos para o padrão do aplicativo?")) return;
    const total = await arquivos.reverterEquipamentos();
    mostrarAviso(`Base de equipamentos revertida para o padrão: ${total} equipamentos.`, "ok");
    render(container);
  });

  container.querySelector("#form-limpar").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const confirmacao = new FormData(evento.target).get("confirmacao");
    const resultado = await arquivos.limparTudo(confirmacao);
    if (!resultado.ok) {
      mostrarAviso(resultado.erro, "erro");
      return;
    }
    mostrarAviso("Base apagada. Importe uma nova planilha para começar.", "ok");
    navegarPara("/");
  });
}
