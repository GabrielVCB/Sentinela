"""
Matriz de risco inicial do Sentinela.

A fonte única é `dados/regras.json`, lida pelo seed do Postgres e pela prévia
React. Este módulo só converte o JSON para o formato que `seed.py` espera.
"""
import json
from pathlib import Path

import seed

CAMINHO_MATRIZ = Path(__file__).resolve().parent / "dados" / "regras.json"


def carregar():
    """Lê a matriz compartilhada e preenche a semente do banco."""
    dados = json.loads(CAMINHO_MATRIZ.read_text(encoding="utf-8"))
    areas = dados.get("areas", [])

    for area in areas:
        for regra in area.get("regras", []):
            seed.criar(
                regra["nome"],
                area["nome"],
                regra["tipo"],
                regra["padrao"],
                regra["risco"],
                regra.get("ativo", True),
            )

    return areas


AREAS = carregar()
