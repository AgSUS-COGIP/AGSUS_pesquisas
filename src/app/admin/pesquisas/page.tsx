import { AdminModulePage } from "@/components/admin-module-page";

export default function AdminSurveysPage() {
  return <AdminModulePage eyebrow="Equipe Técnica" title="Pesquisas e ciclos" requiredModule="ADMIN_SURVEYS" description="Crie pesquisas reutilizáveis, organize versões de formulário, defina períodos de aplicação e publique somente configurações validadas." primaryAction={{ label: "Criar nova pesquisa", href: "/admin/pesquisas/nova" }} items={[
    { title: "Criar nova pesquisa", text: "Inicie uma pesquisa institucional com versão, ciclo, período, regras de rascunho e anonimato.", href: "/admin/pesquisas/nova", actionLabel: "Abrir construtor", status: "Disponível" },
    { title: "CDDI 2026", text: "Ciclo de Devolutivas e Desenvolvimento Individual com 12 competências, 52 perguntas e escalas institucionais.", status: "Encerrado" },
    { title: "Construtor de formulário", text: "Organize seções, perguntas, alternativas, obrigatoriedade, ordem e textos de orientação." },
    { title: "Versões e publicação", text: "Preserve versões anteriores e publique somente configurações validadas para o público definido." },
  ]} />;
}
