"use client";

import Link from "next/link";
import { BadgeCheck, Building2, KeyRound, Mail, UserRound } from "lucide-react";
import { PersonAvatar } from "@/components/person-avatar";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { metadataText } from "@/lib/person-metadata";
import { usePlatformGuard } from "@/lib/platform-context";
import { navigationGroupsForModules } from "@/lib/platform-navigation";

export default function ProfilePage() {
  // Sem módulo exigido: o próprio perfil é acessível a qualquer pessoa com
  // cadastro institucional ativo.
  const guard = usePlatformGuard();
  if (guard.state !== "granted") {
    return <PlatformGuardState guard={guard} title="seu perfil" unidentifiedTitle="Não foi possível identificar seu acesso" />;
  }

  const { person, modules } = guard;
  // A foto vem da conta Google, sincronizada no login: não há mais escolha de
  // avatar nesta tela, então a casca e o cartão mostram a mesma imagem.
  const googleAvatarUrl = person.avatarUrl ?? metadataText(person.metadata, "google_avatar_url");
  const unit = metadataText(person.metadata, "unit", "unidade", "organizational_unit") ?? person.costCenter;
  const coordination = metadataText(person.metadata, "coordination", "coordenacao");
  const directorate = metadataText(person.metadata, "directorate", "diretoria");
  const user = { ...guard.user, avatarUrl: googleAvatarUrl };

  const fields = [
    { label: "Matrícula", value: person.employeeNumber, icon: KeyRound },
    { label: "E-mail institucional", value: person.institutionalEmail ?? "Não informado", icon: Mail },
    { label: "Cargo", value: person.jobTitle ?? "Não informado", icon: UserRound },
    { label: "Diretoria", value: directorate ?? "Não informada", icon: Building2 },
    { label: "Unidade", value: unit ?? "Não informada", icon: Building2 },
    { label: "Coordenação", value: coordination ?? "Não informada", icon: Building2 },
  ];

  return (
    <PlatformShell user={user} eyebrow="Conta" title="Perfil">
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        <section className="page-intro">
          <div>
            <p className="section-eyebrow">Identidade institucional</p>
            <h2 className="page-title">Seu perfil na plataforma</h2>
            <p className="page-description">Consulte sua foto da conta Google e os dados sincronizados do cadastro institucional.</p>
          </div>
          <span className="status-badge"><BadgeCheck className="h-4 w-4" />Cadastro validado</span>
        </section>

        <section className="surface-card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <PersonAvatar
            fullName={person.fullName}
            avatarUrl={googleAvatarUrl}
            className="h-24 w-24 rounded-xl"
          />
          <div>
            <p className="section-eyebrow">Foto de perfil</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Gerenciada pela conta Google</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              A plataforma usa automaticamente a foto da sua conta Google. Para alterá-la, atualize a imagem no Google e entre novamente na plataforma.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <article className="surface-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div><p className="section-eyebrow">Dados funcionais</p><h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Informações sincronizadas</h3></div>
              <span className="text-xs font-medium text-[var(--text-secondary)]">Somente leitura</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {fields.map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-card)] text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0"><p className="text-xs font-medium text-[var(--text-secondary)]">{label}</p><p className="mt-1 break-words text-sm font-semibold text-[var(--text-primary)]">{value}</p></div>
                </div>
              ))}
            </div>
          </article>

          <aside className="surface-card p-6">
            <p className="section-eyebrow">Acesso</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Perfil e permissões</h3>
            <div className="mt-5 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-4"><p className="text-xs font-medium text-[var(--status-info-text)]">Perfil principal</p><p className="mt-1 font-semibold text-[var(--status-info-text)]">{user.profileLabel}</p></div>
            {/*
              Aqui havia a lista de papéis vigentes, que repetia palavra por
              palavra a caixa acima: desde `20260810120000` os perfis são
              **exclusivos**, então `roles` traz sempre um só — o mesmo que
              `profileLabel`. A tela dizia "Superadmin" duas vezes seguidas.

              No lugar entra o que o título promete e a tela não entregava: as
              permissões. Vêm da mesma fonte que monta o menu, então o que se lê
              aqui é exatamente o que aparece na navegação.
            */}
            <div className="mt-4">
              <p className="text-xs font-medium text-[var(--text-secondary)]">Áreas liberadas para você</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {navigationGroupsForModules(modules).flatMap((group) => group.items).map((item) => (
                  <span key={item.href} className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">{item.label}</span>
                ))}
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <Link href="/area" className="primary-button w-full justify-center">Voltar à visão geral</Link>
              {modules.some((module) => module.startsWith("ADMIN_")) && <Link href="/admin" className="secondary-button w-full justify-center">Abrir administração</Link>}
            </div>
          </aside>
        </section>
      </div>
    </PlatformShell>
  );
}
