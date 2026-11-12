/**
 * Dados de referência da prévia.
 *
 * A matriz e as mensagens vêm dos mesmos JSON que o Flask usa no seed
 * (`servidor/dados/`). Não há uma segunda lista de regras no React.
 */
import matrizJson from "../../servidor/dados/regras.json";
import mensagensJson from "../../servidor/dados/mensagens.json";

export type Risco = "baixo" | "medio" | "alto";
export type TipoRegra = "regex" | "palavra-chave";

export interface RegraSeed {
  nome: string;
  tipo: TipoRegra;
  padrao: string;
  risco: Risco;
}

export interface AreaSeed {
  nome: string;
  descricao: string;
  regras: RegraSeed[];
}

export const RISCOS: Risco[] = ["baixo", "medio", "alto"];

export const ROTULO_RISCO: Record<Risco, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};

export const PESO_RISCO: Record<Risco, number> = {
  baixo: 1,
  medio: 2,
  alto: 3,
};

type MatrizJson = {
  areas: Array<{
    nome: string;
    descricao: string;
    regras: Array<{
      nome: string;
      tipo: string;
      padrao: string;
      risco: string;
    }>;
  }>;
};

const matriz = matrizJson as MatrizJson;

export const AREAS_SEED: AreaSeed[] = matriz.areas.map((area) => ({
  nome: area.nome,
  descricao: area.descricao,
  regras: area.regras.map((regra) => ({
    nome: regra.nome,
    tipo: regra.tipo === "regex" ? "regex" : "palavra-chave",
    padrao: regra.padrao,
    risco: (["baixo", "medio", "alto"] as Risco[]).includes(regra.risco as Risco)
      ? (regra.risco as Risco)
      : "medio",
  })),
}));

export const MENSAGENS_PADRAO = mensagensJson as Record<Risco, string>;

export const FERRAMENTAS_MONITORADAS = ["ChatGPT", "Gemini", "Claude", "Copilot"] as const;

export const SITES_MONITORADOS = [
  "chatgpt.com",
  "chat.openai.com",
  "gemini.google.com",
  "claude.ai",
  "copilot.cloud.microsoft",
  "copilot.microsoft.com",
  "copilot.com",
] as const;

export const ACOES = ["enviou", "cancelou"] as const;
export type Acao = (typeof ACOES)[number];

export const ORIGENS = ["texto", "colagem", "imagem", "pdf", "anexo"] as const;
export type Origem = (typeof ORIGENS)[number];

export const ROTULO_ORIGEM: Record<Origem, string> = {
  texto: "Texto digitado",
  colagem: "Colagem de texto longo",
  imagem: "Print ou imagem",
  pdf: "Arquivo PDF",
  anexo: "Imagem e PDF",
};

export function ordenarRisco(a: Risco, b: Risco) {
  return PESO_RISCO[b] - PESO_RISCO[a];
}

export function formatarDataHora(ms: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function formatarDataCurta(ms: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(ms));
}

export function formatarNumero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

export const CLASSES_RISCO: Record<
  Risco,
  { texto: string; borda: string; fundo: string; ponto: string }
> = {
  baixo: {
    texto: "text-risco-baixo",
    borda: "border-risco-baixo/35",
    fundo: "bg-risco-baixo-bg",
    ponto: "bg-risco-baixo",
  },
  medio: {
    texto: "text-risco-medio",
    borda: "border-risco-medio/35",
    fundo: "bg-risco-medio-bg",
    ponto: "bg-risco-medio",
  },
  alto: {
    texto: "text-risco-alto",
    borda: "border-risco-alto/35",
    fundo: "bg-risco-alto-bg",
    ponto: "bg-risco-alto",
  },
};
