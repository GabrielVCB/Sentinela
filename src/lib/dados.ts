/**
 * Dados de referência da prévia.
 *
 * A matriz abaixo vem de `servidor/dados/regras-publicas.json` e contém apenas
 * nomes, áreas e níveis de risco. Os padrões completos ficam no servidor e só
 * são entregues pela API autenticada pelo código de verificação da extensão.
 */
import matrizJson from "../../servidor/dados/regras-publicas.json";
import mensagensJson from "../../servidor/dados/mensagens.json";

export type Risco = "baixo" | "medio" | "alto";
export type TipoRegra = "regex" | "palavra-chave";

export interface RegraSeed {
  nome: string;
  risco: Risco;
}

export interface AreaSeed {
  nome: string;
  descricao: string;
  regras: RegraSeed[];
}

export const ROTULO_RISCO: Record<Risco, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};

type MatrizJson = {
  areas: Array<{
    nome: string;
    descricao: string;
    regras: Array<{
      nome: string;
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
    risco: (["baixo", "medio", "alto"] as Risco[]).includes(regra.risco as Risco)
      ? (regra.risco as Risco)
      : "medio",
  })),
}));

export const MENSAGENS_PADRAO = mensagensJson as Record<Risco | "sem_deteccao", string>;

export const FERRAMENTAS_MONITORADAS = ["ChatGPT", "Gemini", "Claude", "Copilot"] as const;

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
