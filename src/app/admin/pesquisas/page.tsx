import { AdminModulePage } from "@/components/admin-module-page";

export default function AdminSurveysPage() {
  return <AdminModulePage eyebrow="Configuração" title="Pesquisas e ciclos" requiredModule="ADMIN_SURVEYS" description="Estruture pesquisas reutilizáveis, versões de formulário, períodos de aplicação e regras de publicação." primaryAction={{ label: "Nova pesquisa", href: "/admin/pesquisas" }} items={[
    { title: "CDDI 2026", text: "Ciclo de Devolutivas e Desenvolvimento Individual com 12 competências, 52 perguntas e escalas institucionais.", status: "Encerrado" },
    { title: "Construtor de formulário", text: "Organize seções, perguntas, alternativas, obrigatoriedade, ordem e textos de orientação." },
    { title: "Versões e publicação", text: "Preserve versões anteriores e publique somente configurações validadas para o público definido." },
  ]} />;
}
