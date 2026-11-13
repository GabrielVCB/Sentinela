/**
 * Sentinela — service worker (Manifest V3).
 *
 * Centraliza TODAS as chamadas de rede, evitando CORS/mixed content nas
 * páginas das IAs. Funciona igual no Chrome e no Microsoft Edge.
 *
 * Cada pedido leva X-API-Token com o código de verificação copiado do painel
 * (Monitoramento > Verificação da extensão). Sem o código, o servidor recusa o envio. O popup
 * mostra o aviso em vez de falhar em silêncio. Alertas que falham por rede
 * entram em uma fila persistente e são reenviados por alarme; o cache de regras
 * mantém o aviso funcionando enquanto o servidor estiver fora do ar.
 */
"use strict";

// O arquivo baixado pelo painel injeta aqui a URL pública do servidor. Assim a
// extensão já chega configurada e o colaborador só informa a identificação.
try {
  importScripts("config.js");
} catch (erro) {
  /* configuração antiga sem config.js: a URL pode ser informada nas Opções */
}

// A extensão consulta só a versão da configuração a cada 30 segundos. A matriz
// completa (regras, mensagens, áreas e chats) só é baixada quando essa versão
// muda. Isso mantém a atualização transparente sem multiplicar o tráfego.
const INTERVALO_SYNC = 30 * 1000;
const VERSAO_EXTENSAO = chrome.runtime.getManifest().version;
const LIMITE_TEXTO_ANEXO = 60000;
// O Render Free pode acordar devagar; 20 s evita "Failed to fetch" em cold start.
const TIMEOUT_MS = 20000;
const TENTATIVAS = 2;
const LIMITE_FILA = 100;
const ALARME_SYNC = "sentinela-sync";
const ALARME_FILA = "sentinela-fila";

// Sem endereço local: a extensão só fala com o servidor publicado na nuvem.
// O arquivo baixado pelo painel traz a URL real; no ZIP público ela fica vazia
// e pode ser informada em Opções.
const SERVIDOR_PADRAO = String(globalThis.SENTINELA_SERVIDOR_PADRAO || "").trim();

const CONFIGURACAO_PADRAO = {
  serverUrl: SERVIDOR_PADRAO,
  apiToken: "",
  departamento: "",
  colaborador: "",
};

const CHAVES = {
  configuracao: "configuracao",
  cache: "cacheConfig",
  status: "statusConexao",
  fila: "filaAlertasPendentes",
  filaAntiga: "filaAlertas",
  ultimoAlerta: "ultimoAlerta",
  dispositivo: "dispositivoId",
  registroDispositivo: "ultimoRegistroDispositivo",
  sitesPendentes: "sitesPendentesPermissao",
};

// ---------------------------------------------------------------------------
// Utilidades de armazenamento
// ---------------------------------------------------------------------------

async function lerArmazenado(chave, valorPadrao) {
  const resultado = await chrome.storage.local.get(chave);
  return resultado[chave] === undefined ? valorPadrao : resultado[chave];
}

async function salvarArmazenado(chave, valor) {
  await chrome.storage.local.set({ [chave]: valor });
}

let promessaDispositivo = null;

/**
 * Identificador aleatório desta instalação. Não é o nome da pessoa e não
 * identifica o colaborador: serve para o painel listar e desconectar um
 * navegador específico sem renovar o código de todos os outros.
 */
async function obterDispositivoId() {
  if (promessaDispositivo) return promessaDispositivo;
  promessaDispositivo = (async function () {
    const salvo = String(await lerArmazenado(CHAVES.dispositivo, "")).trim();
    if (/^[A-Za-z0-9_-]{8,80}$/.test(salvo)) return salvo;
    let id = "";
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        id = "dev-" + crypto.randomUUID();
      }
    } catch (erro) {
      /* ambientes sem randomUUID */
    }
    if (!id) {
      id = "dev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
    }
    await salvarArmazenado(CHAVES.dispositivo, id);
    return id;
  })().finally(function () {
    promessaDispositivo = null;
  });
  return promessaDispositivo;
}

