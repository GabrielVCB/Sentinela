import { useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { useAnaliseComDebounce } from "@/hooks/use-analise";
import { BaixarProjetoLink } from "@/components/BaixarProjeto";
import { BannerRisco } from "@/components/painel/BannerRisco";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AREAS_SEED,
  FERRAMENTAS_MONITORADAS,
  MENSAGENS_PADRAO,
  type Risco,
} from "@/lib/dados";
import type { RegraEntrada } from "@/lib/detectores";
import { ArrowUpRight } from "lucide-react";

// A prévia não tem login próprio: o painel real é servido pelo Flask.
// Configure VITE_SENTINELA_URL com a URL pública do servidor.
const URL_PAINEL = (
  (import.meta.env.VITE_SENTINELA_URL as string | undefined) ||
  "https://sentinela.suaempresa.com"
).replace(/\/+$/, "");
const REGRAS_DEMO: RegraEntrada[] = AREAS_SEED.flatMap((area) =>
  area.regras.map((regra) => ({
    ...regra,
    area: area.nome,
    ativo: true,
  })),
);
const AREAS_ORDENADAS = [...AREAS_SEED].sort((a, b) =>
  a.nome.localeCompare(b.nome, "pt-BR"),
);

const TEXTO_INICIAL =
  "Preciso revisar o orçamento interno do trimestre e o cronograma do projeto Atlas antes da reunião de segunda.";

const EXEMPLOS_DEMO = [
  {
    rotulo: "Baixo",
    texto: "Pode revisar a redação deste e-mail de agradecimento para o cliente?",
  },
  {
    rotulo: "Médio",
    texto: "Preciso revisar o orçamento interno do trimestre e o cronograma do projeto Atlas.",
  },
  {
    rotulo: "Alto",
    texto: "Estou com erro na API. Minha chave é sk-proj-8fJ2kLm9Qr4Tz7Xb1Nc6Vd3.",
  },
];

const ETAPAS = [
  {
    numero: "01",
    titulo: "Implantação em minutos",
    texto: "A extensão é instalada no Chrome ou no Edge com o código de verificação fornecido pelo painel.",
  },
  {
    numero: "02",
    titulo: "Detecção no campo de texto",
    texto:                  "A extensão localiza a caixa de texto de cada IA. Texto, colagens e anexos entram na análise.",
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
      "O painel recebe só metadados do alerta (colaborador, departamento, IP, nível e decisão), nunca o conteúdo.",
  },
];

const RECURSOS = [
  {
    grupo: "Análise",
    itens: [
      {
        titulo: "Imagens",
        texto:
          "O texto é extraído por OCR no próprio computador, classificado e descartado. A imagem nunca é enviada.",
      },
      {
        titulo: "PDFs",
        texto: "O texto é extraído localmente e passa pela mesma análise.",
      },
      {
        titulo: "Colagens grandes",
        texto:
          "A colagem é analisada antes de chegar ao site. Blocos longos, listas e código têm classificação própria.",
      },
    ],
  },
  {
    grupo: "Administração",
    itens: [
      {
        titulo: "Gestão centralizada",
        texto:
          "IAs monitoradas, ativação e departamentos são definidos no painel e valem para todas as extensões.",
      },
      {
        titulo: "Relatórios",
        texto:
          "Os alertas filtrados por data, departamento e nível podem ser exportados em CSV ou PDF.",
      },
    ],
  },
];

const fade = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

