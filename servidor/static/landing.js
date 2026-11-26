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
  // com todos os padrões exige o código de conexão e não é exposta aqui.
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
  var timerRetomada = null;
  var interagiu = false;

  function pararRotacao() {
    interagiu = true;
    clearTimeout(timerRotacao);
    clearTimeout(timerRetomada);
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

  function avancarRotacao() {
    if (reduzirMovimento || botoesRotacao.length < 2) return;
    indiceRotacao = (indiceRotacao + 1) % botoesRotacao.length;
    var botao = botoesRotacao[indiceRotacao];
    digitar(botao.getAttribute("data-texto") || "", agendarRotacao);
  }

  function agendarRotacao() {
    if (interagiu || reduzirMovimento || botoesRotacao.length < 2) return;
    clearTimeout(timerRotacao);
    timerRotacao = setTimeout(avancarRotacao, 4200);
  }

  function retomarAposPausa() {
    clearTimeout(timerRetomada);
    timerRetomada = setTimeout(function () {
      interagiu = false;
      avancarRotacao();
    }, 10000);
  }

  document.querySelectorAll("[data-texto]").forEach(function (botao) {
    botao.addEventListener("click", function () {
      pararRotacao();
      var posicao = botoesRotacao.indexOf(botao);
      if (posicao >= 0) indiceRotacao = posicao;
      digitar(botao.getAttribute("data-texto") || "", retomarAposPausa);
    });
  });

  analisar();
  agendarRotacao();

  // Aparição fluida dos blocos ao descer a tela, sem esconder conteúdo quando
  // o JS falhar. Blocos irmãos entram em sequência curta, como uma leitura.
  var grupos = [
    ".lp-secao",
    ".lp-escuro-conteudo",
    ".lp-cta-grade",
  ];
  if (!reduzirMovimento && "IntersectionObserver" in window) {
    var observador = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          entrada.target.classList.add("visivel");
          observador.unobserve(entrada.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    grupos.forEach(function (seletor) {
      document.querySelectorAll(seletor).forEach(function (pai) {
        Array.prototype.forEach.call(pai.children, function (filho, indice) {
          if (filho.classList.contains("lp-marca-dagua")) return;
          filho.classList.add("aparecer");
          filho.style.setProperty("--atraso", Math.min(indice, 4) * 90 + "ms");
          observador.observe(filho);
        });
      });
    });
  }
})();

/**
 * Sentinela — interações da landing: header ao rolar e matriz por departamento.
 * Funciona sem dependências e mantém a seção visível quando o JS falha.
 */
(function () {
  "use strict";

  var topo = document.getElementById("lp-topo");
  if (topo) {
    var atualizarTopo = function () {
      topo.classList.toggle("rolou", window.scrollY > 12);
    };
    atualizarTopo();
    window.addEventListener("scroll", atualizarTopo, { passive: true });
  }

  var abas = Array.prototype.slice.call(document.querySelectorAll(".lp-aba"));
  if (!abas.length) return;

  function ativar(indice, focar) {
    abas.forEach(function (aba, posicao) {
      var selecionada = posicao === indice;
      aba.setAttribute("aria-selected", selecionada ? "true" : "false");
      aba.tabIndex = selecionada ? 0 : -1;
      var painel = document.getElementById(aba.getAttribute("aria-controls"));
      if (painel) painel.hidden = !selecionada;
    });
    if (focar) abas[indice].focus();
  }

  abas.forEach(function (aba, indice) {
    aba.addEventListener("click", function () {
      ativar(indice, false);
    });

    aba.addEventListener("keydown", function (evento) {
      var proximo = null;
      if (evento.key === "ArrowRight") proximo = (indice + 1) % abas.length;
      else if (evento.key === "ArrowLeft") proximo = (indice - 1 + abas.length) % abas.length;
      else if (evento.key === "Home") proximo = 0;
      else if (evento.key === "End") proximo = abas.length - 1;
      if (proximo === null) return;
      evento.preventDefault();
      ativar(proximo, true);
    });
  });

  // Estabiliza a altura da matriz no maior conjunto de regras: trocar de
  // departamento não desloca o restante da página. No mobile a altura é natural.
  var paineis = Array.prototype.slice.call(document.querySelectorAll(".lp-painel-area"));
  var areaResultados = document.querySelector(".lp-paineis");
  if (paineis.length && areaResultados) {
    var medirMatriz = function () {
      // Mede sempre a partir da altura natural, sem acumular medições anteriores.
      areaResultados.style.removeProperty("--matriz-altura");
      if (window.matchMedia("(max-width: 900px)").matches) return;
      var maior = 0;
      paineis.forEach(function (painel) {
        var oculto = painel.hidden;
        painel.hidden = false;
        maior = Math.max(maior, painel.offsetHeight);
        painel.hidden = oculto;
      });
      if (maior > 0) {
        areaResultados.style.setProperty("--matriz-altura", Math.ceil(maior) + "px");
      }
    };
    medirMatriz();
    window.addEventListener("resize", medirMatriz, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medirMatriz);
  }
})();
