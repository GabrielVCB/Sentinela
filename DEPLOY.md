# Deploy — Sentinela 2.9 no Render Free + Neon

Este é o caminho de custo zero do projeto: **Render Free** para o Flask, **Neon Free** para o
Postgres e, opcionalmente, **UptimeRobot** para manter a demo acordada. O mesmo container pode
ser publicado no Cloud Run depois; o código não muda.

## 1. Pré-requisitos

- Conta no GitHub.
- Conta na Render (plano Free).
- Conta no Neon (plano Free).
- Conta no UptimeRobot (plano Free), se quiser o keep-alive.

O Render Free não exige cartão. O Neon Free também não. Nenhum dos dois promete disponibilidade
24/7 “para sempre”; leia a seção de limites antes de chamar isso de produção.

## 2. Criar o Postgres no Neon

1. Crie um projeto na região **AWS South America (São Paulo) `aws-sa-east-1`**.
2. Crie o banco `sentinela`.
3. Copie a **connection string pooled** (host com `-pooler`) e mantenha `sslmode=require`.
4. Guarde a string; ela será `SENTINELA_DB_URL`.

O servidor aplica as migrações e cria o esquema, as 44 regras, as mensagens e o primeiro
administrador na primeira subida. Não rode SQL manual.

## 3. Publicar na Render

1. Suba o repositório no GitHub.
2. Na Render, escolha **New → Blueprint** e selecione o `render.yaml` da raiz.
3. Informe:
   - `SENTINELA_DB_URL`: a connection string do Neon;
   - `SENTINELA_ADMIN_SENHA`: uma senha forte, com 8+ caracteres.
4. Confirme o deploy.

O `render.yaml` usa a raiz do repositório como contexto e inicia o Flask com:

```bash
cd servidor && gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 60
```

Isso é necessário porque o Flask serve `extensao/detectores.js` em `/detectores.js`; o arquivo
precisa existir no container. O `Dockerfile` também copia esse arquivo.

### Variáveis usadas

| Variável | Obrigatória | Observação |
| --- | --- | --- |
| `SENTINELA_DB_URL` | sim | Postgres do Neon com `sslmode=require`. |
| `SENTINELA_SECRET_KEY` | sim em produção | O `render.yaml` gera uma. |
| `SENTINELA_ADMIN_USUARIO` | não | Padrão `admin`. |
| `SENTINELA_ADMIN_SENHA` | sim | Só é usada na criação do primeiro admin. |
| `SENTINELA_AMBIENTE` | sim | `producao` recusa segredo/senha de exemplo. |
| `SENTINELA_COOKIE_SEGURO` | sim | `1` em HTTPS. |
| `SENTINELA_FORCAR_HTTPS` | sim | `1` em produção. |
| `SENTINELA_PROXY_HOPS` | sim | `1` na Render; `2` com Cloudflare na frente. |
| `SENTINELA_CONFIG_CACHE` | não | Segundos de cache do `/api/config`; padrão 30. |
| `SENTINELA_API_TOKEN` | não | Se definido, tem prioridade sobre o token do banco. |
| `SENTINELA_CORS_ORIGINS` | não | Padrão `*`, necessário para extensões. |

## 4. Health check e UptimeRobot

O endpoint leve é:

```bash
curl -fsS https://SEU-SERVICO.onrender.com/api/ping
```

O endpoint que também testa o Postgres é `/api/health`. Use `/api/ping` no UptimeRobot para não
acordar o banco a cada cinco minutos desnecessariamente.

No UptimeRobot:

1. Crie um monitor HTTP(s).
2. URL: `https://SEU-SERVICO.onrender.com/api/ping`.
3. Intervalo: 5 minutos.
4. Alertas: e-mail; se quiser, webhook.

O monitor mantém o serviço acordado, mas **consome as 750 horas mensais** do Render Free. Um
serviço 24/7 usa ~720 h em mês de 30 dias e ~744 h em mês de 31; a margem é pequena. Se a cota
acabar, o Render suspende os web services free até o mês seguinte. O UptimeRobot não cria
disponibilidade garantida.

