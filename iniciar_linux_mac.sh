#!/usr/bin/env bash
cd "$(dirname "$0")"

if [ ! -x ".venv/bin/python" ]; then
    echo "Criando ambiente virtual pela primeira vez..."
    python3 -m venv .venv || { echo "Instale o Python 3.10 ou superior."; exit 1; }
fi

if [ ! -f ".venv/instalado.ok" ]; then
    echo "Instalando dependências (só na primeira vez, precisa de internet)..."
    .venv/bin/python -m pip install --upgrade pip
    .venv/bin/python -m pip install -r requirements.txt || { echo "Falha na instalação."; exit 1; }
    touch .venv/instalado.ok
fi

.venv/bin/python run.py
