"""Criação do aplicativo Flask."""
from flask import Flask

import config
from app import db, repositorio
from app.utils import nome_curto, tag_valida


def criar_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = config.CHAVE_SECRETA
    app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB por envio

    db.inicializar(app)

    from app.rotas import arquivos, auditoria, principal
    app.register_blueprint(principal.bp)
    app.register_blueprint(auditoria.bp)
    app.register_blueprint(arquivos.bp)

    with app.app_context():
        arquivos.garantir_referencia_inicial()

    app.jinja_env.filters["nome_curto"] = nome_curto
    app.jinja_env.filters["tag_valida"] = tag_valida

    @app.context_processor
    def variaveis_globais():
        return {
            "auditor": repositorio.preferencia("auditor"),
            "qtd_conflitos": repositorio.total_conflitos(),
            "rotulos_motivo": {**config.SITUACOES_TAG, **config.OUTROS_MOTIVOS},
            "padrao_tag": config.PADRAO_TAG,
        }

    return app
