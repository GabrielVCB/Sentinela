/* Sentinela — aplica o tema salvo antes de a página pintar. */
(function () {
  "use strict";
  var tema = "claro";
  try {
    var salvo = localStorage.getItem("sentinela-tema");
    if (salvo === "escuro" || salvo === "claro") tema = salvo;
  } catch (erro) {
    /* armazenamento indisponível: mantém o tema claro */
  }
  document.documentElement.dataset.tema = tema;
})();
