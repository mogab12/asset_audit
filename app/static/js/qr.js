(function () {
  "use strict";

  var script = document.currentScript;
  var setorAtual = script.dataset.setor;
  var urlEscanear = script.dataset.urlEscanear;
  var urlAuditor = script.dataset.urlAuditor;

  var botaoAbrir = document.getElementById("botao-ler-qr");
  var botaoFechar = document.getElementById("botao-fechar-qr");
  var botaoTrocarCamera = document.getElementById("botao-trocar-camera");
  var dialogo = document.getElementById("leitor-qr");
  var video = document.getElementById("leitor-qr-video");
  var canvas = document.getElementById("leitor-qr-canvas");
  var blocoFoto = document.getElementById("leitor-qr-foto");
  var inputFoto = document.getElementById("leitor-qr-arquivo");
  var status = document.getElementById("leitor-qr-status");

  if (!botaoAbrir || !dialogo || typeof jsQR === "undefined") {
    return;
  }

  var contexto = canvas.getContext("2d", { willReadFrequently: true });
  var streamAtual = null;
  var quadro = null;
  var aguardandoResposta = false;
  var ultimoTexto = "";
  var ultimaLeituraEm = 0;
  var camerasDisponiveis = [];
  var indiceCameraAtual = 0;

  function mostrarStatus(mensagem, tipo) {
    status.textContent = mensagem;
    status.className = "leitor-qr__status" + (tipo ? " leitor-qr__status--" + tipo : "");
  }

  function pararCamera() {
    if (quadro) {
      cancelAnimationFrame(quadro);
      quadro = null;
    }
    if (streamAtual) {
      streamAtual.getTracks().forEach(function (t) { t.stop(); });
      streamAtual = null;
    }
    video.srcObject = null;
  }

  function processarTexto(texto) {
    var agora = Date.now();
    if (texto === ultimoTexto && agora - ultimaLeituraEm < 4000) {
      return;
    }
    if (aguardandoResposta) {
      return;
    }
    ultimoTexto = texto;
    ultimaLeituraEm = agora;
    aguardandoResposta = true;
    mostrarStatus("Lendo " + texto + "…");

    fetch(urlEscanear, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: texto, setor: setorAtual }),
    })
      .then(function (resposta) { return resposta.json().then(function (dados) {
        return { status: resposta.status, dados: dados };
      }); })
      .then(function (resultado) {
        var dados = resultado.dados;
        aguardandoResposta = false;
        if (!dados.ok) {
          if (dados.precisa_auditor && urlAuditor) {
            window.location.href = urlAuditor;
            return;
          }
          mostrarStatus(dados.erro || "Não foi possível registrar a leitura.", "erro");
          return;
        }
        var tipo = dados.motivo === "Conforme" ? "ok" : "aviso";
        mostrarStatus(dados.identificacao + " registrado: " + dados.rotulo + ".", tipo);
      })
      .catch(function () {
        aguardandoResposta = false;
        mostrarStatus("Falha ao conectar com o aplicativo. Tente de novo.", "erro");
      });
  }

  function lerQuadro() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
      var imagem = contexto.getImageData(0, 0, canvas.width, canvas.height);
      var codigo = jsQR(imagem.data, imagem.width, imagem.height);
      if (codigo && codigo.data) {
        processarTexto(codigo.data);
      }
    }
    quadro = requestAnimationFrame(lerQuadro);
  }

  function listarCameras() {
    if (!navigator.mediaDevices.enumerateDevices) {
      return;
    }
    navigator.mediaDevices.enumerateDevices().then(function (dispositivos) {
      camerasDisponiveis = dispositivos.filter(function (d) { return d.kind === "videoinput"; });
      botaoTrocarCamera.hidden = camerasDisponiveis.length < 2;
    });
  }

  function iniciarCameraAoVivo(deviceId) {
    var restricoes = deviceId
      ? { video: { deviceId: { exact: deviceId } } }
      : { video: { facingMode: { ideal: "environment" } } };

    navigator.mediaDevices.getUserMedia(restricoes)
      .then(function (stream) {
        pararCamera();
        streamAtual = stream;
        video.hidden = false;
        blocoFoto.hidden = true;
        video.srcObject = stream;
        video.onloadedmetadata = function () { video.play(); };
        quadro = requestAnimationFrame(lerQuadro);
        mostrarStatus("Aponte a câmera para o QR code do equipamento.");
        listarCameras();
      })
      .catch(function () {
        usarModoFoto();
      });
  }

  function usarModoFoto() {
    video.hidden = true;
    blocoFoto.hidden = false;
    botaoTrocarCamera.hidden = true;
    mostrarStatus("Câmera ao vivo não disponível neste aparelho. Tire uma foto do QR code.");
  }

  function decodificarArquivo(arquivo) {
    if (!arquivo) return;
    var leitor = new FileReader();
    leitor.onload = function () {
      var imagemEl = new Image();
      imagemEl.onload = function () {
        canvas.width = imagemEl.naturalWidth;
        canvas.height = imagemEl.naturalHeight;
        contexto.drawImage(imagemEl, 0, 0, canvas.width, canvas.height);
        var imagem = contexto.getImageData(0, 0, canvas.width, canvas.height);
        var codigo = jsQR(imagem.data, imagem.width, imagem.height);
        if (codigo && codigo.data) {
          processarTexto(codigo.data);
        } else {
          mostrarStatus("Não deu para reconhecer um QR code nessa foto. Tente de novo.", "erro");
        }
      };
      imagemEl.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  }

  botaoAbrir.addEventListener("click", function () {
    ultimoTexto = "";
    dialogo.showModal();
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      iniciarCameraAoVivo();
    } else {
      usarModoFoto();
    }
  });

  botaoFechar.addEventListener("click", function () { dialogo.close(); });
  dialogo.addEventListener("close", pararCamera);

  botaoTrocarCamera.addEventListener("click", function () {
    if (!camerasDisponiveis.length) return;
    indiceCameraAtual = (indiceCameraAtual + 1) % camerasDisponiveis.length;
    iniciarCameraAoVivo(camerasDisponiveis[indiceCameraAtual].deviceId);
  });

  inputFoto.addEventListener("change", function () {
    decodificarArquivo(inputFoto.files[0]);
    inputFoto.value = "";
  });
})();
