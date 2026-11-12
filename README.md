# A Sentinela: Governança e Letramento em IA

**Versão atual: 2.9**

## Download da extensão

- [**Baixar extensão (.zip)**](./public/sentinela-extensao.zip)
- No painel: **Instalação e administradores → Baixar extensão (.zip)**, no mesmo bloco do código de instalação.


A Sentinela é uma camada de governança para o uso de inteligências artificiais públicas no
trabalho. Ela ajuda a empresa a perceber quando informações sensíveis estão prestes a ser
enviadas para ferramentas como ChatGPT, Gemini, Claude e Copilot, sem ler, armazenar ou
transmitir o conteúdo.

A extensão analisa o texto no próprio navegador e mostra um aviso antes do envio. O painel
administrativo recebe apenas o alerta: site, departamento, colaborador, IP, nível de risco,
tipos detectados, origem e a decisão de enviar ou cancelar.

## Glossário

Estes são os termos usados na interface. Evite sinônimos para não recriar a ambiguidade que o
produto corrige.

| Termo | Significado |
| --- | --- |
| **Regra** | Item da matriz que identifica um tipo de dado e define seu nível de risco. Não use “detector”, “padrão” ou “palavra-chave” como nome da entidade. |
| **Departamento** | Categoria da matriz de risco e local escolhido pelo colaborador nas Opções da extensão. A tela **Departamentos** reúne as duas funções em uma única lista. |
| **Alerta** | Registro de metadados gerado quando a extensão encontra conteúdo sensível. |
| **Decisão** | Escolha do colaborador depois do aviso: enviar ou cancelar. |
| **Excluir** | Termo único para excluir regras, departamentos, alertas, IAs ou administradores. **Desconectar** continua sendo uma ação diferente, aplicada a um dispositivo. |

A marca é feminina: **A Sentinela**. Os textos corridos usam “a Sentinela”, “da Sentinela” e
“na Sentinela”. O logotipo e os títulos podem usar apenas **Sentinela**.

## O problema que resolve

As pessoas querem automatizar tarefas simples, e a IA virou o caminho mais rápido. O problema é
que uma tarefa simples pode custar caro quando leva dados confidenciais junto. O antivírus não
entende um CPF no meio de uma frase, o jurídico não vê um token colado na IA e o firewall não
distingue um print de contrato de uma imagem qualquer.

A Sentinela existe para tornar esse risco visível no momento certo:

- avisa antes do envio, não depois do incidente;
- ensina o colaborador com uma mensagem curta e objetiva;
- registra a decisão para a empresa acompanhar o letramento;
- preserva a privacidade, porque o conteúdo não é transmitido nem armazenado.

## O que o produto faz

### Extensão

- Observa o campo de texto das IAs monitoradas.
- Analisa texto digitado, colagens, imagens e PDFs localmente.
- Aplica as regras editáveis do painel e as regras técnicas embutidas.
- Mostra um aviso isolado do estilo do site.
- Em risco médio ou alto, pede confirmação antes do envio.
- Registra somente os metadados do alerta no servidor.
- Mantém uma fila local para reenviar alertas quando a rede falha.

### Painel administrativo

- **Visão geral** com evolução, risco, decisão após o aviso, IAs, departamentos e tipos.
- **Regras de detecção** com criação, edição, teste e exclusão de regras.
- **Departamentos** com a matriz e a relação entre regras e departamentos.
- **Mensagens educativas** para os níveis baixo, médio e alto.
- **Alertas** com filtros, retenção e exportação em CSV e PDF.
- **Instalação e administradores** com endereço, código de instalação, download e contas.
- **Monitoramento** com ativação global, IAs monitoradas e dispositivos conectados.

Regras, departamentos e o limite de criticidade começam com sugestões iniciais; tudo pode ser
ajustado no painel.

## Privacidade

**Nenhum conteúdo é armazenado neste sistema.**

O texto digitado, as imagens e os PDFs são analisados no navegador e descartados. O alerta contém
somente metadados: IA, departamento, colaborador, IP, origem, nível de risco, tipos detectados
e decisão. O código de instalação autoriza a extensão a registrar alertas, mas não dá
acesso ao painel.

