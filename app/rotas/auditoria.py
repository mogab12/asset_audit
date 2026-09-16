"""Formulário de auditoria de um equipamento."""
import re

from flask import (Blueprint, abort, flash, jsonify, redirect, render_template,
                   request, url_for)

import config
from app import db, repositorio
from app.utils import hoje, nome_curto, tag_valida

bp = Blueprint("auditoria", __name__, url_prefix="/item")

_PADRAO_ID_EFFORT = re.compile(config.PADRAO_URL_EFFORT)


def _extrair_id_effort(texto):
    texto = (texto or "").strip()
    encontrado = _PADRAO_ID_EFFORT.search(texto)
    if encontrado:
        return encontrado.group(1)
    return texto if texto.isdigit() else None


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


def _aplicar_auditoria(item, setor_encontrado, escolha, campos_extra=None):
    """Decide o motivo final (considerando "Encontrado em outro local") e grava."""
    origem = item["setor_origem"]
    motivo = escolha
    if escolha == config.MOTIVO_CONFORME and origem and setor_encontrado != origem:
        motivo = config.MOTIVO_OUTRO_LOCAL

    dados = {
        "setor_atual": setor_encontrado,
        "motivo": motivo,
        "status": (config.STATUS_CONFORME if motivo == config.MOTIVO_CONFORME
                   else config.STATUS_NAO_CONFORME),
        "executante": repositorio.preferencia("auditor"),
        "data": hoje(),
    }
    if campos_extra:
        dados.update(campos_extra)
    item.update(dados)
    repositorio.atualizar(item["id"], item)
    db.obter().commit()
    return motivo


def _salvar(item, voltar):
    form = request.form
    escolha = form.get("motivo", config.MOTIVO_CONFORME)
    if escolha not in _opcoes_motivo(item):
        escolha = config.MOTIVO_CONFORME

    setor_encontrado = form.get("setor_atual", "").strip() or item["setor_atual"]
    motivo = _aplicar_auditoria(item, setor_encontrado, escolha, campos_extra={
        "tag": form.get("tag", item["tag"]).strip().upper(),
        "ns": form.get("ns", item["ns"]).strip(),
        "patrimonio": form.get("patrimonio", item["patrimonio"]).strip(),
        "modelo": form.get("modelo", item["modelo"]).strip(),
        "observacao": form.get("observacao", "").strip(),
    })

    identificacao = item["tag"] or item["patrimonio"] or nome_curto(item["equipamento"])
    rotulo = {**config.SITUACOES_TAG, **config.OUTROS_MOTIVOS}.get(motivo, motivo)
    if motivo == config.MOTIVO_PENDENTE:
        flash(f"{identificacao}: dados salvos, mas o item continua pendente.", "aviso")
    else:
        flash(f"{identificacao} registrado: {rotulo}.", "ok")
    if not tag_valida(item["tag"]):
        flash(f"A TAG {item['tag']} está fora do padrão e deve ser trocada.", "aviso")

    return redirect(url_for("principal.setor", nome=voltar))


@bp.route("/escanear", methods=["POST"])
def escanear():
    """Auditoria automática a partir da leitura de um QR code do Effort."""
    if not repositorio.preferencia("auditor"):
        return jsonify(ok=False, precisa_auditor=True,
                       erro="Informe seu nome antes de auditar."), 400

    dados = request.get_json(silent=True) or {}
    id_effort = _extrair_id_effort(dados.get("texto", ""))
    setor_atual = (dados.get("setor") or "").strip()
    if not id_effort:
        return jsonify(ok=False, erro="QR code não reconhecido."), 400

    item = repositorio.por_id_effort(id_effort)
    if item is None:
        ref = repositorio.referencia_por_id(id_effort)
        if ref is None:
            return jsonify(ok=False, erro=(
                f"ID {id_effort} não encontrado na base de equipamentos (Effort). "
                "Atualize a planilha em Planilhas.")), 404

        item = repositorio.por_tag(ref["tag"]) if ref["tag"] else None
        if item is None:
            novo_id = repositorio.inserir(repositorio.preparar({
                "equipamento": ref["equipamento"],
                "modelo": ref["modelo"],
                "tag": ref["tag"],
                "ns": ref["ns"],
                "patrimonio": ref["patrimonio"],
                "setor_origem": ref["setor"],
                "setor_atual": ref["setor"],
                "motivo": config.MOTIVO_PENDENTE,
                "id_effort": id_effort,
            }))
            db.obter().commit()
            item = repositorio.por_id(novo_id)
        else:
            repositorio.definir_id_effort(item["id"], id_effort)
            db.obter().commit()

    motivo = _aplicar_auditoria(item, setor_atual or item["setor_atual"], config.MOTIVO_CONFORME)
    rotulo = {**config.SITUACOES_TAG, **config.OUTROS_MOTIVOS}.get(motivo, motivo)
    identificacao = item["tag"] or item["patrimonio"] or nome_curto(item["equipamento"])
    return jsonify(ok=True, item_id=item["id"], identificacao=identificacao,
                   motivo=motivo, rotulo=rotulo)


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
