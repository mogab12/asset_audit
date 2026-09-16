"""
Inicia o aplicativo de Auditoria de Ativos.

    python run.py            -> servidor normal (waitress)
    python run.py --dev      -> modo desenvolvimento (recarrega ao editar o código)
"""
import socket
import sys

import config
from app import criar_app

app = criar_app()


def ip_da_rede():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


if __name__ == "__main__":
    print("\n  Auditoria de Ativos")
    print(f"  Neste computador:        http://127.0.0.1:{config.PORTA}")
    if config.HOST == "0.0.0.0":
        print(f"  Celular/tablet na rede:  http://{ip_da_rede()}:{config.PORTA}")
    print("  Para encerrar, pressione Ctrl+C.\n")

    if "--dev" in sys.argv:
        app.run(host=config.HOST, port=config.PORTA, debug=True)
    else:
        from waitress import serve
        serve(app, host=config.HOST, port=config.PORTA, threads=8)
