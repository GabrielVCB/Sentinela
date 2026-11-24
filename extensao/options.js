/** Sentinela — página de opções. */
"use strict";

// A configuração do painel pode injetar a URL pública em config.js. O
// colaborador informa apenas o código completo, que também pode carregar a URL.
const PADROES = {
  serverUrl: String(globalThis.SENTINELA_SERVIDOR_PADRAO || "").trim(),
  apiToken: "",
  departamento: "",
  colaborador: "",
};

let servidorAtual = PADROES.serverUrl;
const CHAVE_TEMA = "temaExtensao";
const CHAVE_TEMA_EM = "temaExtensaoEm";

/**
 * O painel entrega um único código no formato `https://servidor|codigo`.
 * Códigos antigos, só com o token, continuam válidos quando config.js já
 * trouxe a URL. O token enviado à API é sempre a parte depois do separador.
 */
function separarCodigo(valor) {
  const texto = String(valor || "").trim();
  const separador = texto.indexOf("|");
  if (separador > 0) {
    const url = texto.slice(0, separador).trim();
    const token = texto.slice(separador + 1).trim();
    if (/^https:\/\//i.test(url) && token) {
      try {
        return { serverUrl: new URL(url).origin, apiToken: token };
      } catch (erro) {
        /* segue como token simples */
      }
    }
  }
  return { serverUrl: "", apiToken: texto };
}

function codigoDaTela() {
  const codigo = separarCodigo(el.token.value);
  if (codigo.serverUrl) servidorAtual = codigo.serverUrl;
  return codigo;
}

const el = {};
let avisoPermissao = "";
let sitesConhecidos = [];
let sitesTotais = [];
let sitesPendentes = [];
let configuracaoSalva = null;
let tokenVisivel = false;

/**
 * Servidor na internet exige permissão do navegador para ser acessado.
 * A permissão é pedida na hora de salvar, com o endereço exato informado.
 */
