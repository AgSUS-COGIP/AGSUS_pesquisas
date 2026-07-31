import { AdminModulePage } from "@/components/admin-module-page";

export default function AdminParticipantsPage() {
  return <AdminModulePage eyebrow="Público" title="Participantes" requiredModule="ADMIN_PARTICIPANTS" description="Consulte pessoas elegíveis, dados institucionais, perfis, situação no ciclo e pendências de acesso." primaryAction={{ label: "Importar participantes", href: "/admin/importacao" }} items={[
    { title: "Base de participantes", text: "Pesquisa por nome, matrícula, unidade, cargo, perfil e situação de participação.", status: "Base oficial" },
    { title: "Pendências cadastrais", text: "Identificação de e-mails ausentes, duplicidades, registros inválidos e pessoas sem identidade de acesso." },
    { title: "Elegibilidade", text: "Controle de inclusão no ciclo, situação funcional e histórico de participação por aplicação." },
  ]} />;
}
