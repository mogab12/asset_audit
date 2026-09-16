// Regras para juntar planilhas de vários auditores (port de app/mesclagem.py).
//
// Quando o mesmo equipamento aparece mais de uma vez (no mesmo arquivo, em
// arquivos diferentes ou já existe na base):
//
//   * ambos pendentes ............................ mantém o que já existe
//   * um pendente e outro não .................... fica o que NÃO está pendente
//   * nenhum pendente e iguais ................... mantém o que já existe
//   * nenhum pendente e diferentes ............... CONFLITO: o usuário escolhe
import * as config from "./config.js";
import * as repositorio from "./repositorio.js";
import { texto } from "./utils.js";

export const MANTER = "manter";
export const SUBSTITUIR = "substituir";
export const CONFLITO = "conflito";

function normal(item, campo) {
  return texto(item[campo]).toUpperCase().split(/\s+/).filter(Boolean).join(" ");
}

export function iguais(a, b) {
  return config.CAMPOS_COMPARACAO.every((c) => normal(a, c) === normal(b, c));
}

// Função pura: decide o que fazer com uma linha repetida.
export function decidir(existente, novo) {
  if (repositorio.ehPendente(novo)) return MANTER;
  if (repositorio.ehPendente(existente)) return SUBSTITUIR;
  if (iguais(existente, novo)) return MANTER;
  return CONFLITO;
}

// Grava os itens na base aplicando as regras. Devolve um resumo.
export async function importar(itens, nomeArquivo, substituirBase = false) {
  if (substituirBase) await repositorio.limparTudo();

  const resumo = { lidos: itens.length, novos: 0, atualizados: 0, mantidos: 0, conflitos: 0 };

  for (const bruto of itens) {
    const item = repositorio.preparar(bruto);
    const existente = repositorio.porChave(item.chave);

    if (existente === null) {
      await repositorio.inserir(item);
      resumo.novos += 1;
      continue;
    }

    const acao = decidir(existente, item);
    if (acao === SUBSTITUIR) {
      await repositorio.atualizar(existente.id, item);
      resumo.atualizados += 1;
    } else if (acao === CONFLITO) {
      const dados = {};
      for (const c of repositorio.CAMPOS) dados[c] = item[c];
      dados.chave = item.chave;
      await repositorio.registrarConflito(item.chave, dados, nomeArquivo);
      resumo.conflitos += 1;
    } else {
      resumo.mantidos += 1;
    }
  }

  return resumo;
}

// escolha = 'atual' (mantém a base) ou 'importado' (usa a outra versão).
export async function resolver(conflitoId, escolha) {
  const conflito = repositorio.conflito(conflitoId);
  if (conflito === null) return;
  if (escolha === "importado") {
    const atual = repositorio.porChave(conflito.chave);
    if (atual) await repositorio.atualizar(atual.id, conflito.importado);
    else await repositorio.inserir(conflito.importado);
  }
  await repositorio.removerConflito(conflitoId);
  await descartarResolvidos(conflito.chave);
}

// Remove outros conflitos do mesmo item que ficaram iguais à base.
async function descartarResolvidos(chave) {
  const atual = repositorio.porChave(chave);
  if (!atual) return;
  for (const c of repositorio.conflitos()) {
    if (c.importado.chave === chave && iguais(atual, c.importado)) {
      await repositorio.removerConflito(c.id);
    }
  }
}