function criarEventoId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch (erro) {
    /* ambientes sem randomUUID */
  }
  return "evt-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

async function lerFila() {
  const valor = await lerArmazenado(CHAVES.fila, []);
  return Array.isArray(valor) ? valor : [];
}

async function salvarFila(fila) {
  await salvarArmazenado(CHAVES.fila, fila.slice(-LIMITE_FILA));
}

async function enfileirarAlerta(alerta) {
  const fila = await lerFila();
  const id = alerta.evento_id;
  if (id && fila.some(function (item) { return item.evento_id === id; })) return;
  fila.push({
    ...alerta,
    evento_id: id || criarEventoId(),
    tentativas: Number(alerta.tentativas || 0),
    criadoEm: Date.now(),
  });
  await salvarFila(fila);
  await garantirAlarmeFila();
}

async function garantirAlarmeSync() {
  // O mínimo aceito pelo Chrome atual é 30 segundos. O alarme é só uma rede de
  // segurança: as páginas abertas também consultam a versão ao ganhar foco.
  await chrome.alarms.create(ALARME_SYNC, { periodInMinutes: 0.5 });
}

async function garantirAlarmeFila() {
  await chrome.alarms.create(ALARME_FILA, { delayInMinutes: 1, periodInMinutes: 1 });
}

// Hosts que já entram pelo content_scripts do manifest. Os demais chats
// configurados no painel são injetados por chrome.scripting quando o
// navegador autoriza o domínio.
const HOSTS_ESTATICOS = [
  "chatgpt.com",
  "chat.openai.com",
  "gemini.google.com",
  "claude.ai",
  "copilot.microsoft.com",
  "copilot.cloud.microsoft",
  "copilot.com",
];
const ID_SCRIPT_DINAMICO = "sentinela-sites-dinamicos";

function hostsDinamicos(sites) {
  const hosts = [];
  (Array.isArray(sites) ? sites : []).forEach(function (site) {
    (Array.isArray(site && site.hosts) ? site.hosts : []).forEach(function (host) {
      const limpo = String(host || "")
        .trim()
        .toLowerCase()
        .replace(/^www\./, "");
      if (
        limpo &&
        HOSTS_ESTATICOS.indexOf(limpo) < 0 &&
        hosts.indexOf(limpo) < 0
      ) {
        hosts.push(limpo);
      }
    });
  });
  return hosts;
}

function origensDosHosts(hosts) {
  const origens = [];
  hosts.forEach(function (host) {
    origens.push("https://" + host + "/*");
    origens.push("https://*." + host + "/*");
  });
  return origens;
}

/**
 * Injeta o detector nos chats adicionados pelo painel. O navegador não deixa
 * uma extensão acessar um domínio novo sem autorização; por isso as Opções
 * mostram um botão para liberar os hosts configurados. A permissão é lembrada
 * pelo Chrome e os scripts são registrados de novo a cada sincronização.
 */
async function registrarSitesDinamicos(sites) {
  if (!chrome.scripting || !chrome.permissions) return;
  const hosts = hostsDinamicos(sites);
  const origens = origensDosHosts(hosts);

  try {
    await chrome.scripting.unregisterContentScripts({ ids: [ID_SCRIPT_DINAMICO] });
  } catch (erro) {
    /* ainda não havia script registrado */
  }

  if (!origens.length) {
    await salvarArmazenado(CHAVES.sitesPendentes, []);
    return;
  }

  let autorizados = [];
  try {
    autorizados = await chrome.permissions.contains({ origins: origens });
  } catch (erro) {
    autorizados = false;
  }
  if (!autorizados) {
    await salvarArmazenado(CHAVES.sitesPendentes, hosts);
    return;
  }

  try {
    await chrome.scripting.registerContentScripts([
      {
        id: ID_SCRIPT_DINAMICO,
        matches: origens,
        js: ["detectores.js", "content.js"],
        runAt: "document_idle",
        persistAcrossSessions: true,
      },
    ]);
    await salvarArmazenado(CHAVES.sitesPendentes, []);
  } catch (erro) {
    await salvarArmazenado(
      CHAVES.sitesPendentes,
      hosts,
    );
  }
}

