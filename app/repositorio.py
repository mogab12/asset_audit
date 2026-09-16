"""Todas as consultas ao banco ficam aqui. As rotas só chamam estas funções."""
import json

import config
from app import db
from app.utils import compactar, gerar_chave, tag_valida, texto

CAMPOS = list(config.COLUNAS.keys())
PENDENTE_SQL = "(motivo = 'Pendente' OR motivo = '')"
CAMPOS_BUSCA = ["tag", "tag_anterior", "ns", "ns_anterior", "patrimonio",
                "patrimonio_anterior", "equipamento", "modelo"]


def eh_pendente(item):
    return texto(item.get("motivo")) in ("", config.MOTIVO_PENDENTE)


def preparar(item):
    """Limpa os campos e calcula os campos auxiliares (chave, setor, busca)."""
    limpo = {campo: texto(item.get(campo)) for campo in CAMPOS}
    limpo["tag"] = limpo["tag"].upper()
    if not limpo["motivo"]:
        limpo["motivo"] = config.MOTIVO_PENDENTE
    limpo["chave"] = item.get("chave") or gerar_chave(limpo)
    limpo["setor_grupo"] = limpo["setor_origem"] or limpo["setor_atual"] or "SEM SETOR"
    limpo["busca"] = "|".join(compactar(limpo[c]) for c in CAMPOS_BUSCA)
    limpo["id_effort"] = texto(item.get("id_effort", ""))
    return limpo


def _dict(linha):
    if linha is None:
        return None
    item = dict(linha)
    item["pendente"] = eh_pendente(item)
    item["tag_ok"] = tag_valida(item["tag"])
    return item


# --- Equipamentos -----------------------------------------------------------

def por_id(item_id):
    linha = db.obter().execute(
        "SELECT * FROM equipamentos WHERE id = ?", (item_id,)).fetchone()
    return _dict(linha)


def por_chave(chave):
    linha = db.obter().execute(
        "SELECT * FROM equipamentos WHERE chave = ?", (chave,)).fetchone()
    return _dict(linha)


def por_id_effort(id_effort):
    """Item já linkado a esse ID do Effort (leituras anteriores do mesmo QR code)."""
    linha = db.obter().execute(
        "SELECT * FROM equipamentos WHERE id_effort = ?", (str(id_effort),)).fetchone()
    return _dict(linha)


def por_tag(tag):
    """Primeira correspondência exata de TAG (atual ou anterior), para linkar um ID novo."""
    tag = tag.upper()
    linha = db.obter().execute(
        "SELECT * FROM equipamentos WHERE tag = ? OR tag_anterior = ? LIMIT 1",
        (tag, tag)).fetchone()
    return _dict(linha)


def definir_id_effort(item_id, id_effort):
    db.obter().execute(
        "UPDATE equipamentos SET id_effort = ? WHERE id = ?", (str(id_effort), item_id))


def inserir(item):
    item = preparar(item)
    colunas = CAMPOS + ["chave", "setor_grupo", "busca", "id_effort"]
    cursor = db.obter().execute(
        f"INSERT INTO equipamentos ({', '.join(colunas)}) "
        f"VALUES ({', '.join('?' * len(colunas))})",
        [item[c] for c in colunas])
    return cursor.lastrowid


def atualizar(item_id, item):
    item = preparar(item)
    colunas = CAMPOS + ["setor_grupo", "busca", "id_effort"]
    db.obter().execute(
        f"UPDATE equipamentos SET {', '.join(c + ' = ?' for c in colunas)} "
        "WHERE id = ?",
        [item[c] for c in colunas] + [item_id])


def todos():
    linhas = db.obter().execute("SELECT * FROM equipamentos ORDER BY id")
    return [dict(l) for l in linhas]


def limpar_tudo():
    conexao = db.obter()
    conexao.execute("DELETE FROM equipamentos")
    conexao.execute("DELETE FROM conflitos")
    conexao.commit()


# --- Setores ----------------------------------------------------------------

def setores():
    """Lista de setores com totais para a tela inicial."""
    linhas = db.obter().execute(f"""
        SELECT setor_grupo AS nome,
               COUNT(*) AS total,
               SUM(CASE WHEN {PENDENTE_SQL} THEN 0 ELSE 1 END) AS auditados
        FROM equipamentos GROUP BY setor_grupo ORDER BY setor_grupo
    """)
    resultado = []
    for l in linhas:
        s = dict(l)
        s["percentual"] = round(100 * s["auditados"] / s["total"]) if s["total"] else 0
        resultado.append(s)
    return resultado


def nomes_setores():
    """Todos os setores conhecidos (para o campo 'Encontrado em')."""
    linhas = db.obter().execute("""
        SELECT setor_origem AS s FROM equipamentos WHERE setor_origem <> ''
        UNION
        SELECT setor_atual FROM equipamentos WHERE setor_atual <> ''
        ORDER BY 1
    """)
    return [l["s"] for l in linhas]


def itens_do_setor(setor, filtro="pendentes"):
    sql = "SELECT * FROM equipamentos WHERE setor_grupo = ?"
    if filtro == "pendentes":
        sql += f" AND {PENDENTE_SQL}"
    elif filtro == "auditados":
        sql += f" AND NOT {PENDENTE_SQL}"
    sql += " ORDER BY equipamento"
    return [_dict(l) for l in db.obter().execute(sql, (setor,))]


