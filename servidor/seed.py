"""
Coletor da matriz de risco usada para semear o Postgres.

Este módulo NÃO é o cadastro em memória do sistema. Ele existe apenas para
montar a lista inicial de 44 regras a partir de regras.py; depois que o banco
é semeado, `limpar()` esvazia a lista. O cadastro real é a tabela `regras`.

As funções têm os mesmos nomes de antes para manter regras.py legível, mas o
único destino é a migration/seed de inicialização.
"""

MATRIZ = []


def criar(nome, area, tipo, padrao, risco, ativo=True):
    """Registra uma regra da semente e devolve o dicionário criado."""
    proximo_id = max([regra["id"] for regra in MATRIZ], default=0) + 1
    regra = {
        "id": proximo_id,
        "nome": nome,
        "area": area,
        "tipo": tipo,
        "padrao": padrao,
        "risco": risco,
        "ativo": ativo,
    }
    MATRIZ.append(regra)
    return regra


def listar():
    """Devolve as regras da semente para o db.py copiar para o Postgres."""
    return MATRIZ


def limpar():
    """Esvazia a semente depois da publicação; não guarda estado de request."""
    MATRIZ.clear()