let promessaFila = null;

/** Reenvia a fila em série; o evento_id mantém a operação idempotente. */
async function processarFila() {
  if (promessaFila) return promessaFila;
  promessaFila = (async function () {
    const fila = await lerFila();
    if (!fila.length) {
      await chrome.alarms.clear(ALARME_FILA);
      return;
    }
    const configuracao = await obterConfiguracao();
    if (!(configuracao.apiToken || "").trim()) return;
    const cache = await lerArmazenado(CHAVES.cache, null);
    if (cache && cache.monitoramentoAtivo === false) return;

    const restantes = [];
    for (const alerta of fila) {
      try {
        await requisitar("/api/alertas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(alerta),
        });
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : "Falha ao reenviar.";
        // Código/token inválido não melhora com retry: descarta e avisa no popup.
        if (erroDefinitivo(mensagem)) {
          await registrarStatus(false, `Alerta descartado: ${mensagem}`);
          continue;
        }
        restantes.push({ ...alerta, tentativas: Number(alerta.tentativas || 0) + 1 });
      }
    }
    await salvarFila(restantes);
    if (restantes.length) await garantirAlarmeFila();
    else await chrome.alarms.clear(ALARME_FILA);
  })().finally(function () {
    promessaFila = null;
  });
  return promessaFila;
}

async function obterConfiguracao() {
  const salva = await lerArmazenado(CHAVES.configuracao, {});
  // A política de monitoramento não mora mais na configuração local. Campos
  // antigos são descartados para não voltarem a valer depois de uma migração.
  const { monitoramentoAtivo, sitesAtivos, ...resto } = salva || {};
  const configuracao = { ...CONFIGURACAO_PADRAO, ...resto };
  if (!String(configuracao.serverUrl || "").trim()) {
    configuracao.serverUrl = SERVIDOR_PADRAO;
  }
  return configuracao;
}

function normalizarUrl(url) {
  const texto = String(url || CONFIGURACAO_PADRAO.serverUrl).trim();
  if (!texto) return "";
  try {
    const endereco = new URL(texto);
    // A extensão só fala com o servidor publicado em https.
    if (endereco.protocol !== "https:") return "";
    // Mesmo que a pessoa cole a URL do painel com /painel no fim, usa só a origem.
    return endereco.origin;
  } catch (erro) {
    return "";
  }
}

