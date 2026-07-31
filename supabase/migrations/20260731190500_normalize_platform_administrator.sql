begin;

update public.system_roles
set name = 'Administrador da Plataforma',
    description = 'Gerencia papéis, permissões e configurações críticas da plataforma.'
where code = 'ADMINISTRATOR';

commit;