export default function Landing() {
  const [texto, setTexto] = useState(TEXTO_INICIAL);
  const regras = useMemo<RegraEntrada[]>(() => REGRAS_DEMO, []);
  const { analise, analisando } = useAnaliseComDebounce(texto, regras);
  const mensagem = analise.deteccoes.length
    ? MENSAGENS_PADRAO[analise.nivel]
    : MENSAGENS_PADRAO.sem_deteccao;
  const destino = `${URL_PAINEL}/painel`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-baseline gap-2.5" aria-label="Sentinela, página inicial">
            <span className="font-serif text-2xl leading-none tracking-tight">Sentinela</span>
            <span className="rotulo hidden sm:inline">governança de ia</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Navegação principal">
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
        <section className="mx-auto w-full max-w-6xl px-5 pt-14 pb-16 sm:px-8 lg:pt-24 lg:pb-24">
          <div className="grid items-start gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1 className="max-w-xl font-serif text-[2.45rem] leading-[0.98] tracking-tight text-balance sm:text-6xl lg:text-[4.15rem]">
                O que é confidencial não deveria virar <em className="italic">prompt</em>.
              </h1>
              <p className="mt-7 max-w-md text-justify text-sm leading-7 text-muted-foreground">
                Painel de governança e letramento em IA para reduzir o vazamento de informações
                corporativas. A extensão analisa localmente o que é digitado no ChatGPT, Gemini,
                Claude e Copilot e avisa antes do envio. O texto nunca sai do navegador.
              </p>
              <p className="mt-3 max-w-md text-xs leading-6 text-muted-foreground">
                Você define as regras, os departamentos e o limite de criticidade. O Sentinela
                cuida do resto.
              </p>


            </motion.div>

            {/* Demonstração ao vivo */}
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="border border-border bg-card">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                  <span className="font-mono text-[11px] text-muted-foreground">ChatGPT</span>
                  <span className="rotulo">prévia</span>
                </div>

                <Textarea
                  value={texto}
                  onChange={(evento) => setTexto(evento.target.value)}
                  aria-label="Texto de demonstração"
                  className="min-h-32 resize-none rounded-none border-0 bg-transparent px-4 py-4 text-sm leading-6 shadow-none focus-visible:ring-0"
                />

                <div className="border-t border-border bg-muted/30 p-3">
                  <BannerRisco
                    nivel={analise.nivel}
                    deteccoes={analise.deteccoes}
                    mensagem={mensagem}
                    analisando={analisando}
                    className="border-0"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
                  <span className="rotulo">Testar</span>
                  {EXEMPLOS_DEMO.map((exemplo) => (
                    <button
                      key={exemplo.rotulo}
                      type="button"
                      onClick={() => setTexto(exemplo.texto)}
                      className="border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                    >
                      {exemplo.rotulo}
                    </button>
                  ))}
                </div>
              </div>

            </motion.div>
          </div>
        </section>

        {/* Faixa de sites monitorados */}
        <div className="border-y border-border">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
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
        <motion.section
          id="problema"
          {...fade}
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28"
        >
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
            <div>
              <p className="rotulo">O problema</p>
              <h2 className="mt-5 font-serif text-4xl leading-[1.05] tracking-tight text-balance">
                A política existe. O hábito não acompanha.
              </h2>
              <p className="mt-5 max-w-sm text-justify text-sm leading-7 text-muted-foreground">
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
                <div key={item.titulo} className="border-b border-border py-6">
                  <h3 className="text-sm font-medium">{item.titulo}</h3>
                  <p className="mt-2 max-w-lg text-justify text-sm leading-6 text-muted-foreground">
                    {item.texto}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* A solução */}
        <motion.section
          id="solucao"
          {...fade}
          className="scroll-mt-20 border-y border-border bg-muted/25"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="max-w-2xl">
              <p className="rotulo">A solução</p>
              <h2 className="mt-5 font-serif text-4xl leading-[1.05] tracking-tight text-balance lg:text-5xl">
                O risco fica visível antes de virar vazamento.
              </h2>
            </div>
            <div className="mt-12 grid gap-8 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
              {[
                {
                  titulo: "Avisa antes do envio",
                  texto: "O alerta aparece no campo de texto, antes de o conteúdo sair da empresa.",
                },
                {
                  titulo: "Ensina no momento certo",
                  texto: "Uma mensagem curta explica o risco e o que fazer com o conteúdo.",
                },
                {
                  titulo: "Registra a decisão",
                  texto: "O painel acompanha envios e cancelamentos por IA e departamento.",
                },
                {
                  titulo: "Controla o risco, não a conversa",
                  texto: "O conteúdo não é guardado. O que chega ao painel é apenas o registro do alerta.",
                },
              ].map((item) => (
                <div key={item.titulo}>
                  <h3 className="font-serif text-xl tracking-tight">{item.titulo}</h3>
                  <p className="mt-2 text-justify text-sm leading-6 text-muted-foreground">
                    {item.texto}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Privacidade */}
        <motion.section
          id="privacidade"
          {...fade}
          className="scroll-mt-20 border-y border-border bg-muted/25"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="rotulo">Privacidade</p>
                <h2 className="mt-5 max-w-xl font-serif text-4xl leading-[1.05] tracking-tight text-balance">
                  Controle do risco, não da conversa.
                </h2>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="relative hidden w-full max-w-sm shrink-0 overflow-hidden border border-border bg-background/60 p-5 lg:block"
                aria-hidden
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="rotulo">Fluxo do conteúdo</span>
                </div>

                <div className="relative mt-8">
                  <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-border" />
                  <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
                    <div className="border border-border bg-background px-2 py-3 text-center">
                      <p className="font-serif text-sm tracking-tight">Texto</p>
                      <p className="mt-1 font-mono text-[8px] tracking-wider text-muted-foreground uppercase">
                        chat
                      </p>
                    </div>
                    <span className="text-muted-foreground" aria-hidden>
                      →
                    </span>
                    <div className="border border-border bg-background px-2 py-3 text-center">
                      <p className="font-serif text-sm tracking-tight">Alerta</p>
                      <p className="mt-1 font-mono text-[8px] tracking-wider text-muted-foreground uppercase">
                        extensão
                      </p>
                    </div>
                    <span className="text-muted-foreground" aria-hidden>
                      →
                    </span>
                    <div className="border border-border bg-background px-2 py-3 text-center">
                      <p className="font-serif text-sm tracking-tight">Registro</p>
                      <p className="mt-1 font-mono text-[8px] tracking-wider text-muted-foreground uppercase">
                        painel
                      </p>
                    </div>
                  </div>
                </div>

              </motion.div>
            </div>

            <div className="mt-14 grid border-y border-border md:grid-cols-2">
              <div className="border-b border-border p-6 md:border-r md:border-b-0 lg:p-8">
                <p className="rotulo">Chega ao painel</p>
                <p className="mt-3 text-justify text-sm leading-6 text-muted-foreground">
                  IA, departamento, colaborador, IP, origem, nível, tipos e decisão.
                </p>
              </div>
              <div className="p-6 lg:p-8">
                <p className="rotulo">Nunca chega</p>
                <p className="mt-3 text-justify text-sm leading-6 text-muted-foreground">
                  Texto, imagens, PDFs.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-3 border border-border bg-background/60 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-5">
              <p className="rotulo">Acesso controlado</p>
              <p className="text-justify text-sm leading-6 text-muted-foreground">
                O código de verificação não dá acesso ao painel. Só o superadmin cria administradores.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Matriz */}
        <motion.section
          id="matriz"
          {...fade}
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="rotulo">Matriz de risco</p>
              <h2 className="mt-5 font-serif text-4xl leading-[1.05] tracking-tight">
                {AREAS_ORDENADAS.length} departamentos, uma escala de risco.
              </h2>
            </div>
            <p className="max-w-xs text-xs leading-6 text-muted-foreground">
              O maior nível encontrado define o alerta. As regras funcionam em português e inglês.
            </p>
          </div>

          <div className="mt-10 overflow-x-auto border-t border-border">
            <table className="w-full min-w-[820px] border-collapse text-left align-top">
              <thead>
                <tr className="border-b border-border">
                  <th className="rotulo py-3 pr-5 font-normal">Departamento</th>
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
                    <tr key={area.nome} className="border-b border-border/60">
                      <td className="py-5 pr-5 align-top">
                        <span className="block text-xs font-medium">{area.nome}</span>
                        <span className="mt-1 block max-w-[13rem] text-[10px] leading-4 text-muted-foreground">
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

          <div className="mt-8 grid border-y border-border sm:grid-cols-3">
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
            ].map((item, indice) => (
              <div
                key={item.titulo}
                className={
                  "py-5 sm:px-5 " +
                  (indice > 0 ? "border-t border-border sm:border-t-0 sm:border-l" : "")
                }
              >
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
        </motion.section>

        {/* Como funciona */}
        <motion.section
          id="funciona"
          {...fade}
          className="scroll-mt-20 border-y border-border bg-muted/25"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="rotulo">Como funciona</p>
                <h2 className="mt-5 font-serif text-4xl leading-[1.05] tracking-tight">
                  Do campo de texto à auditoria.
                </h2>
              </div>
            </div>

            <div className="mt-12 grid gap-x-10 gap-y-10 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-4">
              {ETAPAS.map((etapa) => (
                <div key={etapa.numero}>
                  <p className="tabular text-[10px] text-muted-foreground">{etapa.numero}</p>
                  <h3 className="mt-3 font-serif text-xl tracking-tight">{etapa.titulo}</h3>
                  <p className="mt-2 text-justify text-sm leading-6 text-muted-foreground">{etapa.texto}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 space-y-10 border-t border-border pt-8">
              {RECURSOS.map((grupo, indice) => (
                <div
                  key={grupo.grupo}
                  className={indice > 0 ? "border-t border-border pt-8" : undefined}
                >
                  <p className="rotulo">{grupo.grupo}</p>
                  <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {grupo.itens.map((recurso) => (
                      <div key={recurso.titulo}>
                        <h3 className="text-xs font-medium">{recurso.titulo}</h3>
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
        <motion.section
          id="letramento"
          {...fade}
          className="scroll-mt-20 bg-foreground text-background"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-20 lg:py-28">
            <div>
              <p className="text-[10px] font-medium tracking-[0.22em] text-background/50 uppercase">
                Letramento
              </p>
              <h2 className="mt-5 max-w-xl font-serif text-4xl leading-[1.05] tracking-tight text-balance lg:text-5xl">
                “Enviou mesmo assim” é o número que importa.
              </h2>
              <p className="mt-6 max-w-lg text-justify text-sm leading-7 text-background/65">
                O painel compara envios e cancelamentos por departamento. Não para punir, mas para
                mostrar onde o aviso ainda não está funcionando e onde o letramento precisa ser
                reforçado.
              </p>
            </div>

            <div className="lg:border-l lg:border-background/15 lg:pl-12">
              <p className="max-w-xs font-serif text-5xl leading-[0.95] tracking-tight">
                Limite de criticidade
              </p>
              <p className="mt-4 max-w-xs text-justify text-sm leading-6 text-background/65">
                Quando a proporção de alertas de risco alto de um departamento atinge ou passa do
                limite definido no painel, com no mínimo três registros, ele é marcado como crítico.
              </p>

              <div className="mt-6 flex flex-wrap gap-2 text-[10px] tracking-[0.08em] uppercase">
                <span className="border border-risco-alto/60 px-2 py-1 text-risco-alto">Crítico</span>
                <span className="border border-risco-medio/60 px-2 py-1 text-risco-medio">
                  Em observação
                </span>
                <span className="border border-background/25 px-2 py-1 text-background/70">
                  Normal
                </span>
              </div>

              <div className="mt-8 border-t border-background/15 pt-4">
                <p className="text-[10px] tracking-[0.18em] text-background/45 uppercase">
                  Como ler
                </p>
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
        <motion.section {...fade} className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="flex flex-col items-center border-y border-border py-16 text-center lg:py-20">
            <p className="rotulo">Painel administrativo</p>
            <h2 className="mt-5 max-w-2xl font-serif text-4xl leading-[1.05] tracking-tight text-balance lg:text-5xl">
              Comece pelo painel. Depois instale a extensão.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
              O painel é de uso exclusivo dos administradores: regras, departamentos, mensagens
              educativas, auditoria e relatórios de letramento em um só lugar. Os colaboradores não
              fazem login; usam apenas a extensão.
            </p>
          </div>
        </motion.section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link to="/" className="flex items-baseline gap-2">
              <span className="font-serif text-xl tracking-tight">Sentinela</span>
              <span className="rotulo">governança de ia</span>
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
              <BaixarProjetoLink
                className="text-muted-foreground hover:text-foreground"
                rotuloBaixando="Baixando projeto"
              >
                Baixar projeto
              </BaixarProjetoLink>
            </div>
          </div>
        </div>
        <div className="border-t border-border/70">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-4 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>© {new Date().getFullYear()} Sentinela</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
