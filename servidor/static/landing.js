/**
 * Sentinela — demonstração local da página inicial.
 *
 * Usa o mesmo motor de detecção da extensão (detectores.js) e um subconjunto
 * público de regras. Nenhum texto sai do navegador.
 */
(function () {
  "use strict";

  var motor = globalThis.PainelDetectores;
  var campo = document.getElementById("demo-texto");
  var caixa = document.getElementById("demo-caixa");
  var nivel = document.getElementById("demo-nivel");
  var contagem = document.getElementById("demo-contagem");
  var tipos = document.getElementById("demo-tipos");
  var mensagem = document.getElementById("demo-mensagem");

  if (!motor || !campo || !caixa || !nivel || !contagem || !tipos || !mensagem) return;

  var ROTULOS = { baixo: "Baixo", medio: "Médio", alto: "Alto" };
  var MENSAGENS = {};
  var regras = [];
  try {
    var dados = document.getElementById("dados-sentinela");
    MENSAGENS = JSON.parse(dados ? dados.dataset.mensagens : "{}");
    regras = JSON.parse(dados ? dados.dataset.regras : "[]");
  } catch (erro) {
    console.warn("Dados padrão da demonstração indisponíveis.", erro);
  }

  // A prévia usa só as regras públicas embutidas na página. A matriz completa
  // com todos os padrões exige o código de verificação e não é exposta aqui.
  var ultimo = "";

  function renderizar(resultado) {
    var assinatura = resultado.nivel + "|" +
      resultado.deteccoes.map(function (item) {
        return item.tipo;
      }).join(",");

    caixa.className = "lp-demo-caixa demo-" + resultado.nivel;
    nivel.textContent = "Risco " + ROTULOS[resultado.nivel];
    var totalTipos = resultado.deteccoes.length;
    var totalOcorrencias = resultado.totalOcorrencias;
    contagem.textContent = totalTipos
      ? totalTipos +
        (totalTipos === 1 ? " tipo · " : " tipos · ") +
        totalOcorrencias +
        (totalOcorrencias === 1 ? " ocorrência" : " ocorrências")
      : "sem detecções";

    tipos.replaceChildren();
    resultado.deteccoes.forEach(function (deteccao) {
      var item = document.createElement("li");
      var ponto = document.createElement("span");
      ponto.className = "lp-tipo-dot " + deteccao.risco;
      var nome = document.createElement("b");
      nome.textContent = deteccao.tipo;
      var area = document.createElement("span");
      area.className = "lp-tipo-area";
      area.textContent = deteccao.area;
      item.appendChild(ponto);
      item.appendChild(nome);
      item.appendChild(area);
      tipos.appendChild(item);
    });

    var chaveMensagem = totalTipos > 0 ? resultado.nivel : "sem_deteccao";
    mensagem.textContent = MENSAGENS[chaveMensagem] || "";

    // Reinicia a animação de entrada apenas quando o conteúdo muda.
    if (assinatura !== ultimo) {
      ultimo = assinatura;
      caixa.classList.remove("demo-atualizou");
      void caixa.offsetWidth;
      caixa.classList.add("demo-atualizou");
    }
  }

  function analisar() {
    renderizar(motor.analisarTexto(campo.value, regras));
  }

  var reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var botoesRotacao = Array.prototype.slice.call(
    document.querySelectorAll("[data-rotacao='true']"),
  );
  // A prévia abre no risco médio; o primeiro giro automático mostra o alto.
  var indiceRotacao = 1;
  var timerDigitacao = null;
  var timerRotacao = null;
  var interagiu = false;

  function pararRotacao() {
    interagiu = true;
    clearTimeout(timerRotacao);
    clearInterval(timerDigitacao);
  }

  function digitar(texto, aoFinal) {
    clearInterval(timerDigitacao);
    if (reduzirMovimento) {
      campo.value = texto;
      analisar();
      if (aoFinal) aoFinal();
      return;
    }
    var posicao = 0;
    campo.value = "";
    // Durante a digitação, o aviso anterior fica estável. O novo risco é
    // aplicado uma única vez no fim, evitando piscadas e trocas de cor.
    timerDigitacao = setInterval(function () {
      posicao += 1;
      campo.value = texto.slice(0, posicao);
      if (posicao >= texto.length) {
        clearInterval(timerDigitacao);
        timerDigitacao = null;
        analisar();
        if (aoFinal) aoFinal();
      }
    }, 16);
  }

  function agendarRotacao() {
    if (interagiu || reduzirMovimento || botoesRotacao.length < 2) return;
    clearTimeout(timerRotacao);
    timerRotacao = setTimeout(function () {
      indiceRotacao = (indiceRotacao + 1) % botoesRotacao.length;
      var botao = botoesRotacao[indiceRotacao];
      digitar(botao.getAttribute("data-texto") || "", agendarRotacao);
    }, 4200);
  }

  campo.addEventListener("input", function () {
    pararRotacao();
    analisar();
  });
  campo.addEventListener("focus", pararRotacao);

  document.querySelectorAll("[data-texto]").forEach(function (botao) {
    botao.addEventListener("click", function () {
      pararRotacao();
      campo.focus();
      digitar(botao.getAttribute("data-texto") || "", null);
    });
  });

  analisar();
  agendarRotacao();

  // Entrada discreta das seções, sem esconder conteúdo quando o JS falhar.
  var secoes = document.querySelectorAll(".lp-secao, .lp-letramento, .lp-cta");
  if (!reduzirMovimento && "IntersectionObserver" in window) {
    var observador = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          entrada.target.classList.add("visivel");
          observador.unobserve(entrada.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );
    secoes.forEach(function (secao) {
      secao.classList.add("revelar");
      observador.observe(secao);
    });
  }
})();
