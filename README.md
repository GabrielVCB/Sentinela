# Sentinela — Governança e Letramento em IA

**Versão atual: 2.9**

**Download da extensão:** [sentinela-extensao.zip](public/sentinela-extensao.zip)

O Sentinela é uma camada de governança para o uso de inteligências artificiais públicas no
trabalho. Ele ajuda a empresa a perceber quando informações sensíveis estão prestes a ser
enviadas para ferramentas como ChatGPT, Gemini, Claude e Copilot — sem ler, armazenar ou
transmitir o conteúdo das conversas.

A extensão analisa o texto no próprio navegador e mostra um aviso antes do envio. O painel
administrativo recebe apenas o alerta: site, departamento, colaborador, nível de risco, tipos
detectados, origem e a decisão de enviar ou cancelar.

## O problema que resolve

O antivírus não entende um CPF no meio de uma frase. O jurídico não vê um token colado no chat.
O firewall não distingue um print de contrato de uma imagem qualquer. Na prática, dados
confidenciais saem pela caixa de texto da IA, muitas vezes sem má intenção.

O Sentinela existe para tornar esse risco visível no momento certo:

- avisa antes do envio, não depois do incidente;
- ensina o colaborador com uma mensagem curta e objetiva;
- registra a decisão para a empresa acompanhar o letramento;
- preserva a privacidade, porque o texto nunca sai do navegador.

## O que o produto faz

### Extensão

- Observa o campo de texto das IAs monitoradas.
- Analisa texto digitado, colagens, imagens e PDFs localmente.
- Aplica detectores técnicos e as regras editáveis do painel.
- Mostra um aviso em Shadow DOM, isolado do estilo do site.
- Em risco médio ou alto, pede confirmação antes do envio.
- Registra somente os metadados do alerta no servidor.
- Mantém uma fila local para reenviar alertas quando a rede falha.

### Painel administrativo

- Visão geral com gráficos de evolução, risco, decisão do colaborador e sites.
- Matriz com 44 regras distribuídas em 6 áreas.
- Cadastro e edição de regras, áreas e mensagens educativas.
- Auditoria com filtros, retenção e exportação em CSV e PDF.
- Ativação global do monitoramento.
- Escolha dos sites monitorados, centralizada no painel.
- Dispositivos conectados com identificador, setor, IP e versão do código de instalação.
- Desconexão individual de dispositivos e alerta de vínculos antes de renovar o código.
- Superadmin inicial protegido, com criação e exclusão de administradores somente por ele.
- Sincronização automática das regras para todos os dispositivos.

## Tecnologias

- **Extensão Manifest V3** para Chrome e Microsoft Edge.
- **JavaScript puro** no detector e no content script, com Shadow DOM.
- **Flask**, em Python, para a landing, o painel e as APIs.
- **Postgres**, hospedado no Neon, como banco de dados.
- **Jinja, HTML e CSS** no painel administrativo.
- **React e Vite** apenas na prévia visual pública.
- **Render Free** para o servidor.
- **Neon Free** para o banco.
- **UptimeRobot** para monitorar a disponibilidade da demo.
- **GitHub Actions** para verificação automatizada.

## Arquitetura

O Sentinela é um sistema único:

- a extensão é a interface que vê o conteúdo no navegador;
- o Flask serve a landing, o painel e a API;
- o Postgres guarda regras, mensagens, configurações e alertas;
- a prévia React é somente uma demonstração visual, sem login, banco ou gravação.

O motor de detecção tem uma única fonte: o arquivo carregado pela extensão e servido pelo Flask.
A matriz de regras e as mensagens educativas também têm uma fonte única, lida pelo servidor e
pela prévia. Isso evita que extensão, painel e landing contem versões diferentes da mesma regra.

## Como funciona

1. A extensão identifica o site e localiza o campo de texto.
2. O detector roda no navegador, com os detectores técnicos e as regras ativas.
3. O aviso aparece com o nível de risco, os tipos encontrados e uma orientação.
4. O colaborador decide enviar ou cancelar.
5. A extensão envia apenas o alerta. Se o servidor estiver indisponível, o alerta entra em uma
   fila local e é reenviado depois.
6. O painel consolida os metadados e mostra os indicadores de letramento.

