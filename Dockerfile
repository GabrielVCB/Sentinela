FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    SENTINELA_AMBIENTE=producao \
    SENTINELA_COOKIE_SEGURO=1 \
    SENTINELA_FORCAR_HTTPS=1

WORKDIR /app

COPY servidor/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY servidor ./servidor
COPY extensao ./extensao
WORKDIR /app/servidor

EXPOSE 8080

# Cloud Run injeta PORT. Duas instâncias de trabalho com threads atendem
# centenas de extensões; o banco fica no Neon e o /api/config tem cache curto.
# Em produção o container exige SENTINELA_SECRET_KEY, SENTINELA_ADMIN_SENHA e
# SENTINELA_DB_URL; passe-as em runtime (nunca copie segredos para a imagem).
CMD exec gunicorn --bind :$PORT --workers 2 --threads 4 --timeout 60 --access-logfile - app:app