async function registrarStatus(conectado, mensagem) {
  await salvarArmazenado(CHAVES.status, {
    conectado: Boolean(conectado),
    mensagem: mensagem || "",
    verificadoEm: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Rede
// ---------------------------------------------------------------------------

async function requisitar(caminho, opcoes, configuracaoExplicita) {
  const configuracao = configuracaoExplicita || (await obterConfiguracao());
  const base = normalizarUrl(configuracao.serverUrl);
  if (!base) {
    throw new Error("Configure a URL do servidor nas Opções. Copie o endereço do painel em Monitoramento.");
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const cabecalhos = { ...(opcoes && opcoes.headers ? opcoes.headers : {}) };
    // Código de verificação copiado do painel, guardado nas Opções.
    const codigo = (configuracao.apiToken || "").trim();
    if (codigo) cabecalhos["X-API-Token"] = codigo;
    // O painel usa este identificador para listar e desconectar um dispositivo
    // sem afetar os demais.
    cabecalhos["X-Device-ID"] = await obterDispositivoId();

    const resposta = await fetch(`${base}${caminho}`, {
      ...opcoes,
      cache: "no-store",
      headers: cabecalhos,
      signal: controlador.signal,
    });

    if (!resposta.ok) {
      let detalhe = `HTTP ${resposta.status}`;
      try {
        const corpo = await resposta.json();
        if (corpo && corpo.erro) detalhe = corpo.erro;
      } catch (erro) {
        /* resposta sem JSON */
      }
      if (resposta.status === 401) {
        detalhe = "Código de verificação inválido ou ausente nas Opções.";
      }
      throw new Error(detalhe);
    }
    return await resposta.json();
  } catch (erro) {
    if (erro && erro.name === "AbortError") {
      throw new Error(
        "Tempo esgotado ao conectar em " + base + ". O servidor pode estar acordando; tente novamente.",
      );
    }
    if (erro instanceof TypeError) {
      throw new Error(
        "Não foi possível conectar a " + base + ". Confira a URL, a permissão de acesso do navegador e se o servidor está online.",
      );
    }
    throw erro;
  } finally {
    clearTimeout(temporizador);
  }
}

// ---------------------------------------------------------------------------
// Extração local de texto de imagens e PDFs (página offscreen)
// ---------------------------------------------------------------------------

let promessaOffscreen = null;

async function garantirOffscreen() {
  if (chrome.offscreen && typeof chrome.offscreen.hasDocument === "function") {
    if (await chrome.offscreen.hasDocument()) return;
  }
  if (promessaOffscreen) return promessaOffscreen;

  promessaOffscreen = chrome.offscreen
    .createDocument({
      url: "offscreen.html",
      reasons: ["WORKERS", "BLOBS"],
      justification:
        "Extração local de texto de imagens e PDFs colados nas IAs, sem enviar conteúdo a servidores.",
    })
    .catch(async function (erro) {
      // Se a página já existe, o erro é inofensivo.
      try {
        if (await chrome.offscreen.hasDocument()) return;
      } catch (ignorado) {
        /* segue para o erro original */
      }
      throw erro;
    })
    .finally(function () {
      promessaOffscreen = null;
    });

  return promessaOffscreen;
}

function enviarParaOffscreen(mensagem) {
  return new Promise(function (resolver) {
    chrome.runtime.sendMessage(mensagem, function (resposta) {
      if (chrome.runtime.lastError) {
        resolver({ ok: false, erro: chrome.runtime.lastError.message });
        return;
      }
      resolver(resposta || { ok: false, erro: "Sem resposta da página de extração." });
    });
  });
}

async function extrairAnexo(anexo) {
  if (!anexo || !anexo.dados) {
    return { ok: false, erro: "Anexo vazio." };
  }
  if (anexo.tipo !== "imagem" && anexo.tipo !== "pdf") {
    return { ok: false, erro: "Tipo de anexo não suportado." };
  }

  try {
    await garantirOffscreen();
  } catch (erro) {
    return {
      ok: false,
      erro: "Não foi possível iniciar a extração local: " +
        (erro instanceof Error ? erro.message : "erro desconhecido"),
    };
  }

  const resposta = await enviarParaOffscreen({
    tipo: "OFFSCREEN_EXTRAIR",
    anexo: {
      nome: String(anexo.nome || "").slice(0, 120),
      tipo: anexo.tipo,
      mime: String(anexo.mime || ""),
      dados: anexo.dados,
    },
  });

  if (!resposta || resposta.ok === false) {
    return { ok: false, erro: (resposta && resposta.erro) || "Falha na extração local." };
  }

  return { ok: true, texto: String(resposta.texto || "").slice(0, LIMITE_TEXTO_ANEXO) };
}

// ---------------------------------------------------------------------------
// Sincronização de configuração (cache para quando o servidor estiver off)
// ---------------------------------------------------------------------------

/** Nomes de área citados pelas regras, sem repetir. */
function areasDasRegras(regras) {
  const vistos = [];
  (Array.isArray(regras) ? regras : []).forEach(function (regra) {
    const nome = regra && regra.area ? String(regra.area).trim() : "";
    if (nome && vistos.indexOf(nome) < 0) vistos.push(nome);
  });
  return vistos;
}

/**
 * A lista de departamentos vem de `areas` em /api/config. Versões anteriores
 * do servidor não mandavam esse campo, então a lista também é montada a partir
 * da área de cada regra — o seletor funciona com qualquer versão publicada.
 */
function areasDaConfiguracao(config) {
  if (!config) return [];
  if (Array.isArray(config.areas) && config.areas.length) return config.areas.slice();
  return areasDasRegras(config.regras);
}

async function registrarDispositivo(configuracao) {
  const id = await obterDispositivoId();
  return requisitar(
    "/api/dispositivos/registrar",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: id,
        colaborador: String(configuracao.colaborador || "").trim(),
        setor: String(configuracao.departamento || "").trim(),
        versao: VERSAO_EXTENSAO,
      }),
    },
    configuracao,
  );
}

