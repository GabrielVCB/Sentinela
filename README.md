# Sentinela — Governança e Letramento em IA

Painel de governança e letramento em IA para reduzir o vazamento de informações corporativas
para IAs públicas (ChatGPT, Gemini, Claude e Copilot) sem vigiar o conteúdo das conversas.

A extensão lê o campo de texto no navegador, avisa antes do envio e registra apenas o alerta no
painel. O texto nunca é enviado nem guardado. O alerta contém site, departamento, colaborador,
IP de origem, nível de risco, tipos detectados, origem e a decisão (`enviou` ou `cancelou`).

**Versão atual: 2.9** — servidor, extensão e prévia.

## Uma arquitetura só

O produto é **Flask + Postgres + extensão Manifest V3**. O app em `src/` é uma **prévia visual
somente leitura**: não tem Convex, não tem login, não grava alertas e não é uma segunda
implementação do produto. O painel real é servido pelo Flask em `/painel`.

```
servidor/dados/regras.json    fonte única das 44 regras e das áreas
servidor/dados/mensagens.json fonte única das mensagens educativas
extensao/detectores.js        fonte única do motor de detecção
servidor/                     Flask, seed, APIs, painel Jinja e exportações
extensao/                     extensão MV3 usada no Chrome e no Edge
src/                          prévia React somente leitura
```

O Flask serve `extensao/detectores.js` em `/detectores.js` para a landing. A extensão carrega o
mesmo arquivo como content script. A prévia React importa esse arquivo. Não existe uma terceira
cópia do detector para divergir.

Se o seu ambiente ainda tiver `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL` ou
`CONVEX_DEPLOYMENT`, pode removê-las: nenhum arquivo do projeto as lê nesta versão.

## O que mudou na 2.9

- **Convex eliminado.** O app React não tem mais autenticação, banco, seed público ou mutações.
- **Uma fonte para regras e mensagens.** O seed do Python e a prévia leem
  `servidor/dados/*.json`; a extensão recebe a matriz do Postgres via `/api/config`.
- **Sincronização real de 30 minutos.** `chrome.alarms` acorda o service worker e atualiza a
  configuração mesmo com a aba aberta por horas.
- **Fila persistente de alertas.** Falhas de rede, timeout, 429 e 5xx vão para
  `chrome.storage.local` e são reenviadas a cada minuto; `evento_id` mantém a gravação
  idempotente.
- **Watchdog mais leve.** A verificação de editores que não disparam `input` caiu de 300 ms para
  1 s; `input` e `MutationObserver` continuam sendo o caminho rápido.
- **Login com lockout.** Cinco falhas bloqueiam a conta por 15 minutos no Postgres, não apenas
  em memória.
- **Rate limit.** `/api/alertas` aceita até 120 envios por minuto por IP; `/login` aceita até 20
  tentativas por 15 minutos por IP.
- **Migrações versionadas.** `schema_migrations` registra o esquema aplicado; não há mais
  alteração de coluna solta na subida.
- **Textos corrigidos.** A landing não promete “24 h” no plano gratuito nem “sem token”.

## Como funciona

1. A extensão observa o campo de texto e os anexos no navegador.
2. O motor local aplica detectores técnicos + as regras editáveis do painel.
3. O aviso aparece em Shadow DOM; risco médio/alto pede confirmação antes do envio.
4. Só o alerta é enviado. Se o servidor estiver dormindo ou a rede falhar, ele entra na fila
   local e é reenviado depois.
5. O painel mostra auditoria, relatórios por departamento e exportação CSV/PDF.

O colaborador não faz login. O painel é restrito a administradores, com senha scrypt e sessão
`HttpOnly`, `SameSite=Lax` e `Secure` em produção.

## Rodar localmente

O servidor não inicia sem Postgres, porque a subida aplica migrações e cria o administrador.

```bash
cd servidor
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export SENTINELA_DB_URL="postgresql://usuario:senha@host/banco?sslmode=require"
export SENTINELA_SECRET_KEY="uma-chave-local"
export SENTINELA_ADMIN_USUARIO="admin"
export SENTINELA_ADMIN_SENHA="uma-senha-forte"
export SENTINELA_AMBIENTE="dev"
export SENTINELA_COOKIE_SEGURO="0"
export SENTINELA_FORCAR_HTTPS="0"

gunicorn --bind 127.0.0.1:8080 --workers 1 --threads 4 app:app
```

Abra `http://127.0.0.1:8080/` para a landing e `http://127.0.0.1:8080/painel` para o painel.
O detector é servido em `http://127.0.0.1:8080/detectores.js`.

Para a prévia React:

