"""
Configurações do aplicativo de Auditoria de Ativos.

Tudo que costuma mudar (padrão de TAG, porta, nomes de colunas) fica aqui,
para que não seja preciso mexer no restante do código.
"""
from pathlib import Path

# ---------------------------------------------------------------------------
# Caminhos
# ---------------------------------------------------------------------------
PASTA_BASE = Path(__file__).resolve().parent
PASTA_DADOS = PASTA_BASE / "dados"
ARQUIVO_BANCO = PASTA_DADOS / "auditoria.db"

# ---------------------------------------------------------------------------
# Servidor
# ---------------------------------------------------------------------------
# "0.0.0.0" permite que celulares/tablets na mesma rede acessem o aplicativo.
# Use "127.0.0.1" para aceitar acesso somente do próprio computador.
HOST = "0.0.0.0"
PORTA = 5000

# Troque por qualquer texto aleatório. Serve apenas para as mensagens na tela.
CHAVE_SECRETA = "troque-esta-chave-por-qualquer-texto"

# ---------------------------------------------------------------------------
# Padrão de TAG
# ---------------------------------------------------------------------------
# Letras primeiro, números depois. O hífen entre eles é opcional.
# Aceita: BINF1234, BINF-1234, CENT-0002
# Acusa:  174-0001, FLUXO2-0001, 1234BINF, BINF 1234
# TAGs fora do padrão são salvas normalmente, mas ficam sinalizadas.
PADRAO_TAG = r"^[A-Z][A-Z0-9]*-?[0-9]+$"

# ---------------------------------------------------------------------------
# Situação da TAG (coluna "Motivo não Conformidade" do Effort)
# ---------------------------------------------------------------------------
# chave  = valor gravado na planilha (igual ao Effort, inclusive a grafia)
# valor  = texto mostrado na tela
MOTIVO_PENDENTE = "Pendente"
MOTIVO_CONFORME = "Conforme"
MOTIVO_OUTRO_LOCAL = "Encontrado em outro local"
MOTIVO_SEM_PLAQUETA = "Sem Plaqueta"

SITUACOES_TAG = {
    "Conforme": "Conforme",
    "Pendente": "Pendente",
    "Sem Plaqueta": "Sem plaqueta",
    "Plaqueta Razurada": "Plaqueta rasurada",
}

# Outros valores que o Effort pode trazer. São preservados na importação
# e aparecem como opção extra apenas nos itens que já os possuem.
OUTROS_MOTIVOS = {
    "Novo Equipamento": "Novo equipamento",
    "Equipamento Antigo": "Equipamento antigo",
}

STATUS_CONFORME = "Conforme"
STATUS_NAO_CONFORME = "Não conforme"

# ---------------------------------------------------------------------------
# Colunas da planilha (mesma ordem da exportação do Effort)
# ---------------------------------------------------------------------------
# campo interno -> título da coluna na planilha
COLUNAS = {
    "status": "Status",
    "modelo_anterior": "Modelo Anterior",
    "modelo": "Modelo",
    "tag_anterior": "TAG Anterior",
    "tag": "TAG",
    "ns_anterior": "Número de Série Anterior",
    "ns": "Número de Série",
    "patrimonio_anterior": "Patrimônio Anterior",
    "patrimonio": "Patrimônio",
    "setor_origem": "Setor Origem",
    "setor_atual": "Setor Atual",
    "equipamento": "Equipamento",
    "motivo": "Motivo não Conformidade",
    "observacao": "Observação",
    "executante": "Executante",
    "data": "Data",
}
NOME_ABA_EXPORTACAO = "Auditoria"

# Campos comparados para decidir se duas auditorias do mesmo equipamento
# são iguais (Executante e Data não entram: dois auditores podem ter
# constatado exatamente a mesma coisa).
CAMPOS_COMPARACAO = [
    "status", "modelo", "tag", "ns", "patrimonio",
    "setor_atual", "motivo", "observacao",
]
