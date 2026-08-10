begin;

-- O módulo institucional "Pesquisas" passa a se chamar "Avaliações" em toda a
-- interface. Aqui ficam os rótulos que vivem no banco: o catálogo de módulos
-- (exibido em telas de permissão) e o nome padrão do produto na marca da
-- plataforma. Códigos internos (SURVEYS, ADMIN_SURVEYS, rotas e RPCs) não mudam.

update public.platform_modules
set name = 'Avaliações'
where code = 'SURVEYS';

update public.platform_modules
set name = 'Avaliações e ciclos'
where code = 'ADMIN_SURVEYS';

alter table public.tb_config_plataforma
  alter column no_produto set default 'Avaliações';

-- Só substitui o nome do produto se a organização ainda usa o padrão antigo;
-- marca personalizada em /admin/configuracoes permanece intocada.
update public.tb_config_plataforma
set no_produto = 'Avaliações',
    dt_alteracao = timezone('utc', now())
where co_configuracao = 1
  and no_produto = 'Pesquisas';

commit;

-- Rollback:
-- begin;
--   update public.platform_modules set name = 'Pesquisas' where code = 'SURVEYS';
--   update public.platform_modules set name = 'Pesquisas e ciclos' where code = 'ADMIN_SURVEYS';
--   alter table public.tb_config_plataforma alter column no_produto set default 'Pesquisas';
--   update public.tb_config_plataforma
--     set no_produto = 'Pesquisas', dt_alteracao = timezone('utc', now())
--     where co_configuracao = 1 and no_produto = 'Avaliações';
-- commit;