/**
 * Mantém o último contato do painel atualizado sem uma escrita por minuto.
 * O poll de versão continua sendo a operação leve; o cadastro do dispositivo
 * é renovado a cada dez minutos e logo depois de uma mudança de configuração.
 */
async function registrarPeriodicamente(configuracao) {
  const ultimo = Number(await lerArmazenado(CHAVES.registroDispositivo, 0)) || 0;
  if (ultimo && Date.now() - ultimo < 10 * 60 * 1000) return;
  try {
    await registrarDispositivo(configuracao);
    await salvarArmazenado(CHAVES.registroDispositivo, Date.now());
  } catch (erro) {
    const texto = erro instanceof Error ? erro.message : "Falha ao registrar dispositivo.";
    await registrarStatus(false, texto);
  }
}

/**
 * Atualiza o cache de regras. Com `verificarRemoto`, consulta primeiro só a
 * versão da configuração; se nada mudou, nem abre a matriz completa.
 */
async function sincronizarConfig(forcar, verificarRemoto) {
  const cache = await lerArmazenado(CHAVES.cache, null);

  if (!forcar && !verificarRemoto && cache && Date.now() - cache.atualizadoEm < INTERVALO_SYNC) {
    return cache;
  }

  try {
    const configuracao = await obterConfiguracao();
    if (!configuracao.serverUrl) {
      throw new Error("Configure a URL do servidor nas opções.");
    }
    if (!(configuracao.apiToken || "").trim()) {
      throw new Error(
        "Código de verificação não configurado. Abra Opções e cole o código do painel, em Monitoramento.",
      );
    }

    if (!forcar && verificarRemoto && cache) {
      const versao = await requisitar("/api/config/versao", { method: "GET" });
      if (
        versao &&
        String(versao.versao_config || "") === String(cache.versaoConfig || "")
      ) {
        await registrarPeriodicamente(configuracao);
        return cache;
      }
    }

    const resposta = await requisitar("/api/config", { method: "GET" });
    if (!resposta || !Array.isArray(resposta.regras) || !resposta.mensagens) {
      throw new Error("Resposta de configuração inválida.");
    }

    const novoCache = {
      regras: resposta.regras,
      mensagens: resposta.mensagens,
      areas: areasDaConfiguracao(resposta),
      // Política global definida no painel; a extensão não a edita localmente.
      monitoramentoAtivo: resposta.monitoramento_ativo !== false,
      sitesAtivos: Array.isArray(resposta.sites_ativos)
        ? resposta.sites_ativos.slice()
        : ["chatgpt", "gemini", "claude", "copilot"],
      sites: Array.isArray(resposta.sites) ? resposta.sites.slice() : [],
      versaoConfig: String(resposta.versao_config || ""),
      codigoVersao: Number(resposta.codigo_versao) || 1,
      atualizadoEm: Date.now(),
    };
    await salvarArmazenado(CHAVES.cache, novoCache);
    await registrarSitesDinamicos(novoCache.sites);
    await registrarStatus(true, "Configuração sincronizada.");

    // O registro é feito depois de a configuração ser aceita. Se o painel
    // desconectou este navegador, a chamada de /api/config já retorna 403.
    await registrarDispositivo(configuracao);
    await salvarArmazenado(CHAVES.registroDispositivo, Date.now());
    return novoCache;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha de conexão.";
    await registrarStatus(false, `Sem conexão: ${mensagem}`);
    // Um dispositivo desconectado não deve continuar aplicando a última cópia
    // da matriz. O painel é a fonte de verdade; a extensão só volta depois de
    // ser reinstalada e registrar um novo identificador.
    if (/desconectado/i.test(mensagem)) {
      const vazio = {
        regras: [],
        mensagens: {},
        areas: [],
        monitoramentoAtivo: false,
        sitesAtivos: [],
        sites: [],
        versaoConfig: "",
        codigoVersao: 0,
        atualizadoEm: Date.now(),
      };
      await salvarArmazenado(CHAVES.cache, vazio);
      return vazio;
    }
    return cache; // cache offline, quando existir
  }
}

