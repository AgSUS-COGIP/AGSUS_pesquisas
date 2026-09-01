begin;

-- A tabela já possui a política institutional_domains_privileged_read, mas o
-- RLS não havia sido habilitado quando ela foi criada por SQL.
alter table public.institutional_domains enable row level security;

commit;
