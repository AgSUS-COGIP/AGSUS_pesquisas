import { redirect } from "next/navigation";

// A gestão de perfis foi consolidada no workspace de Configurações
// (aba "Acessos"). A rota antiga permanece como atalho e redireciona,
// preservando links e favoritos já existentes.
export default function Page() {
  redirect("/admin/configuracoes");
}
