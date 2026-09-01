/** Estados compartilhados sem dependências de Node, seguros para Client e Edge. */
export type Prontidao =
  | { estado: "pronta" }
  | { estado: "configuracao-ausente"; detalhe: string }
  | { estado: "backend-inacessivel"; detalhe: string }
  | { estado: "esquema-incompativel"; detalhe: string };

export function ehQuedaDeBackend(prontidao: Prontidao) {
  return prontidao.estado === "backend-inacessivel" || prontidao.estado === "esquema-incompativel";
}
