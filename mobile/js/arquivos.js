// Importar/exportar planilhas e base de equipamentos (port de app/rotas/arquivos.py).
import * as config from "./config.js";
import * as mesclagem from "./mesclagem.js";
import * as planilha from "./planilha.js";
import * as repositorio from "./repositorio.js";
import { compactar } from "./utils.js";

// Chamado uma vez na inicialização: garante que a base do Effort não fique vazia.
export async function garantirReferenciaInicial() {
  if (repositorio.totalReferenciaEffort() > 0) return;
  const resposta = await fetch(config.ARQUIVO_EQUIPAMENTOS_PADRAO);
  const bytes = await resposta.arrayBuffer();
  const linhas = planilha.lerReferenciaEffort(bytes);
  await repositorio.salvarReferenciaEffort(linhas);
}

export async function reverterEquipamentos() {
  const resposta = await fetch(config.ARQUIVO_EQUIPAMENTOS_PADRAO);
  const bytes = await resposta.arrayBuffer();
  const linhas = planilha.lerReferenciaEffort(bytes);
  await repositorio.salvarReferenciaEffort(linhas);
  return linhas.length;
}

export async function importarEquipamentos(arquivo) {
  const bytes = await arquivo.arrayBuffer();
  const linhas = planilha.lerReferenciaEffort(bytes); // pode lançar ErroPlanilha
  await repositorio.salvarReferenciaEffort(linhas);
  return linhas.length;
}

// Importa vários arquivos, na ordem. "modo" = 'mesclar' | 'substituir'.
// Devolve { totais, mensagens } — mensagens já prontas para exibir como avisos.
export async function importarArquivos(arquivos, modo) {
  let substituir = modo === "substituir";
  const totais = { lidos: 0, novos: 0, atualizados: 0, mantidos: 0, conflitos: 0 };
  const mensagens = [];

  for (const arquivo of arquivos) {
    let itens;
    try {
      const bytes = await arquivo.arrayBuffer();
      itens = planilha.ler(bytes);
    } catch (erro) {
      mensagens.push({ texto: `${arquivo.name}: ${erro.message || "não foi possível ler o arquivo."}`, tipo: "erro" });
      continue;
    }
    const resumo = await mesclagem.importar(itens, arquivo.name, substituir);
    substituir = false;
    for (const chave of Object.keys(totais)) totais[chave] += resumo[chave];
    mensagens.push({ texto: `${arquivo.name}: ${resumo.lidos} linhas lidas.`, tipo: "ok" });
  }

  mensagens.push({
    texto: `Resultado: ${totais.novos} novos, ${totais.atualizados} atualizados, ` +
           `${totais.mantidos} mantidos, ${totais.conflitos} conflitos.`,
    tipo: totais.conflitos ? "aviso" : "ok",
  });

  return { totais, mensagens };
}

export function nomeArquivoExportacao() {
  const auditor = compactar(repositorio.preferencia("auditor")) || "SEM_AUDITOR";
  const agora = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const carimbo = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}_` +
                  `${pad(agora.getHours())}${pad(agora.getMinutes())}`;
  return `Auditoria_de_Ativos_${auditor}_${carimbo}.xlsx`;
}

function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result.split(",")[1]);
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

// Dentro do app Android (Capacitor), um link <a download> com blob: não
// funciona — o WebView não tem para onde mandar o download. Nesse caso,
// grava o arquivo na área do app e abre o menu de compartilhar/salvar do
// Android. No navegador (PWA), continua sendo o download comum.
export async function exportar() {
  const blob = planilha.gerar(repositorio.todos());
  const nome = nomeArquivoExportacao();

  if (window.Capacitor?.isNativePlatform?.()) {
    const { Filesystem, Share } = window.Capacitor.Plugins;
    const base64 = await blobParaBase64(blob);
    const { uri } = await Filesystem.writeFile({ path: nome, data: base64, directory: "CACHE" });
    await Share.share({ title: nome, files: [uri] });
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function limparTudo(confirmacao) {
  if ((confirmacao || "").trim().toUpperCase() !== "APAGAR") {
    return { ok: false, erro: "Para apagar a base, digite APAGAR no campo de confirmação." };
  }
  await repositorio.limparTudo();
  return { ok: true };
}
