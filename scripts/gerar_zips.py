#!/usr/bin/env python3
"""Gera os ZIPs públicos a partir do código atual do repositório.

O painel/landing apontam para `public/sentinela-projeto.zip` e
`public/sentinela-extensao.zip`. Sem esta etapa, o download entregava um
snapshot antigo do projeto — e o deploy feito a partir dele continuava na
versão anterior. Rode este script depois de qualquer alteração publicada.
"""
from __future__ import annotations

import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PUBLICO = RAIZ / "public"
IGNORAR_DIR = {
    ".git",
    ".github",
    ".venv",
    "node_modules",
    ".preview",
    "dist",
    "build",
    ".next",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
}
IGNORAR_ARQUIVO = {
    "public/sentinela-projeto.zip",
    "public/sentinela-extensao.zip",
}


def arquivos_do_projeto():
    for caminho in sorted(RAIZ.rglob("*")):
        if not caminho.is_file():
            continue
        relativo = caminho.relative_to(RAIZ)
        if any(parte in IGNORAR_DIR for parte in relativo.parts):
            continue
        if relativo.as_posix() in IGNORAR_ARQUIVO:
            continue
        if caminho.name == ".env" or caminho.suffix == ".log":
            continue
        yield caminho, relativo.as_posix()


def gerar_projeto() -> Path:
    destino = PUBLICO / "sentinela-projeto.zip"
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as zipado:
        for caminho, relativo in arquivos_do_projeto():
            zipado.write(caminho, relativo)
        for vazio in ("servidor", "extensao", "public"):
            if (RAIZ / vazio).is_dir():
                zipado.writestr(f"{vazio}/", "")
    return destino


def gerar_extensao() -> Path:
    destino = PUBLICO / "sentinela-extensao.zip"
    base = RAIZ / "extensao"
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as zipado:
        for caminho in sorted(base.rglob("*")):
            if caminho.is_file():
                zipado.write(caminho, "extensao/" + caminho.relative_to(base).as_posix())
    return destino


if __name__ == "__main__":
    for arquivo in (gerar_projeto(), gerar_extensao()):
        print(f"{arquivo.relative_to(RAIZ)}: {arquivo.stat().st_size / 1024 / 1024:.1f} MB")
