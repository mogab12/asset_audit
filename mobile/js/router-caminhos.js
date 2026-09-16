// Monta strings de "#/caminho?query" para usar em atributos href (equivalente
// ao url_for() do Flask, mas para hrefs estáticos, sem precisar de clique/JS).

function montar(caminho, query = {}) {
  const partes = caminho.split("/").map((p) => (p ? encodeURIComponent(p) : p)).join("/");
  const limpo = Object.fromEntries(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
  const consulta = new URLSearchParams(limpo).toString();
  return `#${partes}${consulta ? `?${consulta}` : ""}`;
}

export const caminhoInicio = (query = {}) => montar("/", query);
export const caminhoSetor = (nome, query = {}) => montar(`/setor/${nome}`, query);
export const caminhoItem = (id, query = {}) => montar(`/item/${id}`, query);
export const caminhoTagsForaDoPadrao = () => montar("/tags-fora-do-padrao");
export const caminhoArquivos = (query = {}) => montar("/arquivos", query);
export const caminhoConflitos = () => montar("/conflitos");
export const caminhoAuditor = (query = {}) => montar("/auditor", query);
