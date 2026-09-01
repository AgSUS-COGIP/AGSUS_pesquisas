begin;

create policy pl_tb_catalogo_objeto_servico
on db_governanca.tb_catalogo_objeto
for all
to service_role
using (true)
with check (true);

create or replace view db_governanca.vw_resumo_migracao
with (security_invoker = true)
as
select
  tp_objeto,
  st_conformidade,
  count(*)::bigint as qt_objeto,
  count(*) filter (where st_registro_ativo = 'S')::bigint as qt_objeto_ativo,
  max(dt_alteracao) as dt_ultima_alteracao
from db_governanca.tb_catalogo_objeto
group by tp_objeto, st_conformidade;

comment on view db_governanca.vw_resumo_migracao is
  'Resumo interno do andamento da adequação dos objetos ao padrão institucional AgSUS.';

revoke all on db_governanca.vw_resumo_migracao from public, anon, authenticated;
grant select on db_governanca.vw_resumo_migracao to service_role;

commit;
