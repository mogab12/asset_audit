// Pequenos comportamentos da interface. O aplicativo funciona sem JavaScript;
// isto só deixa o uso mais rápido e com avisos na hora.

// Aviso de TAG fora do padrão enquanto digita
const campoTag = document.getElementById("tag");
const avisoTag = document.getElementById("aviso-tag");
if (campoTag && avisoTag) {
  const padrao = new RegExp(campoTag.dataset.padrao);
  const verificar = () => {
    const valor = campoTag.value.trim().toUpperCase();
    avisoTag.hidden = valor === "" || padrao.test(valor);
  };
  campoTag.addEventListener("input", verificar);
  verificar();
}

// Aviso quando o setor encontrado é diferente do setor de origem
const campoSetor = document.getElementById("setor_atual");
const avisoSetor = document.getElementById("aviso-setor");
if (campoSetor && avisoSetor) {
  const origem = campoSetor.dataset.origem;
  const verificar = () => {
    avisoSetor.hidden = !origem || campoSetor.value === origem;
  };
  campoSetor.addEventListener("change", verificar);
  verificar();
}

// Pedido de confirmação em formulários marcados com data-confirmar
document.querySelectorAll("form[data-confirmar]").forEach((form) => {
  form.addEventListener("submit", (evento) => {
    if (!window.confirm(form.dataset.confirmar)) evento.preventDefault();
  });
});

// Evita envio duplo (toque duplo em celular)
document.querySelectorAll("form[method=post]").forEach((form) => {
  form.addEventListener("submit", (evento) => {
    if (evento.defaultPrevented) return;
    form.querySelectorAll("button[type=submit], button:not([type])").forEach((b) => {
      setTimeout(() => { b.disabled = true; }, 0);
    });
  });
});

// Mensagens de sucesso somem sozinhas depois de alguns segundos
document.querySelectorAll(".aviso--ok").forEach((aviso) => {
  setTimeout(() => { aviso.remove(); }, 5000);
});
