"""Testes das regras principais. Rode com:  python -m unittest -v"""
import tempfile
import unittest
from pathlib import Path

import config

# Usa um banco temporário para não mexer nos dados reais
_pasta = tempfile.mkdtemp()
config.PASTA_DADOS = Path(_pasta)
config.ARQUIVO_BANCO = Path(_pasta) / "teste.db"

from app import criar_app, mesclagem, planilha, repositorio  # noqa: E402
from app.utils import compactar, gerar_chave, tag_valida  # noqa: E402


def item(**campos):
    base = {
        "status": "Não conforme", "modelo_anterior": "AGILIA", "modelo": "AGILIA",
        "tag_anterior": "BSER-0010", "tag": "BSER-0010",
        "ns_anterior": "25508676", "ns": "25508676",
        "patrimonio_anterior": "", "patrimonio": "",
        "setor_origem": "UNIDADE NEONATAL", "setor_atual": "UNIDADE NEONATAL",
        "equipamento": "BOMBA DE SERINGA AGILIA  TAG:BSER-0010",
        "motivo": "Pendente", "observacao": "", "executante": "", "data": "",
    }
    base.update(campos)
    return base


AUDITADO_A = dict(motivo="Conforme", status="Conforme", executante="ANA", data="15/09/2026")
AUDITADO_B = dict(motivo="Sem Plaqueta", executante="BRUNO", data="15/09/2026")


class TestTag(unittest.TestCase):
    def test_validas(self):
        for tag in ["BINF1234", "BINF-1234", "CENT-0002", "binf1234", ""]:
            self.assertTrue(tag_valida(tag), tag)

    def test_invalidas(self):
        for tag in ["174-0001", "2-0001", "1234", "1234BINF", "BINF 1234", "BINF-", "BINF"]:
            self.assertFalse(tag_valida(tag), tag)

    def test_pesquisa_ignora_pontuacao(self):
        self.assertEqual(compactar("200.021348"), "200021348")
        self.assertEqual(compactar("Bomba de Infusão"), "BOMBADEINFUSAO")


class TestDecisao(unittest.TestCase):
    def test_ambos_pendentes(self):
        self.assertEqual(mesclagem.decidir(item(), item()), mesclagem.MANTER)

    def test_novo_auditado_substitui_pendente(self):
        self.assertEqual(mesclagem.decidir(item(), item(**AUDITADO_A)), mesclagem.SUBSTITUIR)

    def test_novo_pendente_nao_substitui_auditado(self):
        self.assertEqual(mesclagem.decidir(item(**AUDITADO_A), item()), mesclagem.MANTER)

    def test_auditados_iguais_mesmo_com_auditor_diferente(self):
        outro = item(**{**AUDITADO_A, "executante": "CARLA"})
        self.assertEqual(mesclagem.decidir(item(**AUDITADO_A), outro), mesclagem.MANTER)

    def test_auditados_diferentes_geram_conflito(self):
        self.assertEqual(mesclagem.decidir(item(**AUDITADO_A), item(**AUDITADO_B)),
                         mesclagem.CONFLITO)


class TestImportacao(unittest.TestCase):
    def setUp(self):
        self.app = criar_app()
        self.contexto = self.app.app_context()
        self.contexto.push()
        repositorio.limpar_tudo()

    def tearDown(self):
        self.contexto.pop()

    def test_fluxo_completo_com_conflito(self):
        r = mesclagem.importar([item(), item()], "base.xlsx")
        self.assertEqual((r["novos"], r["mantidos"]), (1, 1))

        r = mesclagem.importar([item(**AUDITADO_A)], "ana.xlsx")
        self.assertEqual(r["atualizados"], 1)

        r = mesclagem.importar([item(**AUDITADO_B)], "bruno.xlsx")
        self.assertEqual(r["conflitos"], 1)

        conflito = repositorio.conflitos()[0]
        mesclagem.resolver(conflito["id"], "importado")
        atual = repositorio.por_chave(gerar_chave(item()))
        self.assertEqual(atual["motivo"], "Sem Plaqueta")
        self.assertEqual(repositorio.total_conflitos(), 0)

    def test_exportar_e_importar_de_novo(self):
        mesclagem.importar([item(**AUDITADO_A), item(tag_anterior="X-1", tag="X-1")], "a.xlsx")
        arquivo = planilha.gerar(repositorio.todos()).getvalue()
        lidos = planilha.ler(arquivo)
        self.assertEqual(len(lidos), 2)
        self.assertEqual(lidos[0]["executante"], "ANA")

        repositorio.limpar_tudo()
        r = mesclagem.importar(lidos, "reimportado.xlsx")
        self.assertEqual(r["novos"], 2)


if __name__ == "__main__":
    unittest.main()
