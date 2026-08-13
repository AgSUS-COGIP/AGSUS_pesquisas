import { PlatformSupportContact } from "@/components/platform-support-contact";

/**
 * Rodapé institucional das telas internas.
 *
 * Discreto de propósito: identificação da instituição de um lado, canal de
 * suporte do outro. O contato vive em `PlatformSupportContact` porque precisa de
 * interatividade (copiar para a área de transferência) — este arquivo continua
 * sendo componente de servidor.
 *
 * Não aparece nas rotas exclusivas do Superadmin (ver `PlatformShell`).
 */
export function PlatformFooter() {
  return (
    <footer data-print-hidden="true" className="mx-auto max-w-[1760px] px-2 pb-6 pt-1 sm:px-5 lg:px-6">
      <div className="flex flex-col items-center gap-2 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:justify-between">
        <p className="text-xs leading-5 text-[var(--text-muted)]">
          Agência Brasileira de Apoio à Gestão do SUS
        </p>
        <PlatformSupportContact />
      </div>
    </footer>
  );
}
