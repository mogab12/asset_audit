// Lógica de auditoria de um equipamento e do leitor de QR code
// (port de app/rotas/auditoria.py, sem a parte de HTTP/Flask).
import * as config from "./config.js";
import * as repositorio from "./repositorio.js";
import { hoje, nomeCurto, texto } from "./utils.js";
import { rotuloMotivo } from "./componentes.js";

export function extrairIdEffort(valor) {
  valor = texto(valor);
  const encontrado = valor.match(config.PADRAO_URL_EFFORT);
  if (encontrado) return encontrado[1];
  return /^\d+$/.test(valor) ? valor : null;
}

// Situações da TAG + o valor atual do item, se for um valor extra.
export function opcoesMotivo(item) {
  const opcoes = { ...config.SITUACOES_TAG };
  if (item.motivo in config.OUTROS_MOTIVOS) opcoes[item.motivo] = config.OUTROS_MOTIVOS[item.motivo];
  return opcoes;
}

export function motivoNaTela(item) {
  if (item.pendente) return config.MOTIVO_SEM_PLAQUETA;
  if (item.motivo === config.MOTIVO_OUTRO_LOCAL) return config.MOTIVO_CONFORME;
  return item.motivo;
}

// Decide o motivo final (considerando "Encontrado em outro local") e grava.
export async function aplicarAuditoria(item, setorEncontrado, escolha, camposExtra = null) {
  const origem = item.setor_origem;
  let motivo = escolha;
  if (escolha === config.MOTIVO_CONFORME && origem && setorEncontrado !== origem) {
    motivo = config.MOTIVO_OUTRO_LOCAL;
  }

  Object.assign(item, {
    setor_atual: setorEncontrado,
    motivo,
    status: motivo === config.MOTIVO_CONFORME ? config.STATUS_CONFORME : config.STATUS_NAO_CONFORME,
    executante: repositorio.preferencia("auditor"),
    data: hoje(),
  }, camposExtra || {});

  await repositorio.atualizar(item.id, item);
  return motivo;
}

export function identificacaoDoItem(item) {
  return item.tag || item.patrimonio || nomeCurto(item.equipamento);
}

// Auditoria automática a partir da leitura de um QR code do Effort.
export async function escanear({ texto: textoLido, setor }) {
  if (!repositorio.preferencia("auditor")) {
    return { ok: false, precisaAuditor: true, erro: "Informe seu nome antes de auditar." };
  }

  const idEffort = extrairIdEffort(textoLido);
  const setorAtual = texto(setor);
  if (!idEffort) return { ok: false, erro: "QR code não reconhecido." };

  let item = repositorio.porIdEffort(idEffort);
  if (item === null) {
    const ref = repositorio.referenciaPorId(idEffort);
    if (ref === null) {
      return {
        ok: false, status: 404,
        erro: `ID ${idEffort} não encontrado na base de equipamentos (Effort). ` +
              "Atualize a planilha em Planilhas.",
      };
    }

    item = ref.tag ? repositorio.porTag(ref.tag) : null;
    if (item === null) {
      const novoId = await repositorio.inserir(repositorio.preparar({
        equipamento: ref.equipamento,
        modelo: ref.modelo,
        tag: ref.tag,
        ns: ref.ns,
        patrimonio: ref.patrimonio,
        setor_origem: ref.setor,
        setor_atual: ref.setor,
        motivo: config.MOTIVO_PENDENTE,
        id_effort: idEffort,
      }));
      item = repositorio.porId(novoId);
    } else {
      await repositorio.definirIdEffort(item.id, idEffort);
    }
  }

  const motivo = await aplicarAuditoria(item, setorAtual || item.setor_atual, config.MOTIVO_CONFORME);
  return {
    ok: true, itemId: item.id, identificacao: identificacaoDoItem(item),
    motivo, rotulo: rotuloMotivo(motivo),
  };
}

// Volta o item para pendente, restaurando os dados do cadastro.
export async function desfazer(itemId) {
  const item = repositorio.porId(itemId);
  if (!item) return null;
  Object.assign(item, {
    motivo: config.MOTIVO_PENDENTE,
    status: config.STATUS_NAO_CONFORME,
    setor_atual: item.setor_origem || item.setor_atual,
    observacao: "",
    executante: "",
    data: "",
  });
  for (const campo of ["modelo", "tag", "ns", "patrimonio"]) {
    if (item[`${campo}_anterior`]) item[campo] = item[`${campo}_anterior`];
  }
  await repositorio.atualizar(itemId, item);
  return item;
}
