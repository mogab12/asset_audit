"""Formulário de auditoria de um equipamento."""
from flask import (Blueprint, abort, flash, redirect, render_template, request,
                   url_for)

import config
from app import db, repositorio
from app.utils import hoje, nome_curto, tag_valida

bp = Blueprint("auditoria", __name__, url_prefix="/item")


def _exigir_auditor():
    if not repositorio.preferencia("auditor"):
        flash("Antes de auditar, informe o seu nome.", "aviso")
        return redirect(url_for("principal.auditor", proximo=request.full_path))
    return None


def _opcoes_motivo(item):
    """Situações da TAG + o valor atual do item, se for um valor extra."""
    opcoes = dict(config.SITUACOES_TAG)
    if item["motivo"] in config.OUTROS_MOTIVOS:
        opcoes[item["motivo"]] = config.OUTROS_MOTIVOS[item["motivo"]]
    return opcoes


def _motivo_na_tela(item):
    if item["pendente"]:
        return config.MOTIVO_SEM_PLAQUETA
    if item["motivo"] == config.MOTIVO_OUTRO_LOCAL:
        return config.MOTIVO_CONFORME
    return item["motivo"]


@bp.route("/<int:item_id>", methods=["GET", "POST"])
def auditar(item_id):
    item = repositorio.por_id(item_id)
    if item is None:
        abort(404)
    exigencia = _exigir_auditor()
    if exigencia:
        return exigencia

    voltar = request.values.get("voltar") or item["setor_grupo"]

    if request.method == "POST":
        return _salvar(item, voltar)

    # Onde foi encontrado: se veio de outro setor, sugere o setor atual da tela;
    # se ainda está pendente, sugere onde deveria estar; senão, o que já foi salvo.
    if request.args.get("encontrado_em"):
        encontrado_em = request.args["encontrado_em"]
    elif item["pendente"]:
        encontrado_em = item["setor_origem"] or item["setor_atual"]
    else:
        encontrado_em = item["setor_atual"]

    return render_template(
        "auditar.html",
        item=item,
        voltar=voltar,
        setores=repositorio.nomes_setores(),
        encontrado_em=encontrado_em,
        opcoes_motivo=_opcoes_motivo(item),
        motivo_selecionado=_motivo_na_tela(item),
    )


def _salvar(item, voltar):
    form = request.form
    escolha = form.get("motivo", config.MOTIVO_CONFORME)
    if escolha not in _opcoes_motivo(item):
        escolha = config.MOTIVO_CONFORME

    setor_encontrado = form.get("setor_atual", "").strip() or item["setor_atual"]
    origem = item["setor_origem"]

    motivo = escolha
    if escolha == config.MOTIVO_CONFORME and origem and setor_encontrado != origem:
        motivo = config.MOTIVO_OUTRO_LOCAL

    item.update({
        "setor_atual": setor_encontrado,
        "motivo": motivo,
        "status": (config.STATUS_CONFORME if motivo == config.MOTIVO_CONFORME
                   else config.STATUS_NAO_CONFORME),
        "tag": form.get("tag", item["tag"]).strip().upper(),
        "ns": form.get("ns", item["ns"]).strip(),
        "patrimonio": form.get("patrimonio", item["patrimonio"]).strip(),
        "modelo": form.get("modelo", item["modelo"]).strip(),
        "observacao": form.get("observacao", "").strip(),
        "executante": repositorio.preferencia("auditor"),
        "data": hoje(),
    })
    repositorio.atualizar(item["id"], item)
    db.obter().commit()

    identificacao = item["tag"] or item["patrimonio"] or nome_curto(item["equipamento"])
    rotulo = {**config.SITUACOES_TAG, **config.OUTROS_MOTIVOS}.get(motivo, motivo)
    if motivo == config.MOTIVO_PENDENTE:
        flash(f"{identificacao}: dados salvos, mas o item continua pendente.", "aviso")
    else:
        flash(f"{identificacao} registrado: {rotulo}.", "ok")
    if not tag_valida(item["tag"]):
        flash(f"A TAG {item['tag']} está fora do padrão e deve ser trocada.", "aviso")

    return redirect(url_for("principal.setor", nome=voltar))


@bp.route("/<int:item_id>/desfazer", methods=["POST"])
def desfazer(item_id):
    """Volta o item para pendente, restaurando os dados do cadastro."""
    item = repositorio.por_id(item_id)
    if item is None:
        abort(404)
    item.update({
        "motivo": config.MOTIVO_PENDENTE,
        "status": config.STATUS_NAO_CONFORME,
        "setor_atual": item["setor_origem"] or item["setor_atual"],
        "observacao": "",
        "executante": "",
        "data": "",
    })
    for campo in ("modelo", "tag", "ns", "patrimonio"):
        if item[f"{campo}_anterior"]:
            item[campo] = item[f"{campo}_anterior"]
    repositorio.atualizar(item_id, item)
    db.obter().commit()
    flash("Auditoria desfeita. O item voltou para pendente.", "ok")
    voltar = request.form.get("voltar") or item["setor_grupo"]
    return redirect(url_for("principal.setor", nome=voltar))
