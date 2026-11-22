/**
 * Sentinela — painel administrativo (JavaScript puro).
 *
 * Toda saída dinâmica é inserida com textContent/createElement, nunca com
 * innerHTML, para impedir XSS vindo de dados do banco.
 */
"use strict";

const $ = function (id) {
  return document.getElementById(id);
};

const ICONE_LIXEIRA =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="m6 7 1 13h10l1-13"/><path d="M10 11v5M14 11v5"/></svg>';

function aplicarLixeira(botao, rotulo) {
  botao.innerHTML = ICONE_LIXEIRA;
  botao.setAttribute("aria-label", rotulo);
  botao.title = rotulo;
}

const estado = {
  areas: [],
  regras: [],
  filtros: { de: "", ate: "", departamento: "todos", nivel: "todos" },
  pagina: 1,
  totalPaginas: 1,
  paginaAtividades: 1,
  totalPaginasAtividades: 1,
  alertaAtual: null,
  secao: "visao",
  monitoramento: null,
  sites: [],
  dispositivos: [],
  euSuperadmin: false,
  periodoGrafico: 14,
  resumoCarregado: false,
  resumoAssinatura: "",
};

const CHAVE_TEMA = "sentinela-tema";

const ROTULO_NIVEL = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
  sem_deteccao: "Sem detecções",
};
const ROTULO_ORIGEM = {
  texto: "Texto digitado",
  colagem: "Colagem de texto longo",
  imagem: "Print ou imagem",
  pdf: "Arquivo PDF",
  anexo: "Imagem e PDF",
};
const ROTULO_ATIVIDADE = {
  regra: "Regra",
  mensagem: "Mensagem",
  alerta: "Alerta",
  departamento: "Departamento",
  administrador: "Administrador",
  monitoramento: "Monitoramento",
  configuracao: "Configuração",
  ia: "IA monitorada",
  codigo: "Código de verificação",
  dispositivo: "Dispositivo",
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

async function api(caminho, opcoes) {
  const configuracao = opcoes || {};
  const resposta = await fetch(caminho, {
    credentials: "same-origin",
    method: configuracao.method || "GET",
    headers: Object.assign({ "Content-Type": "application/json" }, configuracao.headers || {}),
    body: configuracao.body,
  });

  if (resposta.status === 401) {
    window.location.href = "/login";
    throw new Error("Sessão expirada.");
  }

  let corpo = null;
  try {
    corpo = await resposta.json();
  } catch (erro) {
    corpo = null;
  }

  if (!resposta.ok) {
    throw new Error((corpo && corpo.erro) || "Erro " + resposta.status + " ao chamar " + caminho);
  }
  return corpo;
}

function criar(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined && texto !== null) elemento.textContent = String(texto);
  return elemento;
}

function limpar(elemento) {
  elemento.replaceChildren();
}

/**
 * O servidor manda o horário em UTC, com "Z" no fim. O navegador converte para
 * o relógio da própria máquina, então quem abre o painel no horário de Brasília
 * vê 14:00 quando o alerta foi registrado às 14:00 (e não 17:00).
 */
function quando(iso) {
  if (!iso) return "—";
  const texto = String(iso).replace(" ", "T");
  const comFuso = /(Z|[+-]\d{2}:?\d{2})$/i.test(texto) ? texto : texto + "Z";
  const momento = new Date(comFuso);
  if (Number.isNaN(momento.getTime())) {
    const partes = texto.split("T");
    const data = (partes[0] || "").split("-");
    if (data.length !== 3) return iso;
    return (
      data[2] + "/" + data[1] + "/" + data[0] + (partes[1] ? " " + partes[1].slice(0, 5) : "")
    );
  }
  return momento.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function diaCurto(iso) {
  const partes = String(iso).split("-");
  return partes.length === 3 ? partes[2] + "/" + partes[1] : iso;
}

function numero(valor) {
  return new Intl.NumberFormat("pt-BR").format(Number(valor) || 0);
}

function plural(total, singular, plural) {
  return numero(total) + " " + (Number(total) === 1 ? singular : plural);
}

function percentual(valor) {
  return (
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(valor) || 0) + "%"
  );
}

function respeitaMovimentoReduzido() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function animarMetrica(elemento, destino, formatador) {
  if (!elemento) return;
  const alvo = Number(destino) || 0;
  const anterior = Number(elemento.dataset.valor || 0);
  elemento.dataset.valor = String(alvo);
  if (respeitaMovimentoReduzido()) {
    elemento.textContent = formatador(alvo);
    return;
  }
  const inicio = performance.now();
  const duracao = 480;
  function passo(agora) {
    const progresso = Math.min((agora - inicio) / duracao, 1);
    const suavizado = 1 - Math.pow(1 - progresso, 3);
    elemento.textContent = formatador(anterior + (alvo - anterior) * suavizado);
    if (progresso < 1) requestAnimationFrame(passo);
    else elemento.textContent = formatador(alvo);
  }
  requestAnimationFrame(passo);
}

function variavelCss(_elemento, nome, reserva) {
  // A cor fica ligada à variável CSS, não ao valor calculado no momento do
  // desenho. Assim o SVG acompanha a troca de tema sem precisar ser recriado.
  return "var(" + nome + (reserva ? ", " + reserva : "") + ")";
}

