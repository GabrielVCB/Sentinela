import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Sobe o painel Flask e o Postgres embutido junto do servidor Vite.
 *
 * O plugin só roda em `vite` (serve), nunca no build. Se Python, pgserver ou
 * gunicorn não estiverem disponíveis, a landing continua funcionando e o
 * terminal mostra como instalar as dependências de preview.
 */
export function painelPreviewPlugin(): Plugin {
  let processo: ChildProcess | null = null;

  return {
    name: "sentinela-painel-preview",
    apply: "serve",
    configureServer(servidor) {
      if (process.env.SENTINELA_PREVIEW_PANEL === "0") return;

      const raiz = process.cwd();
      const script = path.resolve(raiz, "scripts", "preview_panel.py");

      processo = spawn("python3", [script], {
        cwd: raiz,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
        stdio: "inherit",
      });

      processo.on("error", (erro) => {
        console.warn(
          "[preview] Não foi possível iniciar o painel Flask: " +
            erro.message +
            ". Rode: python3 -m pip install -r scripts/requirements-preview.txt",
        );
        processo = null;
      });

      processo.on("exit", (codigo, sinal) => {
        if (codigo && codigo !== 0) {
          console.warn(
            `[preview] Painel encerrou (${codigo}${sinal ? `, ${sinal}` : ""}). ` +
              "A landing continua disponível.",
          );
        }
        processo = null;
      });

      const encerrar = () => {
        if (processo && !processo.killed) processo.kill("SIGTERM");
      };
      // Não encerra no simples reload do vite.config.ts: o helper novo detecta
      // o painel já saudável e o reaproveita. O processo só é encerrado quando
      // o Vite realmente termina.
      process.once("exit", encerrar);
      process.once("SIGINT", encerrar);
      process.once("SIGTERM", encerrar);
    },
  };
}
