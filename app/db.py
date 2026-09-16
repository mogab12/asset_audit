"""Banco de dados local (SQLite, um único arquivo em dados/auditoria.db)."""
import sqlite3

from flask import g

import config

ESQUEMA = """
CREATE TABLE IF NOT EXISTS equipamentos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    chave               TEXT NOT NULL UNIQUE,
    setor_grupo         TEXT NOT NULL DEFAULT '',
    busca               TEXT NOT NULL DEFAULT '',
    status              TEXT DEFAULT '',
    modelo_anterior     TEXT DEFAULT '',
    modelo              TEXT DEFAULT '',
    tag_anterior        TEXT DEFAULT '',
    tag                 TEXT DEFAULT '',
    ns_anterior         TEXT DEFAULT '',
    ns                  TEXT DEFAULT '',
    patrimonio_anterior TEXT DEFAULT '',
    patrimonio          TEXT DEFAULT '',
    setor_origem        TEXT DEFAULT '',
    setor_atual         TEXT DEFAULT '',
    equipamento         TEXT DEFAULT '',
    motivo              TEXT DEFAULT '',
    observacao          TEXT DEFAULT '',
    executante          TEXT DEFAULT '',
    data                TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_equip_setor ON equipamentos (setor_grupo);
CREATE INDEX IF NOT EXISTS idx_equip_atual ON equipamentos (setor_atual);

-- Auditorias divergentes que aguardam a escolha do usuário
CREATE TABLE IF NOT EXISTS conflitos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    chave       TEXT NOT NULL,
    dados       TEXT NOT NULL,      -- versão importada (JSON)
    arquivo     TEXT DEFAULT '',
    criado_em   TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conf_chave ON conflitos (chave);

CREATE TABLE IF NOT EXISTS preferencias (
    nome  TEXT PRIMARY KEY,
    valor TEXT
);
"""


def conectar():
    config.PASTA_DADOS.mkdir(parents=True, exist_ok=True)
    conexao = sqlite3.connect(config.ARQUIVO_BANCO)
    conexao.row_factory = sqlite3.Row
    conexao.execute("PRAGMA journal_mode=WAL")  # leitura/escrita mais rápidas
    return conexao


def obter():
    """Conexão da requisição atual (aberta uma vez e reaproveitada)."""
    if "db" not in g:
        g.db = conectar()
    return g.db


def fechar(_erro=None):
    conexao = g.pop("db", None)
    if conexao is not None:
        conexao.close()


def inicializar(app):
    with conectar() as conexao:
        conexao.executescript(ESQUEMA)
    app.teardown_appcontext(fechar)
