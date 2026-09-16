// Cabeçalho (nome do auditor, contador de conflitos) e avisos "flash"
// (port do base.html + do context_processor de app/__init__.py).
import * as repositorio from "./repositorio.js";
import { caminhoAuditor } from "./router-caminhos.js";

export function atualizarCabecalho() {
  const auditor = repositorio.preferencia("auditor");
  const linkAuditor = document.getElementById("link-auditor");
  if (linkAuditor) {
    linkAuditor.textContent = auditor || "Definir auditor";
    linkAuditor.href = caminhoAuditor({ proximo: location.hash.slice(1) || "/" });
  }

  const linkConflitos = document.getElementById("link-conflitos");
  if (linkConflitos) {
    const total = repositorio.totalConflitos();
    linkConflitos.innerHTML = total
      ? `Conflitos <span class="contador">${total}</span>`
      : "Conflitos";
  }
}

export function mostrarAviso(mensagem, tipo = "ok") {
  const container = document.getElementById("avisos");
  if (!container) return;
  const div = document.createElement("div");
  div.className = `aviso aviso--${tipo}`;
  div.setAttribute("role", "status");
  div.textContent = mensagem;
  container.appendChild(div);
  if (tipo === "ok") {
    setTimeout(() => div.remove(), 5000);
  } else {
    div.style.cursor = "pointer";
    div.title = "Toque para fechar";
    div.addEventListener("click", () => div.remove());
  }
}

export function limparAvisos() {
  const container = document.getElementById("avisos");
  if (container) container.innerHTML = "";
}