Se você não precisa de 24/7, desligue o monitor: o serviço hiberna após 15 minutos e a primeira
visita demora cerca de 1 minuto.

## 5. Primeiro acesso

1. Abra `https://SEU-SERVICO.onrender.com/painel`.
2. Entre com `SENTINELA_ADMIN_USUARIO` e a senha informada.
3. Em **07 · Monitoramento**, ative o monitoramento e escolha os sites.
4. Confira **06 · Instalação**:
   - a URL pública;
   - o código de instalação;
   - a versão **2.9**;
   - o administrador inicial marcado como **Superadmin**.
5. Confira **04 · Regras**: devem existir 44 regras iniciais.
6. Crie/edite uma regra e confirme que a extensão recebe a nova versão automaticamente; use
   **Sincronizar todos agora** em **07 · Monitoramento** se quiser forçar a consulta.
7. Instale a extensão e confirme que ela aparece em **06 · Instalação → Dispositivos conectados**.

## 6. Instalar a extensão

```bash
rm -f public/sentinela-extensao.zip
zip -qr public/sentinela-extensao.zip extensao -x '*.DS_Store'
```

O ZIP deve conter a pasta `extensao/` com `manifest.json` dentro. Em cada computador:

1. Descompacte e recarregue em `chrome://extensions` ou `edge://extensions`.
2. Abra **Opções**.
3. Informe a URL do Render, o código de instalação, o departamento e o colaborador.
4. Salve, autorize o host e use **Testar conexão**.
5. Abra o ChatGPT/Gemini/Claude/Copilot e teste texto + imagem/PDF.

A versão 2.9 pede a permissão `alarms`, usada para sincronizar a matriz e reenviar a fila.

## 7. Validar o deploy

```bash
URL=https://SEU-SERVICO.onrender.com

curl -fsS "$URL/api/ping"                  # {"ok":true,"versao":"2.9",...}
curl -fsS "$URL/api/health"                # {"ok":true,"versao":"2.9"}
curl -fsS "$URL/detectores.js" | head -c 80
curl -sI "$URL/painel" | grep -i strict    # HSTS quando atrás de HTTPS
```

No painel:

- [ ] login funciona e o cookie é `Secure`;
- [ ] 44 regras visíveis;
- [ ] criar/editar/excluir uma regra e recarregar em outra instância mostra a mudança;
- [ ] um alerta de teste aparece com site, departamento, colaborador, IP, nível, tipos e origem;
- [ ] texto + imagem no mesmo prompt gera detecções das duas origens;
- [ ] **06 · Instalação** mostra o endereço e o código corretos;
- [ ] **07 · Monitoramento** ativa e desativa o aviso nos sites escolhidos;
- [ ] a extensão mostra **2.9** em `chrome://extensions`;
- [ ] desligar a rede, gerar um alerta e religar: a fila reenvia em até 1 minuto;
- [ ] o mesmo `evento_id` não duplica o alerta na auditoria.

## 8. Migrações e rollback

As migrações ficam em `MIGRACOES` (`servidor/db.py`) e são registradas em `schema_migrations`.
Uma migração publicada não deve ser editada; crie a próxima.

O esquema 2.9 é compatível com os dados da 2.8. Em rollback de código, o banco continua legível;
as colunas de lockout e a tabela `schema_migrations` são aditivas.

## 9. Limites reais

- **Render Free:** 750 h/mês, hiberna após 15 min, pode suspender ao esgotar a cota. Não é
  produção 24/7 garantida.
- **Neon Free:** limites de armazenamento/computação e suspensão por inatividade.
- **UptimeRobot Free:** intervalo de 5 minutos e limites de monitores.
- **Cloud Run:** alternativa com cota gratuita mensal e `min-instances=0`, mas exige faturamento
  ativo; `min-instances=1` tem custo.
- **Código de instalação:** único para o workspace. Para muitas extensões, o próximo passo é
  token por dispositivo com revogação individual.

Se o objetivo é uma demo de portfólio, o conjunto Render + Neon + UptimeRobot é suficiente e
honesto. Se o objetivo é uma empresa usando 24/7, contrate uma instância sempre ligada e trate o
Neon como banco gerenciado com backup.
