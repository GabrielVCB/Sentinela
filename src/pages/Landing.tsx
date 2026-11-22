import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  ClipboardPaste,
  FileText,
  History,
  LockKeyhole,
  MessageSquare,
  ScanText,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useAnaliseComDebounce } from "@/hooks/use-analise";
import { BannerRisco } from "@/components/painel/BannerRisco";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AREAS_SEED,
  FERRAMENTAS_MONITORADAS,
  MENSAGENS_PADRAO,
  type Risco,
} from "@/lib/dados";
import { analisarTexto, type RegraEntrada } from "@/lib/detectores";

// Esta é a prévia de desenvolvimento do Freebuff. A landing oficial é
// `servidor/templates/landing.html`; o painel real também é servido pelo Flask.
// Configure VITE_SENTINELA_URL com a URL pública do servidor.
const URL_PAINEL = (
  (import.meta.env.VITE_SENTINELA_URL as string | undefined) || ""
).replace(/\/+$/, "");

// Só um conjunto curto de exemplos fica no bundle da prévia. A matriz completa
// com os padrões de detecção é entregue pela API autenticada da extensão.
const REGRAS_DEMO: RegraEntrada[] = [
  {
    nome: "Orçamento interno",
    area: "Financeiro",
    tipo: "palavra-chave",
    padrao: "orçamento, budget",
    risco: "medio",
    ativo: true,
  },
  {
    nome: "Cronograma de projeto",
    area: "Projetos e Estratégias",
    tipo: "palavra-chave",
    padrao: "cronograma, roadmap, cronograma do projeto",
    risco: "medio",
    ativo: true,
  },
  {
    nome: "Documento confidencial",
    area: "Segurança da Informação",
    tipo: "palavra-chave",
    padrao: "confidencial, uso interno, confidential",
    risco: "medio",
    ativo: true,
  },
  {
    nome: "Dados de clientes",
    area: "Segurança da Informação",
    tipo: "palavra-chave",
    padrao: "lista de clientes, base de clientes, customer list",
    risco: "alto",
    ativo: true,
  },
  {
    nome: "Nome do colaborador",
    area: "RH",
    tipo: "palavra-chave",
    padrao: "nome do colaborador, nome do funcionário",
    risco: "baixo",
    ativo: true,
  },
];

const AREAS_ORDENADAS = [...AREAS_SEED].sort((a, b) =>
  a.nome.localeCompare(b.nome, "pt-BR"),
);

const TEXTO_INICIAL =
  "Preciso revisar o orçamento interno do trimestre e o cronograma do projeto Atlas antes da reunião de segunda.";

const EXEMPLOS_DEMO = [
  {
    rotulo: "Baixo",
    texto: "Pode revisar o nome do colaborador citado neste rascunho antes de enviar?",
    rotacao: true,
    risco: "baixo",
  },
  {
    rotulo: "Médio",
    texto:
      "Preciso revisar o orçamento interno do trimestre e o cronograma do projeto Atlas.",
    rotacao: true,
    risco: "medio",
  },
  {
    rotulo: "Alto",
    texto: "Estou com erro na API. Minha chave é sk-proj-8fJ2kLm9Qr4Tz7Xb1Nc6Vd3.",
    rotacao: true,
    risco: "alto",
  },
  {
    rotulo: "Sem detecção",
    texto: "Pode revisar a redação deste e-mail de agradecimento para o cliente?",
    rotacao: false,
    risco: "sem_deteccao",
  },
] as const;

const ESTILO_EXEMPLO: Record<(typeof EXEMPLOS_DEMO)[number]["risco"], string> = {
  baixo:
    "border-risco-baixo/35 bg-transparent text-risco-baixo hover:bg-risco-baixo-bg/55",
  medio:
    "border-risco-medio/35 bg-transparent text-risco-medio hover:bg-risco-medio-bg/55",
  alto:
    "border-risco-alto/35 bg-transparent text-risco-alto hover:bg-risco-alto-bg/55",
  sem_deteccao:
    "border-border bg-transparent text-muted-foreground hover:bg-muted/35",
};

