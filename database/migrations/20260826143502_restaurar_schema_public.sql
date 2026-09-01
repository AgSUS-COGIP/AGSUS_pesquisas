begin;

-- Reconciliação do histórico remoto. A versão foi aplicada em produção em
-- 26/08/2026, mas o arquivo não chegou ao repositório. A forma condicional
-- preserva o estado já esperado por esta árvore (`public`) durante db reset e
-- também documenta a operação que ocorreu no remoto.
do $reconciliacao$
begin
  if exists (select 1 from pg_namespace where nspname = 'sigav')
     and not exists (select 1 from pg_namespace where nspname = 'public') then
    alter schema sigav rename to public;
  end if;
end;
$reconciliacao$;

notify pgrst, 'reload schema';

commit;
