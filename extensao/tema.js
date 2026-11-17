/** Sentinela — tema próprio da extensão (independente do painel). */
(function () {
  "use strict";

  var CHAVE = "temaExtensao";
  var CHAVE_EM = "temaExtensaoEm";
  var raiz = document.documentElement;
  var resolvido = false;
  var aplicadoEm = 0;

  function normalizar(tema) {
    return tema === "escuro" ? "escuro" : "claro";
  }

  function lerEspelho() {
    try {
      var tema = localStorage.getItem(CHAVE);
      return {
        tema:
          tema === "escuro" || tema === "claro" ? tema : null,
        em: Number(localStorage.getItem(CHAVE_EM)) || 0,
      };
    } catch (erro) {
      return { tema: null, em: 0 };
    }
  }

  function gravarEspelho(tema, em) {
    try {
      localStorage.setItem(CHAVE, tema);
      localStorage.setItem(CHAVE_EM, String(em));
    } catch (erro) {
      /* páginas da extensão podem bloquear localStorage */
    }
  }

  function aplicar(tema, em, persistir) {
    var escolhido = normalizar(tema);
    var momento = Number(em) || 0;
    // Um evento atrasado de outra página não pode reverter um tema mais novo
    // que já está aplicado. Sem horário (instalação antiga), mantém o valor.
    if (momento && aplicadoEm && momento < aplicadoEm) return;
    if (momento > aplicadoEm) aplicadoEm = momento;
    raiz.dataset.tema = escolhido;
    raiz.removeAttribute("data-tema-carregando");
    resolvido = true;
    if (persistir) gravarEspelho(escolhido, aplicadoEm || Date.now());
  }

  // O espelho local permite aplicar o tema antes da primeira pintura e evita
  // a piscada clara/escura ao abrir o popup. O chrome.storage é a fonte
  // compartilhada entre Opções e popup; o horário decide qual valor é o mais
  // novo quando uma página abre logo depois de a outra alternar o tema.
  var espelho = lerEspelho();
  var espelhoValido = espelho.tema !== null;

  if (espelhoValido) {
    aplicar(espelho.tema, espelho.em, false);
  } else {
    raiz.setAttribute("data-tema-carregando", "");
  }

  var fallback = setTimeout(function () {
    if (!resolvido) aplicar("claro", 0, false);
  }, 600);

  try {
    chrome.storage.local.get([CHAVE, CHAVE_EM], function (dados) {
      clearTimeout(fallback);
      var tema = dados && dados[CHAVE];
      var temSalvo = tema === "escuro" || tema === "claro";
      var em = Number(dados && dados[CHAVE_EM]) || 0;

      if (!temSalvo) {
        if (!resolvido) aplicar("claro", 0, false);
        return;
      }

      // Sem espelho, aceita o valor salvo mesmo sem horário (instalações
      // antigas). Com espelho, só troca se o armazenamento for mais recente.
      var deveAplicar = espelhoValido ? em > aplicadoEm : em >= aplicadoEm;
      if (deveAplicar) aplicar(tema, em, true);
    });

    chrome.storage.onChanged.addListener(function (mudancas, area) {
      if (area !== "local") return;
      if (!mudancas[CHAVE] && !mudancas[CHAVE_EM]) return;
      clearTimeout(fallback);
      var tema = mudancas[CHAVE]
        ? mudancas[CHAVE].newValue
        : raiz.dataset.tema;
      var em = mudancas[CHAVE_EM]
        ? Number(mudancas[CHAVE_EM].newValue) || Date.now()
        : Date.now();
      aplicar(tema, em, true);
    });
  } catch (erro) {
    /* fora do contexto da extensão */
    clearTimeout(fallback);
    aplicar("claro", 0, false);
  }
})();
