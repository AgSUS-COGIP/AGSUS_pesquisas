begin;

-- Restaura o catálogo de módulos da plataforma em ambientes onde
-- 20260731115500_platform_navigation_permissions.sql nunca foi aplicada.
--
-- Contexto: há bancos (inclusive o de produção) cujo esquema foi construído sem
-- passar por parte do histórico de migrations. O sintoma é
-- `relation "public.platform_modules" does not exist` ao aplicar qualquer
-- migration posterior que escreva nesse catálogo — por exemplo
-- 20260807150500_renomear_modulo_avaliacoes.sql.
--
-- As três tabelas **não são fonte de autorização** e não têm leitor em runtime
-- desde 20260803104000, quando o mapa de módulos passou a ser derivado do papel
-- dentro do corpo da função de contexto. Quem decide os módulos hoje é o `case`
-- de fc_obter_contexto_plataforma(). Elas existem como catálogo descritivo do
-- banco, e é por isso que restaurá-las é seguro: recriar não altera o
-- comportamento de nenhuma tela.
--
-- Toda a migration é idempotente (`if not exists`, `on conflict`), então rodar
-- de novo num banco que já as tenha não causa efeito algum.

-- Os nomes de tabela e de coluna reproduzem **exatamente** a definição original
-- de 20260731115500. Não seguem o padrão institucional de propósito: renomeá-los
-- deixaria o banco restaurado incompatível com o de quem aplicou aquela migration
-- na época. São objetos legados, e por isso constam da allowlist
-- LEGACY_RESTORED_OBJECTS de scripts/validate-db-naming.mjs. Objeto **novo**
-- continua obrigado ao padrão — ver ../../docs/database-naming-standard.md.
create table if not exists public.platform_modules (
  code text primary key,
  name text not null,
  description text,
  category text not null default 'MAIN',
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.role_module_permissions (
  role_id uuid not null references public.system_roles(id) on delete cascade,
  module_code text not null references public.platform_modules(code) on delete cascade,
  allowed boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (role_id, module_code)
);

create table if not exists public.person_module_permissions (
  person_id uuid not null references public.people(id) on delete cascade,
  module_code text not null references public.platform_modules(code) on delete cascade,
  allowed boolean not null,
  granted_by uuid references public.people(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (person_id, module_code)
);

-- Rótulos já no estado final: "Pesquisas" é o nome oficial do módulo na
-- especificação vigente dos quatro perfis, e é o rótulo que a navegação usa.
-- 20260807150500 renomeou SURVEYS para "Avaliações"; a decisão foi revertida,
-- então o catálogo nasce alinhado à interface para não reintroduzir divergência.
insert into public.platform_modules (code, name, category, position) values
  ('HOME', 'Visão geral', 'MAIN', 10),
  ('SURVEYS', 'Pesquisas', 'MAIN', 20),
  ('DASHBOARDS', 'Painéis', 'MAIN', 30),
  ('TEAM', 'Minha equipe', 'WORK', 40),
  ('RESULTS', 'Resultados', 'WORK', 50),
  ('ADMIN_SURVEYS', 'Pesquisas e ciclos', 'ADMIN', 100),
  ('ADMIN_PARTICIPANTS', 'Participantes', 'ADMIN', 110),
  ('ADMIN_TEAMS', 'Equipes e lideranças', 'ADMIN', 120),
  ('ADMIN_ACCESS', 'Acessos e permissões', 'ADMIN', 130),
  ('ADMIN_IMPORT', 'Importações', 'ADMIN', 140)
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  position = excluded.position,
  active = true;

-- RLS obrigatória em tabela de schema exposto (gate de CI e regra do projeto).
-- Sem política de leitura para `authenticated`: o catálogo não é consumido pelo
-- cliente, apenas por consulta administrativa direta.
alter table public.platform_modules enable row level security;
alter table public.role_module_permissions enable row level security;
alter table public.person_module_permissions enable row level security;

revoke all on table public.platform_modules from public, anon, authenticated;
revoke all on table public.role_module_permissions from public, anon, authenticated;
revoke all on table public.person_module_permissions from public, anon, authenticated;

commit;

-- Rollback:
-- begin;
--   drop table if exists public.person_module_permissions;
--   drop table if exists public.role_module_permissions;
--   drop table if exists public.platform_modules;
-- commit;
