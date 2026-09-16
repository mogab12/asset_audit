"""Funções pequenas e reutilizáveis (texto, TAG, datas)."""
import re
import unicodedata
from datetime import date, datetime

import config

_REGEX_TAG = re.compile(config.PADRAO_TAG)


def texto(valor):
    """Converte qualquer valor de célula em texto limpo ('' quando vazio)."""
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    if isinstance(valor, (datetime, date)):
        return valor.strftime("%d/%m/%Y")
    return str(valor).strip()


def sem_acentos(valor):
    base = unicodedata.normalize("NFKD", texto(valor))
    return "".join(c for c in base if not unicodedata.combining(c))


def compactar(valor):
    """'Bomba de Infusão BINF-0321' -> 'BOMBADEINFUSAOBINF0321'.

    Usado na pesquisa: ignora maiúsculas, acentos, espaços e pontuação,
    então '200.021348' encontra '200021348' e 'binf0321' encontra 'BINF-0321'.
    """
    return re.sub(r"[^A-Z0-9]", "", sem_acentos(valor).upper())


def termos_pesquisa(consulta):
    """Divide a pesquisa em palavras já compactadas (todas precisam bater)."""
    termos = (compactar(p) for p in sem_acentos(consulta).split())
    return [t for t in termos if t]


def tag_valida(tag):
    """True se a TAG segue o padrão. TAG vazia não é considerada inválida."""
    tag = texto(tag).upper()
    return not tag or bool(_REGEX_TAG.match(tag))


def hoje():
    return date.today().strftime("%d/%m/%Y")


def nome_curto(equipamento):
    """Remove o sufixo 'TAG:... NS:... PA:...' que o Effort coloca no nome."""
    return re.split(r"\s+TAG:", texto(equipamento), maxsplit=1)[0].strip()


def gerar_chave(item):
    """Identificador único de um equipamento, estável entre planilhas.

    Equipamentos do cadastro são identificados pelos dados "Anteriores"
    (que não mudam durante a auditoria). Itens sem cadastro (novo/antigo)
    são identificados pelos dados atuais e pela descrição.
    """
    up = lambda campo: texto(item.get(campo)).upper()
    if up("tag_anterior") or up("ns_anterior") or up("patrimonio_anterior"):
        partes = ["CAD", up("tag_anterior"), up("ns_anterior"),
                  up("patrimonio_anterior"), up("modelo_anterior"),
                  up("setor_origem")]
    else:
        partes = ["NOVO", up("tag"), up("ns"), up("patrimonio"),
                  up("equipamento")]
    return "|".join(partes)
