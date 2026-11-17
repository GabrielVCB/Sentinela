#!/usr/bin/env python3
"""Sobe o painel Flask e um Postgres embutido para o preview do Freebuff.

Este processo é iniciado pelo plugin do Vite (veja vite.config.ts). Ele não
faz parte da implantação: em produção o painel continua usando o Postgres
externo e o gunicorn do render.yaml.

O banco fica em `.preview/pgdata` e é criado/isolado neste projeto. Para
recomeçar do zero, pare o preview e apague essa pasta.
"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pgserver

RAIZ = Path(__file__).resolve().parent.parent
PASTA_PREVIEW = RAIZ / ".preview"
DADOS_PG = PASTA_PREVIEW / "pgdata"
PORTA = int(os.environ.get("SENTINELA_PREVIEW_PANEL_PORT", "5001"))
URL_PAINEL = f"http://127.0.0.1:{PORTA}"

processo = None
servidor_pg = None


def _parar(_sinal=None, _frame=None) -> None:
    global processo, servidor_pg
    if processo is not None and processo.poll() is None:
        processo.terminate()
        try:
            processo.wait(timeout=8)
        except subprocess.TimeoutExpired:
            processo.kill()
    if servidor_pg is not None:
        try:
            servidor_pg.cleanup()
        except Exception:
            pass
        servidor_pg = None
    raise SystemExit(0)


def _painel_existente() -> bool:
    try:
        with urllib.request.urlopen(URL_PAINEL + "/api/ping", timeout=1.5) as resposta:
            return resposta.status == 200
    except (OSError, urllib.error.URLError):
        return False


def _esperar_painel(limite: float = 90.0) -> bool:
    inicio = time.monotonic()
    while time.monotonic() - inicio < limite:
        if processo is not None and processo.poll() is not None:
            return False
        try:
            with urllib.request.urlopen(URL_PAINEL + "/api/ping", timeout=2) as resposta:
                if resposta.status == 200:
                    return True
        except (OSError, urllib.error.URLError):
            time.sleep(0.8)
    return False


def _semear_demonstracao(uri: str) -> None:
    """Cria alguns alertas/dispositivos só no banco de preview, uma única vez."""
    import psycopg
    from psycopg.rows import dict_row

    with psycopg.connect(uri, row_factory=dict_row) as conexao:
        total = conexao.execute("SELECT COUNT(*) AS total FROM alertas").fetchone()["total"]
        if total:
            return

        areas = [
            linha["nome"]
            for linha in conexao.execute("SELECT nome FROM areas ORDER BY nome").fetchall()
        ]
        if not areas:
            return

        agora = datetime.now(timezone.utc)
        sites = ["ChatGPT", "Gemini", "Claude", "Copilot"]
        pessoas = [
            ("Ana Souza", areas[0]),
            ("Bruno Lima", areas[1 % len(areas)]),
            ("Carla Mendes", areas[2 % len(areas)]),
            ("Diego Alves", areas[3 % len(areas)]),
        ]
        itens = [
            ("CPF", "alto", "Dados pessoais"),
            ("E-mail corporativo", "medio", "Dados corporativos"),
            ("Contrato", "alto", "Jurídico"),
            ("Credencial de acesso", "alto", "Segurança da Informação"),
            ("Nome de colaborador", "baixo", "Dados pessoais"),
        ]

        for indice in range(14):
            colaborador, departamento = pessoas[indice % len(pessoas)]
            nivel = ("alto", "medio", "baixo")[indice % 3]
            acao = "enviou" if indice % 4 else "cancelou"
            data_hora = agora - timedelta(
                days=indice % 9,
                hours=(indice * 3) % 10,
                minutes=(indice * 7) % 60,
            )
            linha = conexao.execute(
                """
                INSERT INTO alertas
                    (evento_id, origem, data_hora, site, departamento, colaborador,
                     nivel_risco, acao)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    f"preview-{indice}",
                    ("texto", "colagem", "imagem", "pdf")[indice % 4],
                    data_hora.isoformat(),
                    sites[indice % len(sites)],
                    departamento,
                    colaborador,
                    nivel,
                    acao,
                ),
            ).fetchone()
            for tipo, risco, area in itens[indice % 3 : indice % 3 + 2]:
                conexao.execute(
                    """
                    INSERT INTO alerta_itens (alerta_id, tipo_detectado, risco, area)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (linha["id"], tipo, risco, area),
                )

        for indice, (colaborador, departamento) in enumerate(pessoas):
            visto = agora - timedelta(minutes=indice * 17)
            conexao.execute(
                """
                INSERT INTO dispositivos
                    (id, colaborador, setor, versao, codigo_versao, ativo,
                     primeiro_visto, ultimo_visto)
                VALUES (%s, %s, %s, %s, 1, 1, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    f"dev-preview-{indice + 1}",
                    colaborador,
                    departamento,
                    "3.0.1",
                    (agora - timedelta(days=20)).isoformat(),
                    visto.isoformat(),
                ),
            )


def main() -> int:
    global processo, servidor_pg

    # Ao recarregar o vite.config.ts, o Vite pode iniciar um novo plugin antes
    # de o processo anterior terminar. Reaproveita o painel já saudável em vez
    # de disputar a mesma porta.
    if _painel_existente():
        print(f"[preview] Painel já está em execução em {URL_PAINEL}.", flush=True)
        return 0

    DADOS_PG.mkdir(parents=True, exist_ok=True)
    servidor_pg = pgserver.PostgresServer(DADOS_PG)
    servidor_pg.ensure_postgres_running()
    uri = servidor_pg.get_uri()

    ambiente = os.environ.copy()
    ambiente.update(
        {
            "SENTINELA_DB_URL": uri,
            "SENTINELA_AMBIENTE": "dev",
            "SENTINELA_SECRET_KEY": "preview-sentinela-nao-use-em-producao",
            "SENTINELA_ADMIN_USUARIO": "admin",
            "SENTINELA_ADMIN_SENHA": "admin123",
            "SENTINELA_COOKIE_SEGURO": "0",
            "SENTINELA_FORCAR_HTTPS": "0",
            "SENTINELA_CONFIG_CACHE": "0",
            "SENTINELA_PREVIEW": "1",
            "PYTHONUNBUFFERED": "1",
        }
    )

    print(f"[preview] Postgres local em {DADOS_PG}", flush=True)
    print(f"[preview] Painel em {URL_PAINEL}", flush=True)
    processo = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "gunicorn",
            "--bind",
            f"127.0.0.1:{PORTA}",
            "--workers",
            "1",
            "--threads",
            "4",
            "--timeout",
            "60",
            "--reload",
            "--access-logfile",
            "-",
            "--error-logfile",
            "-",
            "app:app",
        ],
        cwd=str(RAIZ / "servidor"),
        env=ambiente,
    )

    signal.signal(signal.SIGTERM, _parar)
    signal.signal(signal.SIGINT, _parar)

    if _esperar_painel():
        try:
            _semear_demonstracao(uri)
            print("[preview] Dados de demonstração prontos.", flush=True)
        except Exception as erro:
            print(f"[preview] Aviso: não semeei dados de demonstração: {erro}", flush=True)
    else:
        print("[preview] O painel não respondeu a tempo; veja o log acima.", flush=True)

    codigo = processo.wait()
    if servidor_pg is not None:
        try:
            servidor_pg.cleanup()
        except Exception:
            pass
        servidor_pg = None
    return codigo


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        _parar()
