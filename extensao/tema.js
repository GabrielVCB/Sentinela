/** Sentinela — tema próprio da extensão (independente do painel). */
(function () {
  "use strict";

  var CHAVE = "temaExtensao";
  var raiz = document.documentElement;
  var resolvido = false;

  // Esconde o conteúdo por um instante até a preferência real chegar. Sem isso,
  // a página pinta no tema claro e troca para o escuro (ou vice-versa) quando o
  // chrome.storage responde, o que parecia uma alternância aleatória.
  if (!raiz.dataset.tema) raiz.setAttribute("data-tema-carregando", "");

  function aplicar(tema) {
    resolvido = true;
    raiz.dataset.tema = tema === "escuro" ? "escuro" : "claro";
    raiz.removeAttribute("data-tema-carregando");
  }

  function aplicarDoArmazenamento(tema) {
    if (!resolvido) {
      aplicar(tema);
      return;
    }
    // Uma alteração feita em outra página da extensão (Opções) vale na hora.
    if (raiz.dataset.tema !== (tema === "escuro" ? "escuro" : "claro")) {
      aplicar(tema);
    }
  }

  // O chrome.storage é a fonte da verdade. O fallback evita que a página fique
  // oculta caso a API não responda por algum motivo.
  var fallback = setTimeout(function () {
    if (!resolvido) aplicar("claro");
  }, 600);

  try {
    chrome.storage.local.get([CHAVE], function (dados) {
      clearTimeout(fallback);
      aplicarDoArmazenamento(dados && dados[CHAVE]);
    });
    chrome.storage.onChanged.addListener(function (mudancas, area) {
      if (area !== "local" || !mudancas[CHAVE]) return;
      clearTimeout(fallback);
      aplicarDoArmazenamento(mudancas[CHAVE].newValue);
    });
  } catch (erro) {
    /* fora do contexto da extensão */
    clearTimeout(fallback);
    aplicar("claro");
  }
})();