A sincronização é transparente: a extensão consulta a versão da configuração a cada minuto e
baixa a matriz completa apenas quando uma regra, área, mensagem ou política muda. O painel também
oferece **Sincronizar todos agora** em **07 · Monitoramento**; não existe mais botão manual nas
Opções da extensão.

## Privacidade e segurança

- O texto digitado, as imagens e os PDFs são analisados no navegador.
- Nenhum conteúdo de conversa é transmitido ou armazenado.
- O alerta contém somente metadados.
- O painel de dispositivos guarda um identificador aleatório, setor, IP, versão e último contato;
  não guarda o texto da conversa.
- O código de instalação autoriza a extensão a registrar alertas, mas não dá acesso ao painel.
- O painel exige login de administrador.
- Senhas são armazenadas com hash scrypt.
- A sessão usa cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- O servidor aplica CSP, HSTS, proteção contra enquadramento e limite de requisições.
- O login tem bloqueio temporário após tentativas repetidas.
- Não existe cadastro público de administradores.

## Monitoramento centralizado

A ativação do monitoramento e a lista de sites monitorados ficam no painel, em
**07 · Monitoramento**. A escolha vale para todas as extensões conectadas ao mesmo servidor e
chega aos navegadores automaticamente em até 1 minuto.

## Dispositivos e administradores

Cada instalação da extensão recebe um identificador aleatório. O painel mostra o setor, o IP, a
versão da extensão e se o dispositivo está usando o código de instalação atual ou um anterior.
Um dispositivo pode ser desconectado individualmente; a extensão deixa de receber regras e
tentar registrar alertas até ser reinstalada.

O primeiro administrador criado pelo servidor é o **superadmin**. Ele não pode ser excluído e é
o único que pode criar ou remover outros administradores. Contas comuns podem trocar a própria
senha.

As Opções da extensão guardam apenas o que é específico daquele computador:

- URL do servidor;
- código de instalação;
- departamento;
- identificador do colaborador.

Não há interruptor local de monitoramento nem seleção local de sites. Isso evita que um
computador fique com uma política diferente da empresa.

## Instalação da extensão

1. Baixe o arquivo da extensão: **[sentinela-extensao.zip](public/sentinela-extensao.zip)**.
2. Extraia o arquivo em uma pasta de fácil acesso.
3. No Chrome, abra `chrome://extensions`. No Edge, abra `edge://extensions`.
4. Ative o **Modo do desenvolvedor**.
5. Clique em **Carregar sem compactação** e selecione a pasta `extensao`.
6. Abra as **Opções** da extensão.
7. Informe a URL do servidor e o código de instalação exibidos no painel, em
   **06 · Instalação**.
8. Escolha o departamento e informe o identificador do colaborador.
9. Salve, autorize o acesso ao servidor e use **Testar conexão**.
10. Abra o ChatGPT, Gemini, Claude ou Copilot e faça um teste com um dado fictício.

A URL do servidor é copiada do painel. Ela não é a URL do GitHub nem a URL da prévia visual.

## Operação na nuvem

O Sentinela é um serviço hospedado. Não existe modo local de operação: o servidor precisa do
Postgres na nuvem para iniciar, aplicar migrações e manter a auditoria.

A implantação de referência usa o Render Free para o Flask e o Neon Free para o Postgres. Nessa
configuração, o Render hiberna depois de um período sem tráfego, e a primeira requisição pode
demorar. O UptimeRobot monitora o endpoint de saúde e ajuda a manter a demonstração acordada,
respeitando o limite de horas do plano gratuito.

Para uma operação contínua de empresa, o caminho é uma instância sempre ligada ou um plano pago.
O plano gratuito é adequado para demonstração, portfólio e validação do produto, não para uma
promessa de disponibilidade 24 horas por dia.

## Limitações conhecidas

- Os seletores dos sites podem mudar quando ChatGPT, Gemini, Claude ou Copilot alterarem a
  interface.
- A extensão precisa ser recarregada depois de uma atualização.
- O plano gratuito do Render pode hibernar e demorar na primeira resposta.
- O código de instalação é único por instalação do servidor; a renovação invalida os
  dispositivos antigos e o painel mostra quantos ainda estavam vinculados.
- A sincronização automática depende do navegador manter a extensão ativa e consultar o servidor
  aproximadamente a cada minuto.
- A prévia React não substitui o painel Flask.

## Licença

Projeto pessoal de portfólio. A licença deve ser ajustada antes de qualquer reutilização
comercial.