```bash
bun install
bun run dev
```

Defina `VITE_SENTINELA_URL` no ambiente da prévia para que os botões “Abrir painel” apontem para
o Flask. Sem essa variável, a prévia usa `https://sentinela.suaempresa.com` como exemplo.

## Publicar no Render Free + Neon

O caminho recomendado para custo zero é **Render Free** para o Flask e **Neon Free** para o
Postgres. O passo a passo está em [DEPLOY.md](DEPLOY.md). Resumo:

1. Crie o Postgres no Neon e copie a connection string com `sslmode=require`.
2. Suba o repositório no GitHub.
3. Na Render, use **New → Blueprint** com o `render.yaml`.
4. Informe `SENTINELA_DB_URL` e `SENTINELA_ADMIN_SENHA`.
5. Depois do deploy, abra `/painel` → **06 · Instalação**.

O `render.yaml` roda a partir da raiz para que `extensao/detectores.js` exista no container e
seja servido em `/detectores.js`.

### UptimeRobot e a limitação real do plano gratuito

O Render Free **hiberna após 15 minutos sem tráfego** e tem **750 horas por workspace/mês**.
Um serviço ligado 24/7 consome cerca de 720 h em um mês de 30 dias e 744 h em um mês de 31 —
sobra pouca margem. O UptimeRobot pode chamar `GET /api/ping` a cada 5 minutos para manter o
serviço acordado, mas isso consome a cota e não transforma o plano em uma garantia de 24/7.

O Neon Free também tem limites e pode suspender por inatividade. Para um portfólio, isso é
aceitável desde que a página e a documentação digam “demo”, não “produção 24/7”. Para uso real
contínuo, a alternativa é uma instância sempre ligada (própria ou paga) ou Cloud Run com
`min-instances=1`, que também tem custo.

O UptimeRobot **não deve** ser usado para esconder a hibernação de um produto que promete
disponibilidade; ele serve para manter a demo acordada e para avisar quando o health check
falhar.

## Instalar a extensão

Use a pasta `extensao/` ou o ZIP `public/sentinela-extensao.zip`.

1. Abra `chrome://extensions` ou `edge://extensions`.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha `extensao/`.
4. Abra **Opções**.
5. Informe a URL do servidor, o código de instalação de **06 · Instalação**, o departamento e o
   colaborador.
6. Salve e use **Testar conexão** e **Sincronizar regras agora**.
7. Abra o ChatGPT/Gemini/Claude/Copilot e teste um texto com risco e um anexo.

A extensão 2.9 pede a permissão `alarms`, usada para sincronizar a matriz a cada 30 minutos e
reenviar a fila. Ela não lê o conteúdo das conversas além do campo de texto e dos anexos que o
usuário coloca no compositor.

## Banco e matriz

A tabela `regras` é a fonte do painel e da extensão. A semente vem de
`servidor/dados/regras.json`; `db.inicializar_banco()` aplica as migrações, copia o que falta e
descarta a semente. Alterar uma regra no painel invalida o cache de `/api/config`.

As migrações ficam em `MIGRACOES`, dentro de `servidor/db.py`, e são registradas em
`schema_migrations`. Nunca edite uma migração já publicada: acrescente outra.

## Segurança e privacidade

- Senhas com `scrypt`; nenhuma senha em texto puro.
- Cookie `HttpOnly`, `SameSite=Lax` e `Secure`; HSTS, CSP, `X-Frame-Options` e
  `Permissions-Policy`.
- Login com atraso, lockout persistido e rate limit por IP.
- Código de instalação obrigatório para a extensão; rotação em **06 · Instalação**.
- `evento_id` único para evitar alerta duplicado.
- Nenhum texto de conversa é transmitido. OCR e extração de PDF são locais.
- O painel não tem cadastro público de administrador; novos usuários são criados por um
  administrador autenticado.

## Testes

```bash
bun tsc -b --noEmit
bun run test
python -m py_compile servidor/*.py
python -m unittest discover -s tests -p "test_*.py" -v
```

O CI em `.github/workflows/ci.yml` roda os mesmos comandos.

## Limitações conhecidas

- A demo não foi testada em uma conta real de ChatGPT/Gemini/Claude/Copilot neste ambiente; os
  seletores podem mudar quando os sites mudarem.
- O Render Free hiberna; a primeira requisição depois disso pode demorar.
- O código de instalação é único para o workspace. Para muitas extensões, o próximo passo é
  token por dispositivo com revogação individual.
- A prévia React é somente leitura e não substitui o painel Flask.

## Licença

Projeto pessoal de portfólio. Ajuste a licença antes de reutilizar comercialmente.