const PILARES: Array<{ titulo: string; texto: string; Icon: LucideIcon }> = [
  {
    titulo: "Avisa antes do envio",
    texto: "O alerta aparece no campo de texto, antes de o conteúdo sair da empresa.",
    Icon: ShieldAlert,
  },
  {
    titulo: "Ensina no momento certo",
    texto: "Uma mensagem curta explica o risco e o que fazer com o conteúdo.",
    Icon: MessageSquare,
  },
  {
    titulo: "Registra a decisão",
    texto: "O painel acompanha envios e cancelamentos por IA e departamento.",
    Icon: BarChart3,
  },
  {
    titulo: "Controla o risco, não a conversa",
    texto: "O conteúdo não é guardado. O painel recebe apenas o registro do alerta.",
    Icon: LockKeyhole,
  },
];

const ETAPAS = [
  {
    numero: "01",
    titulo: "Implantação em minutos",
    texto:
      "A extensão é instalada no Chrome ou no Edge com o código de verificação fornecido pelo painel.",
  },
  {
    numero: "02",
    titulo: "Detecção no campo de texto",
    texto:
      "A extensão localiza a caixa de texto de cada IA. Texto, colagens e anexos entram na análise.",
  },
  {
    numero: "03",
    titulo: "Aviso antes do envio",
    texto:
      "Orienta o colaborador e pede confirmação em risco médio ou alto. Não bloqueia o envio: a decisão continua com ele.",
  },
  {
    numero: "04",
    titulo: "Auditoria sem conteúdo",
    texto:
      "O painel recebe só metadados do alerta (colaborador, departamento, nível e decisão), nunca o conteúdo.",
  },
];

type Recurso = { titulo: string; texto: string; Icon: LucideIcon };

const RECURSOS: Array<{ grupo: string; itens: Recurso[] }> = [
  {
    grupo: "Análise",
    itens: [
      {
        titulo: "Imagens",
        texto:
          "O texto é extraído por OCR no próprio computador, classificado e descartado. A imagem nunca é enviada.",
        Icon: ScanText,
      },
      {
        titulo: "PDFs",
        texto: "O texto é extraído localmente e passa pela mesma análise.",
        Icon: FileText,
      },
      {
        titulo: "Colagens grandes",
        texto:
          "A colagem é analisada antes de chegar ao site. Blocos longos, listas e código têm classificação própria.",
        Icon: ClipboardPaste,
      },
    ],
  },
  {
    grupo: "Administração",
    itens: [
      {
        titulo: "Gestão centralizada",
        texto:
          "IAs autorizadas, ativação e departamentos são definidos no painel e valem para todas as extensões.",
        Icon: SlidersHorizontal,
      },
      {
        titulo: "Relatórios",
        texto:
          "Os alertas filtrados por data, departamento e nível podem ser exportados em CSV ou PDF.",
        Icon: BarChart3,
      },
      {
        titulo: "Histórico de atividades",
        texto:
          "Cada alteração administrativa fica registrada com autor, ação e horário para auditoria.",
        Icon: History,
      },
    ],
  },
];

const CONTEUDO = "mx-auto w-full max-w-[88rem] px-6 sm:px-10 lg:px-14";
const SECAO_CONTEUDO = `${CONTEUDO} flex min-h-[calc(100svh-4.5rem)] flex-col justify-center py-20 lg:py-24`;

