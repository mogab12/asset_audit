// Leitor de QR code pela câmera (port de app/static/js/qr.js), chamando
// auditoria.escanear() diretamente no lugar de um fetch ao servidor.
//
// Dois modos, dependendo de onde o app está rodando:
//
//  - Nativo (dentro do app Android, via @capacitor-mlkit/barcode-scanning):
//    usa o mesmo ML Kit do Google que o app de câmera do celular usa — foco e
//    leitura de códigos pequenos muito melhores do que dá para fazer com
//    getUserMedia numa WebView. A câmera de verdade fica atrás da WebView; o
//    app fica transparente durante a leitura para ela aparecer (ver CSS
//    ".leitor-qr-ativo" em estilo.css).
//  - Navegador comum / PWA: getUserMedia + BarcodeDetector (quando o
//    navegador suporta) ou jsQR (script clássico, window.jsQR) com um zoom
//    digital para compensar a limitação dele com códigos pequenos.
import * as auditoria from "./auditoria.js";
import { caminhoAuditor, caminhoItem } from "./router-caminhos.js";

export function configurarLeitor(container, { setorAtual }) {
  const botaoAbrir = container.querySelector("#botao-ler-qr");
  const botaoFechar = container.querySelector("#botao-fechar-qr");
  const botaoTrocarCamera = container.querySelector("#botao-trocar-camera");
  const dialogo = container.querySelector("#leitor-qr");
  const cameraBox = container.querySelector("#leitor-qr-camera");
  const video = container.querySelector("#leitor-qr-video");
  const canvas = container.querySelector("#leitor-qr-canvas");
  const blocoFoto = container.querySelector("#leitor-qr-foto");
  const inputFoto = container.querySelector("#leitor-qr-arquivo");
  const status = container.querySelector("#leitor-qr-status");
  const blocoZoom = container.querySelector("#leitor-qr-zoom");
  const sliderZoom = container.querySelector("#leitor-qr-zoom-slider");

  if (!botaoAbrir || !dialogo) return () => {};

  const BarcodeScanner = window.Capacitor?.isNativePlatform?.()
    ? window.Capacitor.Plugins.BarcodeScanner
    : null;
  const Haptics = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins.Haptics : null;
  const detectorWeb = criarDetectorWeb();
  if (!BarcodeScanner && !detectorWeb && typeof window.jsQR === "undefined") return () => {};

  const contexto = canvas.getContext("2d", { willReadFrequently: true });
  let aguardandoResposta = false;
  let ultimoTexto = "";
  let ultimaLeituraEm = 0;

  function criarDetectorWeb() {
    if (typeof window.BarcodeDetector !== "function") return null;
    try {
      return new window.BarcodeDetector({ formats: ["qr_code"] });
    } catch {
      return null;
    }
  }

  // navigator.vibrate() sozinho não funciona de forma confiável aqui: o
  // navegador só libera a Vibration API quando a chamada acontece dentro de
  // um gesto do usuário (toque/clique), e a leitura do QR code chega de um
  // evento assíncrono do plugin de câmera, não de um clique — por isso o
  // plugin nativo de Haptics (chama o vibrador do Android direto, sem essa
  // restrição do navegador) é usado como primeira opção dentro do app.
  function vibrar() {
    if (Haptics) {
      Haptics.vibrate({ duration: 200 }).catch(() => {});
    } else if (navigator.vibrate) {
      navigator.vibrate(200);
    }
  }

  function mostrarStatus(mensagem, tipo) {
    status.textContent = mensagem;
    status.className = "leitor-qr__status" + (tipo ? " leitor-qr__status--" + tipo : "");
  }

  // Mesmo status, mas com um botão que leva direto para a tela do equipamento
  // — para o operador conferir ou adicionar uma observação sem sair do fluxo.
  function mostrarResultado(mensagem, tipo, itemId) {
    status.className = "leitor-qr__status" + (tipo ? " leitor-qr__status--" + tipo : "");
    status.replaceChildren(mensagem);
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "botao botao--principal leitor-qr__botao-item";
    botao.textContent = "Ver equipamento / adicionar observação";
    botao.addEventListener("click", () => {
      dialogo.close();
      location.hash = caminhoItem(itemId, { voltar: setorAtual });
    });
    status.appendChild(botao);
  }

  async function processarTexto(texto) {
    const agora = Date.now();
    if (texto === ultimoTexto && agora - ultimaLeituraEm < 4000) return;
    if (aguardandoResposta) return;
    ultimoTexto = texto;
    ultimaLeituraEm = agora;
    aguardandoResposta = true;
    vibrar();
    mostrarStatus("Lendo " + texto + "…");

    try {
      const dados = await auditoria.escanear({ texto, setor: setorAtual });
      aguardandoResposta = false;
      if (!dados.ok) {
        if (dados.precisaAuditor) {
          location.hash = caminhoAuditor({ proximo: location.hash.slice(1) || "/" });
          return;
        }
        mostrarStatus(dados.erro || "Não foi possível registrar a leitura.", "erro");
        return;
      }
      const tipo = dados.motivo === "Conforme" ? "ok" : "aviso";
      mostrarResultado(dados.identificacao + " registrado: " + dados.rotulo + ".", tipo, dados.itemId);
    } catch (erro) {
      aguardandoResposta = false;
      mostrarStatus("Falha ao registrar a leitura. Tente de novo.", "erro");
    }
  }

  // =====================================================================
  // Modo nativo: câmera real via ML Kit (Capacitor), atrás da WebView.
  // =====================================================================
  let listenerBarcode = null;

  async function iniciarNativo() {
    video.hidden = true;
    botaoTrocarCamera.hidden = true;
    mostrarStatus("Preparando a câmera…");

    let permissao = await BarcodeScanner.checkPermissions();
    if (permissao.camera !== "granted" && permissao.camera !== "limited") {
      permissao = await BarcodeScanner.requestPermissions();
    }
    if (permissao.camera !== "granted" && permissao.camera !== "limited") {
      mostrarStatus(
        "Permissão de câmera negada. Ative em Ajustes > Apps > Auditoria de Ativos > Permissões.",
        "erro");
      return;
    }

    document.documentElement.classList.add("leitor-qr-ativo");

    listenerBarcode = await BarcodeScanner.addListener("barcodeScanned", (evento) => {
      const valor = evento.barcode?.rawValue || evento.barcode?.displayValue;
      if (valor) processarTexto(valor);
    });

    try {
      // resolution: 2 = 1920x1080 (mais nítido para códigos pequenos e distantes)
      await BarcodeScanner.startScan({ formats: ["QR_CODE"], lensFacing: "BACK", resolution: 2 });
    } catch {
      mostrarStatus("Não foi possível abrir a câmera.", "erro");
      document.documentElement.classList.remove("leitor-qr-ativo");
      return;
    }

    mostrarStatus("Aponte a câmera para o QR code do equipamento.");

    try {
      const [{ zoomRatio: min }, { zoomRatio: max }] = await Promise.all([
        BarcodeScanner.getMinZoomRatio(),
        BarcodeScanner.getMaxZoomRatio(),
      ]);
      sliderZoom.min = min;
      sliderZoom.max = max;
      sliderZoom.step = Math.max((max - min) / 20, 0.01);
      sliderZoom.value = min;
      blocoZoom.hidden = max <= min;
    } catch {
      blocoZoom.hidden = true;
    }
  }

  async function pararNativo() {
    document.documentElement.classList.remove("leitor-qr-ativo");
    video.hidden = false;
    if (listenerBarcode) {
      await listenerBarcode.remove().catch(() => {});
      listenerBarcode = null;
    }
    try { await BarcodeScanner.stopScan(); } catch { /* já pode estar parada */ }
  }

  // =====================================================================
  // Modo navegador: getUserMedia + BarcodeDetector/jsQR + zoom digital.
  // =====================================================================
  let streamAtual = null;
  let trackAtual = null;
  let quadro = null;
  let decodificandoAsync = false;
  let camerasDisponiveis = [];
  let indiceCameraAtual = 0;
  let zoomNativoWebSuportado = false;
  let zoomDigitalAtual = 1;

  function configurarControleZoomWeb(track) {
    const capacidades = track.getCapabilities ? track.getCapabilities() : {};
    zoomNativoWebSuportado = Boolean(capacidades.zoom);
    const min = zoomNativoWebSuportado ? capacidades.zoom.min : 1;
    const max = zoomNativoWebSuportado ? capacidades.zoom.max : 4;
    const passo = zoomNativoWebSuportado ? (capacidades.zoom.step || 0.1) : 0.1;
    sliderZoom.min = min;
    sliderZoom.max = max;
    sliderZoom.step = passo;
    sliderZoom.value = min;
    zoomDigitalAtual = 1;
    video.style.transform = "";
    blocoZoom.hidden = max <= min;
  }

  function pararCameraWeb() {
    if (quadro) { cancelAnimationFrame(quadro); quadro = null; }
    if (streamAtual) { streamAtual.getTracks().forEach((t) => t.stop()); streamAtual = null; }
    trackAtual = null;
    video.srcObject = null;
  }

  async function lerQuadroNativoWeb() {
    if (!decodificandoAsync && video.readyState === video.HAVE_ENOUGH_DATA) {
      decodificandoAsync = true;
      try {
        const codigos = await detectorWeb.detect(video);
        if (codigos.length) processarTexto(codigos[0].rawValue);
      } catch {
        // ignora falha pontual de um quadro
      }
      decodificandoAsync = false;
    }
    quadro = requestAnimationFrame(lerQuadroNativoWeb);
  }

  function lerQuadroJsQR() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      canvas.width = vw;
      canvas.height = vh;
      if (!zoomNativoWebSuportado && zoomDigitalAtual > 1) {
        const cw = vw / zoomDigitalAtual;
        const ch = vh / zoomDigitalAtual;
        contexto.drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, vw, vh);
      } else {
        contexto.drawImage(video, 0, 0, vw, vh);
      }
      const imagem = contexto.getImageData(0, 0, vw, vh);
      const codigo = window.jsQR(imagem.data, imagem.width, imagem.height);
      if (codigo && codigo.data) processarTexto(codigo.data);
    }
    quadro = requestAnimationFrame(lerQuadroJsQR);
  }

  function listarCameras() {
    if (!navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then((dispositivos) => {
      camerasDisponiveis = dispositivos.filter((d) => d.kind === "videoinput");
      botaoTrocarCamera.hidden = camerasDisponiveis.length < 2;
    });
  }

  function iniciarCameraWeb(deviceId) {
    const restricoesVideo = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    const restricoes = deviceId
      ? { video: { ...restricoesVideo, deviceId: { exact: deviceId } } }
      : { video: { ...restricoesVideo, facingMode: { ideal: "environment" } } };

    navigator.mediaDevices.getUserMedia(restricoes)
      .then((stream) => {
        pararCameraWeb();
        streamAtual = stream;
        trackAtual = stream.getVideoTracks()[0] || null;
        video.hidden = false;
        blocoFoto.hidden = true;
        video.srcObject = stream;
        video.onloadedmetadata = () => video.play();
        quadro = requestAnimationFrame(detectorWeb ? lerQuadroNativoWeb : lerQuadroJsQR);
        mostrarStatus("Aponte a câmera para o QR code do equipamento.");
        listarCameras();
        if (trackAtual) configurarControleZoomWeb(trackAtual);
      })
      .catch(() => usarModoFoto());
  }

  function usarModoFoto() {
    video.hidden = true;
    blocoFoto.hidden = false;
    botaoTrocarCamera.hidden = true;
    blocoZoom.hidden = true;
    mostrarStatus("Câmera ao vivo não disponível neste aparelho. Tire uma foto do QR code.");
  }

  async function decodificarArquivo(arquivo) {
    if (!arquivo) return;
    const imagemEl = new Image();
    const leitor = new FileReader();
    leitor.onload = async () => {
      imagemEl.src = leitor.result;
      await imagemEl.decode().catch(() => {});

      if (detectorWeb) {
        try {
          const codigos = await detectorWeb.detect(imagemEl);
          if (codigos.length) { processarTexto(codigos[0].rawValue); return; }
        } catch {
          // cai para o jsQR abaixo
        }
      }

      if (typeof window.jsQR === "undefined") {
        mostrarStatus("Não deu para reconhecer um QR code nessa foto. Tente de novo.", "erro");
        return;
      }
      canvas.width = imagemEl.naturalWidth;
      canvas.height = imagemEl.naturalHeight;
      contexto.drawImage(imagemEl, 0, 0, canvas.width, canvas.height);
      const imagem = contexto.getImageData(0, 0, canvas.width, canvas.height);
      const codigo = window.jsQR(imagem.data, imagem.width, imagem.height);
      if (codigo && codigo.data) processarTexto(codigo.data);
      else mostrarStatus("Não deu para reconhecer um QR code nessa foto. Tente de novo.", "erro");
    };
    leitor.readAsDataURL(arquivo);
  }

  // =====================================================================
  // Zoom (slider + pinça com dois dedos), comum aos dois modos.
  // =====================================================================
  let pinchDistanciaInicial = null;
  let pinchZoomInicial = 1;

  function aplicarZoom(valor) {
    valor = Number(valor);
    if (BarcodeScanner) {
      BarcodeScanner.setZoomRatio({ zoomRatio: valor }).catch(() => {});
    } else if (zoomNativoWebSuportado && trackAtual) {
      trackAtual.applyConstraints({ advanced: [{ zoom: valor }] }).catch(() => {});
      video.style.transform = "";
    } else {
      zoomDigitalAtual = valor;
      video.style.transform = valor > 1 ? `scale(${valor})` : "";
    }
  }

  function distanciaToques(toques) {
    const dx = toques[0].clientX - toques[1].clientX;
    const dy = toques[0].clientY - toques[1].clientY;
    return Math.hypot(dx, dy);
  }

  // =====================================================================
  // Abrir/fechar o diálogo e ligar os controles.
  // =====================================================================
  botaoAbrir.addEventListener("click", () => {
    ultimoTexto = "";
    dialogo.showModal();
    if (BarcodeScanner) iniciarNativo();
    else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) iniciarCameraWeb();
    else usarModoFoto();
  });

  botaoFechar.addEventListener("click", () => dialogo.close());
  dialogo.addEventListener("close", () => {
    if (BarcodeScanner) pararNativo();
    else pararCameraWeb();
  });

  botaoTrocarCamera.addEventListener("click", () => {
    if (!camerasDisponiveis.length) return;
    indiceCameraAtual = (indiceCameraAtual + 1) % camerasDisponiveis.length;
    iniciarCameraWeb(camerasDisponiveis[indiceCameraAtual].deviceId);
  });

  inputFoto.addEventListener("change", () => {
    decodificarArquivo(inputFoto.files[0]);
    inputFoto.value = "";
  });

  sliderZoom.addEventListener("input", () => aplicarZoom(sliderZoom.value));

  cameraBox.addEventListener("touchstart", (evento) => {
    if (evento.touches.length === 2) {
      pinchDistanciaInicial = distanciaToques(evento.touches);
      pinchZoomInicial = Number(sliderZoom.value);
    }
  }, { passive: true });

  cameraBox.addEventListener("touchmove", (evento) => {
    if (evento.touches.length === 2 && pinchDistanciaInicial) {
      const fator = distanciaToques(evento.touches) / pinchDistanciaInicial;
      const min = Number(sliderZoom.min);
      const max = Number(sliderZoom.max);
      const novoValor = Math.min(max, Math.max(min, pinchZoomInicial * fator));
      sliderZoom.value = novoValor;
      aplicarZoom(novoValor);
    }
  }, { passive: true });

  cameraBox.addEventListener("touchend", (evento) => {
    if (evento.touches.length < 2) pinchDistanciaInicial = null;
  });

  // Chamado pelo roteador ao sair desta tela: garante que a câmera não
  // continue ligada em segundo plano se o usuário navegar sem fechar o diálogo.
  return () => { if (BarcodeScanner) pararNativo(); else pararCameraWeb(); };
}
