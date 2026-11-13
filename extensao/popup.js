/** Sentinela — popup: status resumido e teste de conexão. */
"use strict";

const elementos = {};

function formatarQuando(ms) {
  if (!ms) return "—";
  var diferenca = Date.now() - ms;
  if (diferenca < 60 * 1000) return "agora";
  if (diferenca < 60 * 60 * 1000) return Math.floor(diferenca / 60000) + " min atrás";
  if (diferenca < 24 * 60 * 60 * 1000) return Math.floor(diferenca / 3600000) + " h atrás";
  return new Date(ms).toLocaleDateString("pt-BR");
}

async function enviar(mensagem) {
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

function pintarStatus(conectado, texto) {
  var ponto = elementos.statusPonto;
  ponto.className = "ponto-status " + (conectado ? "on" : "off");
  elementos.statusTexto.textContent = texto || (conectado ? "Conectado" : "Desconectado");
}

async function carregar() {
  const estado = await enviar({ tipo: "OBTER_ESTADO" });
  if (!estado.ok) {
    pintarStatus(false, "Não foi possível ler a configuração.");
    return;
  }

  const configuracao = estado.configuracao || {};
  elementos.monitoramento.textContent =
    configuracao.monitoramentoAtivo === true
      ? "Ativo"
      : configuracao.monitoramentoAtivo === false
        ? "Desativado"
        : "Aguardando configuração";
  elementos.departamento.textContent = configuracao.departamento || "não configurado";
  elementos.colaborador.textContent = configuracao.colaborador || "não configurado";
  elementos.regras.textContent = estado.cache ? estado.cache.totalRegras : 0;
  elementos.sincronizacao.textContent = estado.cache
    ? formatarQuando(estado.cache.atualizadoEm)
    : "nunca";

  if (!(configuracao.apiToken || "").trim()) {
    pintarStatus(false, "Cole o código de verificação nas opções.");
  } else if (!(configuracao.departamento || "").trim() || !(configuracao.colaborador || "").trim()) {
    pintarStatus(false, "Informe departamento e colaborador nas opções.");
  } else if (estado.status && estado.status.conectado) {
    pintarStatus(true, "Conectado");
  } else if (estado.status && estado.status.mensagem) {
    pintarStatus(false, "Sem conexão");
  } else {
    pintarStatus(false, "Nenhuma sincronização ainda.");
  }
}

async function testarConexao() {
  elementos.testar.disabled = true;
  elementos.testar.textContent = "Testando…";
  const resposta = await enviar({ tipo: "TESTAR_CONEXAO" });
  elementos.testar.disabled = false;
  elementos.testar.textContent = "Testar conexão";
  pintarStatus(
    Boolean(resposta.ok),
    resposta.ok
      ? "Online · " + (resposta.latenciaMs || 0) + " ms"
      : "Falha: " + (resposta.mensagem || resposta.erro || "indisponível"),
  );
}

document.addEventListener("DOMContentLoaded", function () {
  elementos.statusPonto = document.getElementById("status-ponto");
  elementos.statusTexto = document.getElementById("status-texto");
  elementos.monitoramento = document.getElementById("monitoramento");
  elementos.departamento = document.getElementById("departamento");
  elementos.colaborador = document.getElementById("colaborador");
  elementos.regras = document.getElementById("regras");
  elementos.sincronizacao = document.getElementById("sincronizacao");
  elementos.testar = document.getElementById("testar");
  elementos.opcoes = document.getElementById("opcoes");

  elementos.testar.addEventListener("click", testarConexao);
  elementos.opcoes.addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  void carregar();
});
