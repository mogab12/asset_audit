// Definir o nome do auditor (port de principal.auditor()).
import * as repositorio from "../repositorio.js";
import { escapeHtml } from "../utils.js";
import { navegarPara } from "../router.js";
import { atualizarCabecalho, mostrarAviso } from "../layout.js";

export async function render(container, { query }) {
  atualizarCabecalho();
  let proximo = query.proximo || "";
  if (!proximo.startsWith("/") || proximo.startsWith("//")) proximo = "/";
  const auditor = repositorio.preferencia("auditor");

  container.innerHTML = `
    <section class="cartao estreito">
      <h1>Quem está auditando?</h1>
      <p class="suave">O nome vai para a coluna “Executante” de cada equipamento que você registrar neste aparelho.</p>
      <form class="formulario" id="form-auditor">
        <div class="campo">
          <label for="nome">Nome completo</label>
          <input id="nome" name="nome" value="${escapeHtml(auditor)}" class="maiusculo" required autofocus autocomplete="name">
        </div>
        <button type="submit" class="botao botao--principal botao--grande">Salvar nome</button>
      </form>
    </section>`;

  container.querySelector("#form-auditor").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const nome = (new FormData(evento.target).get("nome") || "").toString().toUpperCase().trim().replace(/\s+/g, " ");
    if (!nome) {
      mostrarAviso("Informe o seu nome para continuar.", "erro");
      return;
    }
    await repositorio.salvarPreferencia("auditor", nome);
    mostrarAviso(`Auditor definido: ${nome}.`, "ok");

    const [caminho, consulta = ""] = proximo.split("?");
    navegarPara(caminho, Object.fromEntries(new URLSearchParams(consulta)));
  });
}