async function garantirPermissao(url) {
  if (!/^https:\/\//i.test(url)) return { ok: false, mensagem: "Use uma URL https do servidor." };
  let origem = "";
  try {
    origem = new URL(url).origin + "/*";
  } catch (erro) {
    return { ok: false, mensagem: "URL inválida." };
  }

  try {
    // A permissão ampla de hosts já cobre o servidor e as IAs novas. Se ela
    // estiver presente, não há prompt nem dependência do clique em Salvar.
    const jaAutorizado = await chrome.permissions.contains({ origins: [origem] });
    if (jaAutorizado) return { ok: true };

    const concedido = await chrome.permissions.request({ origins: [origem] });
    return concedido
      ? { ok: true }
      : {
          ok: false,
          mensagem:
            "O navegador não autorizou o acesso a " +
            origem.replace(/\/\*$/, "") +
            ". Clique em Salvar novamente e escolha Permitir.",
        };
  } catch (erro) {
    return { ok: false, mensagem: erro instanceof Error ? erro.message : "Falha ao pedir permissão." };
  }
}

function enviar(mensagem) {
  return new Promise(function (resolver) {
    try {
      chrome.runtime.sendMessage(mensagem, function (resposta) {
        if (chrome.runtime.lastError) {
          resolver({ ok: false, erro: chrome.runtime.lastError.message });
          return;
        }
        resolver(resposta || { ok: false, erro: "Sem resposta do service worker." });
      });
    } catch (erro) {
      resolver({ ok: false, erro: erro.message });
    }
  });
}

function avisar(elemento, texto, tipo) {
  elemento.textContent = texto;
  elemento.className = "resultado " + (tipo || "");
}

function plural(total, singular, plural) {
  return total + " " + (Number(total) === 1 ? singular : plural);
}

function quando(ms) {
  if (!ms) return "nunca";
  return new Date(ms).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Departamentos vêm das áreas cadastradas no painel, para ninguém digitar um
 * nome que não existe. A lista carrega com o código já preenchido, sem
 * precisar salvar as configurações antes.
 */
function montarDepartamentos(areas, atual, vazioTexto) {
  const lista = Array.isArray(areas) ? areas.slice() : [];
  const escolhido = String(atual || "");
  // Um valor antigo, gravado antes da lista existir, continua aparecendo.
  if (escolhido && lista.indexOf(escolhido) < 0) lista.unshift(escolhido);

  el.departamento.replaceChildren();
  const vazia = document.createElement("option");
  vazia.value = "";
  vazia.disabled = true;
  vazia.textContent = lista.length
    ? "Selecione o departamento"
    : vazioTexto || "Carregando departamentos…";
  el.departamento.appendChild(vazia);

  lista.forEach(function (nome) {
    const opcao = document.createElement("option");
    opcao.value = nome;
    opcao.textContent = nome;
    el.departamento.appendChild(opcao);
  });

  el.departamento.value = escolhido;
}

let timerAreas = null;

/**
 * Busca as áreas no servidor usando o endereço definido pela configuração e o
 * código que está na tela, sem gravar nada. Assim o seletor já abre preenchido.
 */
async function carregarAreas(mostrarErro) {
  const dadosCodigo = codigoDaTela();
  const servidor = servidorAtual.trim();
  const codigo = dadosCodigo.apiToken;
  const atual = el.departamento.value;

  if (!/^https:\/\//i.test(servidor) || !codigo) {
    montarDepartamentos([], atual, "Cole o código de conexão");
    return;
  }

  const resposta = await enviar({
    tipo: "OBTER_AREAS",
    serverUrl: servidor,
    apiToken: codigo,
  });

  if (resposta.ok) {
    montarDepartamentos(resposta.areas || [], atual);
    if (mostrarErro) {
      avisar(
        el.resultadoConexao,
        resposta.areas && resposta.areas.length
          ? plural(resposta.areas.length, "departamento carregado", "departamentos carregados") + "."
          : "O servidor respondeu sem departamentos cadastrados.",
        resposta.areas && resposta.areas.length ? "ok" : "erro",
      );
    }
    return;
  }

  // Falha ao consultar (código incompleto, por exemplo): mantém a lista que já
  // estava na tela em vez de esvaziar o seletor.
  if (el.departamento.options.length <= 1) {
    montarDepartamentos([], atual, "Não foi possível carregar");
  }
  if (mostrarErro) {
    avisar(el.resultadoConexao, "Falha ao carregar departamentos: " + (resposta.erro || "servidor indisponível"), "erro");
  }
}

function agendarAreas() {
  clearTimeout(timerAreas);
  timerAreas = setTimeout(function () {
    void carregarAreas(false);
  }, 500);
}

function desenharSites(sites, pendentes, ativos) {
  sitesTotais = Array.isArray(sites) ? sites.slice() : [];
  sitesPendentes = Array.isArray(pendentes) ? pendentes.slice() : [];
  const autorizados = new Set(Array.isArray(ativos) ? ativos : []);
  sitesConhecidos = sitesTotais.filter(function (site) {
    return site && autorizados.has(site.id);
  });
  el.sitesStatus.replaceChildren();
  el.sitesStatus.setAttribute("aria-busy", "false");

  if (!sitesConhecidos.length) {
    const vazio = document.createElement("li");
    vazio.className = "micro";
    vazio.textContent = "Nenhuma IA autorizada foi encontrada na configuração atual.";
    el.sitesStatus.appendChild(vazio);
  } else {
    sitesConhecidos.forEach(function (site) {
      const item = document.createElement("li");
      const nome = document.createElement("strong");
      nome.textContent = site.nome || site.id;
      const host = document.createElement("span");
      host.textContent = (site.hosts || []).join(" · ");
      item.appendChild(nome);
      item.appendChild(host);
      el.sitesStatus.appendChild(item);
    });
  }

  if (sitesPendentes.length) {
    el.permissaoSites.textContent =
      "Domínios ainda sem permissão no navegador: " + sitesPendentes.join(", ") + ".";
    el.permissaoSites.className = "dica erro";
  } else {
    el.permissaoSites.textContent = "";
    el.permissaoSites.className = "dica";
  }
}

async function autorizarPendentes() {
  if (!sitesPendentes.length) return true;
  const origens = [];
  sitesPendentes.forEach(function (host) {
    origens.push("https://" + host + "/*");
    origens.push("https://*." + host + "/*");
  });
  try {
    const concedido = await chrome.permissions.request({ origins: origens });
    if (!concedido) {
      avisar(el.resultadoConexao, "O navegador não autorizou os domínios adicionais.", "erro");
      return false;
    }
    return true;
  } catch (erro) {
    avisar(
      el.resultadoConexao,
      erro instanceof Error ? erro.message : "Falha ao pedir permissão.",
      "erro",
    );
    return false;
  }
}

function estadoDaSincronizacao(estado) {
  if (!estado.cache) return { texto: "Nunca sincronizado", chave: "neutro" };
  if (estado.status && estado.status.mensagem && !estado.status.conectado) {
    return { texto: "Falha na sincronização", chave: "erro" };
  }
  const idade = Date.now() - Number(estado.cache.atualizadoEm || 0);
  if (idade > 24 * 60 * 60 * 1000) {
    return { texto: "Dados desatualizados", chave: "atencao" };
  }
  return { texto: "Atualizado", chave: "ok" };
}

function atualizarResumo(estado) {
  el.sincronizacao.textContent =
    estado.cache && estado.cache.atualizadoEm
      ? new Date(estado.cache.atualizadoEm).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "nunca";
  if (el.sincronizacao) {
    el.sincronizacao.title = estado.cache && estado.cache.atualizadoEm
      ? new Date(estado.cache.atualizadoEm).toLocaleString("pt-BR")
      : "Nenhuma sincronização concluída.";
  }
  const sincronizacao = estadoDaSincronizacao(estado);
  if (el.estadoSincronizacao) {
    el.estadoSincronizacao.textContent = sincronizacao.texto;
    el.estadoSincronizacao.className = "estado-sincronizacao " + sincronizacao.chave;
  }
  if (el.versao) {
    el.versao.textContent = estado.versao || chrome.runtime.getManifest().version;
  }
  const politica = estado.configuracao || {};
  const totalSites = sitesTotais.length;
  const ativos = Array.isArray(politica.sitesAtivos) ? politica.sitesAtivos.length : 0;
  el.politica.textContent = politica.monitoramentoAtivo === false
    ? "Monitoramento desativado"
    : ativos + " de " + totalSites + " IAs autorizadas";

  const status = estado.status;
  const conectado = Boolean(status && status.conectado);
  if (el.statusPonto) {
    el.statusPonto.className = "status-olhos " + (conectado ? "on" : "off");
    el.statusPonto.alt = conectado ? "Conectado" : "Desconectado";
    el.statusPonto.setAttribute("aria-label", conectado ? "Conectado" : "Desconectado");
  }
  if (el.statusPontoTexto) {
    el.statusPontoTexto.textContent = conectado ? "Conectado" : "Desconectado";
  }
  if (status && status.mensagem) {
    el.sincronizacao.title = (el.sincronizacao.title || "") + " · " + status.mensagem;
  }
}

function configuracoesDaTela() {
  return {
    apiToken: el.token.value.trim(),
    departamento: el.departamento.value.trim(),
    colaborador: el.colaborador.value.trim(),
  };
}

function atualizarPendente() {
  if (!el.alteracoesPendentes) return;
  if (!configuracaoSalva) {
    el.alteracoesPendentes.hidden = true;
    return;
  }
  const atual = configuracoesDaTela();
  el.alteracoesPendentes.hidden =
    atual.apiToken === configuracaoSalva.apiToken &&
    atual.departamento === configuracaoSalva.departamento &&
    atual.colaborador === configuracaoSalva.colaborador;
}

function limparErrosCampos() {
  document.querySelectorAll(".erro-campo").forEach(function (erro) { erro.remove(); });
  [el.token, el.departamento, el.colaborador].forEach(function (campo) {
    if (!campo) return;
    campo.removeAttribute("aria-invalid");
  });
}

function marcarErroCampo(campo, mensagem) {
  if (!campo) return;
  limparErroCampo(campo);
  campo.setAttribute("aria-invalid", "true");
  const erro = document.createElement("p");
  erro.className = "erro-campo";
  erro.setAttribute("role", "alert");
  erro.textContent = mensagem;
  const rotulo = campo.closest("label") || campo.parentElement;
  rotulo.appendChild(erro);
}

function limparErroCampo(campo) {
  campo.removeAttribute("aria-invalid");
  const rotulo = campo.closest("label") || campo.parentElement;
  const erro = rotulo && rotulo.querySelector(".erro-campo");
  if (erro) erro.remove();
}

function atualizarTokenVisivel() {
  if (!el.token || !el.alternarToken) return;
  el.token.type = tokenVisivel ? "text" : "password";
  el.alternarToken.textContent = tokenVisivel ? "Ocultar" : "Mostrar";
  el.alternarToken.setAttribute("aria-pressed", String(tokenVisivel));
}

async function copiarCodigo() {
  const valor = el.token.value.trim();
  if (!valor) return;
  try {
    await navigator.clipboard.writeText(valor);
    avisar(el.resultadoConexao, "Código copiado.", "ok");
  } catch (erro) {
    el.token.focus();
    el.token.select();
    avisar(el.resultadoConexao, "Selecione e copie o código manualmente.", "erro");
  }
}

async function carregar() {
  // Atualiza a versão da política antes de desenhar a lista. Assim uma IA
  // desativada no painel some sem exigir "Testar conexão".
  await enviar({ tipo: "OBTER_CONFIG" });
  const estado = await enviar({ tipo: "OBTER_ESTADO" });
  if (!estado.ok) {
    avisar(el.resultadoConexao, estado.erro || "Falha ao carregar o estado.", "erro");
    return;
  }

  const configuracao = Object.assign({}, PADROES, estado.configuracao || {});
  servidorAtual = String(configuracao.serverUrl || PADROES.serverUrl || "")
    .trim()
    .replace(/\/+$/, "");
  el.token.value = configuracao.apiToken || "";
  el.colaborador.value = configuracao.colaborador || "";

  const areas = estado.cache ? estado.cache.areas : [];
  montarDepartamentos(areas, configuracao.departamento);
  configuracaoSalva = configuracoesDaTela();
  atualizarPendente();
  // Sem cache (primeira abertura), as áreas vêm do servidor na hora.
  if (!areas || !areas.length) void carregarAreas(false);
  desenharSites(estado.sites, estado.sitesPendentes, configuracao.sitesAtivos);
  atualizarResumo(estado);
}

async function salvar(silencioso, completo) {
  if (!silencioso && el.salvar && el.salvar.disabled) return false;
  if (!silencioso && el.salvar) {
    el.salvar.disabled = true;
    el.salvar.textContent = "Salvando…";
    if (el.estadoSincronizacao) {
      el.estadoSincronizacao.textContent = "Atualizando";
      el.estadoSincronizacao.className = "estado-sincronizacao atencao";
    }
  }
  try {
    return await executarSalvamento(silencioso, completo);
  } finally {
    if (!silencioso && el.salvar) {
      el.salvar.disabled = false;
      el.salvar.textContent = "Salvar conexão e identificação";
    }
    atualizarPendente();
  }
}

async function executarSalvamento(silencioso, completo) {
  if (!silencioso) limparErrosCampos();
  const exigirIdentificacao = completo !== false;
  const departamento = el.departamento.value.trim();
  const dadosCodigo = codigoDaTela();

  let endereco = null;
  try {
    endereco = new URL(servidorAtual);
  } catch (erro) {
    endereco = null;
  }
  if (!endereco || endereco.protocol !== "https:") {
    const mensagem =
      "O código de conexão deve incluir o endereço do servidor. Copie o código completo em Monitoramento → Código de conexão.";
    if (!silencioso) marcarErroCampo(el.token, mensagem);
    avisar(el.resultadoSalvar, mensagem, "erro");
    return false;
  }
  const servidor = endereco.origin;

  const codigo = dadosCodigo.apiToken;
  if (!codigo) {
    const mensagem = "Cole o código de conexão que aparece no painel, em Monitoramento.";
    if (!silencioso) marcarErroCampo(el.token, mensagem);
    avisar(el.resultadoSalvar, mensagem, "erro");
    return false;
  }

  if (exigirIdentificacao && !departamento) {
    const mensagem = "Escolha o departamento. Ele é obrigatório para identificar a origem do alerta.";
    if (!silencioso) marcarErroCampo(el.departamento, mensagem);
    avisar(el.resultadoSalvar, mensagem, "erro");
    return false;
  }

  const colaborador = el.colaborador.value.trim();
  if (exigirIdentificacao && !colaborador) {
    const mensagem =
      "Informe o identificador do colaborador. Ele é obrigatório: os alertas não são anônimos.";
    if (!silencioso) marcarErroCampo(el.colaborador, mensagem);
    avisar(el.resultadoSalvar, mensagem, "erro");
    return false;
  }

  const permissao = await garantirPermissao(servidor);
  avisoPermissao = permissao.ok ? "" : permissao.mensagem || "";
  if (permissao.ok && !silencioso) {
    const dominiosOk = await autorizarPendentes();
    if (!dominiosOk) {
      avisoPermissao = "Configurações salvas, mas o navegador não autorizou todos os domínios.";
    }
  }

  // Testar/sincronizar não devem apagar uma identificação já salva: quando o
  // campo está vazio, o valor anterior é mantido.
  const guardado = await chrome.storage.local.get("configuracao");
  const anterior = guardado.configuracao || {};

  const configuracao = {
    serverUrl: servidor.replace(/\/+$/, ""),
    apiToken: codigo,
    departamento: departamento || anterior.departamento || "",
    colaborador: colaborador || anterior.colaborador || "",
  };

  await chrome.storage.local.set({ configuracao: configuracao });
  configuracaoSalva = configuracoesDaTela();
  atualizarPendente();

  if (!silencioso) {
    // Sincroniza na hora: confirma o código e já carrega a lista de departamentos.
    const sincronizado = await enviar({ tipo: "SINCRONIZAR_AGORA" });
    if (avisoPermissao) {
      avisar(el.resultadoSalvar, "Configurações salvas. " + avisoPermissao, "erro");
    } else if (!sincronizado.ok) {
      const mensagem =
        "Configurações salvas, mas o servidor recusou o código. Copie o valor de Código de conexão e salve de novo.";
      marcarErroCampo(el.token, mensagem);
      avisar(el.resultadoSalvar, mensagem, "erro");
    } else {
      avisar(el.resultadoSalvar, "Configurações salvas e código aceito.", "ok");
      setTimeout(function () {
        el.resultadoSalvar.textContent = "";
      }, 3000);
    }
    await carregar();
  }
  return true;
}

async function testar() {
  // Testar a conexão só precisa do endereço e do código; departamento e
  // colaborador podem ser preenchidos depois, antes de salvar de fato.
  const salvo = await salvar(true, false);
  if (!salvo) {
    avisar(el.resultadoConexao, el.resultadoSalvar.textContent, "erro");
    el.resultadoSalvar.textContent = "";
    return;
  }
  if (avisoPermissao) {
    avisar(el.resultadoConexao, avisoPermissao, "erro");
    return;
  }
  el.testar.disabled = true;
  el.testar.textContent = "Testando…";
  const resposta = await enviar({ tipo: "TESTAR_CONEXAO" });
  el.testar.disabled = false;
  el.testar.textContent = "Testar conexão";

  if (resposta.ok) {
    const segundos = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
      (resposta.latenciaMs || 0) / 1000,
    );
    el.resultadoConexao.replaceChildren();
    el.resultadoConexao.className = "resultado resultado-conexao ok";
    [
      ["Situação da conexão", "Conectado"],
      ["Tempo de resposta", segundos + " s"],
      ["Regras carregadas", String(resposta.totalRegras ?? "—")],
    ].forEach(function (par) {
      const linha = document.createElement("div");
      const rotulo = document.createElement("span");
      rotulo.textContent = par[0];
      const valor = document.createElement("strong");
      valor.textContent = par[1];
      linha.appendChild(rotulo);
      linha.appendChild(valor);
      el.resultadoConexao.appendChild(linha);
    });
  } else {
    avisar(
      el.resultadoConexao,
      "Falha: " + (resposta.mensagem || resposta.erro || "servidor indisponível"),
      "erro",
    );
  }
  atualizarResumo(await enviar({ tipo: "OBTER_ESTADO" }));
}

document.addEventListener("DOMContentLoaded", function () {
  el.token = document.getElementById("token");
  el.departamento = document.getElementById("departamento");
  el.colaborador = document.getElementById("colaborador");
  el.sincronizacao = document.getElementById("sincronizacao");
  el.estadoSincronizacao = document.getElementById("estado-sincronizacao");
  el.politica = document.getElementById("politica-monitoramento");
  el.sitesStatus = document.getElementById("sites-status");
  el.permissaoSites = document.getElementById("permissao-sites");
  el.statusPonto = document.getElementById("status-ponto");
  el.statusPontoTexto = document.getElementById("status-ponto-texto");
  el.resultadoConexao = document.getElementById("resultado-conexao");
  el.resultadoSalvar = document.getElementById("resultado-salvar");
  el.testar = document.getElementById("testar");
  el.salvar = document.getElementById("salvar");
  el.versao = document.getElementById("versao-extensao");
  el.tema = document.getElementById("tema-escuro");
  el.alternarToken = document.getElementById("alternar-token");
  el.copiarToken = document.getElementById("copiar-token");
  el.alteracoesPendentes = document.getElementById("alteracoes-pendentes");

  // O espelho local pode estar à frente do armazenamento por alguns
  // milissegundos logo após a troca de tema. O maior horário vence, para o
  // interruptor nunca abrir no estado oposto ao do popup.
  let temaLocal = null;
  let temaLocalEm = 0;
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA);
    if (salvo === "escuro" || salvo === "claro") temaLocal = salvo;
    temaLocalEm = Number(localStorage.getItem(CHAVE_TEMA_EM)) || 0;
  } catch (erro) {
    /* sem espelho local */
  }
  if (temaLocal) el.tema.checked = temaLocal === "escuro";

  chrome.storage.local.get([CHAVE_TEMA, CHAVE_TEMA_EM], function (dados) {
    const salvoEm = Number(dados[CHAVE_TEMA_EM]) || 0;
    if (!temaLocal || salvoEm > temaLocalEm) {
      el.tema.checked = dados[CHAVE_TEMA] === "escuro";
    }
  });

  el.tema.addEventListener("change", function () {
    const tema = el.tema.checked ? "escuro" : "claro";
    const agora = Date.now();
    temaLocalEm = agora;
    document.documentElement.dataset.tema = tema;
    // O espelho local é síncrono e deixa o popup já no tema certo mesmo se ele
    // for aberto imediatamente depois do clique; o armazenamento compartilha
    // o valor com as demais páginas da extensão.
    try {
      localStorage.setItem(CHAVE_TEMA, tema);
      localStorage.setItem(CHAVE_TEMA_EM, String(agora));
    } catch (erro) {
      /* o tema continua valendo nesta sessão */
    }
    chrome.storage.local.set({ [CHAVE_TEMA]: tema, [CHAVE_TEMA_EM]: agora });
  });

  el.testar.addEventListener("click", testar);
  el.salvar.addEventListener("click", function () {
    void salvar(false);
  });
  el.alternarToken.addEventListener("click", function () {
    tokenVisivel = !tokenVisivel;
    atualizarTokenVisivel();
  });
  el.copiarToken.addEventListener("click", function () { void copiarCodigo(); });
  [el.token, el.colaborador, el.departamento].forEach(function (campo) {
    campo.addEventListener("input", function () {
      limparErroCampo(campo);
      atualizarPendente();
    });
    campo.addEventListener("change", function () {
      limparErroCampo(campo);
      atualizarPendente();
    });
  });

  // A lista de departamentos acompanha o código digitado, sem salvar antes.
  el.token.addEventListener("input", agendarAreas);

  // O service worker atualiza o cache periodicamente; a tela acompanha a
  // mudança para refletir na hora uma IA adicionada ou desativada no painel.
  chrome.storage.onChanged.addListener(function (mudancas, area) {
    if (area !== "local") return;
    if (mudancas[CHAVE_TEMA] || mudancas[CHAVE_TEMA_EM]) {
      const novoEm = Number(
        mudancas[CHAVE_TEMA_EM] && mudancas[CHAVE_TEMA_EM].newValue,
      ) || 0;
      // Só aceita o valor compartilhado se ele não for mais antigo que o
      // espelho local; assim uma notificação fora de ordem não faz o
      // interruptor piscar no estado oposto ao do popup.
      if (!novoEm || novoEm >= temaLocalEm) {
        if (novoEm) temaLocalEm = novoEm;
        if (mudancas[CHAVE_TEMA]) {
          el.tema.checked = mudancas[CHAVE_TEMA].newValue === "escuro";
        }
      }
      return;
    }
    if (!mudancas.cacheConfig) return;
    void carregar();
  });

  void carregar();
});
