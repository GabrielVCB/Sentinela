import { CLASSES_RISCO, ROTULO_RISCO, type Risco } from "@/lib/dados";
import type { Deteccao } from "@/lib/detectores";
import { cn } from "@/lib/utils";
import { ShieldAlert } from "lucide-react";

/**
 * Reprodução fiel do painel que a extensão injeta via Shadow DOM.
 * Mostra apenas metadados (tipo, área e risco), nunca o texto digitado.
 */
export function BannerRisco({
  nivel,
  deteccoes,
  mensagem,
  analisando = false,
  className,
}: {
  nivel: Risco;
  deteccoes: Deteccao[];
  mensagem: string;
  analisando?: boolean;
  className?: string;
}) {
  const cores = CLASSES_RISCO[nivel];
  const semDeteccoes = deteccoes.length === 0;
  const totalOcorrencias = deteccoes.reduce(
    (soma, deteccao) => soma + (deteccao.ocorrencias || 0),
    0,
  );

  return (
    <section
      aria-live="polite"
      aria-label={`Aviso de risco ${ROTULO_RISCO[nivel]}`}
      className={cn(
        "relative overflow-hidden border transition-colors duration-300",
        semDeteccoes ? "bg-card" : cores.fundo,
        cores.borda,
        className,
      )}
    >
      <span
        className={cn("absolute inset-y-0 left-0 w-[3px] transition-colors duration-300", cores.ponto)}
        aria-hidden
      />
      <div className="flex flex-col gap-3 py-4 pr-5 pl-5">
        <div className="flex items-center justify-between gap-3">
          <span className={cn("flex items-center gap-2 text-[11px] font-medium tracking-[0.14em] uppercase transition-colors duration-300", cores.texto)}>
            <ShieldAlert className="size-3.5" aria-hidden />
            Risco {ROTULO_RISCO[nivel]}
          </span>
          <span className="rotulo">
            {analisando
              ? "analisando…"
              : semDeteccoes
                ? "sem detecções"
                : `${deteccoes.length} ${deteccoes.length === 1 ? "tipo" : "tipos"} · ${totalOcorrencias} ${totalOcorrencias === 1 ? "ocorrência" : "ocorrências"}`}
          </span>
        </div>

        <ul
          className={cn("flex flex-wrap gap-1.5", semDeteccoes && "min-h-[22px]")}
          aria-hidden={semDeteccoes || undefined}
        >
          {deteccoes.map((deteccao) => (
            <li
              key={`${deteccao.tipo}-${deteccao.area}`}
              className="inline-flex items-center gap-1.5 border border-border/80 bg-background/70 px-1.5 py-0.5 text-[11px] leading-4 transition-colors duration-300"
            >
              <span
                className={cn("size-1 rounded-full", CLASSES_RISCO[deteccao.risco].ponto)}
                aria-hidden
              />
              <span className="font-medium">{deteccao.tipo}</span>
              <span className="text-muted-foreground">· {deteccao.area}</span>
            </li>
          ))}
        </ul>

        <p className="min-h-10 text-xs leading-5 text-muted-foreground">{mensagem}</p>
      </div>
    </section>
  );
}