def vindos_de_outro_setor(setor):
    """Itens de outros setores que foram encontrados neste setor."""
    linhas = db.obter().execute(f"""
        SELECT * FROM equipamentos
        WHERE setor_atual = ? AND setor_grupo <> ? AND NOT {PENDENTE_SQL}
        ORDER BY equipamento
    """, (setor, setor))
    return [_dict(l) for l in linhas]


def pesquisar(termos, setor=None, fora_do_setor=None, limite=100):
    """Pesquisa por patrimônio, nº de série, TAG ou nome (todas as palavras)."""
    if not termos:
        return []
    sql = "SELECT * FROM equipamentos WHERE 1 = 1"
    params = []
    for termo in termos:
        sql += " AND busca LIKE ?"
        params.append(f"%{termo}%")
    if setor:
        sql += " AND setor_grupo = ?"
        params.append(setor)
    if fora_do_setor:
        sql += " AND setor_grupo <> ?"
        params.append(fora_do_setor)
    sql += " ORDER BY setor_grupo, equipamento LIMIT ?"
    params.append(limite)
    return [_dict(l) for l in db.obter().execute(sql, params)]


def resumo():
    conexao = db.obter()
    linha = conexao.execute(f"""
        SELECT COUNT(*) AS total,
               COALESCE(SUM(CASE WHEN {PENDENTE_SQL} THEN 0 ELSE 1 END), 0) AS auditados
        FROM equipamentos
    """).fetchone()
    tags = conexao.execute("SELECT tag FROM equipamentos WHERE tag <> ''")
    return {
        "total": linha["total"],
        "auditados": linha["auditados"],
        "pendentes": linha["total"] - linha["auditados"],
        "tags_fora_padrao": sum(1 for t in tags if not tag_valida(t["tag"])),
        "conflitos": total_conflitos(),
    }


def tags_fora_do_padrao():
    linhas = db.obter().execute(
        "SELECT * FROM equipamentos WHERE tag <> '' ORDER BY setor_grupo, tag")
    return [i for i in map(_dict, linhas) if not i["tag_ok"]]


# --- Conflitos --------------------------------------------------------------

def total_conflitos():
    return db.obter().execute("SELECT COUNT(*) FROM conflitos").fetchone()[0]


def registrar_conflito(chave, dados, arquivo):
    conteudo = json.dumps(dados, ensure_ascii=False, sort_keys=True)
    conexao = db.obter()
    repetido = conexao.execute(
        "SELECT 1 FROM conflitos WHERE chave = ? AND dados = ?",
        (chave, conteudo)).fetchone()
    if not repetido:
        conexao.execute(
            "INSERT INTO conflitos (chave, dados, arquivo) VALUES (?, ?, ?)",
            (chave, conteudo, arquivo))


def conflitos():
    resultado = []
    for linha in db.obter().execute("SELECT * FROM conflitos ORDER BY id"):
        resultado.append({
            "id": linha["id"],
            "arquivo": linha["arquivo"],
            "importado": json.loads(linha["dados"]),
            "atual": por_chave(linha["chave"]),
        })
    return resultado


def conflito(conflito_id):
    linha = db.obter().execute(
        "SELECT * FROM conflitos WHERE id = ?", (conflito_id,)).fetchone()
    if linha is None:
        return None
    return {"id": linha["id"], "chave": linha["chave"],
            "importado": json.loads(linha["dados"])}


def remover_conflito(conflito_id):
    db.obter().execute("DELETE FROM conflitos WHERE id = ?", (conflito_id,))


# --- Base de equipamentos do Effort (leitor de QR code) --------------------

CAMPOS_REFERENCIA_EFFORT = list(config.COLUNAS_REFERENCIA_EFFORT.keys())


def salvar_referencia_effort(linhas):
    """Substitui a base de referência inteira pelas linhas informadas."""
    conexao = db.obter()
    conexao.execute("DELETE FROM referencia_effort")
    colunas = CAMPOS_REFERENCIA_EFFORT
    conexao.executemany(
        f"INSERT OR REPLACE INTO referencia_effort ({', '.join(colunas)}) "
        f"VALUES ({', '.join('?' * len(colunas))})",
        [[texto(linha.get(c)) for c in colunas] for linha in linhas])


def total_referencia_effort():
    return db.obter().execute("SELECT COUNT(*) FROM referencia_effort").fetchone()[0]


def referencia_por_id(id_effort):
    linha = db.obter().execute(
        "SELECT * FROM referencia_effort WHERE id_effort = ?", (str(id_effort),)).fetchone()
    return dict(linha) if linha else None


# --- Preferências -----------------------------------------------------------

def preferencia(nome, padrao=""):
    linha = db.obter().execute(
        "SELECT valor FROM preferencias WHERE nome = ?", (nome,)).fetchone()
    return linha["valor"] if linha else padrao


def salvar_preferencia(nome, valor):
    conexao = db.obter()
    conexao.execute(
        "INSERT INTO preferencias (nome, valor) VALUES (?, ?) "
        "ON CONFLICT(nome) DO UPDATE SET valor = excluded.valor", (nome, valor))
    conexao.commit()