// ---------------------------------------------------------------------------
// Alertas (envio direto ao servidor da empresa)
// ---------------------------------------------------------------------------

function sanearAlerta(alerta) {
  const niveis = ["baixo", "medio", "alto"];
  const tipos = Array.isArray(alerta.tipos_detectados) ? alerta.tipos_detectados : [];

  return {
    data_hora:
      typeof alerta.data_hora === "string" && alerta.data_hora
        ? alerta.data_hora
        : new Date().toISOString(),
    site: String(alerta.site || "").slice(0, 120),
    departamento: String(alerta.departamento || "Não informado").slice(0, 80),
    colaborador: alerta.colaborador ? String(alerta.colaborador).slice(0, 80) : null,
    nivel_risco: niveis.indexOf(alerta.nivel_risco) >= 0 ? alerta.nivel_risco : "baixo",
    tipos_detectados: tipos.slice(0, 20).map(function (item) {
      if (typeof item === "string") return { tipo_detectado: item.slice(0, 80), risco: "alto" };
      return {
        tipo_detectado: String(item.tipo_detectado || item.tipo || "").slice(0, 80),
        risco: niveis.indexOf(item.risco) >= 0 ? item.risco : "alto",
        area: item.area ? String(item.area).slice(0, 60) : null,
      };
    }),
    acao: alerta.acao === "cancelou" ? "cancelou" : "enviou",
    evento_id: alerta.evento_id
      ? String(alerta.evento_id).slice(0, 64)
      : criarEventoId(),
    origem: ["texto", "colagem", "imagem", "pdf", "anexo"].indexOf(alerta.origem) >= 0
      ? alerta.origem
      : "texto",
  };
}

function erroDefinitivo(mensagem) {
  return /Código de verificação|Departamento não|Colaborador não|desconectado|HTTP 400|HTTP 401|HTTP 403/.test(
    String(mensagem || ""),
  );
}

async function enviarAlerta(alerta) {
  const limpo = sanearAlerta(alerta);

  // Sem o código, o servidor recusaria o envio. O aviso aparece no popup na
  // hora, em vez de o alerta sumir sem explicação.
  const configuracao = await obterConfiguracao();
  const cache = await lerArmazenado(CHAVES.cache, null);

  async function recusar(mensagem) {
    await registrarStatus(false, mensagem);
    await salvarArmazenado(CHAVES.ultimoAlerta, {
      ok: false,
      mensagem: mensagem,
      em: Date.now(),
    });
    return { ok: false, mensagem: mensagem };
  }

  if (cache && cache.monitoramentoAtivo === false) {
    return recusar("Monitoramento pausado pelo painel. Nenhum alerta será registrado.");
  }
  if (!(configuracao.apiToken || "").trim()) {
    return recusar(
      "Código de verificação não configurado. Abra Opções e cole o código do painel, em Monitoramento.",
    );
  }

  // Sem departamento e sem colaborador não há auditoria: o alerta não é
  // anônimo. A extensão só registra com os dois campos preenchidos.
  if (!(configuracao.departamento || "").trim()) {
    return recusar("Departamento não configurado. Abra Opções e escolha o departamento.");
  }
  if (!(configuracao.colaborador || "").trim()) {
    return recusar(
      "Colaborador não configurado. Abra Opções e informe o identificador do colaborador.",
    );
  }

  limpo.departamento = String(configuracao.departamento).trim().slice(0, 80);
  limpo.colaborador = String(configuracao.colaborador).trim().slice(0, 80);

  let ultimaFalha = "Falha ao registrar.";

  // Uma repetição imediata cobre o intervalo em que o Flask está iniciando;
  // se ainda falhar, a fila persistente tenta de novo via alarme.
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const resultado = await requisitar("/api/alertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(limpo),
      });
      await registrarStatus(true, "Alerta registrado.");
      await salvarArmazenado(CHAVES.ultimoAlerta, {
        ok: true,
        mensagem: resultado && resultado.duplicado ? "Alerta já registrado." : "Alerta registrado.",
        em: Date.now(),
      });
      return {
        ok: true,
        id: resultado && resultado.id,
        duplicado: !!(resultado && resultado.duplicado),
      };
    } catch (erro) {
      ultimaFalha = erro instanceof Error ? erro.message : "Falha ao registrar.";
      if (tentativa === TENTATIVAS) break;
      await new Promise(function (resolver) {
        setTimeout(resolver, 400);
      });
    }
  }

  // Erros de configuração não melhoram com retry. Falhas de rede, timeout,
  // 429 e 5xx entram na fila.
  const definitivo = erroDefinitivo(ultimaFalha);
  if (!definitivo) await enfileirarAlerta(limpo);

  await registrarStatus(
    false,
    definitivo ? `Alerta não registrado: ${ultimaFalha}` : `Alerta na fila para reenvio: ${ultimaFalha}`,
  );
  await salvarArmazenado(CHAVES.ultimoAlerta, {
    ok: false,
    mensagem: ultimaFalha,
    enfileirado: !definitivo,
    em: Date.now(),
  });
  return { ok: false, mensagem: ultimaFalha, enfileirado: !definitivo };
}

