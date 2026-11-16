/** Sentinela — tema próprio da extensão (independente do painel). */
(function () {
  "use strict";

  var CHAVE = "temaExtensao";

  function aplicar(tema) {
    document.documentElement.dataset.tema = tema === "escuro" ? "escuro" : "claro";
  }

  // O localStorage evita a piscada clara ao abrir uma página da extensão. O
  // chrome.storage é a fonte da verdade e sincroniza opções, popup e conteúdo.
  try {
    var espelho = localStorage.getItem(CHAVE);
    if (espelho === "escuro" || espelho === "claro") aplicar(espelho);
  } catch (erro) {
    /* páginas da extensão podem bloquear localStorage */
  }

  try {
    chrome.storage.local.get([CHAVE], function (dados) {
      if (dados && (dados[CHAVE] === "escuro" || dados[CHAVE] === "claro")) {
        aplicar(dados[CHAVE]);
      }
    });
    chrome.storage.onChanged.addListener(function (mudancas, area) {
      if (area !== "local" || !mudancas[CHAVE]) return;
      aplicar(mudancas[CHAVE].newValue);
    });
  } catch (erro) {
    /* fora do contexto da extensão */
  }
})();
