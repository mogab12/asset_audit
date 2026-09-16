"""Regras para juntar planilhas de vários auditores.

Quando o mesmo equipamento aparece mais de uma vez (no mesmo arquivo, em
arquivos diferentes ou já existe na base):

  * ambos pendentes ............................ mantém o que já existe
  * um pendente e outro não .................... fica o que NÃO está pendente
  * nenhum pendente e iguais ................... mantém o que já existe
  * nenhum pendente e diferentes ............... CONFLITO: o usuário escolhe
"""
import config
from app import db, repositorio
from app.utils import texto

MANTER = "manter"
SUBSTITUIR = "substituir"
CONFLITO = "conflito"


def iguais(a, b):
    normal = lambda item, campo: " ".join(texto(item.get(campo)).upper().split())
    return all(normal(a, c) == normal(b, c) for c in config.CAMPOS_COMPARACAO)


def decidir(existente, novo):
    """Função pura: decide o que fazer com uma linha repetida."""
    if repositorio.eh_pendente(novo):
        return MANTER
    if repositorio.eh_pendente(existente):
        return SUBSTITUIR
    if iguais(existente, novo):
        return MANTER
    return CONFLITO


def importar(itens, nome_arquivo, substituir_base=False):
    """Grava os itens na base aplicando as regras. Devolve um resumo."""
    if substituir_base:
        repositorio.limpar_tudo()

    resumo = {"lidos": len(itens), "novos": 0, "atualizados": 0,
              "mantidos": 0, "conflitos": 0}

    for bruto in itens:
        item = repositorio.preparar(bruto)
        existente = repositorio.por_chave(item["chave"])

        if existente is None:
            repositorio.inserir(item)
            resumo["novos"] += 1
            continue

        acao = decidir(existente, item)
        if acao == SUBSTITUIR:
            repositorio.atualizar(existente["id"], item)
            resumo["atualizados"] += 1
        elif acao == CONFLITO:
            dados = {c: item[c] for c in repositorio.CAMPOS}
            dados["chave"] = item["chave"]
            repositorio.registrar_conflito(item["chave"], dados, nome_arquivo)
            resumo["conflitos"] += 1
        else:
            resumo["mantidos"] += 1

    db.obter().commit()
    return resumo


def resolver(conflito_id, escolha):
    """escolha = 'atual' (mantém a base) ou 'importado' (usa a outra versão)."""
    conflito = repositorio.conflito(conflito_id)
    if conflito is None:
        return
    if escolha == "importado":
        atual = repositorio.por_chave(conflito["chave"])
        if atual:
            repositorio.atualizar(atual["id"], conflito["importado"])
        else:
            repositorio.inserir(conflito["importado"])
    repositorio.remover_conflito(conflito_id)
    _descartar_resolvidos(conflito["chave"])
    db.obter().commit()


def _descartar_resolvidos(chave):
    """Remove outros conflitos do mesmo item que ficaram iguais à base."""
    atual = repositorio.por_chave(chave)
    if not atual:
        return
    for c in repositorio.conflitos():
        if c["importado"].get("chave") == chave and iguais(atual, c["importado"]):
            repositorio.remover_conflito(c["id"])