Senhas são armazenadas com hash scrypt. A sessão usa cookie `HttpOnly`, `SameSite=Lax` e `Secure`
em produção. O servidor aplica CSP, HSTS, proteção contra enquadramento e limite de requisições,
e o login tem bloqueio temporário após tentativas repetidas. Não existe cadastro público de
administradores.

## Tecnologias e arquitetura

- **Extensão Manifest V3** para Chrome e Microsoft Edge.
- **JavaScript puro** no detector e no content script, com Shadow DOM.
- **Flask**, em Python, para a landing, o painel e as APIs.
- **Postgres**, hospedado no Neon, como banco de dados.
- **Jinja, HTML e CSS** no painel administrativo.
- **React e Vite** apenas na prévia visual pública.
- **Render Free** para o servidor.
- **Neon Free** para o banco.
- **UptimeRobot** para monitorar a disponibilidade da demonstração.
- **GitHub Actions** para verificação automatizada.

A Sentinela é um sistema único:

- a extensão é a interface que vê o conteúdo no navegador;
- o Flask serve a landing, o painel e a API;
- o Postgres guarda regras, mensagens, configurações e alertas;
- a prévia React é somente uma demonstração visual, sem login, banco ou gravação.

O motor de detecção tem uma única fonte: o arquivo carregado pela extensão e servido pelo Flask.
A matriz de regras e as mensagens educativas também têm uma fonte única, lida pelo servidor e
pela prévia. O arquivo da matriz fica em `servidor/dados/regras.json`; o seed do Postgres copia
essa lista na primeira subida. Depois disso, o cadastro real é a tabela `regras`, e o JSON só
serve como carga inicial.

A extensão usa um content script para observar o campo de texto das IAs monitoradas. Um
`MutationObserver` acompanha mudanças no DOM, e o aviso é renderizado em Shadow DOM para não
herdar o estilo do site. A captura de digitação e colagem é feita por eventos de `keystroke` e
`paste`; imagens passam por OCR em um contexto offscreen. O pipeline é sempre local.

Além das regras editáveis, a extensão aplica regras técnicas sempre ativas: CPF e CNPJ com
dígitos verificadores, IPv4 privado e hostnames internos, tokens e chaves de API, senhas e
credenciais, dados bancários, cartões com Luhn e uma heurística de código-fonte.

O campo interno de departamento no banco e na API mantém o nome legado por compatibilidade. Toda
a interface, os relatórios e a documentação usam **Departamento**.

## Como funciona

1. A extensão identifica o site e localiza o campo de texto.
2. O detector roda no navegador, com as regras técnicas e as regras ativas.
3. O aviso aparece com o nível de risco, os tipos encontrados e uma orientação.
4. O colaborador decide enviar ou cancelar.
5. A extensão envia apenas o alerta. Se o servidor estiver indisponível, o alerta entra em uma
   fila local e é reenviado depois.
6. O painel consolida os metadados e mostra os indicadores de letramento.

A sincronização é transparente: a extensão consulta a versão da configuração a cada 30 segundos e
baixa a matriz completa apenas quando uma regra, departamento, mensagem ou política muda. Na interface, o
prazo apresentado é **até 1 minuto**. A tela **Monitoramento** tem apenas **Salvar ativação**;
não existe botão de sincronização manual nas Opções da extensão.

O maior nível encontrado define o alerta. Um item de risco alto eleva a mensagem a risco alto;
sem itens altos, um item médio eleva a risco médio. As regras funcionam em português e inglês.

## Telas do painel

Cada tela tem o menu e um título igual ao item do menu, sem subtítulo explicativo. A barra superior
mostra apenas **Painel administrativo**, uma vez. Não há etiquetas numeradas nem textos repetidos.
Os detalhes operacionais ficam em dicas contextuais e nas confirmações de ações sensíveis.

Os títulos são: **Visão geral**, **Alertas**, **Regras de detecção**, **Departamentos**,
**Mensagens educativas**, **Monitoramento** e **Instalação e administradores**.

Na tela **Departamentos**, a dica do formulário explica que departamento é a categoria da regra e
o local escolhido pelo colaborador. Ao excluir, o histórico de alertas é preservado.

