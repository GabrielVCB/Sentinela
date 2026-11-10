/** Sentinela — página de opções. */
"use strict";

// O endereço do servidor é copiado do painel; não há servidor local.
const PADROES = {
  serverUrl: "",
  apiToken: "",
  departamento: "",
  colaborador: "",
};

const el = {};
let avisoPermissao = "";

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
    // Chame request diretamente no gesto do clique; contains antes poderia
    // consumir a ativação do usuário e impedir o pedido de permissão.
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
 * Busca as áreas no servidor usando o endereço e o código que estão na tela,
 * sem gravar nada. Assim o seletor de departamento já abre preenchido.
 */
async function carregarAreas(mostrarErro) {
  const servidor = el.servidor.value.trim();
  const codigo = el.token.value.trim();
  const atual = el.departamento.value;

  if (!/^https:\/\//i.test(servidor) || !codigo) {
    montarDepartamentos([], atual, "Cole a URL e o código de instalação");
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
          ? resposta.areas.length + " departamento(s) carregado(s)."
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

function atualizarResumo(estado) {
  el.regras.textContent = estado.cache ? estado.cache.totalRegras : 0;
  el.sincronizacao.textContent = estado.cache ? quando(estado.cache.atualizadoEm) : "nunca";
  el.versao.textContent = estado.versao || chrome.runtime.getManifest().version;

  const status = estado.status;
  el.statusPonto.className =
    "ponto-status " + (status && status.conectado ? "on" : "off");
  if (status && status.mensagem) {
    el.sincronizacao.title = status.mensagem;
  }
}

async function carregar() {
  const estado = await enviar({ tipo: "OBTER_ESTADO" });
  if (!estado.ok) {
    avisar(el.resultadoConexao, estado.erro || "Falha ao carregar o estado.", "erro");
    return;
  }

  const configuracao = Object.assign({}, PADROES, estado.configuracao || {});
  el.servidor.value = configuracao.serverUrl || "";
  el.token.value = configuracao.apiToken || "";
  el.colaborador.value = configuracao.colaborador || "";

  const areas = estado.cache ? estado.cache.areas : [];
  montarDepartamentos(areas, configuracao.departamento);
  // Sem cache (primeira abertura), as áreas vêm do servidor na hora.
  if (!areas || !areas.length) void carregarAreas(false);
  atualizarResumo(estado);
}

async function salvar(silencioso, completo) {
  const exigirIdentificacao = completo !== false;
  const departamento = el.departamento.value.trim();

  let endereco = null;
  try {
    endereco = new URL(el.servidor.value.trim());
  } catch (erro) {
    endereco = null;
  }
  if (!endereco || endereco.protocol !== "https:") {
    avisar(
      el.resultadoSalvar,
      "Cole a URL completa do servidor, começando com https://. Ex.: https://sentinela-xxxx.onrender.com",
      "erro",
    );
    return false;
  }
  const servidor = endereco.origin;
  if (/suaempresa\.com/i.test(servidor)) {
    avisar(
      el.resultadoSalvar,
      "Troque a URL de exemplo pela URL do Render que aparece no painel em 06 · Instalação.",
      "erro",
    );
    return false;
  }

  const codigo = el.token.value.trim();
  if (!codigo) {
    avisar(
      el.resultadoSalvar,
      "Cole o código de instalação que aparece no painel, em 06 · Instalação.",
      "erro",
    );
    return false;
  }

  if (exigirIdentificacao && !departamento) {
    avisar(
      el.resultadoSalvar,
      "Escolha o departamento. Ele é obrigatório para identificar a origem do alerta.",
      "erro",
    );
    return false;
  }

  const colaborador = el.colaborador.value.trim();
  if (exigirIdentificacao && !colaborador) {
    avisar(
      el.resultadoSalvar,
      "Informe o identificador do colaborador. Ele é obrigatório: os alertas não são anônimos.",
      "erro",
    );
    return false;
  }

  const permissao = await garantirPermissao(servidor);
  avisoPermissao = permissao.ok ? "" : permissao.mensagem || "";

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

  if (!silencioso) {
    // Sincroniza na hora: confirma o código e já carrega a lista de departamentos.
    const sincronizado = await enviar({ tipo: "SINCRONIZAR_AGORA" });
    if (avisoPermissao) {
      avisar(el.resultadoSalvar, "Configurações salvas. " + avisoPermissao, "erro");
    } else if (!sincronizado.ok) {
      avisar(
        el.resultadoSalvar,
        "Configurações salvas, mas o servidor recusou o código. Copie o valor de 06 · Instalação e salve de novo.",
        "erro",
      );
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
    avisar(
      el.resultadoConexao,
      "Conectado em " + (resposta.latenciaMs || 0) + " ms. " + (resposta.mensagem || ""),
      "ok",
    );
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
  el.servidor = document.getElementById("servidor");
  el.token = document.getElementById("token");
  el.departamento = document.getElementById("departamento");
  el.colaborador = document.getElementById("colaborador");
  el.regras = document.getElementById("regras");
  el.sincronizacao = document.getElementById("sincronizacao");
  el.statusPonto = document.getElementById("status-ponto");
  el.resultadoConexao = document.getElementById("resultado-conexao");
  el.resultadoSalvar = document.getElementById("resultado-salvar");
  el.testar = document.getElementById("testar");
  el.salvar = document.getElementById("salvar");
  el.versao = document.getElementById("versao-extensao");

  el.testar.addEventListener("click", testar);
  el.salvar.addEventListener("click", function () {
    void salvar(false);
  });

  // A lista de departamentos acompanha o código digitado, sem salvar antes.
  el.token.addEventListener("input", agendarAreas);
  el.servidor.addEventListener("change", agendarAreas);

  void carregar();
});
