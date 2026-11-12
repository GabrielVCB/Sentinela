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
import { ArrowRight, ArrowUpRight } from "lucide-react";

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
    rotulo: "CPF",
    texto: "O CPF do novo analista é 529.982.247-25. Pode conferir os dados para o contrato?",
  },
  {
    rotulo: "Token",
    texto: "Estou com erro na API. Minha chave é sk-proj-8fJ2kLm9Qr4Tz7Xb1Nc6Vd3.",
  },
  {
    rotulo: "Senha",
    texto: "My password is Hunter2!",
  },
  {
    rotulo: "Sem risco",
    texto: "Pode revisar a redação deste e-mail de agradecimento para o cliente?",
  },
];

const ETAPAS = [
  {
    numero: "01",
    titulo: "Implantação em minutos",
    texto: "A extensão é instalada no Chrome ou no Edge a partir do pacote fornecido pelo painel.",
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
      "Um aviso aparece antes do envio, classifica o risco e orienta o colaborador. Em risco médio ou alto, pede confirmação.",
  },
  {
    numero: "04",
    titulo: "Auditoria sem conteúdo",
    texto:
      "O painel recebe colaborador, IP e decisão, mas não o prompt. A empresa acompanha o risco sem acessar a conversa.",
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
  const mensagem = MENSAGENS_PADRAO[analise.nivel];
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
              Abrir painel
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
              <p className="rotulo">Governança de IA · privacidade</p>
              <h1 className="mt-6 max-w-xl font-serif text-[2.9rem] leading-[0.98] tracking-tight text-balance sm:text-6xl lg:text-[4.15rem]">
                O que é confidencial não deveria virar <em className="italic">prompt</em>.
              </h1>
              <p className="mt-7 max-w-md text-sm leading-7 text-muted-foreground">
                Painel de governança e letramento em IA para reduzir o vazamento de informações
                corporativas. A extensão analisa localmente o que é digitado no ChatGPT, Gemini,
                Claude e Copilot e avisa antes do envio. O texto nunca sai do navegador.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button asChild className="rounded-sm">
                  <a href={destino}>
                    Abrir o painel
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
                <Button asChild variant="ghost" className="rounded-sm">
                  <a href="#matriz">Ver a matriz de risco</a>
                </Button>
              </div>

              <dl className="mt-12 grid max-w-md grid-cols-3 gap-4 border-t border-border pt-5">
                <div>
                  <dt className="rotulo">Sites monitorados</dt>
                  <dd className="mt-1 font-serif text-2xl">{FERRAMENTAS_MONITORADAS.length}</dd>
                </div>
                <div>
                  <dt className="rotulo">Áreas de risco</dt>
                  <dd className="mt-1 font-serif text-2xl">{AREAS_SEED.length}</dd>
                </div>
                <div>
                  <dt className="rotulo">Textos de conversa armazenados</dt>
                  <dd className="mt-1 font-serif text-2xl">0</dd>
                </div>
              </dl>
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
                  <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-risco-baixo" aria-hidden />
                    ChatGPT
                  </span>
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

              <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
                <span className="mt-1.5 block size-1 shrink-0 bg-foreground/40" aria-hidden />
                A prévia usa as mesmas regras da extensão. Experimente:
                “My password is Hunter2!”, “minha senha é 123” ou “senha:123”.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Faixa de sites monitorados */}
        <div className="border-y border-border">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span className="rotulo">Sites monitorados</span>
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
              <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">
                Ferramentas de IA públicas são úteis e vão continuar sendo usadas. O que precisa
                mudar é o que entra nelas.
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
                  <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
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
                  <span className="rotulo">Fluxo local</span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-risco-baixo" />
                    <span className="size-1.5 rounded-full bg-border" />
                    <span className="size-1.5 rounded-full bg-border" />
                  </span>
                </div>

                <div className="relative mt-8">
                  <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-border" />
                  <div className="relative grid grid-cols-3 gap-2.5">
                    {[
                      ["Texto", "entrada"],
                      ["Regra", "local"],
                      ["Alerta", "metadados"],
                    ].map(([titulo, detalhe]) => (
                      <div
                        key={titulo}
                        className="border border-border bg-background px-2 py-3 text-center"
                      >
                        <p className="font-serif text-sm tracking-tight">{titulo}</p>
                        <p className="mt-1 font-mono text-[8px] tracking-wider text-muted-foreground uppercase">
                          {detalhe}
                        </p>
                      </div>
                    ))}
                  </div>
                  <motion.span
                    className="absolute top-1/2 left-4 size-1.5 -translate-y-1/2 rounded-full bg-risco-baixo"
                    animate={{ left: ["16%", "50%", "84%"] }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>

                <div className="mt-7 flex items-end justify-between gap-4 border-t border-border pt-4">
                  <span className="max-w-[9.5rem] text-[10px] leading-5 text-muted-foreground">
                    O navegador é o limite.
                  </span>
                  <span className="font-serif text-[2.7rem] leading-none tracking-tight text-foreground/15 italic">
                    local
                  </span>
                </div>
              </motion.div>
            </div>

            <div className="mt-14 grid gap-8 border-t border-border pt-8 md:grid-cols-3 md:gap-12">
              {[
                {
                  titulo: "Analisa no navegador",
                  texto:
                    "A extensão examina o texto no próprio computador. Nada do que é digitado é transmitido.",
                },
                {
                  titulo: "Classifica por risco",
                  texto:
                    "Cada regra pertence a uma área e a um nível. O maior nível encontrado define o alerta.",
                },
                {
                  titulo: "Registra o alerta",
                  texto:
                    "Metadados do alerta: site, departamento, colaborador, IP, origem, nível, tipos detectados e decisão. O prompt não é armazenado.",
                },
              ].map((item) => (
                <div key={item.titulo}>
                  <h3 className="font-serif text-xl tracking-tight">{item.titulo}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.texto}</p>
                </div>
              ))}
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
                {AREAS_ORDENADAS.length} áreas, uma escala de risco.
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
                  <th className="rotulo py-3 pr-5 font-normal">Área</th>
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

          <p className="mt-4 text-[11px] text-muted-foreground">
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
              <p className="max-w-xs text-xs leading-6 text-muted-foreground">
                Uma extensão para Chrome e Edge, um painel administrativo e uma API na nuvem. Em
                quatro etapas.
              </p>
            </div>

            <div className="mt-12 grid gap-x-10 gap-y-10 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-4">
              {ETAPAS.map((etapa) => (
                <div key={etapa.numero}>
                  <p className="tabular text-[10px] text-muted-foreground">{etapa.numero}</p>
                  <h3 className="mt-3 font-serif text-xl tracking-tight">{etapa.titulo}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{etapa.texto}</p>
                </div>
              ))}
            </div>

            <div className="mt-14 grid gap-6 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  marca: "Imagem",
                  titulo: "Imagens",
                  texto:
                    "O texto é extraído por OCR no próprio computador, classificado e descartado. A imagem nunca é enviada.",
                },
                {
                  marca: "PDF",
                  titulo: "PDFs",
                  texto: "O texto é extraído localmente e passa pela mesma análise.",
                },
                {
                  marca: "Colagem",
                  titulo: "Colagens grandes",
                  texto:
                    "A colagem é analisada antes de chegar ao site. Blocos longos, listas e código têm classificação própria.",
                },
                {
                  marca: "Gestão",
                  titulo: "Gestão centralizada",
                  texto:
                    "Sites monitorados, ativação e departamentos são definidos no painel e valem para todas as extensões.",
                },
                {
                  marca: "Acesso",
                  titulo: "Acesso controlado",
                  texto:
                    "Cada extensão precisa do código de instalação para registrar alertas.",
                },
                {
                  marca: "Relatórios",
                  titulo: "Relatórios",
                  texto:
                    "Os alertas filtrados por data, departamento e nível podem ser exportados em CSV ou PDF.",
                },
                {
                  marca: "Sincronia",
                  titulo: "Regras sincronizadas",
                  texto:
                    "Alterações no painel chegam a todas as extensões em até 1 minuto.",
                },
              ].map((recurso) => (
                <div key={recurso.titulo}>
                  <span className="inline-block border border-border px-2 py-0.5 font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
                    {recurso.marca}
                  </span>
                  <h3 className="mt-3 text-xs font-medium">{recurso.titulo}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{recurso.texto}</p>
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
              <p className="mt-6 max-w-lg text-sm leading-7 text-background/65">
                O painel compara envios e cancelamentos por departamento. Não para punir, mas para
                mostrar onde o aviso ainda não está funcionando e onde o letramento precisa ser
                reforçado.
              </p>
              <div className="mt-8 border-t border-background/15 pt-6 text-xs text-background/60">
                Relatórios por data, departamento e nível, com exportação em CSV e PDF.
              </div>
            </div>

            <div className="lg:border-l lg:border-background/15 lg:pl-12">
              <p className="font-serif text-7xl leading-none tracking-tight">30%</p>
              <p className="mt-4 max-w-xs text-sm leading-6 text-background/65">
                Quando 30% ou mais dos alertas de risco alto são enviados mesmo após o aviso,
                com no mínimo três registros no departamento, o departamento é marcado como
                crítico. O limite de criticidade é configurável no painel.
              </p>
              <div className="mt-8 border-t border-background/15 pt-4">
                <p className="text-[10px] tracking-[0.18em] text-background/45 uppercase">
                  Como ler
                </p>
                <p className="mt-2 text-xs leading-6 text-background/60">
                  Muitos cancelamentos indicam que o aviso está funcionando. Muitos envios em risco
                  alto indicam que o aviso precisa de contexto, treinamento ou uma ferramenta
                  corporativa autorizada.
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
              O painel é de uso exclusivo dos administradores: regras, áreas, mensagens educativas,
              auditoria e relatórios de letramento em um só lugar. Os colaboradores não fazem login;
              usam apenas a extensão.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild className="rounded-sm">
                <a href={destino}>
                  Entrar no painel
                  <ArrowRight className="size-4" />
                </a>
              </Button>
              <Button asChild variant="outline" className="rounded-sm">
                <a href="#matriz">Ver a matriz de risco</a>
              </Button>
            </div>
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
              <a href={`${URL_PAINEL}/painel`} className="text-muted-foreground hover:text-foreground">
                Visão geral
              </a>
              <a href={`${URL_PAINEL}/painel`} className="text-muted-foreground hover:text-foreground">
                Alertas
              </a>
              <a href={`${URL_PAINEL}/painel`} className="text-muted-foreground hover:text-foreground">
                Regras de detecção
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
            <p className="max-w-[11rem] text-[10px] leading-5 text-muted-foreground">
              Nenhum prompt é armazenado nesse sistema.
            </p>
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
