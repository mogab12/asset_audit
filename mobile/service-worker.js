// Cache do app shell inteiro, para o app funcionar 100% offline depois do
// primeiro carregamento (instalado ou não como PWA).
const VERSAO = "v1";
const CACHE = `auditoria-ativos-${VERSAO}`;

const ARQUIVOS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/estilo.css",
  "./dados/Equipamentos.xlsx",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./js/app.js",
  "./js/arquivos.js",
  "./js/auditoria.js",
  "./js/componentes.js",
  "./js/config.js",
  "./js/db.js",
  "./js/layout.js",
  "./js/mesclagem.js",
  "./js/planilha.js",
  "./js/qr.js",
  "./js/repositorio.js",
  "./js/router-caminhos.js",
  "./js/router.js",
  "./js/utils.js",
  "./js/vendor/jsQR.js",
  "./js/vendor/xlsx.full.min.js",
  "./js/views/arquivos.js",
  "./js/views/auditar.js",
  "./js/views/auditor.js",
  "./js/views/conflitos.js",
  "./js/views/inicio.js",
  "./js/views/setor.js",
  "./js/views/tags.js",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(
        chaves.filter((chave) => chave !== CACHE).map((chave) => caches.delete(chave))
      ))
      .then(() => self.clients.claim())
  );
});

// Cache-first: serve do cache imediatamente (offline funciona sempre);
// busca na rede só para preencher o cache na primeira vez ou revalidar.
self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET") return;
  evento.respondWith(
    caches.match(evento.request).then((resposta) => {
      if (resposta) return resposta;
      return fetch(evento.request).then((respostaRede) => {
        const copia = respostaRede.clone();
        caches.open(CACHE).then((cache) => cache.put(evento.request, copia));
        return respostaRede;
      });
    }).catch(() => caches.match("./index.html"))
  );
});
