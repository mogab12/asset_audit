// Roteador simples baseado em hash, sem dependências externas.
// Cada rota chama render(container, { params, query }) da view correspondente.

const rotas = [];
let container = null;
let limpezaAtual = null;

// Uma view pode registrar aqui uma função de limpeza (ex.: desligar a câmera
// do leitor de QR code) chamada automaticamente antes de sair da rota atual.
export function aoSairDaRota(fn) {
  limpezaAtual = fn;
}

export function registrar(padrao, render) {
  // padrao: "/", "/setor/:nome", "/item/:id", etc.
  const nomes = [];
  const regexTexto = padrao
    .split("/")
    .map((parte) => {
      if (parte.startsWith(":")) {
        nomes.push(parte.slice(1));
        return "([^/]+)";
      }
      return parte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  rotas.push({ regex: new RegExp(`^${regexTexto}$`), nomes, render });
}

function analisarHash() {
  const bruto = location.hash.slice(1) || "/";
  const [caminho, consulta = ""] = bruto.split("?");
  const query = Object.fromEntries(new URLSearchParams(consulta));
  return { caminho: decodeURIComponent(caminho).replace(/\/+$/, "") || "/", query };
}

export function navegarPara(caminho, query = {}) {
  const consulta = new URLSearchParams(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ).toString();
  const codificado = caminho.split("/").map(encodeURIComponent).join("/");
  location.hash = "#" + codificado + (consulta ? `?${consulta}` : "");
}

async function tratarMudanca() {
  if (limpezaAtual) {
    try { limpezaAtual(); } catch { /* nunca deve impedir a navegação */ }
    limpezaAtual = null;
  }

  const { caminho, query } = analisarHash();
  for (const rota of rotas) {
    const encontrado = caminho.match(rota.regex);
    if (encontrado) {
      const params = {};
      // "caminho" já foi decodificado uma vez em analisarHash(); não decodificar de novo aqui.
      rota.nomes.forEach((nome, indice) => { params[nome] = encontrado[indice + 1]; });
      container.scrollTop = 0;
      window.scrollTo(0, 0);
      await rota.render(container, { params, query });
      return;
    }
  }
  container.innerHTML = "<p>Página não encontrada.</p>";
}

export function iniciar(elementoContainer) {
  container = elementoContainer;
  window.addEventListener("hashchange", tratarMudanca);
  tratarMudanca();
}

export function atualizar() {
  return tratarMudanca();
}
