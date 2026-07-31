import { AdminModulePage } from "@/components/admin-module-page";

export default function AdminTeamsPage() {
  return <AdminModulePage eyebrow="Estrutura organizacional" title="Equipes e lideranças" requiredModule="ADMIN_TEAMS" description="Gerencie vínculos de liderança utilizados nas avaliações e registre correções de estrutura com rastreabilidade." items={[
    { title: "Vínculos ativos", text: "Relações entre liderança e participante utilizadas para autorizar avaliações de chefia.", status: "Controlado" },
    { title: "Solicitações de correção", text: "Fila para análise de vínculos incorretos, ausentes ou desatualizados antes da abertura do ciclo." },
    { title: "Cobertura de liderança", text: "Visão de participantes com e sem liderança definida e distribuição por unidade organizacional." },
  ]} />;
}
