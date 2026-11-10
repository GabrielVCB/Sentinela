/**
 * Adaptador tipado para o ÚNICO motor de detecção do projeto:
 * `extensao/detectores.js`.
 *
 * A extensão carrega esse arquivo como content script; o Flask o serve em
 * `/detectores.js` para a landing; a prévia React o importa aqui. Assim não
 * existe uma segunda implementação para divergir.
 */
import "../../extensao/detectores.js";
import type { Risco, TipoRegra } from "./dados";

export interface RegraEntrada {
  _id?: string;
  nome: string;
  area: string;
  tipo: TipoRegra;
  padrao: string;
  risco: Risco;
  ativo: boolean;
}

export interface Deteccao {
  tipo: string;
  area: string;
  risco: Risco;
  ocorrencias: number;
}

export interface Analise {
  nivel: Risco;
  deteccoes: Deteccao[];
  totalOcorrencias: number;
}

interface Motor {
  normalizar(texto: string): string;
  validarCPF(valor: string): boolean;
  validarCNPJ(valor: string): boolean;
  validarLuhn(valor: string): boolean;
  pareceSegredoAltaEntropia(valor: string): boolean;
  pareceCodigoFonte(texto: string): boolean;
  avaliarColagem(texto: string): Deteccao | null;
  LIMITE_COLAGEM: number;
  aplicarRegra(regra: RegraEntrada, texto: string): Deteccao | null;
  classificar(deteccoes: Deteccao[]): Risco;
  consolidar(deteccoes: Deteccao[]): Deteccao[];
  mesclarDeteccoes(deteccoes: Deteccao[]): Analise;
  analisarTexto(texto: string, regras?: RegraEntrada[]): Analise;
  analisarConteudo(
    texto: string,
    anexos?: Array<{ deteccoes?: Deteccao[] }>,
    colagem?: { deteccao?: Deteccao } | null,
    regras?: RegraEntrada[],
  ): Analise;
}

const motor = (globalThis as typeof globalThis & { PainelDetectores?: Motor })
  .PainelDetectores;

function obterMotor(): Motor {
  if (!motor) {
    throw new Error("Motor de detecção não carregado em extensao/detectores.js.");
  }
  return motor;
}

export const LIMITE_COLAGEM = obterMotor().LIMITE_COLAGEM;

export function normalizar(texto: string) {
  return obterMotor().normalizar(texto);
}

export function validarCPF(valor: string) {
  return obterMotor().validarCPF(valor);
}

export function validarCNPJ(valor: string) {
  return obterMotor().validarCNPJ(valor);
}

export function validarLuhn(valor: string) {
  return obterMotor().validarLuhn(valor);
}

export function pareceSegredoAltaEntropia(valor: string) {
  return obterMotor().pareceSegredoAltaEntropia(valor);
}

export function pareceCodigoFonte(texto: string) {
  return obterMotor().pareceCodigoFonte(texto);
}

export function avaliarColagem(texto: string) {
  return obterMotor().avaliarColagem(texto);
}

export function aplicarRegra(regra: RegraEntrada, texto: string) {
  return obterMotor().aplicarRegra(regra, texto);
}

export function classificar(deteccoes: Deteccao[]) {
  return obterMotor().classificar(deteccoes);
}

export function consolidar(deteccoes: Deteccao[]) {
  return obterMotor().consolidar(deteccoes);
}

export function mesclarDeteccoes(deteccoes: Deteccao[]) {
  return obterMotor().mesclarDeteccoes(deteccoes);
}

export function analisarTexto(texto: string, regras: RegraEntrada[] = []) {
  return obterMotor().analisarTexto(texto, regras);
}

export function analisarConteudo(
  texto: string,
  anexos: Array<{ deteccoes?: Deteccao[] }> = [],
  colagem: { deteccao?: Deteccao } | null = null,
  regras: RegraEntrada[] = [],
) {
  return obterMotor().analisarConteudo(texto, anexos, colagem, regras);
}