const fade = {
  initial: { opacity: 0, y: 10 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

function Icone({ icon: IconeComponente }: { icon: LucideIcon }) {
  return (
    <span className="inline-flex size-8 items-center justify-center border border-border bg-muted/50 text-muted-foreground">
      <IconeComponente className="size-4" strokeWidth={1.5} aria-hidden />
    </span>
  );
}

export default function Landing() {
  const [texto, setTexto] = useState(TEXTO_INICIAL);
  const regras = useMemo<RegraEntrada[]>(() => REGRAS_DEMO, []);
  const { analise, analisando } = useAnaliseComDebounce(texto, regras);
  const [analiseExibida, setAnaliseExibida] = useState(analise);
  const [digitando, setDigitando] = useState(false);
  const digitandoDemo = useRef(false);
  const mensagem = analiseExibida.deteccoes.length
    ? MENSAGENS_PADRAO[analiseExibida.nivel]
    : MENSAGENS_PADRAO.sem_deteccao;
  // No preview do Freebuff, o painel Flask é servido no mesmo host pelo proxy
  // do Vite. Em um build publicado, VITE_SENTINELA_URL aponta para o servidor
  // Flask oficial.
  const destino =
    import.meta.env.DEV || !URL_PAINEL ? "/painel" : `${URL_PAINEL}/painel`;
  const reduzirMovimento = useReducedMotion();
  const pausado = useRef(false);
  const timerRotacao = useRef<number | null>(null);
  const timerDigitacao = useRef<number | null>(null);
  const timerRetomada = useRef<number | null>(null);
  const retomadaPendente = useRef(false);
  const indiceDemo = useRef(1);
  const [recomeco, setRecomeco] = useState(0);

  useEffect(() => {
    if (!digitandoDemo.current) setAnaliseExibida(analise);
  }, [analise]);

  function pararDemo() {
    pausado.current = true;
    if (timerRotacao.current !== null) window.clearTimeout(timerRotacao.current);
    if (timerRetomada.current !== null) window.clearTimeout(timerRetomada.current);
    timerRetomada.current = null;
    if (timerDigitacao.current !== null) {
      window.clearInterval(timerDigitacao.current);
      timerDigitacao.current = null;
      digitandoDemo.current = false;
      setDigitando(false);
    }
  }

  function retomarDepoisDeDezSegundos() {
    if (reduzirMovimento) return;
    if (timerRetomada.current !== null) window.clearTimeout(timerRetomada.current);
    timerRetomada.current = window.setTimeout(() => {
      timerRetomada.current = null;
      retomadaPendente.current = true;
      pausado.current = false;
      setRecomeco((atual) => atual + 1);
    }, 10000);
  }

  useEffect(() => {
    if (reduzirMovimento) return;
    pausado.current = false;
    const retomando = retomadaPendente.current;
    retomadaPendente.current = false;
    const rotacao = EXEMPLOS_DEMO.filter((exemplo) => exemplo.rotacao);
    // A prévia abre no risco médio; o primeiro giro automático mostra o alto.
    let indice = indiceDemo.current;
    let cancelado = false;

    const limpar = () => {
      if (timerRotacao.current !== null) window.clearTimeout(timerRotacao.current);
      if (timerDigitacao.current !== null) window.clearInterval(timerDigitacao.current);
      if (timerRetomada.current !== null) window.clearTimeout(timerRetomada.current);
      timerRotacao.current = null;
      timerDigitacao.current = null;
      timerRetomada.current = null;
    };

    const digitar = (alvo: string, aoFinal: () => void) => {
      if (timerDigitacao.current !== null) window.clearInterval(timerDigitacao.current);
      let posicao = 0;
      digitandoDemo.current = true;
      setDigitando(true);
      setTexto("");
      timerDigitacao.current = window.setInterval(() => {
        if (cancelado || pausado.current) {
          if (timerDigitacao.current !== null) window.clearInterval(timerDigitacao.current);
          return;
        }
        posicao += 1;
        setTexto(alvo.slice(0, posicao));
        if (posicao >= alvo.length) {
          if (timerDigitacao.current !== null) window.clearInterval(timerDigitacao.current);
          timerDigitacao.current = null;
          digitandoDemo.current = false;
          setDigitando(false);
          setAnaliseExibida(analisarTexto(alvo, regras));
          aoFinal();
        }
      }, 16);
    };

    const proximo = () => {
      if (cancelado || pausado.current) return;
      indice = (indice + 1) % rotacao.length;
      indiceDemo.current = indice;
      digitar(rotacao[indice].texto, () => {
        if (cancelado || pausado.current) return;
        timerRotacao.current = window.setTimeout(proximo, 3800);
      });
    };

    timerRotacao.current = window.setTimeout(proximo, retomando ? 0 : 4200);
    return () => {
      cancelado = true;
      limpar();
    };
  }, [reduzirMovimento, regras, recomeco]);

  function escolherExemplo(novoTexto: string) {
    pararDemo();

    if (reduzirMovimento) {
      setTexto(novoTexto);
      setAnaliseExibida(analisarTexto(novoTexto, regras));
      return;
    }

    const rotacao = EXEMPLOS_DEMO.filter((exemplo) => exemplo.rotacao);
    const posicaoNaRotacao = rotacao.findIndex((exemplo) => exemplo.texto === novoTexto);
    if (posicaoNaRotacao >= 0) indiceDemo.current = posicaoNaRotacao;

    if (timerDigitacao.current !== null) window.clearInterval(timerDigitacao.current);
    let posicao = 0;
    digitandoDemo.current = true;
    setDigitando(true);
    setTexto("");
    timerDigitacao.current = window.setInterval(() => {
      posicao += 1;
      setTexto(novoTexto.slice(0, posicao));
      if (posicao >= novoTexto.length) {
        if (timerDigitacao.current !== null) window.clearInterval(timerDigitacao.current);
        timerDigitacao.current = null;
        digitandoDemo.current = false;
        setDigitando(false);
        setAnaliseExibida(analisarTexto(novoTexto, regras));
        // O risco escolhido fica parado por 10 s; depois a rotação continua.
        retomarDepoisDeDezSegundos();
      }
    }, 16);
  }

  const animacaoSecao = reduzirMovimento ? {} : fade;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className={`${CONTEUDO} flex items-center justify-between gap-6 py-4`}>
          <Link to="/" className="flex items-center gap-2.5" aria-label="Sentinela, página inicial">
            <img src="/logo.png?v=4.0.7" alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain" />
            <span className="flex flex-col">
              <span className="font-serif text-2xl leading-none tracking-tight">Sentinela</span>
              <span className="rotulo mt-1 leading-none">governança de ia</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Navegação principal">
            <a href="#problema" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Problema
            </a>
            <a href="#privacidade" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Privacidade
            </a>
            <a href="#matriz" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Matriz de risco
            </a>
            <a href="#funciona" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Como funciona
            </a>
            <a href="#letramento" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Letramento
            </a>
          </nav>

          <Button asChild variant="outline" className="rounded-sm">
            <a href={destino}>
              Entrar
              <ArrowUpRight className="size-3.5" />
            </a>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="w-full">
          <div className={`${CONTEUDO} grid min-h-[calc(100svh-4.5rem)] items-center gap-14 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-20 lg:py-20`}>
            <motion.div
              initial={reduzirMovimento ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1 className="max-w-[15ch] font-serif text-[2.8rem] leading-[0.98] tracking-tight text-balance sm:text-6xl lg:text-[4.6rem]">
                O que é confidencial não deveria virar <em className="italic">prompt</em>.
              </h1>
              <p className="mt-7 max-w-xl text-justify text-sm leading-7 text-muted-foreground">
                Painel de governança e letramento em IA para reduzir o vazamento de informações
                corporativas. A extensão analisa localmente o que é digitado no ChatGPT, Gemini,
                Claude e Copilot e avisa antes do envio. O texto é analisado no navegador e não é
                armazenado; o painel recebe apenas o registro do alerta.
              </p>
              <p className="mt-3 max-w-xl text-xs leading-6 text-muted-foreground">
                Você define as regras, os departamentos e a tolerância. O Sentinela cuida do resto.
              </p>

              <div className="mt-8 flex flex-wrap gap-2.5">
                <Button asChild className="rounded-sm">
                  <a href={destino}>
                    Entrar no painel
                    <ArrowUpRight className="size-3.5" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="rounded-sm">
                  <a href="#matriz">
                    Explorar a matriz
                    <ArrowRight className="size-3.5" />
                  </a>
                </Button>
              </div>

              <div className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-border pt-5">
                <div>
                  <p className="font-serif text-2xl leading-none">40+</p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">regras iniciais</p>
                </div>
                <div>
                  <p className="font-serif text-2xl leading-none">4</p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">IAs monitoradas</p>
                </div>
                <div>
                  <p className="font-serif text-2xl leading-none">0</p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">conteúdo guardado</p>
                </div>
              </div>
            </motion.div>

            {/* Demonstração ao vivo */}
            <motion.div
              initial={reduzirMovimento ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="relative border border-border bg-card shadow-[0_24px_70px_rgba(27,27,26,0.1)]">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
                  <span className="font-mono text-[11px] text-muted-foreground">IAexemplo.com</span>
                  <span className="rotulo">prévia</span>
                </div>

                <Textarea
                  value={texto}
                  readOnly
                  tabIndex={-1}
                  aria-label="Texto de demonstração (somente leitura)"
                  className="pointer-events-none min-h-40 cursor-default resize-none rounded-none border-0 bg-card px-4 py-4 text-sm leading-6 shadow-none focus-visible:ring-0"
                />

                <div className="border-t border-border bg-card p-3">
                  <BannerRisco
                    nivel={analiseExibida.nivel}
                    deteccoes={analiseExibida.deteccoes}
                    mensagem={mensagem}
                    analisando={analisando && !digitando}
                    className="border-0 transition-colors duration-300"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border bg-card px-4 py-3">
                  <span className="rotulo">Testar</span>
                  {EXEMPLOS_DEMO.map((exemplo) => (
                    <button
                      key={exemplo.rotulo}
                      type="button"
                      onClick={() => escolherExemplo(exemplo.texto)}
                      className={`inline-flex min-h-5 items-center gap-1.5 border px-1.5 py-0.5 text-[10px] leading-4 font-medium transition-colors ${ESTILO_EXEMPLO[exemplo.risco]}`}
                    >
                      {exemplo.risco !== "sem_deteccao" && (
                        <span className="size-1 rounded-full bg-current" aria-hidden />
                      )}
                      {exemplo.rotulo}
                    </button>
                  ))}
                </div>
              </div>

              <p className="mt-3 text-right font-mono text-[10px] text-muted-foreground">
                análise local · nenhum texto é enviado ao painel
              </p>
            </motion.div>
          </div>
        </section>

        {/* Faixa de sites monitorados */}
        <div className="border-y border-border bg-muted/25">
          <div className={`${CONTEUDO} flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between`}>
            <span className="rotulo">IAs monitoradas</span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
              {FERRAMENTAS_MONITORADAS.map((site, indice) => (
                <span key={site} className="flex items-center gap-3">
                  {indice > 0 && <span className="text-border">/</span>}
                  {site}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* O problema */}
        <motion.section id="problema" {...animacaoSecao} className="w-full border-b border-border">
          <div className={`${CONTEUDO} grid min-h-[calc(100svh-4.5rem)] items-center gap-14 py-20 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-24 lg:py-24`}>
            <div>
              <p className="rotulo">O problema</p>
              <h2 className="mt-5 max-w-2xl font-serif text-4xl leading-[1.04] tracking-tight text-balance lg:text-5xl">
                A política existe. O hábito não acompanha.
              </h2>
              <p className="mt-6 max-w-lg text-justify text-sm leading-7 text-muted-foreground">
                As pessoas querem automatizar tarefas simples, e a IA virou o caminho mais rápido.
                O problema é que uma tarefa simples pode custar caro quando leva dados
                confidenciais junto.
              </p>
            </div>

            <div className="border-t border-border">
              {[
                {
                  titulo: "A IA pública virou atalho",
                  texto:
                    "Reescrever e-mails, depurar código, resumir contratos: tarefas legítimas que, com frequência, envolvem dados sensíveis.",
                },
                {
                  titulo: "O vazamento não parece vazamento",
                  texto:
                    "Um CPF no meio de uma frase, um token colado para pedir ajuda. Nenhum antivírus reage a isso, e o jurídico só descobre depois.",
                },
                {
                  titulo: "Sem registro, não há gestão",
                  texto:
                    "Quem enviou, com que risco, em qual departamento? Sem auditoria, a política de uso de IA fica só no papel.",
                },
              ].map((item) => (
                <div key={item.titulo} className="border-b border-border py-7">
                  <h3 className="text-sm font-medium">{item.titulo}</h3>
                  <p className="mt-2 max-w-2xl text-justify text-sm leading-6 text-muted-foreground">
                    {item.texto}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* A solução */}
        <motion.section id="solucao" {...animacaoSecao} className="w-full border-b border-border bg-muted/25">
          <div className={SECAO_CONTEUDO}>
            <div className="max-w-3xl">
              <p className="rotulo">A solução</p>
              <h2 className="mt-5 font-serif text-4xl leading-[1.04] tracking-tight text-balance lg:text-5xl">
                O risco fica visível antes de virar vazamento.
              </h2>
            </div>
            <div className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {PILARES.map((item) => (
                <div key={item.titulo} className="bg-card p-7">
                  <Icone icon={item.Icon} />
                  <h3 className="mt-5 font-serif text-xl tracking-tight">{item.titulo}</h3>
                  <p className="mt-2 text-justify text-sm leading-6 text-muted-foreground">
                    {item.texto}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Privacidade */}
        <motion.section id="privacidade" {...animacaoSecao} className="w-full border-b border-border">
          <div className={SECAO_CONTEUDO}>
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="rotulo">Privacidade</p>
                <h2 className="mt-5 max-w-2xl font-serif text-4xl leading-[1.04] tracking-tight text-balance lg:text-5xl">
                  Controle do risco, não da conversa.
                </h2>
                <p className="mt-6 max-w-xl text-justify text-sm leading-7 text-muted-foreground">
                  O conteúdo é analisado no navegador e não é armazenado. O painel recebe apenas o
                  registro do alerta, nunca o texto, a imagem ou o PDF.
                </p>
              </div>

              <div className="hidden w-full max-w-md shrink-0 border border-border bg-card p-5 lg:block" aria-hidden>
                <div className="flex items-center justify-between gap-4">
                  <span className="rotulo">Fluxo do conteúdo</span>
                </div>
                <div className="relative mt-8">
                  <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-border" />
                  <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
                    <div className="border border-border bg-background px-2 py-3 text-center">
                      <p className="font-serif text-sm tracking-tight">Texto</p>
                      <p className="mt-1 font-mono text-[8px] tracking-wider text-muted-foreground uppercase">chat</p>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <div className="border border-border bg-background px-2 py-3 text-center">
                      <p className="font-serif text-sm tracking-tight">Alerta</p>
                      <p className="mt-1 font-mono text-[8px] tracking-wider text-muted-foreground uppercase">extensão</p>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <div className="border border-border bg-background px-2 py-3 text-center">
                      <p className="font-serif text-sm tracking-tight">Registro</p>
                      <p className="mt-1 font-mono text-[8px] tracking-wider text-muted-foreground uppercase">painel</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 grid border-y border-border md:grid-cols-2">
              <div className="border-b border-border p-7 md:border-r md:border-b-0 lg:p-9">
                <p className="rotulo">Chega ao painel</p>
                <p className="mt-3 text-justify text-sm leading-6 text-muted-foreground">
                  IA, departamento, colaborador, origem, nível, categorias e decisão.
                </p>
              </div>
              <div className="p-7 lg:p-9">
                <p className="rotulo">Nunca chega</p>
                <p className="mt-3 text-justify text-sm leading-6 text-muted-foreground">
                  Texto, imagens, PDFs.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 border border-border bg-card p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-5">
              <p className="rotulo">Acesso controlado</p>
              <p className="text-justify text-sm leading-6 text-muted-foreground">
                O código de verificação não dá acesso ao painel.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Matriz */}
        <motion.section id="matriz" {...animacaoSecao} className="w-full border-b border-border bg-muted/25">
          <div className={SECAO_CONTEUDO}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="rotulo">Matriz de risco</p>
                <h2 className="mt-5 font-serif text-4xl leading-[1.04] tracking-tight lg:text-5xl">
                  {AREAS_ORDENADAS.length} departamentos, uma escala de risco.
                </h2>
              </div>
              <p className="max-w-sm text-xs leading-6 text-muted-foreground">
                O maior nível encontrado define o alerta. As regras funcionam em português e inglês.
              </p>
            </div>

            <div className="mt-10 overflow-x-auto border border-border bg-card">
              <table className="w-full min-w-[900px] border-collapse text-left align-top">
                <thead>
                  <tr className="border-b border-border">
                    <th className="rotulo py-3 pr-5 pl-5 font-normal">Departamento</th>
                    {(["baixo", "medio", "alto"] as Risco[]).map((risco) => (
                      <th key={risco} className="rotulo py-3 pr-5 font-normal">
                        <span className="flex items-center gap-2">
                          <span
                            className={
                              risco === "baixo"
                                ? "size-1.5 rounded-full bg-risco-baixo"
                                : risco === "medio"
                                  ? "size-1.5 rounded-full bg-risco-medio"
                                  : "size-1.5 rounded-full bg-risco-alto"
                            }
                            aria-hidden
                          />
                          {risco === "baixo" ? "Baixo" : risco === "medio" ? "Médio" : "Alto"}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {AREAS_ORDENADAS.map((area) => {
                    const porRisco = (nivel: Risco) =>
                      area.regras.filter((regra) => regra.risco === nivel);
                    return (
                      <tr key={area.nome} className="border-b border-border/70 last:border-b-0">
                        <td className="py-5 pr-5 pl-5 align-top">
                          <span className="block text-xs font-medium">{area.nome}</span>
                          <span className="mt-1 block max-w-[15rem] text-[10px] leading-4 text-muted-foreground">
                            {area.descricao}
                          </span>
                        </td>
                        {(["baixo", "medio", "alto"] as Risco[]).map((nivel) => (
                          <td key={nivel} className="py-5 pr-5 align-top">
                            <ul className="flex flex-col gap-1">
                              {porRisco(nivel).map((regra) => (
                                <li
                                  key={regra.nome}
                                  className="text-[11px] leading-4 text-muted-foreground"
                                >
                                  {regra.nome}
                                </li>
                              ))}
                            </ul>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-7 grid gap-px border border-border bg-border sm:grid-cols-3">
              {[
                {
                  titulo: "Mais de 40 regras iniciais",
                  texto: "Cobertura pronta para os principais departamentos da empresa.",
                },
                {
                  titulo: "Validações técnicas",
                  texto: "CPF, CNPJ, cartões, tokens, senhas e código-fonte.",
                },
                {
                  titulo: "Palavra-chave ou regex",
                  texto: "Crie regras próprias no painel, sem depender de uma nova versão.",
                },
              ].map((item) => (
                <div key={item.titulo} className="bg-card p-5">
                  <h3 className="text-xs font-medium">{item.titulo}</h3>
                  <p className="mt-2 text-justify text-[11px] leading-5 text-muted-foreground">
                    {item.texto}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-4 text-justify text-[11px] text-muted-foreground">
              Regras editáveis no painel; as extensões recebem as alterações automaticamente.
            </p>
          </div>
        </motion.section>

        {/* Como funciona */}
        <motion.section id="funciona" {...animacaoSecao} className="w-full border-b border-border">
          <div className={SECAO_CONTEUDO}>
            <div>
              <p className="rotulo">Como funciona</p>
              <h2 className="mt-5 font-serif text-4xl leading-[1.04] tracking-tight lg:text-5xl">
                Do campo de texto à auditoria.
              </h2>
            </div>

            <div className="mt-12 grid gap-x-10 gap-y-10 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-4">
              {ETAPAS.map((etapa) => (
                <div key={etapa.numero}>
                  <p className="tabular text-[10px] text-muted-foreground">{etapa.numero}</p>
                  <h3 className="mt-3 font-serif text-xl tracking-tight">{etapa.titulo}</h3>
                  <p className="mt-2 text-justify text-sm leading-6 text-muted-foreground">
                    {etapa.texto}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 space-y-10 border-t border-border pt-8">
              {RECURSOS.map((grupo, indice) => (
                <div key={grupo.grupo} className={indice > 0 ? "border-t border-border pt-8" : undefined}>
                  <p className="rotulo">{grupo.grupo}</p>
                  <div className="mt-5 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
                    {grupo.itens.map((recurso) => (
                      <div key={recurso.titulo} className="bg-card p-6">
                        <Icone icon={recurso.Icon} />
                        <h3 className="mt-4 text-xs font-medium">{recurso.titulo}</h3>
                        <p className="mt-1.5 text-justify text-xs leading-5 text-muted-foreground">
                          {recurso.texto}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Letramento */}
        <motion.section id="letramento" {...animacaoSecao} className="w-full bg-foreground text-background">
          <div className={`${CONTEUDO} grid min-h-[calc(100svh-4.5rem)] items-center gap-14 py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-24`}>
            <div>
              <p className="text-[10px] font-medium tracking-[0.22em] text-background/50 uppercase">
                Letramento
              </p>
              <h2 className="mt-5 max-w-2xl font-serif text-4xl leading-[1.04] tracking-tight text-balance lg:text-5xl">
                “Enviou mesmo assim” é o número que importa.
              </h2>
              <p className="mt-6 max-w-xl text-justify text-sm leading-7 text-background/65">
                O painel compara envios e cancelamentos por departamento. Não para punir, mas para
                mostrar onde o aviso ainda não está funcionando e onde o letramento precisa ser
                reforçado.
              </p>
            </div>

            <div className="lg:border-l lg:border-background/15 lg:pl-12">
              <p className="max-w-sm font-serif text-5xl leading-[0.95] tracking-tight">
                Tolerância (%)
              </p>
              <p className="mt-4 max-w-sm text-justify text-sm leading-6 text-background/65">
                Quando a proporção de alertas de risco alto de um departamento atinge ou passa do
                limite definido no painel, com no mínimo três registros, ele é marcado como crítico.
              </p>

              <div className="mt-6 flex flex-wrap gap-2 text-[10px] tracking-[0.08em] uppercase">
                <span className="border border-background/25 px-2 py-1 text-background/70">Normal</span>
                <span className="border border-risco-medio/60 px-2 py-1 text-risco-medio">Em observação</span>
                <span className="border border-risco-alto/60 px-2 py-1 text-risco-alto">Crítico</span>
              </div>

              <div className="mt-8 border-t border-background/15 pt-4">
                <p className="text-[10px] tracking-[0.18em] text-background/45 uppercase">Como ler</p>
                <p className="mt-2 text-justify text-xs leading-6 text-background/60">
                  Muitos cancelamentos indicam que o aviso está funcionando. Muitos envios em risco
                  alto indicam que o aviso precisa de contexto, treinamento ou uma ferramenta
                  corporativa autorizada.
                </p>
                <p className="mt-4 text-justify text-xs leading-6 text-background/70">
                  Use esse indicador para decidir onde investir em treinamento: comece pelos
                  departamentos críticos e acompanhe a evolução dos que estão em observação.
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section {...animacaoSecao} className="w-full">
          <div className={`${CONTEUDO} grid min-h-[calc(100svh-4.5rem)] items-center gap-14 py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-24`}>
            <div>
              <p className="rotulo">Painel administrativo</p>
              <h2 className="mt-5 max-w-2xl font-serif text-4xl leading-[1.04] tracking-tight text-balance lg:text-5xl">
                Comece pelo painel. Depois instale a extensão.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">
                O painel é de uso exclusivo dos administradores: regras, departamentos, mensagens
                educativas, auditoria e relatórios de letramento em um só lugar. Os colaboradores não
                fazem login; usam apenas a extensão.
              </p>
              <div className="mt-8 flex flex-wrap gap-2.5">
                <Button asChild className="rounded-sm">
                  <a href={destino}>
                    Entrar no painel
                    <ArrowUpRight className="size-3.5" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="rounded-sm">
                  <a href="#privacidade">
                    Entender a privacidade
                    <ShieldCheck className="size-3.5" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px border border-border bg-border">
              {[
                { titulo: "Regras e departamentos", texto: "Matriz editável em português e inglês." },
                { titulo: "Alertas e retenção", texto: "Filtros, paginação e exportação em CSV ou PDF." },
                { titulo: "Monitoramento", texto: "IAs autorizadas, dispositivos e ocorrências." },
                { titulo: "Letramento", texto: "Envios e cancelamentos por departamento." },
              ].map((item, indice) => (
                <div key={item.titulo} className="bg-card p-6">
                  <span className="font-mono text-[10px] text-muted-foreground">0{indice + 1}</span>
                  <h3 className="mt-3 text-xs font-medium">{item.titulo}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{item.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="border-t border-border bg-muted/20">
        <div className={`${CONTEUDO} flex flex-col gap-8 py-10 lg:flex-row lg:items-start lg:justify-between`}>
          <div>
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/logo.png?v=4.0.7"
                alt=""
                aria-hidden="true"
                className="h-7 w-7 shrink-0 object-contain"
              />
              <span className="font-serif text-xl leading-none tracking-tight">Sentinela</span>
              <span className="rotulo leading-none">governança de ia</span>
            </Link>
            <p className="mt-3 max-w-sm text-[11px] leading-5 text-muted-foreground">
              Painel de governança, auditoria e letramento em IA.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-14 gap-y-6 text-[11px]">
            <div className="flex flex-col gap-2">
              <span className="rotulo">Painel</span>
              <a href={destino} className="text-muted-foreground hover:text-foreground">
                Entrar
              </a>
            </div>
            <div className="flex flex-col gap-2">
              <span className="rotulo">Projeto</span>
              <a href="#privacidade" className="text-muted-foreground hover:text-foreground">
                Privacidade
              </a>
              <a href="#matriz" className="text-muted-foreground hover:text-foreground">
                Matriz de risco
              </a>
              <a href="#funciona" className="text-muted-foreground hover:text-foreground">
                Como funciona
              </a>
              <a href="/sentinela-projeto.zip" download className="text-muted-foreground hover:text-foreground">
                Baixar projeto
              </a>
              <a href="/sentinela-extensao.zip" download className="text-muted-foreground hover:text-foreground">
                Baixar extensão
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-border">
          <div className={`${CONTEUDO} flex flex-col gap-2 py-4 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between`}>
            <span>© {new Date().getFullYear()} Sentinela</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
