"""Tela inicial, setores, pesquisa e nome do auditor."""
from flask import (Blueprint, flash, redirect, render_template, request,
                   url_for)

from app import repositorio
from app.utils import compactar, termos_pesquisa

bp = Blueprint("principal", __name__)

FILTROS = {"pendentes": "Pendentes", "auditados": "Auditados", "todos": "Todos"}


def _correspondencia_exata(item, consulta):
    """True se a pesquisa é exatamente a TAG, o nº de série ou o patrimônio."""
    alvo = compactar(consulta)
    campos = ("tag", "tag_anterior", "ns", "ns_anterior",
              "patrimonio", "patrimonio_anterior")
    return any(alvo and compactar(item[c]) == alvo for c in campos)


@bp.route("/")
def inicio():
    consulta = request.args.get("q", "").strip()
    resultados = repositorio.pesquisar(termos_pesquisa(consulta)) if consulta else []
    return render_template(
        "inicio.html",
        setores=repositorio.setores(),
        resumo=repositorio.resumo(),
        consulta=consulta,
        resultados=resultados,
    )


@bp.route("/setor/<path:nome>")
def setor(nome):
    filtro = request.args.get("filtro", "pendentes")
    if filtro not in FILTROS:
        filtro = "pendentes"
    consulta = request.args.get("q", "").strip()
    termos = termos_pesquisa(consulta)

    em_outros = []
    if termos:
        itens = repositorio.pesquisar(termos, setor=nome)
        # Leitor de código de barras: achou exatamente 1 pendente -> abre direto
        if (len(itens) == 1 and itens[0]["pendente"]
                and _correspondencia_exata(itens[0], consulta)):
            return redirect(url_for("auditoria.auditar",
                                    item_id=itens[0]["id"], voltar=nome))
        if not itens:
            em_outros = repositorio.pesquisar(termos, fora_do_setor=nome)
    else:
        itens = repositorio.itens_do_setor(nome, filtro)

    dados_setor = next((s for s in repositorio.setores() if s["nome"] == nome),
                       {"nome": nome, "total": 0, "auditados": 0, "percentual": 0})

    return render_template(
        "setor.html",
        setor=dados_setor,
        itens=itens,
        em_outros=em_outros,
        vindos=repositorio.vindos_de_outro_setor(nome),
        consulta=consulta,
        filtro=filtro,
        filtros=FILTROS,
    )


@bp.route("/tags-fora-do-padrao")
def tags_fora_do_padrao():
    return render_template("tags.html", itens=repositorio.tags_fora_do_padrao())


@bp.route("/auditor", methods=["GET", "POST"])
def auditor():
    proximo = request.values.get("proximo", "")
    if not proximo.startswith("/") or proximo.startswith("//"):
        proximo = url_for("principal.inicio")
    if request.method == "POST":
        nome = " ".join(request.form.get("nome", "").upper().split())
        if not nome:
            flash("Informe o seu nome para continuar.", "erro")
        else:
            repositorio.salvar_preferencia("auditor", nome)
            flash(f"Auditor definido: {nome}.", "ok")
            return redirect(proximo)
    return render_template("auditor.html", proximo=proximo)
