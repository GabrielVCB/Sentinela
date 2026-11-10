import json
import unittest
from pathlib import Path

CAMINHO = Path(__file__).resolve().parent.parent / "servidor" / "dados" / "sites.json"


class SitesTest(unittest.TestCase):
    def setUp(self):
        self.sites = json.loads(CAMINHO.read_text(encoding="utf-8"))["sites"]

    def test_ids_unicos(self):
        ids = [site["id"] for site in self.sites]
        self.assertEqual(len(ids), len(set(ids)))

    def test_todos_tem_nome_e_hosts(self):
        for site in self.sites:
            self.assertTrue(site["nome"].strip())
            self.assertTrue(site["hosts"])
            for host in site["hosts"]:
                self.assertNotIn("://", host)
                self.assertNotIn("/", host)

    def test_os_quatro_grupos_principais(self):
        self.assertEqual(
            {site["id"] for site in self.sites},
            {"chatgpt", "gemini", "claude", "copilot"},
        )


if __name__ == "__main__":
    unittest.main()
