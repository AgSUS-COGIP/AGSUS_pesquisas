import { AdminModulePage } from "@/components/admin-module-page";

export default function AdminAccessPage() {
  return <AdminModulePage eyebrow="Segurança" title="Acessos e permissões" requiredModule="ADMIN_ACCESS" description="Administre papéis institucionais, módulos liberados e exceções individuais com segregação de funções." items={[
    { title: "Papéis do sistema", text: "Administrador, gestor de pesquisa, auditor, liderança e participante com responsabilidades distintas.", status: "RBAC" },
    { title: "Módulos por perfil", text: "Liberação controlada de pesquisas, painéis, equipes, resultados e funções administrativas." },
    { title: "Exceções individuais", text: "Concessões ou bloqueios específicos por pessoa, com justificativa e registro de auditoria." },
  ]} />;
}
