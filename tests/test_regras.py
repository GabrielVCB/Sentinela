import json
import sys
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "servidor"))

import regras  # noqa: E402


class MatrizTest(unittest.TestCase):
    def test_quarenta_e_quatro_regras(self):
        total = sum(len(area["regras"]) for area in regras.AREAS)
        self.assertEqual(total, 44)

    def test_nomes_unicos_por_area(self):
        for area in regras.AREAS:
            nomes = [regra["nome"] for regra in area["regras"]]
            self.assertEqual(len(nomes), len(set(nomes)), area["nome"])

    def test_tipos_e_riscos_validos(self):
        for area in regras.AREAS:
            for regra in area["regras"]:
                self.assertIn(regra["tipo"], ("regex", "palavra-chave"))
                self.assertIn(regra["risco"], ("baixo", "medio", "alto"))
                self.assertTrue(regra["padrao"].strip())

    def test_json_e_carregado_pelo_mesmo_arquivo(self):
        dados = json.loads((RAIZ / "servidor" / "dados" / "regras.json").read_text("utf-8"))
        self.assertEqual(len(dados["areas"]), len(regras.AREAS))
        self.assertEqual(
            sum(len(area["regras"]) for area in dados["areas"]),
            44,
        )


if __name__ == "__main__":
    unittest.main()
