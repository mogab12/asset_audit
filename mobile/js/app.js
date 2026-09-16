// Bootstrap da PWA: inicializa os dados, garante a base padrão e liga o roteador.
import * as repositorio from "./repositorio.js";
import * as arquivos from "./arquivos.js";
import * as router from "./router.js";
import { atualizarCabecalho, mostrarAviso } from "./layout.js";

import * as inicio from "./views/inicio.js";
import * as setor from "./views/setor.js";
import * as auditar from "./views/auditar.js";
import * as tags from "./views/tags.js";
import * as arquivosView from "./views/arquivos.js";
import * as conflitos from "./views/conflitos.js";
import * as auditor from "./views/auditor.js";

// Dentro do app Android (Capacitor), o service worker é redundante — tudo já
// vem empacotado no .apk — e pode até atrapalhar: se ele passar a responder
// as páginas a partir do cache, a injeção do "window.Capacitor" (que os
// plugins nativos de Arquivos/Compartilhar precisam) pode não acontecer.
// Por isso, no app nativo ele nem é registrado, e qualquer registro antigo
// (de uma versão anterior deste app) é removido.
async function ajustarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (window.Capacitor?.isNativePlatform?.()) {
    const registros = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registros.map((r) => r.unregister()));
    if (window.caches) {
      const nomes = await caches.keys();
      await Promise.all(nomes.map((n) => caches.delete(n)));
    }
    return;
  }

  navigator.serviceWorker.register("service-worker.js").catch(() => {
    // Sem service worker o app ainda funciona online; só não fica instalável/offline.
  });
}

function configurarBotaoVoltarAndroid() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  const App = window.Capacitor.Plugins.App;
  App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else App.exitApp();
  });
}

async function iniciar() {
  await ajustarServiceWorker();
  configurarBotaoVoltarAndroid();

  await repositorio.inicializar();
  try {
    await arquivos.garantirReferenciaInicial();
  } catch (erro) {
    mostrarAviso("Não foi possível carregar a base padrão de equipamentos.", "erro");
  }

  router.registrar("/", inicio.render);
  router.registrar("/setor/:nome", setor.render);
  router.registrar("/item/:id", auditar.render);
  router.registrar("/tags-fora-do-padrao", tags.render);
  router.registrar("/arquivos", arquivosView.render);
  router.registrar("/conflitos", conflitos.render);
  router.registrar("/auditor", auditor.render);

  atualizarCabecalho();
  router.iniciar(document.getElementById("app"));
}

iniciar();
