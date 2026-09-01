"use client";

import { useEffect, useState } from "react";
import { normalizarModulosDeManutencao } from "./manutencao";
import type { PlatformModule } from "./platform-modules";

/**
 * Estado de manutenção no navegador — lido a cada montagem, sem cache.
 *
 * ## Por que sem cache
 *
 * O contexto institucional é guardado por dois minutos, e faz sentido: papel e
 * módulos de uma pessoa não mudam durante uma sessão. Manutenção muda no
 * instante em que alguém clica em ativar, e é a mudança inteira do produto.
 * Guardá-la por dois minutos faria a manutenção demorar dois minutos para
 * valer, e a retirada demorar outros dois — que é justamente o defeito que esta
 * funcionalidade existe para não ter.
 *
 * A resposta é pequena e a rota não toca o banco: ela lê o control plane, que é
 * feito para ser lido em toda requisição.
 *
 * ## Falhar é não bloquear
 *
 * `null` significa "ainda não sei", e a guarda não bloqueia nada nesse estado.
 * Uma leitura lenta ou uma rota fora não podem transformar módulo saudável em
 * módulo indisponível.
 */
export function useModulosEmManutencao(ativo = true): readonly PlatformModule[] | undefined {
  const [modulos, setModulos] = useState<readonly PlatformModule[] | undefined>(undefined);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;

    fetch("/api/plataforma/manutencao", { cache: "no-store" })
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((corpo) => {
        if (!vivo || !corpo) return;
        setModulos(normalizarModulosDeManutencao(corpo.modules));
      })
      .catch(() => {
        // Silencioso de propósito: quem não conseguiu ler a bandeira não tem o
        // que dizer a quem usa, e um aviso aqui apareceria em toda navegação.
      });

    return () => {
      vivo = false;
    };
  }, [ativo]);

  return modulos;
}