A tela **Alertas** usa a coluna **Decisão** para enviar ou cancelar. Os botões de exclusão são
**Excluir alertas antigos**, **Excluir todos os alertas** e **Limpar filtros**. A coluna de ações
não tem cabeçalho.

A tela **Instalação e administradores** mostra o endereço do servidor, o código de instalação, o
IP de origem e o armazenamento em nuvem. A consequência de um código ausente fica em uma dica ao
lado do código.

A tela **Monitoramento** define a ativação geral no cabeçalho, as IAs monitoradas e os
dispositivos conectados. As IAs usam interruptores; a tela tem apenas **Salvar ativação** como
ação de persistência. A renovação do código fica em **Instalação e administradores**.

## Estados e indicadores

- **Crítico**: ao menos 3 alertas, com percentual de risco alto igual ou acima do limite de
  criticidade.
- **Em observação**: menos de 3 alertas.
- **Normal**: ao menos 3 alertas e percentual de risco alto abaixo do limite.

O limite de criticidade é definido em **Visão geral**, no bloco **Efetividade dos avisos por
departamento**. A definição fica na dica do campo de limite.

Indicadores da **Visão geral**: **Alertas**, **Envios após o aviso**, **Tipos detectados** e **IAs
com mais alertas**. Os gráficos mantêm apenas o título; a explicação fica no tooltip.

## Dispositivos e administradores

Cada instalação da extensão envia o colaborador informado nas Opções, o departamento e o IP de
origem. O painel não exibe identificadores técnicos aleatórios; cada instalação aparece em uma
linha com colaborador, departamento, IP e situação do código. O identificador técnico continua só
no servidor, para que **Desconectar** atue individualmente naquela instalação. Se o código for
renovado, ela volta a conectar ao salvar o novo código nas Opções; não é necessário reinstalar a
extensão.

O primeiro administrador criado pelo servidor é o **superadmin**. Ele não pode ser excluído e é o
único que pode criar ou excluir outros administradores. Contas comuns podem trocar a própria
senha.

As Opções da extensão guardam apenas o que é específico daquele computador:

- URL do servidor;
- código de instalação;
- departamento;
- identificador do colaborador.

Não há interruptor local de monitoramento nem seleção local de IAs. Isso evita que um
computador fique com uma política diferente da empresa.

## Instalação da extensão

1. No painel, abra **Instalação e administradores** e clique em **Baixar extensão (.zip)**. O pacote e o código de instalação ficam no mesmo bloco, prontos para serem passados aos funcionários. O ZIP já leva a URL do servidor. Para um teste sem painel, use o [ZIP público](./public/sentinela-extensao.zip).
2. Extraia o arquivo em uma pasta de fácil acesso.
3. No Chrome, abra `chrome://extensions`. No Edge, abra `edge://extensions`.
4. Ative o **Modo do desenvolvedor**.
5. Clique em **Carregar sem compactação** e selecione a pasta `extensao`.
6. Abra as **Opções** da extensão.
7. Informe a URL do servidor e o código de instalação exibidos no painel, em
   **Instalação e administradores**.
8. Escolha o departamento e informe o identificador do colaborador.
9. Salve, autorize o acesso ao servidor e use **Testar conexão**.
10. Abra o ChatGPT, Gemini, Claude ou Copilot e faça um teste com um dado fictício.

A URL do servidor é copiada do painel. Ela não é a URL do GitHub nem a URL da prévia visual.

## Operação na nuvem

A Sentinela é um serviço hospedado. Não existe modo local de operação: o servidor precisa do
Postgres na nuvem para iniciar, aplicar migrações e manter a auditoria.

A implantação de referência usa o Render Free para o Flask e o Neon Free para o Postgres. O
UptimeRobot monitora o endpoint de saúde e ajuda a manter a demonstração acordada.

O endpoint leve de verificação é `/api/ping`. O endpoint `/api/health` também consulta o
Postgres. Use o primeiro no monitor externo para não acordar o banco a cada verificação.

## Licença

Projeto pessoal de portfólio. A licença deve ser ajustada antes de qualquer reutilização
comercial.