// ---------------------------------------------------------------------------
// Mensagens das páginas (content script, popup e opções)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(function (mensagem, remetente, responder) {
  if (!mensagem || !mensagem.tipo) return false;

  (async function () {
    try {
      if (mensagem.tipo === "OBTER_CONFIG") {
        // A página aberta também participa da atualização transparente.
        const cache = await sincronizarConfig(false, true);
        responder({ ok: true, cache: cache });
        return;
      }

      if (mensagem.tipo === "OBTER_AREAS") {
        const configuracao = {
          serverUrl: normalizarUrl(mensagem.serverUrl || CONFIGURACAO_PADRAO.serverUrl),
          apiToken: String(mensagem.apiToken || "").trim(),
        };
        if (!configuracao.apiToken) {
          responder({ ok: false, erro: "Cole o código de verificação para carregar os departamentos." });
          return;
        }
        try {
          const resposta = await requisitar("/api/config", { method: "GET" }, configuracao);
          responder({
            ok: true,
            areas: areasDaConfiguracao(resposta),
          });
        } catch (erro) {
          responder({
            ok: false,
            erro: erro instanceof Error ? erro.message : "Servidor indisponível.",
          });
        }
        return;
      }

      if (mensagem.tipo === "SINCRONIZAR_AGORA") {
        // Usado apenas pelo clique em Salvar das Opções; não há mais botão
        // manual de sincronização na interface.
        const cache = await sincronizarConfig(true, false);
        responder({ ok: Boolean(cache), cache: cache });
        return;
      }

      if (mensagem.tipo === "REGISTRAR_ALERTA") {
        responder(await enviarAlerta(mensagem.alerta || {}));
        return;
      }

      if (mensagem.tipo === "EXTRAIR_ANEXO") {
        responder(await extrairAnexo(mensagem.anexo || {}));
        return;
      }

      if (mensagem.tipo === "TESTAR_CONEXAO") {
        try {
          const inicio = Date.now();
          const configuracao = await obterConfiguracao();
          const base = normalizarUrl(configuracao.serverUrl);
          if (!base) {
            throw new Error(
              "Configure a URL do servidor nas Opções. Copie o endereço do painel em Monitoramento.",
            );
          }
          if (chrome.permissions && chrome.permissions.contains) {
            const autorizado = await chrome.permissions.contains({ origins: [base + "/*"] });
            if (!autorizado) {
              throw new Error(
                "O navegador não autorizou acesso a " +
                  base +
                  ". Salve as Opções e escolha Permitir quando o Chrome perguntar.",
              );
            }
          }
          // /api/ping prova que a rede e a URL funcionam; /api/config também
          // confere o código de verificação.
          await requisitar("/api/ping", { method: "GET" });
          const resposta = await requisitar("/api/config", { method: "GET" });
          await registrarDispositivo(configuracao);
          const totalRegras = resposta && Array.isArray(resposta.regras) ? resposta.regras.length : 0;
          await registrarStatus(true, "Conexão estabelecida.");
          responder({
            ok: true,
            mensagem: `${totalRegras} ${totalRegras === 1 ? "regra" : "regras"}`,
            latenciaMs: Date.now() - inicio,
          });
        } catch (erro) {
          const texto = erro instanceof Error ? erro.message : "Servidor indisponível.";
          await registrarStatus(false, texto);
          responder({ ok: false, mensagem: texto });
        }
        return;
      }

      if (mensagem.tipo === "OBTER_ESTADO") {
        const [configuracao, status, cache, ultimoAlerta, sitesPendentes] = await Promise.all([
          obterConfiguracao(),
          lerArmazenado(CHAVES.status, null),
          lerArmazenado(CHAVES.cache, null),
          lerArmazenado(CHAVES.ultimoAlerta, null),
          lerArmazenado(CHAVES.sitesPendentes, []),
        ]);
        // O popup mostra a política do servidor, não uma preferência local.
        const politica = cache
          ? {
              monitoramentoAtivo: cache.monitoramentoAtivo !== false,
              sitesAtivos: Array.isArray(cache.sitesAtivos) ? cache.sitesAtivos : [],
            }
          : {};
        responder({
          ok: true,
          configuracao: { ...configuracao, ...politica },
          status: status,
          ultimoAlerta: ultimoAlerta,
          versao: VERSAO_EXTENSAO,
          dispositivoId: await obterDispositivoId(),
          sites: cache && Array.isArray(cache.sites) ? cache.sites : [],
          sitesPendentes: Array.isArray(sitesPendentes) ? sitesPendentes : [],
          cache: cache
            ? {
                totalRegras: cache.regras ? cache.regras.length : 0,
                atualizadoEm: cache.atualizadoEm,
                areas:
                  Array.isArray(cache.areas) && cache.areas.length
                    ? cache.areas
                    : areasDasRegras(cache.regras),
              }
            : null,
        });
        return;
      }

      responder({ ok: false, erro: "Mensagem desconhecida." });
    } catch (erro) {
      responder({
        ok: false,
        erro: erro instanceof Error ? erro.message : "Erro inesperado no service worker.",
      });
    }
  })();

  return true; // resposta assíncrona
});

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async function () {
  const salva = await lerArmazenado(CHAVES.configuracao, null);
  if (!salva) await salvarArmazenado(CHAVES.configuracao, CONFIGURACAO_PADRAO);
  // A chave antiga era usada por uma versão que descartava a fila; a fila nova
  // só é removida quando o servidor confirma o registro.
  await chrome.storage.local.remove(CHAVES.filaAntiga);
  await obterDispositivoId();
  await garantirAlarmeSync();
  await processarFila();

  // Primeira instalação (ou reinstalação, que apaga as Opções): abre a tela
  // para colar o código, em vez de ficar recusando alertas em silêncio.
  const configuracao = await obterConfiguracao();
  if (!(configuracao.apiToken || "").trim()) {
    await registrarStatus(false, "Código de verificação não configurado.");
    await chrome.runtime.openOptionsPage();
    return;
  }
  await sincronizarConfig(true);
});

chrome.runtime.onStartup.addListener(function () {
  void garantirAlarmeSync();
  void processarFila();
});

chrome.alarms.onAlarm.addListener(function (alarme) {
  if (alarme.name === ALARME_SYNC) void sincronizarConfig(false, true);
  if (alarme.name === ALARME_FILA) void processarFila();
});

chrome.storage.onChanged.addListener(function (mudancas, area) {
  if (area !== "local" || !mudancas[CHAVES.configuracao]) return;
  void garantirAlarmeSync();
  void sincronizarConfig(true);
});
