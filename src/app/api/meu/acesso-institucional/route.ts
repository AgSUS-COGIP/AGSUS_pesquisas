import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro } from "@/lib/api/resposta-http";

/**
 * Registra o acesso institucional de quem entrou pela primeira vez.
 *
 * Chamada quando o contexto volta com `UNLINKED`: há sessão no banco, mas
 * nenhum cadastro institucional vinculado.
 *
 * A matrícula vai sempre `null` — quem resolve a identidade é o banco, pelo
 * e-mail da sessão. Aceitá-la do corpo deixaria alguém escolher a qual cadastro
 * se vincular, e é a matrícula que identifica a pessoa neste projeto (a base
 * oficial tem e-mails repetidos entre matrículas distintas).
 */
export async function POST() {
  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("resolve_authenticated_person", {
    target_employee_number: null,
  });

  if (error) return respostaDeErro(error, "POST /api/meu/acesso-institucional");

  const resolucao = data as { status?: string; message?: string } | null;

  // A RPC devolve `status` no corpo em vez de levantar exceção; o 409 mantém a
  // promessa da camada de que erro de negócio chega como status HTTP.
  if (resolucao?.status !== "OK") {
    return NextResponse.json(
      { mensagem: resolucao?.message ?? "Não foi possível registrar o acesso institucional." },
      { status: 409 },
    );
  }

  return NextResponse.json(resolucao);
}
