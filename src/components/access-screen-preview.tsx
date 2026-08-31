"use client";

import { ExternalImage } from "@/components/external-image";
import { PlatformLogo } from "@/components/platform-logo";
import { OFFICIAL_PLATFORM_LOGO_URL } from "@/lib/platform-branding";
import { needsLightForeground } from "@/lib/color-contrast";

type AccessScreenPreviewProps = {
  organizationName: string;
  /** Textos como estão no formulário — ainda não salvos. */
  productDescription: string;
  greeting: string;
  instruction: string;
  panelColor: string | null;
  /** Nulo quando não há arte configurada: a prévia mostra o fundo institucional. */
  backgroundUrl: string | null;
  className?: string;
};

/**
 * Prévia do cartão da tela de acesso, dentro das configurações.
 *
 * Existe porque configurar aquela tela era às cegas: mudava-se a saudação e só
 * se descobria o resultado abrindo `/acesso` noutra aba, deslogado — e cada
 * ajuste custava esse ciclo.
 *
 * **Reflete o formulário, não o banco.** Recebe os textos como estão sendo
 * digitados, então a pessoa vê antes de salvar. Prévia que só mostrasse o valor
 * já gravado chegaria tarde demais para ser útil.
 *
 * É uma reprodução, não a tela real: mesmo layout, mesma regra de contraste e
 * mesma assinatura, em escala menor. Ela **precisa acompanhar**
 * `tela-acesso.tsx` — se aquela mudar de composição e esta não, a prévia passa
 * a prometer uma tela que não existe, que é pior do que não ter prévia.
 */
export function AccessScreenPreview({
  organizationName,
  productDescription,
  greeting,
  instruction,
  panelColor,
  backgroundUrl,
  className,
}: AccessScreenPreviewProps) {
  const claro = needsLightForeground(panelColor);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-cover bg-center p-4 ${className ?? ""}`}
      style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : { backgroundColor: "var(--surface-page)" }}
      role="img"
      aria-label="Prévia da tela de acesso com os valores atuais"
    >
      <div
        className="w-full max-w-[15rem] rounded-xl px-4 py-4 shadow-lg ring-1 ring-white/25"
        style={{ backgroundColor: panelColor ?? "#ffffff" }}
      >
        <div className="flex flex-wrap items-center justify-center gap-2 text-center">
          <div
            className="flex flex-col items-center gap-1"
            style={claro ? { filter: "brightness(0) invert(1)" } : undefined}
          >
            <PlatformLogo
              src={OFFICIAL_PLATFORM_LOGO_URL}
              alt=""
              organizationName={organizationName}
              width={28}
              height={28}
              className="h-6 w-6 object-contain text-[9px]"
            />
            <span className={`text-[10px] font-black leading-none ${claro ? "text-white" : "text-[#003b70]"}`}>
              {organizationName}
            </span>
          </div>
          <span className={`h-7 w-px shrink-0 ${claro ? "bg-white/35" : "bg-[#003b70]/20"}`} aria-hidden="true" />
          <ExternalImage
            src={claro ? "/sigav-assinatura-negativa.svg" : "/sigav-assinatura.svg"}
            alt=""
            width={300}
            height={96}
            className="h-6 w-auto max-w-full object-contain"
          />
        </div>

        {/* `break-words` porque a prévia é estreita: texto longo sem quebra
            estouraria o cartão e daria a impressão de defeito no layout, quando
            o problema seria só o tamanho da caixa. */}
        <p className={`mt-2 break-words text-center text-[9px] font-bold leading-tight ${claro ? "text-white/90" : "text-[#003b70]"}`}>
          {productDescription}
        </p>
        <p className={`mt-2 break-words text-center text-[11px] font-black leading-tight ${claro ? "text-white" : "text-[#003b70]"}`}>
          {greeting}
        </p>
        <p className={`mt-1 break-words text-center text-[9px] leading-tight ${claro ? "text-white/80" : "text-slate-600"}`}>
          {instruction}
        </p>

        <span
          className={`mt-3 flex min-h-7 items-center justify-center rounded-lg px-2 text-[9px] font-semibold ${
            claro ? "bg-white text-[#003b70]" : "bg-[#003b70] text-white"
          }`}
        >
          Entrar com Google institucional
        </span>
      </div>
    </div>
  );
}
