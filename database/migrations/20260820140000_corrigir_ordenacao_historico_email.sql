begin;

-- Corrige a ordenação do histórico de e-mails.
--
-- `fc_listar_envios_email`, criada em `20260820120000`, ordenava por
-- `f.dt_criacao` — coluna que **não existe** naquele ponto: a subconsulta já a
-- havia apelidado para `"createdAt"`, para o jsonb sair em camelCase como o
-- resto dos contratos. O resultado era `42703 column f.dt_criacao does not
-- exist` em toda chamada, e o painel de histórico nunca carregava.
--
-- O defeito é da mesma família do que a função irmã `fc_listar_audiencia_email`
-- teve de resolver: quando `to_jsonb(f)` exige apelido camelCase, **todo**
-- `order by` sobre aquela subconsulta precisa usar o apelido entre aspas, e não
-- o nome original da coluna. Aqui a correção passou despercebida porque o erro
-- só aparece em tempo de execução — nada no ensaio da migration o revela, já
-- que `create function` não valida o corpo.
--
-- Mesma assinatura, então nenhum consumidor muda.

create or replace function public.fc_listar_envios_email(
  p_aplicacao uuid default null,
  p_situacao text default 'ALL',
  p_limite integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_result jsonb;
  v_limite integer := greatest(1, least(coalesce(p_limite, 200), 1000));
  v_situacao text := upper(coalesce(nullif(btrim(p_situacao), ''), 'ALL'));
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  if v_situacao not in ('ALL', 'PROCESSANDO', 'ENVIADO', 'FALHOU') then
    raise exception 'Situação inválida. Use ALL, PROCESSANDO, ENVIADO ou FALHOU.';
  end if;

  select jsonb_build_object(
    'resumo', (
      select coalesce(jsonb_object_agg(x.st_envio, x.total), '{}'::jsonb)
      from (
        select t.st_envio, count(*) as total
        from public.tl_email_participante t
        where p_aplicacao is null or t.sq_aplicacao = p_aplicacao
        group by t.st_envio
      ) x
    ),
    'envios', (
      -- O apelido entre aspas, e não `f.dt_criacao`: é o nome que existe aqui.
      select coalesce(jsonb_agg(to_jsonb(f) order by f."createdAt" desc), '[]'::jsonb)
      from (
        select t.sq_email as id,
               t.tp_email as kind,
               t.st_envio as status,
               t.ds_erro as erro,
               t.dt_criacao as "createdAt",
               t.dt_envio as "sentAt",
               p.full_name as "personName",
               p.institutional_email as "personEmail",
               a.code as "applicationCode",
               a.name as "applicationName"
        from public.tl_email_participante t
        join public.people p on p.id = t.sq_pessoa
        join public.survey_applications a on a.id = t.sq_aplicacao
        where (p_aplicacao is null or t.sq_aplicacao = p_aplicacao)
          and (v_situacao = 'ALL' or t.st_envio = v_situacao)
        order by t.dt_criacao desc
        limit v_limite
      ) f
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.fc_listar_envios_email(uuid, text, integer) from public, anon;
grant execute on function public.fc_listar_envios_email(uuid, text, integer) to authenticated;

comment on function public.fc_listar_envios_email(uuid, text, integer) is
  'Histórico de e-mails aos participantes, com resumo por situação. Leitura administrativa de tl_email_participante.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Restaurar a definição de 20260820120000 reintroduz o defeito; se for
--   -- mesmo necessário voltar, prefira remover a função.
--   drop function if exists public.fc_listar_envios_email(uuid, text, integer);
-- commit;
