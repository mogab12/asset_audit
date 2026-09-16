"""Importar/exportar planilhas e resolver conflitos."""
from datetime import datetime

from flask import (Blueprint, flash, redirect, render_template, request,
                   send_file, url_for)

import config
from app import mesclagem, planilha, repositorio
from app.utils import compactar

bp = Blueprint("arquivos", __name__)


@bp.route("/arquivos")
def pagina():
    return render_template("arquivos.html", resumo=repositorio.resumo())


@bp.route("/importar", methods=["POST"])
def importar():
    arquivos = [a for a in request.files.getlist("arquivos") if a.filename]
    if not arquivos:
        flash("Selecione pelo menos uma planilha.", "erro")
        return redirect(url_for("arquivos.pagina"))

    substituir = request.form.get("modo") == "substituir"
    totais = {"lidos": 0, "novos": 0, "atualizados": 0, "mantidos": 0, "conflitos": 0}

    for posicao, arquivo in enumerate(arquivos):
        try:
            itens = planilha.ler(arquivo.read())
        except planilha.ErroPlanilha as erro:
            flash(f"{arquivo.filename}: {erro}", "erro")
            continue
        except Exception as erro:  # arquivo corrompido, formato inesperado etc.
            flash(f"{arquivo.filename}: não foi possível ler ({erro}).", "erro")
            continue
        # "Substituir" limpa a base só antes do primeiro arquivo válido
        resumo = mesclagem.importar(itens, arquivo.filename,
                                    substituir_base=substituir)
        substituir = False
        for chave in totais:
            totais[chave] += resumo[chave]
        flash(f"{arquivo.filename}: {resumo['lidos']} linhas lidas.", "ok")

    flash(
        f"Resultado: {totais['novos']} novos, {totais['atualizados']} atualizados, "
        f"{totais['mantidos']} mantidos, {totais['conflitos']} conflitos.",
        "aviso" if totais["conflitos"] else "ok")

    if totais["conflitos"]:
        return redirect(url_for("arquivos.conflitos"))
    return redirect(url_for("principal.inicio"))


@bp.route("/exportar")
def exportar():
    pendentes = repositorio.total_conflitos()
    if pendentes and request.args.get("confirmar") != "1":
        flash(f"Há {pendentes} conflito(s) sem decisão. A exportação usará a "
              "versão que está na base. Resolva os conflitos ou exporte assim mesmo.",
              "aviso")
        return redirect(url_for("arquivos.pagina", conflitos_pendentes=1))

    auditor = compactar(repositorio.preferencia("auditor")) or "SEM_AUDITOR"
    carimbo = datetime.now().strftime("%Y-%m-%d_%H%M")
    nome = f"Auditoria_de_Ativos_{auditor}_{carimbo}.xlsx"
    return send_file(planilha.gerar(repositorio.todos()), as_attachment=True,
                     download_name=nome,
                     mimetype="application/vnd.openxmlformats-officedocument."
                              "spreadsheetml.sheet")


@bp.route("/limpar", methods=["POST"])
def limpar():
    if request.form.get("confirmacao", "").strip().upper() != "APAGAR":
        flash("Para apagar a base, digite APAGAR no campo de confirmação.", "erro")
        return redirect(url_for("arquivos.pagina"))
    repositorio.limpar_tudo()
    flash("Base apagada. Importe uma nova planilha para começar.", "ok")
    return redirect(url_for("principal.inicio"))


@bp.route("/conflitos")
def conflitos():
    campos = [(c, config.COLUNAS[c]) for c in config.CAMPOS_COMPARACAO + ["executante", "data"]]
    return render_template("conflitos.html", conflitos=repositorio.conflitos(),
                           campos=campos)


@bp.route("/conflitos/<int:conflito_id>", methods=["POST"])
def resolver(conflito_id):
    escolha = request.form.get("escolha")
    if escolha not in ("atual", "importado"):
        flash("Escolha uma das versões.", "erro")
    else:
        mesclagem.resolver(conflito_id, escolha)
        flash("Conflito resolvido.", "ok")
    return redirect(url_for("arquivos.conflitos"))