function normalizar(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function badge(nivel) {
  const classe = nivel === "sem_deteccao" ? "sem-deteccao" : nivel;
  const elemento = criar("span", "badge risco-" + classe, ROTULO_NIVEL[nivel] || nivel);
  return elemento;
}

const ROTULO_STATUS_DISPOSITIVO = {
  ativo: "Ativo",
  sem_sinal: "Sem sinal",
  removida: "Removida",
  desatualizada: "Desatualizada",
};

function badgeStatusDispositivo(status) {
  const chave = ROTULO_STATUS_DISPOSITIVO[status] ? status : "sem_sinal";
  return criar(
    "span",
    "badge status-" + chave.replace(/_/g, "-"),
    ROTULO_STATUS_DISPOSITIVO[chave],
  );
}

let timerToast = null;
function avisar(texto, tipo) {
  const toast = $("toast");
  toast.textContent = texto;
  toast.className = "toast " + (tipo || "");
  toast.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(function () {
    toast.hidden = true;
  }, 3800);
}

function tratarErro(erro) {
  console.error(erro);
  avisar(erro instanceof Error ? erro.message : "Erro inesperado.", "erro");
}

// Confirmação reutilizável (dialog nativo)
let acaoConfirmada = null;
function confirmar(titulo, texto, rotulo, aoConfirmar) {
  $("confirmar-titulo").textContent = titulo;
  $("confirmar-texto").textContent = texto;
  const botao = $("confirmar-ok");
  const rotuloBotao = rotulo || "Excluir";
  // Em Alertas, a exclusão volta a ser textual. Nas demais áreas, mantém o ícone.
  if (/alerta/i.test(titulo) || /alerta/i.test(rotuloBotao)) {
    botao.textContent = rotuloBotao;
  } else {
    aplicarLixeira(botao, rotuloBotao);
  }
  acaoConfirmada = aoConfirmar;
  $("dialogo-confirmar").showModal();
}

// ---------------------------------------------------------------------------
// Navegação
// ---------------------------------------------------------------------------

function atualizarRotuloTema() {
  const escuro = document.documentElement.dataset.tema === "escuro";
  const botao = $("alternar-tema");
  if (!botao) return;
  botao.setAttribute("aria-pressed", String(escuro));
  const rotulo = $("tema-rotulo");
  if (rotulo) rotulo.textContent = escuro ? "Modo claro" : "Modo escuro";
}

function alternarTema() {
  const escuro = document.documentElement.dataset.tema === "escuro";
  const tema = escuro ? "claro" : "escuro";
  document.documentElement.dataset.tema = tema;
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch (erro) {
    /* o tema continua valendo nesta sessão */
  }
  atualizarRotuloTema();
  // Os SVGs recebem cores resolvidas no momento do desenho. Ao trocar o tema,
  // redesenha a Visão geral para atualizar o complemento da rosca.
  if (estado.secao === "visao") {
    estado.resumoCarregado = false;
    carregarResumo().catch(tratarErro);
  }
}

function irPara(secao) {
  estado.secao = secao;
  document.querySelectorAll("[data-painel]").forEach(function (bloco) {
    bloco.classList.toggle("ativa", bloco.dataset.painel === secao);
  });
  document.querySelectorAll(".menu-nav [data-ir]").forEach(function (botao) {
    botao.classList.toggle("ativo", botao.dataset.ir === secao);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  carregarSecao(secao);
}

function carregarSecao(secao) {
  if (secao === "visao") {
    carregarResumo();
  } else if (secao === "regras") {
    Promise.all([carregarAreas(), carregarRegras()]).catch(tratarErro);
  } else if (secao === "areas") {
    carregarAreas().catch(tratarErro);
  } else if (secao === "mensagens") {
    carregarMensagens().catch(tratarErro);
  } else if (secao === "alertas") {
    carregarAreas()
      .then(popularFiltroDepartamento)
      .then(function () {
        return carregarAlertas(1);
      })
      .catch(tratarErro);
  } else if (secao === "administradores") {
    Promise.all([carregarAdmins(), carregarAtividades(1)]).catch(tratarErro);
  } else if (secao === "monitoramento") {
    Promise.all([
      carregarMonitoramento(),
      carregarDispositivos(),
      carregarInstalacao(),
    ]).catch(tratarErro);
  }
}

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

async function carregarResumo() {
  const limiar = Number($("limiar").value) || 30;
  const metricas = $("metricas-resumo");
  if (metricas && !estado.resumoCarregado) metricas.setAttribute("aria-busy", "true");

  try {
    const dados = await api(
      "/api/admin/resumo?limiar=" +
        encodeURIComponent(limiar) +
        "&dias=" +
        encodeURIComponent(estado.periodoGrafico),
    );

    // A atualização automática acontece a cada 15 s. Redesenhar os mesmos
    // números e gráficos reiniciava animações e dava a impressão de que a
    // Visão geral estava piscando. Só há novo desenho quando o conteúdo muda.
    const assinatura = JSON.stringify(dados);
    if (estado.resumoCarregado && assinatura === estado.resumoAssinatura) return;

    animarMetrica($("kpi-total"), dados.total, function (valor) {
      return numero(Math.round(valor));
    });
    $("kpi-total-detalhe").textContent = plural(
      dados.departamentos_ativos,
      "departamento com alertas",
      "departamentos com alertas",
    );
    animarMetrica($("kpi-alto"), dados.total_alto, function (valor) {
      return numero(Math.round(valor));
    });
    $("kpi-alto-detalhe").textContent = percentual(dados.taxa_alto) + " do total de alertas";
    animarMetrica($("kpi-envio"), dados.taxa_envio, percentual);
    $("kpi-envio-detalhe").textContent =
      numero(dados.total_enviou) + " envios · " + numero(dados.total_cancelou) + " cancelamentos";
    animarMetrica($("kpi-tipos"), dados.tipos_distintos, function (valor) {
      return numero(Math.round(valor));
    });

    const periodo = dados.periodo || estado.periodoGrafico;
    $("grafico-periodo").textContent = "Alertas por dia · últimos " + periodo + " dias";
    desenharGrafico(dados.evolucao, periodo);

    const porNivel = dados.por_nivel || {
      baixo: 0,
      medio: 0,
      alto: dados.total_alto,
    };
    const porAcao = dados.por_acao || {
      enviou: dados.total_enviou,
      cancelou: dados.total_cancelou,
    };
    const baseCores = $("grafico-risco");
    const baixo = variavelCss(baseCores, "--baixo", "#16a34a");
    const medio = variavelCss(baseCores, "--medio", "#f59e0b");
    const alto = variavelCss(baseCores, "--alto", "#dc2626");
    const marca = variavelCss(baseCores, "--marca", "#00c896");
    const complemento = variavelCss(baseCores, "--grafico-complemento", "#111111");

    desenharDonut(
      "grafico-risco",
      [
        { rotulo: "Alto", valor: porNivel.alto, cor: alto },
        { rotulo: "Médio", valor: porNivel.medio, cor: medio },
        { rotulo: "Baixo", valor: porNivel.baixo, cor: baixo },
      ],
      "Distribuição dos alertas por nível de risco",
    );
    desenharDonut(
      "grafico-acao",
      [
        { rotulo: "Enviou", valor: porAcao.enviou, cor: marca },
        { rotulo: "Cancelou", valor: porAcao.cancelou, cor: complemento },
      ],
      "Comportamento dos colaboradores após o alerta",
    );
    desenharSites(dados.por_site || []);
    desenharTipos(dados.tipos);
    desenharLetramento(dados);
    desenharGargalos(dados.gargalos);
    desenharUltimos(dados.ultimos);
    estado.resumoAssinatura = assinatura;
  } finally {
    if (metricas) metricas.setAttribute("aria-busy", "false");
    estado.resumoCarregado = true;
  }
}

function desenharGrafico(evolucao, periodo) {
  const container = $("grafico-evolucao");
  limpar(container);

  const dias = Array.isArray(evolucao) ? evolucao : [];
  const totalPeriodo = dias.reduce(function (soma, dia) {
    return soma + (Number(dia.total) || 0);
  }, 0);

  if (!dias.length || !totalPeriodo) {
    container.appendChild(
      criar(
        "p",
        "grafico-vazio",
        "Ainda não existem dados suficientes para apresentar esta evolução. Os registros aparecerão aqui após as primeiras detecções.",
      ),
    );
    return;
  }

  const largura = 780;
  const altura = 254;
  const margem = { topo: 22, direita: 10, baixo: 34, esquerda: 42 };
  const areaLargura = largura - margem.esquerda - margem.direita;
  const areaAltura = altura - margem.topo - margem.baixo;
  const maximoBruto = Math.max.apply(
    null,
    [1].concat(dias.map(function (dia) { return Number(dia.total) || 0; })),
  );
  const passoY = Math.max(1, Math.ceil(maximoBruto / 4));
  const topoValor = passoY * 4;
  const passo = areaLargura / Math.max(dias.length, 1);
  const larguraBarra = Math.max(3, Math.min(30, passo * 0.58));
  const ns = "http://www.w3.org/2000/svg";
  const linhaCor = variavelCss(container, "--linha", "#e0ded8");
  const textoCor = variavelCss(container, "--cinza-claro", "#8a8a84");
  const baixoCor = variavelCss(container, "--baixo", "#16a34a");
  const medioCor = variavelCss(container, "--medio", "#f59e0b");
  const altoCor = variavelCss(container, "--alto", "#dc2626");
  const baseY = margem.topo + areaAltura;

  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 " + largura + " " + altura);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Alertas por dia nos últimos " + (periodo || dias.length) + " dias");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const tituloEixo = document.createElementNS(ns, "text");
  tituloEixo.setAttribute("x", 0);
  tituloEixo.setAttribute("y", 10);
  tituloEixo.setAttribute("font-size", "9");
  tituloEixo.style.fill = textoCor;
  tituloEixo.setAttribute("font-family", "Consolas, monospace");
  tituloEixo.textContent = "alertas";
  svg.appendChild(tituloEixo);

  for (let indice = 0; indice <= 4; indice += 1) {
    const y = margem.topo + areaAltura * (1 - indice / 4);
    const linha = document.createElementNS(ns, "line");
    linha.setAttribute("x1", margem.esquerda);
    linha.setAttribute("x2", largura - margem.direita);
    linha.setAttribute("y1", y);
    linha.setAttribute("y2", y);
    linha.style.stroke = linhaCor;
    if (indice !== 0) linha.setAttribute("stroke-dasharray", "2 5");
    svg.appendChild(linha);

    const rotulo = document.createElementNS(ns, "text");
    rotulo.setAttribute("x", margem.esquerda - 10);
    rotulo.setAttribute("y", y + 3);
    rotulo.setAttribute("text-anchor", "end");
    rotulo.setAttribute("font-size", "9");
    rotulo.style.fill = textoCor;
    rotulo.setAttribute("font-family", "Consolas, monospace");
    rotulo.textContent = String(passoY * indice);
    svg.appendChild(rotulo);
  }

  const tooltip = criar("div", "grafico-tooltip");
  tooltip.hidden = true;
  container.appendChild(tooltip);

  function posicionarTooltip(evento) {
    const caixa = container.getBoundingClientRect();
    const x = Math.max(70, Math.min(caixa.width - 70, evento.clientX - caixa.left));
    const y = Math.max(58, evento.clientY - caixa.top);
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  const intervaloRotulos = Math.max(1, Math.ceil(dias.length / 7));
  dias.forEach(function (dia, indice) {
    const centro = margem.esquerda + passo * indice + passo / 2;
    const grupo = document.createElementNS(ns, "g");
    const segmentos = [
      { valor: Number(dia.baixo) || 0, cor: baixoCor },
      { valor: Number(dia.medio) || 0, cor: medioCor },
      { valor: Number(dia.alto) || 0, cor: altoCor },
    ];
    let acumulado = 0;

    segmentos.forEach(function (segmento) {
      if (!segmento.valor) return;
      const alturaSegmento = (segmento.valor / topoValor) * areaAltura;
      const barra = document.createElementNS(ns, "rect");
      barra.setAttribute("x", centro - larguraBarra / 2);
      barra.setAttribute("y", baseY - ((acumulado + segmento.valor) / topoValor) * areaAltura);
      barra.setAttribute("width", larguraBarra);
      barra.setAttribute("height", Math.max(alturaSegmento, 1.5));
      barra.style.fill = segmento.cor;
      barra.setAttribute("rx", "1");
      grupo.appendChild(barra);
      acumulado += segmento.valor;
    });

    const areaClique = document.createElementNS(ns, "rect");
    areaClique.setAttribute("x", centro - passo / 2);
    areaClique.setAttribute("y", margem.topo);
    areaClique.setAttribute("width", Math.max(passo, 4));
    areaClique.setAttribute("height", areaAltura);
    areaClique.setAttribute("fill", "transparent");
    areaClique.style.cursor = "default";
    areaClique.addEventListener("mouseenter", function (evento) {
      tooltip.textContent =
        diaCurto(dia.data) +
        "\n" +
        plural(dia.total, "alerta", "alertas") +
        "\n" +
        "Alto " +
        (dia.alto || 0) +
        " · Médio " +
        (dia.medio || 0) +
        " · Baixo " +
        (dia.baixo || 0);
      tooltip.hidden = false;
      posicionarTooltip(evento);
    });
    areaClique.addEventListener("mousemove", posicionarTooltip);
    areaClique.addEventListener("mouseleave", function () {
      tooltip.hidden = true;
    });
    grupo.appendChild(areaClique);

    if (indice % intervaloRotulos === 0 || indice === dias.length - 1) {
      const rotulo = document.createElementNS(ns, "text");
      rotulo.setAttribute("x", centro);
      rotulo.setAttribute("y", altura - 10);
      rotulo.setAttribute("text-anchor", "middle");
      rotulo.setAttribute("font-size", "9");
      rotulo.style.fill = textoCor;
      rotulo.setAttribute("font-family", "Consolas, monospace");
      rotulo.textContent = diaCurto(dia.data);
      grupo.appendChild(rotulo);
    }

    const titulo = document.createElementNS(ns, "title");
    titulo.textContent =
      diaCurto(dia.data) + ": " + plural(dia.total, "alerta", "alertas");
    grupo.appendChild(titulo);
    svg.appendChild(grupo);
  });

  container.appendChild(svg);

  const legenda = criar("div", "legenda-grafico");
  [
    { rotulo: "Baixo", cor: baixoCor },
    { rotulo: "Médio", cor: medioCor },
    { rotulo: "Alto", cor: altoCor },
  ].forEach(function (item) {
    const marca = criar("span");
    const quadrado = criar("i");
    quadrado.style.background = item.cor;
    marca.appendChild(quadrado);
    marca.appendChild(document.createTextNode(item.rotulo));
    legenda.appendChild(marca);
  });
  container.appendChild(legenda);
}

function desenharDonut(id, itens, descricao) {
  const container = $(id);
  limpar(container);
  const total = itens.reduce(function (soma, item) {
    return soma + (Number(item.valor) || 0);
  }, 0);

  if (!total) {
    container.appendChild(
      criar(
        "p",
        "grafico-vazio",
        "Ainda não existem dados suficientes para esta distribuição. Os registros aparecerão após as primeiras detecções.",
      ),
    );
    return;
  }

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 42 42");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", descricao);

  const fundo = document.createElementNS(ns, "circle");
  fundo.setAttribute("cx", "21");
  fundo.setAttribute("cy", "21");
  fundo.setAttribute("r", "15.9155");
  fundo.setAttribute("fill", "none");
  fundo.style.stroke = variavelCss(container, "--superficie-2", "#f3f2ed");
  fundo.setAttribute("stroke-width", "5");
  svg.appendChild(fundo);

  const totalTexto = document.createElementNS(ns, "text");
  totalTexto.setAttribute("x", "21");
  totalTexto.setAttribute("y", "20.5");
  totalTexto.setAttribute("text-anchor", "middle");
  totalTexto.setAttribute("font-size", "4.6");
  totalTexto.style.fill = variavelCss(container, "--tinta", "#1b1b1a");
  totalTexto.setAttribute("font-family", "Georgia, serif");
  totalTexto.textContent = numero(total);
  svg.appendChild(totalTexto);

  const legendaTotal = document.createElementNS(ns, "text");
  legendaTotal.setAttribute("x", "21");
  legendaTotal.setAttribute("y", "24.5");
  legendaTotal.setAttribute("text-anchor", "middle");
  legendaTotal.setAttribute("font-size", "2.4");
  legendaTotal.setAttribute("letter-spacing", "0.12");
  legendaTotal.style.fill = variavelCss(container, "--cinza-claro", "#8a8a84");
  legendaTotal.setAttribute("font-family", "Consolas, monospace");
  legendaTotal.textContent = "ALERTAS";
  svg.appendChild(legendaTotal);

  let deslocamento = 0;
  itens.forEach(function (item, indice) {
    const valor = Number(item.valor) || 0;
    if (!valor) return;
    const fatia = (valor / total) * 100;
    const circulo = document.createElementNS(ns, "circle");
    circulo.setAttribute("cx", "21");
    circulo.setAttribute("cy", "21");
    circulo.setAttribute("r", "15.9155");
    circulo.setAttribute("fill", "none");
    circulo.style.stroke = item.cor;
    circulo.setAttribute("stroke-width", "5");
    circulo.setAttribute("stroke-dasharray", "0 100");
    circulo.setAttribute("stroke-dashoffset", String(25 - deslocamento));
    circulo.style.transition = respeitaMovimentoReduzido()
      ? "none"
      : "stroke-dasharray 0.55s cubic-bezier(0.22, 1, 0.36, 1)";
    circulo.style.transitionDelay = indice * 55 + "ms";
    const titulo = document.createElementNS(ns, "title");
    titulo.textContent = item.rotulo + ": " + valor + " (" + percentual(fatia) + ")";
    circulo.appendChild(titulo);
    svg.appendChild(circulo);
    requestAnimationFrame(function () {
      circulo.style.strokeDasharray = fatia + " " + (100 - fatia);
    });
    deslocamento += fatia;
  });
  container.appendChild(svg);

  const legenda = criar("div", "donut-legenda");
  itens.forEach(function (item) {
    const linha = criar("p");
    const marca = criar("i");
    marca.style.background = item.cor;
    linha.appendChild(marca);
    linha.appendChild(document.createTextNode(item.rotulo));
    linha.appendChild(criar("strong", null, numero(item.valor)));
    legenda.appendChild(linha);
  });
  container.appendChild(legenda);
}

function desenharSites(sites) {
  const container = $("barras-sites");
  limpar(container);

  if (!sites || !sites.length) {
    container.appendChild(
      criar(
        "p",
        "grafico-vazio",
        "Ainda não há ocorrências por IA. Elas aparecerão aqui após as primeiras detecções.",
      ),
    );
    return;
  }

  const maximo = Math.max.apply(
    null,
    [1].concat(sites.map(function (item) { return item.total; })),
  );
  const bloco = criar("div", "barra-site");
  sites.forEach(function (item) {
    const linha = criar("div", "barra-item");
    linha.appendChild(criar("span", "nome", item.site));
    const trilho = criar("span", "barra-trilho");
    const preenchimento = criar("span", "barra-preenchimento");
    preenchimento.style.width = Math.max((item.total / maximo) * 100, item.total > 0 ? 2 : 0) + "%";
    trilho.appendChild(preenchimento);
    linha.appendChild(trilho);
    linha.appendChild(criar("span", "barra-valor", numero(item.total)));
    bloco.appendChild(linha);
  });
  container.appendChild(bloco);
}

function desenharTipos(tipos) {
  const lista = $("lista-tipos");
  limpar(lista);

  if (!tipos.length) {
    const vazio = criar("li");
    vazio.appendChild(
      criar(
        "span",
        "grafico-vazio",
        "Ainda não há categorias identificadas. Elas aparecerão aqui após as primeiras detecções.",
      ),
    );
    lista.appendChild(vazio);
    return;
  }

  tipos.forEach(function (tipo) {
    const item = criar("li");

    const bloco = criar("span");
    bloco.appendChild(criar("span", "tipo", tipo.tipo));
    bloco.appendChild(criar("span", "area", tipo.area));
    item.appendChild(bloco);

    item.appendChild(badge(tipo.risco));
    item.appendChild(criar("span", "total", tipo.total));
    lista.appendChild(item);
  });
}

function desenharLetramento(dados) {
  const corpo = $("tabela-letramento");
  limpar(corpo);

  if (!dados.por_departamento.length) {
    const linha = criar("tr");
    const celula = criar("td", "", "Nenhum alerta registrado.");
    celula.colSpan = 4;
    linha.appendChild(celula);
    corpo.appendChild(linha);
    return;
  }

  const gargalos = dados.gargalos.map(function (item) { return item.departamento; });

  dados.por_departamento.forEach(function (item) {
    const linha = criar("tr");

    const nome = criar("td");
    nome.appendChild(criar("span", "", item.departamento));
    linha.appendChild(nome);

    const envio = criar("td");
    const barra = criar("div", "barra-envio");
    const trilho = criar("span", "trilho");
    const enviado = criar("span", "enviado");
    enviado.style.width = item.taxa_envio + "%";
    trilho.appendChild(enviado);
    barra.appendChild(trilho);
    barra.appendChild(criar("span", "percentual", percentual(item.taxa_envio)));
    envio.appendChild(barra);
    linha.appendChild(envio);

    const alto = criar(
      "td",
      "tabular centro",
      item.alto + " / " + item.total + " · " + percentual(item.taxa_alto),
    );
    linha.appendChild(alto);

    const situacao = criar("td");
    if (gargalos.indexOf(item.departamento) >= 0) {
      situacao.appendChild(criar("span", "status-gargalo", "Crítico"));
    } else if (item.total < 3) {
      situacao.appendChild(criar("span", "status-observacao", "Em observação"));
    } else {
      situacao.appendChild(criar("span", "status-ok", "Normal"));
    }
    linha.appendChild(situacao);

    corpo.appendChild(linha);
  });
}

function desenharGargalos(gargalos) {
  const container = $("gargalos");
  limpar(container);
  container.appendChild(
    criar("p", "nota", plural(gargalos.length, "departamento crítico", "departamentos críticos") + "."),
  );
}

function desenharUltimos(ultimos) {
  const lista = $("ultimos");
  limpar(lista);

  if (!ultimos.length) {
    lista.appendChild(criar("li", "micro", "Nada registrado ainda."));
    return;
  }

  ultimos.forEach(function (alerta) {
    const item = criar("li");
    item.appendChild(criar("span", "quando", quando(alerta.data_hora)));
    item.appendChild(
      criar("span", "", alerta.departamento + " · " + alerta.site),
    );
    item.appendChild(badge(alerta.nivel_risco));
    item.appendChild(
      criar(
        "span",
        "acao",
        alerta.acao === "enviou" ? "Enviou" : "Cancelou",
      ),
    );
    lista.appendChild(item);
  });
}

// ---------------------------------------------------------------------------
// Regras
// ---------------------------------------------------------------------------

async function carregarAreas() {
  estado.areas = await api("/api/admin/areas");
  renderizarAreas();
  preencherSelectAreas();
}

function preencherSelectAreas() {
  const select = $("regra-area");
  const valorAtual = select.value;
  limpar(select);
  estado.areas.forEach(function (area) {
    const opcao = criar("option", "", area.nome);
    opcao.value = String(area.id);
    select.appendChild(opcao);
  });
  if (valorAtual && estado.areas.some(function (area) { return String(area.id) === valorAtual; })) {
    select.value = valorAtual;
  }

  const filtro = $("filtro-area-regras");
  if (!filtro) return;
  const filtroAtual = filtro.value;
  limpar(filtro);
  const todas = criar("option", "", "Todos os departamentos");
  todas.value = "";
  filtro.appendChild(todas);
  estado.areas.forEach(function (area) {
    const opcao = criar("option", "", area.nome);
    opcao.value = String(area.id);
    filtro.appendChild(opcao);
  });
  filtro.value = filtroAtual;
}

function renderizarAreas() {
  const lista = $("lista-areas");
  limpar(lista);

  if (!estado.areas.length) {
    lista.appendChild(criar("li", "nota", "Nenhum departamento cadastrado."));
    return;
  }

  estado.areas.forEach(function (area) {
    const item = criar("li", "area-item");

    const bloco = criar("div");
    bloco.appendChild(criar("h3", "", area.nome));
    bloco.appendChild(criar("p", "", area.descricao || "Sem descrição cadastrada."));
    bloco.appendChild(
      criar(
        "p",
        "rotulo contagem",
        plural(area.total_regras, "regra", "regras") +
          " · " +
          plural(area.total_ativas, "ativa", "ativas"),
      ),
    );
    item.appendChild(bloco);

    const acoes = criar("div", "area-acoes");
    const editar = criar("button", "botao pequeno", "Editar");
    editar.type = "button";
    editar.addEventListener("click", function () { abrirArea(area); });

    const excluir = criar("button", "botao pequeno perigo botao-icone");
    excluir.type = "button";
    aplicarLixeira(excluir, "Excluir departamento");
    excluir.addEventListener("click", function () {
      confirmar(
        "Excluir departamento?",
        'O departamento "' + area.nome + '" e suas ' + plural(area.total_regras, "regra", "regras") +
          " serão excluídos. Os alertas históricos permanecem.",
        "Excluir departamento",
        async function () {
          try {
            const resposta = await api("/api/admin/areas/" + area.id, { method: "DELETE" });
            avisar(
              "Departamento excluído. " +
                plural(resposta.regras_removidas, "regra excluída", "regras excluídas") +
                ".",
            );
            await carregarAreas();
            await carregarRegras();
          } catch (erro) {
            tratarErro(erro);
          }
        },
      );
    });

    acoes.appendChild(editar);
    acoes.appendChild(excluir);
    item.appendChild(acoes);
    lista.appendChild(item);
  });
}

async function carregarRegras() {
  estado.regras = await api("/api/admin/regras");
  renderizarRegras();
}

function rotuloTipo(tipo) {
  return tipo === "regex" ? "Regex" : "Palavra-chave";
}

function renderizarRegras() {
  const corpo = $("tabela-regras");
  limpar(corpo);

  const termo = normalizar($("busca-regras").value.trim());
  const areaFiltro = $("filtro-area-regras").value;
  const statusFiltro = $("filtro-status-regras").value;
  const filtradas = estado.regras.filter(function (regra) {
    if (areaFiltro && String(regra.area_id) !== areaFiltro) return false;
    if (statusFiltro === "ativas" && !regra.ativo) return false;
    if (statusFiltro === "inativas" && regra.ativo) return false;
    if (!termo) return true;
    return normalizar(
      [regra.nome, regra.area, regra.padrao, rotuloTipo(regra.tipo), ROTULO_NIVEL[regra.risco]].join(" "),
    ).indexOf(termo) >= 0;
  });

  $("contador-regras").textContent =
    plural(filtradas.length, "regra", "regras") +
    " · " +
    plural(
      filtradas.filter(function (regra) { return regra.ativo; }).length,
      "ativa",
      "ativas",
    );

  if (!filtradas.length) {
    const linha = criar("tr");
    const celula = criar("td", "nota", "Nenhuma regra encontrada.");
    celula.colSpan = 6;
    linha.appendChild(celula);
    corpo.appendChild(linha);
    return;
  }

  filtradas.forEach(function (regra) {
    const linha = criar("tr");

    const nome = criar("td");
    nome.appendChild(criar("span", "", regra.nome));
    nome.appendChild(criar("code", "", regra.padrao));
    linha.appendChild(nome);

    linha.appendChild(criar("td", "", regra.area));
    linha.appendChild(criar("td", "", rotuloTipo(regra.tipo)));

    const risco = criar("td");
    risco.appendChild(badge(regra.risco));
    linha.appendChild(risco);

    const ativa = criar("td");
    const alternativa = criar("label", "interruptor-regra");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = regra.ativo;
    checkbox.setAttribute("aria-label", "Ativar regra " + regra.nome);
    const textoAtiva = criar(
      "span",
      "interruptor-site-texto",
      checkbox.checked ? "Ativa" : "Pausada",
    );
    checkbox.addEventListener("change", function () {
      textoAtiva.textContent = checkbox.checked ? "Ativa" : "Pausada";
      atualizarAtivo(regra, checkbox.checked, checkbox);
    });
    alternativa.appendChild(checkbox);
    alternativa.appendChild(criar("span", "interruptor-site-trilho", null));
    alternativa.appendChild(textoAtiva);
    ativa.appendChild(alternativa);
    linha.appendChild(ativa);

    const acoes = criar("td", "direita");
    const grupoAcoes = criar("div", "acoes-tabela");
    const editar = criar("button", "botao pequeno", "Editar");
    editar.type = "button";
    editar.addEventListener("click", function () { abrirRegra(regra); });

    const excluir = criar("button", "botao pequeno perigo botao-icone");
    excluir.type = "button";
    aplicarLixeira(excluir, "Excluir regra");
    excluir.addEventListener("click", function () {
      confirmar(
        "Excluir regra?",
        'A regra "' + regra.nome + '" deixará de ser aplicada pela extensão. Esta ação não pode ser desfeita.',
        "Excluir regra",
        async function () {
          try {
            await api("/api/admin/regras/" + regra.id, { method: "DELETE" });
            avisar("Regra excluída.");
            await carregarRegras();
            await carregarAreas();
          } catch (erro) {
            tratarErro(erro);
          }
        },
      );
    });

    grupoAcoes.appendChild(editar);
    grupoAcoes.appendChild(excluir);
    acoes.appendChild(grupoAcoes);
    linha.appendChild(acoes);
    corpo.appendChild(linha);
  });
}

async function atualizarAtivo(regra, ativo, checkbox) {
  try {
    await api("/api/admin/regras/" + regra.id, {
      method: "PUT",
      body: JSON.stringify({
        area_id: regra.area_id,
        nome: regra.nome,
        tipo: regra.tipo,
        padrao: regra.padrao,
        risco: regra.risco,
        ativo: ativo,
      }),
    });
    regra.ativo = ativo;
    avisar(ativo ? "Regra ativada." : "Regra desativada.");
    await carregarRegras();
    await carregarAreas();
  } catch (erro) {
    checkbox.checked = !ativo;
    tratarErro(erro);
  }
}

function abrirRegra(regra) {
  $("titulo-regra").textContent = regra ? "Editar regra" : "Nova regra";
  $("regra-id").value = regra ? regra.id : "";
  $("regra-nome").value = regra ? regra.nome : "";
  $("regra-tipo").value = regra ? regra.tipo : "palavra-chave";
  $("regra-padrao").value = regra ? regra.padrao : "";
  $("regra-risco").value = regra ? regra.risco : "medio";
  $("regra-ativa").checked = regra ? regra.ativo : true;
  $("regra-teste").value = "";
  $("resultado-teste").textContent = "";
  $("resultado-teste").className = "resultado";

  if (regra) {
    $("regra-area").value = String(regra.area_id);
  } else if (estado.areas.length) {
    $("regra-area").value = String(estado.areas[0].id);
  }

  $("dialogo-regra").showModal();
}

function testarRegra() {
  const tipo = $("regra-tipo").value;
  const padrao = $("regra-padrao").value;
  const texto = $("regra-teste").value;
  const resultado = $("resultado-teste");

  if (!padrao.trim()) {
    resultado.textContent = "Informe os termos ou a expressão antes de testar.";
    resultado.className = "resultado erro";
    return;
  }
  if (!texto.trim()) {
    resultado.textContent = "Digite um texto de exemplo.";
    resultado.className = "resultado erro";
    return;
  }

  if (tipo === "regex") {
    let regex;
    try {
      regex = new RegExp(padrao, "gi");
    } catch (erro) {
      resultado.textContent = "Expressão inválida: " + erro.message;
      resultado.className = "resultado erro";
      return;
    }
    const encontrados = texto.match(regex);
    const total = encontrados ? encontrados.length : 0;
    resultado.textContent =
      total > 0
        ? plural(total, "correspondência encontrada", "correspondências encontradas") +
          " no texto de exemplo."
        : "Nenhuma correspondência no texto de exemplo.";
    resultado.className = "resultado " + (total > 0 ? "ok" : "erro");
    return;
  }

  const alvo = normalizar(texto);
  let total = 0;
  padrao.split(",").forEach(function (termo) {
    const limpo = normalizar(termo.trim());
    if (limpo.length < 2) return;
    let posicao = alvo.indexOf(limpo);
    while (posicao >= 0) {
      total += 1;
      posicao = alvo.indexOf(limpo, posicao + limpo.length);
    }
  });

  resultado.textContent =
    total > 0
      ? plural(total, "correspondência encontrada", "correspondências encontradas") +
        " no texto de exemplo."
      : "Nenhuma correspondência no texto de exemplo.";
  resultado.className = "resultado " + (total > 0 ? "ok" : "erro");
}

async function salvarRegra(evento) {
  evento.preventDefault();
  const id = $("regra-id").value;
  const dados = {
    area_id: Number($("regra-area").value),
    nome: $("regra-nome").value,
    tipo: $("regra-tipo").value,
    padrao: $("regra-padrao").value,
    risco: $("regra-risco").value,
    ativo: $("regra-ativa").checked,
  };

  try {
    if (id) {
      await api("/api/admin/regras/" + id, { method: "PUT", body: JSON.stringify(dados) });
      avisar("Regra atualizada.");
    } else {
      await api("/api/admin/regras", { method: "POST", body: JSON.stringify(dados) });
      avisar("Regra criada.");
    }
    $("dialogo-regra").close();
    await carregarRegras();
    await carregarAreas();
  } catch (erro) {
    tratarErro(erro);
  }
}

// ---------------------------------------------------------------------------
// Áreas
// ---------------------------------------------------------------------------

function abrirArea(area) {
  $("titulo-area").textContent = area ? "Editar departamento" : "Novo departamento";
  $("area-id").value = area ? area.id : "";
  $("area-nome").value = area ? area.nome : "";
  $("area-descricao").value = area ? area.descricao : "";
  $("dialogo-area").showModal();
}

async function salvarArea(evento) {
  evento.preventDefault();
  const id = $("area-id").value;
  const dados = {
    nome: $("area-nome").value,
    descricao: $("area-descricao").value,
  };

  try {
    if (id) {
      await api("/api/admin/areas/" + id, { method: "PUT", body: JSON.stringify(dados) });
      avisar("Departamento atualizado.");
    } else {
      await api("/api/admin/areas", { method: "POST", body: JSON.stringify(dados) });
      avisar("Departamento criado.");
    }
    $("dialogo-area").close();
    await carregarAreas();
    await carregarRegras();
  } catch (erro) {
    tratarErro(erro);
  }
}

// ---------------------------------------------------------------------------
// Mensagens educativas
// ---------------------------------------------------------------------------

async function carregarMensagens() {
  const mensagens = await api("/api/admin/mensagens");
  const container = $("mensagens");
  limpar(container);

  mensagens.forEach(function (mensagem) {
    const editor = criar("section", "mensagem-editor");

    const topo = criar("div", "topo-editor");
    const selo = badge(mensagem.nivel);
    if (mensagem.nivel === "baixo") selo.textContent = "Baixo · com detecções";
    topo.appendChild(selo);
    editor.appendChild(topo);

    const rotuloNivel = ROTULO_NIVEL[mensagem.nivel] || mensagem.nivel;
    const campo = document.createElement("textarea");
    campo.value = mensagem.texto;
    campo.maxLength = 600;
    campo.setAttribute("aria-label", "Mensagem educativa: " + rotuloNivel);
    editor.appendChild(campo);

    const rodape = criar("div", "rodape-editor");
    const contador = criar("span", "rotulo", mensagem.texto.length + "/600");
    campo.addEventListener("input", function () {
      contador.textContent = campo.value.length + "/600";
    });

    const salvar = criar("button", "botao pequeno primario", "Salvar");
    salvar.type = "button";
    salvar.addEventListener("click", async function () {
      try {
        await api("/api/admin/mensagens/" + mensagem.nivel, {
          method: "PUT",
          body: JSON.stringify({ texto: campo.value }),
        });
        avisar("Mensagem de risco " + mensagem.nivel + " salva.");
      } catch (erro) {
        tratarErro(erro);
      }
    });

    rodape.appendChild(contador);
    rodape.appendChild(salvar);
    editor.appendChild(rodape);

    container.appendChild(editor);
  });
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

async function popularFiltroDepartamento() {
  const select = $("filtro-departamento");
  const atual = select.value;

  let emUso = [];
  try {
    emUso = await api("/api/admin/departamentos");
  } catch (erro) {
    emUso = [];
  }

  const nomes = [];
  estado.areas.forEach(function (area) {
    if (nomes.indexOf(area.nome) < 0) nomes.push(area.nome);
  });
  emUso.forEach(function (item) {
    if (item.departamento && nomes.indexOf(item.departamento) < 0) {
      nomes.push(item.departamento);
    }
  });
  // Alertas enviados sem departamento preenchido ficam como “Não informado”.
  if (nomes.indexOf("Não informado") < 0) nomes.push("Não informado");
  nomes.sort(function (a, b) {
    return a.localeCompare(b, "pt-BR");
  });

  limpar(select);
  const todas = criar("option", "", "Todos os departamentos");
  todas.value = "todos";
  select.appendChild(todas);

  nomes.forEach(function (nome) {
    const opcao = criar("option", "", nome);
    opcao.value = nome;
    select.appendChild(opcao);
  });

  select.value = atual && (atual === "todos" || nomes.indexOf(atual) >= 0) ? atual : "todos";
}

function lerFiltros() {
  estado.filtros = {
    de: $("filtro-de").value,
    ate: $("filtro-ate").value,
    departamento: $("filtro-departamento").value,
    nivel: $("filtro-nivel").value,
  };
}

function parametrosFiltros() {
  const parametros = new URLSearchParams();
  if (estado.filtros.de) parametros.set("de", estado.filtros.de);
  if (estado.filtros.ate) parametros.set("ate", estado.filtros.ate);
  if (estado.filtros.departamento && estado.filtros.departamento !== "todos") {
    parametros.set("departamento", estado.filtros.departamento);
  }
  if (estado.filtros.nivel && estado.filtros.nivel !== "todos") {
    parametros.set("nivel", estado.filtros.nivel);
  }
  return parametros;
}

async function carregarAlertas(pagina) {
  lerFiltros();
  const parametros = parametrosFiltros();
  parametros.set("pagina", String(pagina));
  parametros.set("por_pagina", "12");

  const dados = await api("/api/admin/alertas?" + parametros.toString());
  estado.pagina = dados.pagina;
  estado.totalPaginas = dados.total_paginas;

  const filtrosExportacao = parametrosFiltros().toString();
  $("exportar").href = "/api/admin/exportar.csv?" + filtrosExportacao;
  $("exportar-pdf").href = "/api/admin/exportar.pdf?" + filtrosExportacao;
  $("resumo-listagem").textContent =
    plural(dados.total, "alerta", "alertas") +
    " · página " +
    dados.pagina +
    " de " +
    dados.total_paginas;
  $("pagina-info").textContent = dados.pagina + " de " + dados.total_paginas;
  $("pagina-anterior").disabled = dados.pagina <= 1;
  $("pagina-proxima").disabled = dados.pagina >= dados.total_paginas;

  const corpo = $("tabela-alertas");
  limpar(corpo);

  if (!dados.registros.length) {
    const linha = criar("tr");
    const celula = criar("td", "nota", "Nenhum alerta com estes filtros.");
    celula.colSpan = 9;
    linha.appendChild(celula);
    corpo.appendChild(linha);
    return;
  }

  dados.registros.forEach(function (alerta) {
    const linha = criar("tr");

    linha.appendChild(criar("td", "", quando(alerta.data_hora)));
    linha.appendChild(criar("td", "", alerta.departamento));
    linha.appendChild(criar("td", "", alerta.colaborador || "Não informado"));
    linha.appendChild(criar("td", "", alerta.site));
    linha.appendChild(
      criar("td", "origem", ROTULO_ORIGEM[alerta.origem] || "Texto digitado"),
    );

    const nivel = criar("td");
    nivel.appendChild(badge(alerta.nivel_risco));
    linha.appendChild(nivel);

    const acao = criar("td", "", alerta.acao === "enviou" ? "Enviou" : "Cancelou");
    linha.appendChild(acao);

    const tipos = criar("td", "", alerta.itens.map(function (item) {
      return item.tipo_detectado;
    }).join(" · ") || "—");
    tipos.style.maxWidth = "220px";
    tipos.style.overflow = "hidden";
    tipos.style.textOverflow = "ellipsis";
    tipos.style.whiteSpace = "nowrap";
    linha.appendChild(tipos);

    const acoes = criar("td", "direita");
    const grupoAcoes = criar("div", "acoes-tabela");
    const ver = criar("button", "botao pequeno", "Detalhes");
    ver.type = "button";
    ver.addEventListener("click", function () { abrirDetalhe(alerta.id); });

    const excluir = criar("button", "botao pequeno perigo botao-icone");
    excluir.type = "button";
    aplicarLixeira(excluir, "Excluir alerta");
    excluir.addEventListener("click", function () {
      confirmar(
        "Excluir alerta?",
        "O registro e suas categorias identificadas serão excluídos da auditoria. Esta ação não pode ser desfeita.",
        "Excluir alerta",
        async function () {
          try {
            await api("/api/admin/alertas/" + alerta.id, { method: "DELETE" });
            avisar("Alerta excluído.");
            await carregarAlertas(estado.pagina);
          } catch (erro) {
            tratarErro(erro);
          }
        },
      );
    });

    grupoAcoes.appendChild(ver);
    grupoAcoes.appendChild(excluir);
    acoes.appendChild(grupoAcoes);
    linha.appendChild(acoes);
    corpo.appendChild(linha);
  });
}

async function abrirDetalhe(id) {
  try {
    const alerta = await api("/api/admin/alertas/" + id);
    estado.alertaAtual = alerta;

    $("detalhe-titulo").textContent = alerta.departamento + " · " + alerta.site;
    $("detalhe-sub").textContent = quando(alerta.data_hora);

    const campos = $("detalhe-campos");
    limpar(campos);
    const pares = [
      ["Nível de risco", ROTULO_NIVEL[alerta.nivel_risco]],
      ["Decisão", alerta.acao === "enviou" ? "Enviou" : "Cancelou"],
      ["Colaborador", alerta.colaborador || "Não informado"],
      ["Origem", ROTULO_ORIGEM[alerta.origem] || "Texto digitado"],
    ];
    pares.forEach(function (par) {
      const linha = criar("div");
      linha.appendChild(criar("dt", "", par[0]));
      linha.appendChild(criar("dd", "", par[1]));
      campos.appendChild(linha);
    });

    const lista = $("detalhe-itens");
    limpar(lista);
    if (!alerta.itens.length) {
      lista.appendChild(criar("li", "", "Nenhum tipo registrado."));
    } else {
      alerta.itens.forEach(function (item) {
        const linha = criar("li");
        const bloco = criar("span");
        bloco.appendChild(criar("span", "", item.tipo_detectado));
        bloco.appendChild(criar("p", "meta", item.area || "—"));
        linha.appendChild(bloco);
        linha.appendChild(badge(item.risco));
        lista.appendChild(linha);
      });
    }

    $("dialogo-alerta").showModal();
  } catch (erro) {
    tratarErro(erro);
  }
}

async function exportarFiltrosAtuais() {
  lerFiltros();
  window.location.href = "/api/admin/exportar.csv?" + parametrosFiltros().toString();
}

// ---------------------------------------------------------------------------
// Código de verificação e administradores
// ---------------------------------------------------------------------------

async function carregarInstalacao() {
  const dados = await api("/api/admin/instalacao");
  estado.euSuperadmin = Boolean(dados.superadmin);
  $("instalacao-url").textContent = dados.url_base;
  // O código exibido inclui a URL do servidor e o token. Assim a extensão
  // consegue conectar pelo ZIP público sem pedir endereço separado.
  const codigo = dados.codigo || dados.token;
  $("instalacao-token").textContent = codigo;
  $("instalacao-token").dataset.valor = codigo;
}

async function carregarDispositivos() {
  const corpo = $("tabela-dispositivos");
  corpo.setAttribute("aria-busy", "true");
  const dados = await api("/api/admin/dispositivos");
  estado.dispositivos = dados.dispositivos || [];
  limpar(corpo);

  const atuais = estado.dispositivos.filter(function (dispositivo) {
    return dispositivo.codigo_atual && dispositivo.status !== "removida";
  }).length;
  const removidos = Number(dados.removidos) || 0;
  $("resumo-dispositivos").textContent =
    plural(dados.total, "dispositivo conectado", "dispositivos conectados") +
    " · " +
    plural(atuais, "com o código atual", "com o código atual") +
    (removidos
      ? " · " + plural(removidos, "removido recentemente", "removidos recentemente")
      : "") +
    ".";
  if ($("monitoramento-dispositivos")) {
    $("monitoramento-dispositivos").textContent = numero(dados.total);
  }

  corpo.setAttribute("aria-busy", "false");
  if (!estado.dispositivos.length) {
    const linha = criar("tr");
    const celula = criar("td", "micro", "Nenhum dispositivo conectado ainda.");
    celula.colSpan = 6;
    linha.appendChild(celula);
    corpo.appendChild(linha);
    return;
  }

  estado.dispositivos.forEach(function (dispositivo) {
    const linha = criar("tr");

    const colaborador = criar("td");
    colaborador.appendChild(
      criar("strong", "nome-colaborador", dispositivo.colaborador || "Não identificado"),
    );
    linha.appendChild(colaborador);
    linha.appendChild(criar("td", null, dispositivo.setor || "Não informado"));
    linha.appendChild(
      criar(
        "td",
        "tabular centro",
        numero(dispositivo.alertas_emitidos || 0),
      ),
    );

    const status = criar("td");
    status.appendChild(badgeStatusDispositivo(dispositivo.status));
    linha.appendChild(status);
    linha.appendChild(criar("td", "micro", quando(dispositivo.ultimo_visto)));

    const acoes = criar("td", "direita");
    if (dispositivo.status === "removida") {
      acoes.appendChild(criar("span", "micro", "—"));
    } else {
      const desconectar = criar("button", "botao pequeno perigo", "Desconectar");
      desconectar.type = "button";
      desconectar.addEventListener("click", function () {
        confirmar(
          "Desconectar dispositivo?",
          (dispositivo.colaborador || "Este acesso") +
            " deixa de receber regras e de registrar alertas. Se o código for renovado, ele pode " +
            "voltar ao salvar o novo código nas Opções.",
          "Desconectar",
          async function () {
            try {
              await api("/api/admin/dispositivos/" + encodeURIComponent(dispositivo.id), {
                method: "DELETE",
              });
              avisar("Dispositivo desconectado.");
              await Promise.all([carregarDispositivos(), carregarInstalacao()]);
            } catch (erro) {
              tratarErro(erro);
            }
          },
        );
      });
      acoes.appendChild(desconectar);
    }
    linha.appendChild(acoes);
    corpo.appendChild(linha);
  });
}

async function copiarToken() {
  const valor = $("instalacao-token").dataset.valor || $("instalacao-token").textContent;
  if (!valor) return;
  try {
    await navigator.clipboard.writeText(valor);
    avisar("Código completo copiado. Cole em Opções da extensão.");
  } catch (erro) {
    avisar("Não foi possível copiar. Selecione o código manualmente.", "erro");
  }
}

async function renovarToken() {
  try {
    const resposta = await api("/api/admin/instalacao/renovar-token", { method: "POST" });
    avisar(resposta.mensagem || "Código renovado.");
    await Promise.all([carregarInstalacao(), carregarDispositivos()]);
  } catch (erro) {
    tratarErro(erro);
  }
}

async function confirmarRenovacaoToken() {
  try {
    const dados = await api("/api/admin/instalacao");
    const total = Number(dados.dispositivos_vinculados) || 0;
    confirmar(
      "Renovar o código de verificação?",
      total === 0
        ? "Nenhum dispositivo está vinculado ao código atual. As extensões existentes deixarão de registrar alertas até receber o novo valor."
        : "Há " +
            plural(total, "dispositivo ainda vinculado", "dispositivos ainda vinculados") +
            " ao código atual. Todos deixarão de receber regras e registrar alertas até serem reconfigurados.",
      "Renovar código",
      function () { void renovarToken(); },
    );
  } catch (erro) {
    tratarErro(erro);
  }
}

async function carregarAdmins() {
  const dados = await api("/api/admin/usuarios");
  estado.euSuperadmin = Boolean(dados.superadmin);
  const botaoLimparAtividades = $("limpar-atividades");
  if (botaoLimparAtividades) {
    botaoLimparAtividades.hidden = !estado.euSuperadmin;
  }
  const admins = dados.usuarios || [];
  const corpo = $("tabela-admins");
  corpo.setAttribute("aria-busy", "true");
  limpar(corpo);

  $("novo-admin").hidden = !estado.euSuperadmin;

  if (!admins.length) {
    const linha = criar("tr");
    const celula = criar("td", "micro", "Nenhum administrador cadastrado.");
    celula.colSpan = 4;
    linha.appendChild(celula);
    corpo.appendChild(linha);
  }

  admins.forEach(function (admin) {
    const linha = criar("tr");

    const usuario = criar("td");
    usuario.appendChild(document.createTextNode(admin.usuario));
    if (admin.atual) {
      const marca = criar("span", "micro", " · você");
      usuario.appendChild(marca);
    }
    linha.appendChild(usuario);

    const perfil = criar("td");
    const selo = criar(
      "span",
      "badge admin-badge",
      admin.superadmin ? "Superadmin" : "Administrador",
    );
    perfil.appendChild(selo);
    linha.appendChild(perfil);
    linha.appendChild(criar("td", "", quando(admin.criado_em)));

    const acoes = criar("td", "direita");
    const podeTrocarSenha = admin.atual || (estado.euSuperadmin && !admin.superadmin);
    if (podeTrocarSenha) {
      const senha = criar("button", "botao pequeno marca", "Trocar senha");
      senha.type = "button";
      senha.addEventListener("click", function () { abrirAdmin(admin); });
      acoes.appendChild(senha);
    }

    if (estado.euSuperadmin && !admin.atual && !admin.superadmin) {
      const excluir = criar("button", "botao pequeno perigo botao-icone");
      excluir.type = "button";
      excluir.style.marginLeft = "6px";
      aplicarLixeira(excluir, "Excluir administrador");
      excluir.addEventListener("click", function () {
        confirmar(
          "Excluir administrador?",
          "A conta de " + admin.usuario + " perde o acesso ao painel. Os alertas já registrados não são afetados.",
          "Excluir",
          async function () {
            try {
              await api("/api/admin/usuarios/" + admin.id, { method: "DELETE" });
              avisar("Administrador excluído.");
              await Promise.all([
                carregarAdmins(),
                carregarAtividades(estado.paginaAtividades),
              ]);
            } catch (erro) {
              tratarErro(erro);
            }
          },
        );
      });
      acoes.appendChild(excluir);
    }

    if (!acoes.childNodes.length) {
      acoes.appendChild(criar("span", "micro", "Protegido"));
    }
    linha.appendChild(acoes);
    corpo.appendChild(linha);
  });
  corpo.setAttribute("aria-busy", "false");
}

async function carregarAtividades(pagina) {
  const alvo = Math.max(1, Number(pagina) || 1);
  $("lista-atividades").setAttribute("aria-busy", "true");
  const dados = await api(
    "/api/admin/atividades?pagina=" + alvo + "&por_pagina=8",
  );
  estado.paginaAtividades = dados.pagina || 1;
  estado.totalPaginasAtividades = dados.total_paginas || 1;

  $("atividades-resumo").textContent =
    plural(dados.total, "atividade", "atividades") +
    " · página " +
    estado.paginaAtividades +
    " de " +
    estado.totalPaginasAtividades;
  $("atividades-pagina-info").textContent =
    estado.paginaAtividades + " de " + estado.totalPaginasAtividades;
  $("atividades-pagina-anterior").disabled = estado.paginaAtividades <= 1;
  $("atividades-pagina-proxima").disabled =
    estado.paginaAtividades >= estado.totalPaginasAtividades;

  const lista = $("lista-atividades");
  const atividades = dados.atividades || [];
  limpar(lista);
  lista.setAttribute("aria-busy", "false");

  if (!atividades.length) {
    lista.appendChild(
      criar("li", "atividade-vazia", "Nenhuma alteração administrativa registrada ainda."),
    );
    return;
  }

  atividades.forEach(function (atividade) {
    const item = criar("li", "atividade");
    const conteudo = criar("div", "atividade-conteudo");
    const frase = criar("p");
    frase.appendChild(criar("strong", null, atividade.usuario || "admin"));
    frase.appendChild(document.createTextNode(" " + (atividade.descricao || "")));
    conteudo.appendChild(frase);

    const meta = criar("div", "atividade-meta");
    const tipo = ROTULO_ATIVIDADE[atividade.entidade] || atividade.entidade || "Alteração";
    meta.appendChild(criar("span", "atividade-tipo", tipo));
    meta.appendChild(criar("span", "atividade-separador", "·"));
    const horario = document.createElement("time");
    horario.dateTime = atividade.criado_em || "";
    horario.textContent = quando(atividade.criado_em);
    meta.appendChild(horario);
    conteudo.appendChild(meta);

    item.appendChild(conteudo);
    lista.appendChild(item);
  });
}

function abrirAdmin(admin) {
  const editando = Boolean(admin);
  $("titulo-admin").textContent = editando ? "Trocar senha" : "Novo administrador";
  $("admin-id").value = editando ? String(admin.id) : "";
  $("admin-usuario").value = editando ? admin.usuario : "";
  $("admin-usuario").disabled = editando;
  $("admin-senha").value = "";
  $("admin-senha-atual").value = "";
  $("campo-senha-atual").hidden = !editando;
  $("admin-senha-atual").required = editando;
  $("dialogo-admin").showModal();
  if (!editando) $("admin-usuario").focus();
}

async function salvarAdmin(evento) {
  evento.preventDefault();
  const id = $("admin-id").value;
  const senha = $("admin-senha").value;

  try {
    if (id) {
      await api("/api/admin/usuarios/" + id + "/senha", {
        method: "PUT",
        body: JSON.stringify({
          senha: senha,
          senha_atual: $("admin-senha-atual").value,
        }),
      });
      avisar("Senha atualizada.");
    } else {
      await api("/api/admin/usuarios", {
        method: "POST",
        body: JSON.stringify({ usuario: $("admin-usuario").value.trim(), senha: senha }),
      });
      avisar("Administrador criado.");
    }
    $("dialogo-admin").close();
    await Promise.all([carregarAdmins(), carregarAtividades(1)]);
  } catch (erro) {
    tratarErro(erro);
  }
}

async function exportarPdfFiltrosAtuais() {
  lerFiltros();
  window.location.href = "/api/admin/exportar.pdf?" + parametrosFiltros().toString();
}

// ---------------------------------------------------------------------------
// Monitoramento
// ---------------------------------------------------------------------------

function urlsDoSite(site) {
  return (site.hosts || []).map(function (host) {
    return "https://" + host;
  });
}

function atualizarRemocaoUrls() {
  const linhas = document.querySelectorAll("#site-urls .linha-url");
  linhas.forEach(function (linha) {
    const remover = linha.querySelector(".remover-url");
    if (remover) remover.hidden = linhas.length <= 1;
  });
  const adicionar = $("adicionar-url");
  if (adicionar) adicionar.disabled = linhas.length >= 10;
}

function adicionarLinhaUrl(valor) {
  const container = $("site-urls");
  if (!container || container.children.length >= 10) return;

  const linha = criar("div", "linha-url");
  const campo = document.createElement("input");
  campo.type = "url";
  campo.placeholder = "https://ia.exemplo.com";
  campo.value = valor || "";
  campo.setAttribute("aria-label", "URL da IA");

  const remover = criar("button", "remover-url", "×");
  remover.type = "button";
  remover.setAttribute("aria-label", "Remover URL");
  remover.hidden = container.children.length === 0;
  remover.addEventListener("click", function () {
    if (container.children.length <= 1) return;
    linha.remove();
    atualizarRemocaoUrls();
  });

  linha.appendChild(campo);
  linha.appendChild(remover);
  container.appendChild(linha);
  atualizarRemocaoUrls();
}

function atualizarInterruptorMonitoramento() {
  const ativo = Boolean(estado.monitoramento && estado.monitoramento.monitoramento_ativo);
  $("monitoramento-ativo").checked = ativo;
  $("monitoramento-ativo-texto").textContent = ativo ? "Ativa" : "Pausada";
}

function atualizarEstadoMonitoramento() {
  const geralAtivo = Boolean(
    estado.monitoramento && estado.monitoramento.monitoramento_ativo,
  );
  const ativos = geralAtivo
    ? document.querySelectorAll("#sites-monitorados .site-toggle:checked").length
    : 0;
  atualizarInterruptorMonitoramento();
  $("monitoramento-chats-ativas").textContent = String(ativos);
  $("monitoramento-chats-total").textContent = String(estado.sites.length);
}

function desenharSitesMonitorados(disponiveis, ativos) {
  const container = $("sites-monitorados");
  limpar(container);
  const selecionados = new Set(Array.isArray(ativos) ? ativos : []);
  estado.sites = Array.isArray(disponiveis) ? disponiveis.slice() : [];

  if (!estado.sites.length) {
    container.appendChild(criar("p", "vazio-painel", "Nenhuma IA cadastrada."));
    return;
  }

  estado.sites.forEach(function (site) {
    const card = criar("article", "site-card" + (selecionados.has(site.id) ? " site-card-ativo" : ""));

    const topo = criar("div", "site-card-topo");
    const identidade = criar("div", "site-identidade");
    identidade.appendChild(criar("h3", null, site.nome || site.id));
    identidade.appendChild(criar("p", "site-url", urlsDoSite(site).join(" · ")));
    topo.appendChild(identidade);
    card.appendChild(topo);

    const rodape = criar("div", "site-card-rodape");
    const alternativa = criar("label", "interruptor-site");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "site-toggle";
    checkbox.value = site.id;
    checkbox.checked = selecionados.has(site.id);
    checkbox.setAttribute("aria-label", "Ativar " + (site.nome || site.id));
    const textoInterruptor = criar(
      "span",
      "interruptor-site-texto",
      checkbox.checked ? "Ativa" : "Pausada",
    );
    checkbox.addEventListener("change", function () {
      if (
        !checkbox.checked &&
        $("monitoramento-ativo").checked &&
        !document.querySelector("#sites-monitorados .site-toggle:checked")
      ) {
        checkbox.checked = true;
        avisar("Mantenha ao menos uma IA ativa ou pause o monitoramento geral.", "erro");
        return;
      }
      card.classList.toggle("site-card-ativo", checkbox.checked);
      textoInterruptor.textContent = checkbox.checked ? "Ativa" : "Pausada";
      atualizarEstadoMonitoramento();
      // Desativar precisa chegar à extensão sem o atraso do agrupamento de
      // cliques. Ativar continua usando o pequeno debounce para evitar uma
      // sequência de gravações quando o administrador ajusta várias IAs.
      if (!checkbox.checked) {
        clearTimeout(timerPoliticaMonitoramento);
        void salvarPoliticaMonitoramento();
      } else {
        agendarPoliticaMonitoramento();
      }
    });
    alternativa.appendChild(checkbox);
    alternativa.appendChild(criar("span", "interruptor-site-trilho", null));
    alternativa.appendChild(textoInterruptor);
    rodape.appendChild(alternativa);

    const acoes = criar("div", "site-card-acoes");
    const editar = criar("button", "botao pequeno", "Editar");
    editar.type = "button";
    editar.addEventListener("click", function () { abrirSite(site); });
    acoes.appendChild(editar);

    const excluir = criar("button", "botao pequeno perigo botao-icone");
    excluir.type = "button";
    aplicarLixeira(excluir, "Excluir IA monitorada");
    excluir.addEventListener("click", function () { removerSite(site); });
    acoes.appendChild(excluir);
    rodape.appendChild(acoes);
    card.appendChild(rodape);
    container.appendChild(card);
  });
}

async function carregarMonitoramento() {
  const dados = await api("/api/admin/configuracoes");
  estado.monitoramento = dados;
  desenharSitesMonitorados(dados.sites_disponiveis, dados.sites_ativos);
  atualizarEstadoMonitoramento();
}

function abrirSite(site) {
  $("site-id").value = site ? site.id : "";
  $("site-nome").value = site ? site.nome : "";
  limpar($("site-urls"));
  const urls = site ? urlsDoSite(site) : [""];
  urls.forEach(function (url) {
    adicionarLinhaUrl(url);
  });
  if (!urls.length) adicionarLinhaUrl("");
  $("titulo-site").textContent = site ? "Editar IA" : "Adicionar IA";
  $("dialogo-site").showModal();
  setTimeout(function () { $("site-nome").focus(); }, 30);
}

async function salvarSite(evento) {
  evento.preventDefault();
  const id = $("site-id").value.trim();
  const urls = Array.from(document.querySelectorAll("#site-urls .linha-url input"))
    .map(function (campo) { return campo.value.trim(); })
    .filter(Boolean);
  if (!urls.length) {
    avisar("Informe ao menos uma URL da IA.", "erro");
    return;
  }
  const corpo = JSON.stringify({ nome: $("site-nome").value.trim(), urls: urls });
  try {
    await api(id ? "/api/admin/sites/" + encodeURIComponent(id) : "/api/admin/sites", {
      method: id ? "PUT" : "POST",
      body: corpo,
    });
    $("dialogo-site").close();
    avisar(id ? "IA atualizada." : "IA adicionada.");
    await carregarMonitoramento();
  } catch (erro) {
    tratarErro(erro);
  }
}

function removerSite(site) {
  confirmar(
    "Excluir IA monitorada?",
    "A IA " + site.nome + " sai do catálogo. A extensão deixará de analisar esse domínio.",
    "Excluir IA",
    async function () {
      try {
        await api("/api/admin/sites/" + encodeURIComponent(site.id), { method: "DELETE" });
        avisar("IA excluída.");
        await carregarMonitoramento();
      } catch (erro) {
        tratarErro(erro);
      }
    },
  );
}

let timerPoliticaMonitoramento = null;
let salvandoPoliticaMonitoramento = false;
let politicaMonitoramentoPendente = null;

function politicaMonitoramentoDaTela() {
  return {
    monitoramento_ativo: $("monitoramento-ativo").checked,
    sites_ativos: Array.from(
      document.querySelectorAll("#sites-monitorados .site-toggle:checked"),
    ).map(function (checkbox) {
      return checkbox.value;
    }),
  };
}

function agendarPoliticaMonitoramento() {
  clearTimeout(timerPoliticaMonitoramento);
  timerPoliticaMonitoramento = setTimeout(function () {
    void salvarPoliticaMonitoramento();
  }, 250);
}

async function aplicarPoliticaMonitoramento(politica) {
  const dados = await api("/api/admin/configuracoes", {
    method: "PUT",
    body: JSON.stringify(politica),
  });
  estado.monitoramento = Object.assign({}, estado.monitoramento, {
    monitoramento_ativo: dados.monitoramento_ativo,
    sites_ativos: dados.sites_ativos,
    sites_disponiveis: dados.sites_disponiveis,
  });
  atualizarEstadoMonitoramento();
  avisar("Monitoramento atualizado.");
}

async function salvarPoliticaMonitoramento() {
  const politica = politicaMonitoramentoDaTela();
  if (politica.monitoramento_ativo && !politica.sites_ativos.length) {
    avisar("Selecione ao menos uma IA ou pause o monitoramento.", "erro");
    await carregarMonitoramento();
    return;
  }

  // Uma desativação pode disparar outra antes de a primeira gravação
  // terminar. A fila mantém a ordem e garante que a última escolha da tela
  // seja a política final, sem uma resposta antiga sobrescrever a nova.
  politicaMonitoramentoPendente = politica;
  if (salvandoPoliticaMonitoramento) return;
  salvandoPoliticaMonitoramento = true;
  try {
    while (politicaMonitoramentoPendente) {
      const atual = politicaMonitoramentoPendente;
      politicaMonitoramentoPendente = null;
      try {
        await aplicarPoliticaMonitoramento(atual);
      } catch (erro) {
        tratarErro(erro);
        await carregarMonitoramento();
        break;
      }
    }
  } finally {
    salvandoPoliticaMonitoramento = false;
  }
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

function ligarEventos() {
  document.querySelectorAll("[data-ir]").forEach(function (botao) {
    botao.addEventListener("click", function () { irPara(botao.dataset.ir); });
  });

  if ($("alternar-tema")) {
    $("alternar-tema").addEventListener("click", alternarTema);
  }

  document.querySelectorAll("[data-periodo]").forEach(function (botao) {
    botao.addEventListener("click", function () {
      const periodo = Number(botao.dataset.periodo);
      if (![7, 14, 30, 90].includes(periodo)) return;
      estado.periodoGrafico = periodo;
      document.querySelectorAll("[data-periodo]").forEach(function (outro) {
        outro.classList.toggle("ativo", outro === botao);
      });
      carregarResumo().catch(tratarErro);
    });
  });

  $("atualizar-resumo").addEventListener("click", function () {
    carregarResumo().catch(tratarErro);
  });

  $("form-limiar").addEventListener("submit", async function (evento) {
    evento.preventDefault();
    const limiar = Number($("limiar").value);
    try {
      await api("/api/admin/configuracoes", {
        method: "PUT",
        body: JSON.stringify({ limiar_gargalo: limiar }),
      });
      avisar("Tolerância atualizada.");
      await carregarResumo();
    } catch (erro) {
      tratarErro(erro);
    }
  });

  $("monitoramento-ativo").addEventListener("change", function () {
    const checkbox = $("monitoramento-ativo");
    if (
      checkbox.checked &&
      !document.querySelector("#sites-monitorados .site-toggle:checked")
    ) {
      checkbox.checked = false;
      atualizarInterruptorMonitoramento();
      avisar("Ative ao menos uma IA para retomar o monitoramento.", "erro");
      return;
    }
    if (estado.monitoramento) {
      estado.monitoramento.monitoramento_ativo = checkbox.checked;
    }
    atualizarEstadoMonitoramento();
    agendarPoliticaMonitoramento();
  });

  $("adicionar-chat").addEventListener("click", function () { abrirSite(null); });
  $("adicionar-url").addEventListener("click", function () {
    adicionarLinhaUrl("");
    const campos = document.querySelectorAll("#site-urls .linha-url input");
    const ultimo = campos[campos.length - 1];
    if (ultimo) ultimo.focus();
  });
  $("form-site").addEventListener("submit", salvarSite);

  $("nova-regra").addEventListener("click", function () { abrirRegra(null); });
  $("form-regra").addEventListener("submit", salvarRegra);
  $("testar-regra").addEventListener("click", testarRegra);
  $("busca-regras").addEventListener("input", renderizarRegras);
  $("filtro-area-regras").addEventListener("change", renderizarRegras);
  $("filtro-status-regras").addEventListener("change", renderizarRegras);

  $("nova-area").addEventListener("click", function () { abrirArea(null); });
  $("form-area").addEventListener("submit", salvarArea);

  $("form-filtros").addEventListener("submit", function (evento) {
    evento.preventDefault();
    carregarAlertas(1).catch(tratarErro);
  });

  $("limpar-filtros").addEventListener("click", function () {
    $("filtro-de").value = "";
    $("filtro-ate").value = "";
    $("filtro-departamento").value = "todos";
    $("filtro-nivel").value = "todos";
    carregarAlertas(1).catch(tratarErro);
  });

  $("pagina-anterior").addEventListener("click", function () {
    if (estado.pagina > 1) carregarAlertas(estado.pagina - 1).catch(tratarErro);
  });

  $("pagina-proxima").addEventListener("click", function () {
    if (estado.pagina < estado.totalPaginas) {
      carregarAlertas(estado.pagina + 1).catch(tratarErro);
    }
  });

  $("exportar").addEventListener("click", function (evento) {
    evento.preventDefault();
    exportarFiltrosAtuais();
  });

  $("exportar-pdf").addEventListener("click", function (evento) {
    evento.preventDefault();
    exportarPdfFiltrosAtuais();
  });

  $("copiar-token").addEventListener("click", function () {
    void copiarToken();
  });

  $("renovar-token").addEventListener("click", function () {
    void confirmarRenovacaoToken();
  });

  $("atualizar-dispositivos").addEventListener("click", function () {
    carregarDispositivos().catch(tratarErro);
  });

  $("atualizar-atividades").addEventListener("click", function () {
    carregarAtividades(estado.paginaAtividades).catch(tratarErro);
  });

  const botaoLimparAtividades = $("limpar-atividades");
  if (botaoLimparAtividades) {
    botaoLimparAtividades.addEventListener("click", function () {
      confirmar(
        "Excluir todo o histórico de atividades?",
        "Todos os registros de auditoria administrativa serão apagados. Esta ação não pode ser desfeita.",
        "Excluir histórico",
        async function () {
          try {
            const resposta = await api("/api/admin/atividades", { method: "DELETE" });
            const removidos = Number(resposta.removidos) || 0;
            avisar(
              removidos === 0
                ? "O histórico de atividades já estava vazio."
                : plural(removidos, "atividade excluída", "atividades excluídas") +
                    " definitivamente.",
            );
            await carregarAtividades(1);
          } catch (erro) {
            tratarErro(erro);
          }
        },
      );
    });
  }

  $("atividades-pagina-anterior").addEventListener("click", function () {
    if (estado.paginaAtividades > 1) {
      carregarAtividades(estado.paginaAtividades - 1).catch(tratarErro);
    }
  });

  $("atividades-pagina-proxima").addEventListener("click", function () {
    if (estado.paginaAtividades < estado.totalPaginasAtividades) {
      carregarAtividades(estado.paginaAtividades + 1).catch(tratarErro);
    }
  });

  $("novo-admin").addEventListener("click", function () { abrirAdmin(null); });
  $("form-admin").addEventListener("submit", salvarAdmin);

  $("form-periodo").addEventListener("submit", async function (evento) {
    evento.preventDefault();
    const de = $("periodo-de").value;
    const ate = $("periodo-ate").value;
    if (!de || !ate) {
      avisar("Informe as duas datas do período.");
      return;
    }
    if (de > ate) {
      avisar("A data inicial não pode ser posterior à data final.");
      return;
    }

    try {
      const resposta = await api("/api/admin/alertas/limpar-periodo", {
        method: "POST",
        body: JSON.stringify({ de: de, ate: ate }),
      });
      $("dialogo-periodo").close();
      avisar(
        resposta.removidos === 0
          ? "Nenhum alerta encontrado no período."
          : plural(resposta.removidos, "alerta excluído", "alertas excluídos") + ".",
      );
      await carregarAlertas(1);
    } catch (erro) {
      tratarErro(erro);
    }
  });

  $("limpar-tudo").addEventListener("click", function () {
    confirmar(
      "Excluir todos os alertas?",
      "Toda a base de auditoria será apagada, inclusive os itens detectados. Esta ação não pode ser desfeita.",
      "Excluir todos os alertas",
      async function () {
        try {
          const resposta = await api("/api/admin/alertas", { method: "DELETE" });
          avisar(
            plural(resposta.removidos, "alerta excluído", "alertas excluídos") +
              " definitivamente.",
          );
          await carregarAlertas(1);
        } catch (erro) {
          tratarErro(erro);
        }
      },
    );
  });

  $("confirmar-cancelar").addEventListener("click", function () {
    acaoConfirmada = null;
    $("dialogo-confirmar").close();
  });

  $("confirmar-ok").addEventListener("click", function () {
    const acao = acaoConfirmada;
    acaoConfirmada = null;
    $("dialogo-confirmar").close();
    if (acao) acao();
  });

  $("detalhe-excluir").addEventListener("click", function () {
    if (!estado.alertaAtual) return;
    const id = estado.alertaAtual.id;
    confirmar(
      "Excluir alerta?",
      "O registro e suas categorias identificadas serão excluídos da auditoria.",
      "Excluir alerta",
      async function () {
        try {
          await api("/api/admin/alertas/" + id, { method: "DELETE" });
          $("dialogo-alerta").close();
          estado.alertaAtual = null;
          avisar("Alerta excluído.");
          await carregarAlertas(estado.pagina);
        } catch (erro) {
          tratarErro(erro);
        }
      },
    );
  });

  const INFORMACOES_ABAS = {
    visao:
      "Resume o que os alertas do período mostram: quantos foram gerados e como evoluíram, em quais níveis de risco, quais IAs e departamentos aparecem mais, quais categorias foram identificadas e se o colaborador enviou ou cancelou depois do alerta. É também nesta tela que se define a tolerância, usada para marcar um departamento como crítico.",
    tolerancia:
      "Percentual de alertas de risco alto a partir do qual um departamento é marcado como crítico. Vale para departamentos com ao menos 3 alertas; abaixo disso, ficam em observação.",
    alertas:
      "Registra cada aviso exibido nas extensões, com a IA usada, o departamento, o colaborador, a origem (texto, imagem ou PDF), o nível de risco, as categorias identificadas e a decisão de enviar ou cancelar. O conteúdo da conversa não é guardado. Os registros podem ser filtrados por data, departamento e nível, exportados em CSV ou PDF e mantidos pelo período de retenção definido aqui.",
    regras:
      "Reúne as regras que a extensão usa para identificar dados sensíveis. Cada regra pertence a um departamento, tem um nível de risco (baixo, médio ou alto) e um padrão de busca, que pode ser uma palavra-chave ou uma expressão regular. As regras podem ser criadas, editadas, ativadas, desativadas e excluídas, e as mudanças chegam às extensões automaticamente.",
    areas:
      "Lista os departamentos da empresa, que servem a duas funções: organizar as regras por área e identificar onde cada colaborador trabalha, já que ele escolhe o departamento na extensão. Com isso, risco e letramento podem ser comparados entre as áreas. Cada departamento mostra a própria matriz de risco e, ao ser excluído, mantém o histórico de alertas.",
    mensagens:
      "Define os textos que o colaborador lê no aviso exibido antes do envio, com uma mensagem para cada situação: risco baixo, quando há detecções de baixo risco; sem detecções, quando nada sensível é encontrado e o aviso exibe o selo de verificação; risco médio; e risco alto. Como o nível e as categorias identificadas já aparecem no próprio aviso, as mensagens trazem apenas a orientação, com limite de caracteres para manter o aviso curto. As alterações chegam às extensões automaticamente.",
    monitoramento:
      "Define como as extensões se comportam em toda a empresa: se o monitoramento está ativo e quais IAs são acompanhadas. A ativação geral e os interruptores de cada IA são salvos automaticamente. A lista mostra colaborador, departamento, alertas emitidos e status: Ativo (contato recente e código atual), Desatualizada (contato recente, mas com código antigo), Sem sinal (sem contato há mais de 24 horas; inclui computador desligado, sem rede ou extensão desativada/removida sem aviso) e Removida (desconectada pelo painel; fica visível por 30 dias). Aqui ficam ainda o código de verificação e o download da extensão.",
    administradores:
      "Gerencia as contas que acessam o painel. O superadmin, primeiro administrador criado, não pode ser excluído e é o único que cria e exclui outras contas. As demais contas usam o painel e podem trocar a própria senha. O histórico de atividades mostra quem fez cada alteração, com navegação por páginas; apenas o superadmin pode apagar todo esse histórico.",
    codigo:
      "Conecta a extensão ao painel e autoriza o envio de alertas ao painel.",
  };

  document.querySelectorAll(".info-aba").forEach(function (botao) {
    botao.addEventListener("click", function () {
      const chave = botao.dataset.info;
      $("titulo-info").textContent = botao.getAttribute("aria-label").replace("Sobre ", "");
      $("texto-info").textContent = INFORMACOES_ABAS[chave] || "";
      $("dialogo-info").showModal();
    });
  });

  document.querySelectorAll("[data-fecha]").forEach(function (botao) {
    botao.addEventListener("click", function () {
      const dialogo = $(botao.dataset.fecha);
      if (dialogo) dialogo.close();
    });
  });

  document.querySelectorAll(".dialogo").forEach(function (dialogo) {
    dialogo.addEventListener("click", function (evento) {
      if (evento.target === dialogo) dialogo.close();
    });
  });
}

/**
 * Atualização automática: um alerta registrado pela extensão aparece no painel
 * em poucos segundos, sem precisar recarregar a página. Fica parada quando a
 * aba está escondida e não mexe nas seções de cadastro.
 */
const INTERVALO_ATUALIZACAO = 15000;

function iniciarAtualizacaoAutomatica() {
  window.setInterval(function () {
    if (document.hidden) return;
    if (document.querySelector("dialog[open]")) return;
    if (estado.secao === "visao") {
      carregarResumo().catch(function () {
        /* erro já aparece no toast da próxima ação */
      });
    } else if (estado.secao === "alertas") {
      carregarAlertas(estado.pagina).catch(function () {
        /* mantém a lista atual se a rede falhar */
      });
    } else if (estado.secao === "monitoramento") {
      carregarDispositivos().catch(function () {
        /* mantém os dispositivos atuais se a rede falhar */
      });
    }
  }, INTERVALO_ATUALIZACAO);
}

document.addEventListener("DOMContentLoaded", function () {
  atualizarRotuloTema();
  ligarEventos();
  irPara("visao");
  iniciarAtualizacaoAutomatica();
});
