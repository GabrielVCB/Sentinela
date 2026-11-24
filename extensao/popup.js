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

function pintarStatus(conectado, texto, estado) {
  elementos.statusTexto.textContent = texto || "Desconectado";
  const classe =
    estado === "erro" ? "status-erro" : conectado ? "status-ok" : "status-neutro";
  elementos.statusTexto.className = "badge " + classe;
}

function pintarMonitoramento(valor) {
  const ativo = valor === true;
  const definido = valor === true || valor === false;
  elementos.monitoramento.textContent = !definido
    ? "Aguardando"
    : ativo
      ? "Ativo"
      : "Desativado";
  elementos.monitoramento.className =
    "badge " + (ativo ? "status-ok" : definido ? "status-neutro" : "status-observacao");
}

async function carregar() {
  // Confere a versão da política em segundo plano. Além de atualizar o estado,
  // isso aplica imediatamente uma IA desativada no painel às abas já abertas.
  void enviar({ tipo: "OBTER_CONFIG" });
  const estado = await enviar({ tipo: "OBTER_ESTADO" });
  if (!estado.ok) {
    pintarStatus(false, "Não foi possível ler a configuração.");
    return;
  }

  const configuracao = estado.configuracao || {};
  pintarMonitoramento(configuracao.monitoramentoAtivo);
  elementos.departamento.textContent = configuracao.departamento || "não configurado";
  elementos.colaborador.textContent = configuracao.colaborador || "não configurado";
  elementos.regras.textContent = estado.cache ? estado.cache.totalRegras : 0;
  const falhaSincronizacao = Boolean(
    estado.cache && estado.status && !estado.status.conectado && estado.status.mensagem,
  );
  elementos.sincronizacao.textContent = estado.cache
    ? formatarQuando(estado.cache.atualizadoEm) + (falhaSincronizacao ? " · falha" : "")
    : falhaSincronizacao
      ? "falha · nunca sincronizado"
      : "nunca";
  elementos.sincronizacao.title = estado.cache && estado.cache.atualizadoEm
    ? "Última sincronização bem-sucedida: " +
      new Date(estado.cache.atualizadoEm).toLocaleString("pt-BR") +
      (falhaSincronizacao ? " · falha na tentativa mais recente" : "")
    : "Nenhuma sincronização concluída.";

  if (!(configuracao.apiToken || "").trim()) {
    pintarStatus(false, "Não configurado", "neutro");
  } else if (estado.status && estado.status.conectado) {
    pintarStatus(true, "Conectado");
  } else if (!(configuracao.departamento || "").trim() || !(configuracao.colaborador || "").trim()) {
    pintarStatus(false, "Configuração incompleta", "neutro");
  } else if (estado.status && estado.status.mensagem) {
    pintarStatus(false, "Sem conexão", "erro");
  } else {
    pintarStatus(false, "Nunca sincronizado", "neutro");
  }
  if (elementos.resultadoTeste && !elementos.resultadoTeste.textContent) {
    elementos.resultadoTeste.textContent = estado.status && estado.status.mensagem
      ? estado.status.mensagem
      : "";
  }
}

async function testarConexao() {
  if (elementos.testar.disabled) return;
  elementos.testar.disabled = true;
  elementos.testar.textContent = "Testando…";
  elementos.resultadoTeste.textContent = "Verificando servidor, código e regras…";
  elementos.resultadoTeste.className = "resultado-popup";
  const resposta = await enviar({ tipo: "TESTAR_CONEXAO" });
  elementos.testar.disabled = false;
  elementos.testar.textContent = "Testar conexão";
  const segundos = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
    (resposta.latenciaMs || 0) / 1000,
  );
  if (resposta.ok) {
    pintarStatus(true, "Conectado");
    const detalhe = resposta.mensagem ? " · " + resposta.mensagem : "";
    elementos.resultadoTeste.textContent = "Conexão validada · " + segundos + " s" + detalhe;
    elementos.resultadoTeste.className = "resultado-popup ok";
  } else {
    pintarStatus(false, "Falha na conexão", "erro");
    elementos.resultadoTeste.textContent = resposta.mensagem || resposta.erro || "Servidor indisponível.";
    elementos.resultadoTeste.className = "resultado-popup erro";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  elementos.statusTexto = document.getElementById("status-texto");
  elementos.monitoramento = document.getElementById("monitoramento");
  elementos.departamento = document.getElementById("departamento");
  elementos.colaborador = document.getElementById("colaborador");
  elementos.regras = document.getElementById("regras");
  elementos.sincronizacao = document.getElementById("sincronizacao");
  elementos.testar = document.getElementById("testar");
  elementos.opcoes = document.getElementById("opcoes");
  elementos.resultadoTeste = document.getElementById("resultado-teste");

  elementos.testar.addEventListener("click", testarConexao);
  elementos.opcoes.addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  // Quando a sincronização termina e grava uma política nova, o popup aberto
  // atualiza sozinho sem precisar ser fechado e reaberto.
  chrome.storage.onChanged.addListener(function (mudancas, area) {
    if (area !== "local") return;
    if (!mudancas.cacheConfig && !mudancas.configuracao) return;
    void carregar();
  });

  void carregar();
});
