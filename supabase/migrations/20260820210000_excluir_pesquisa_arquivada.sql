begin;

-- Exclusão manual antecipada de uma avaliação arquivada.
--
-- Arquivar já separa a avaliação do catálogo e a expiração automática remove
-- apenas rascunhos sem respostas. Esta RPC oferece a mesma remoção segura sem
-- esperar os 30 dias: uma versão publicada ou qualquer resposta ainda impede
-- a operação, preservando o histórico institucional.
create or replace function public.fc_excluir_pesquisa_arquivada(p_pesquisa uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_arquivada_em timestamptz;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração.';
  end if;

  select dt_arquivamento into v_arquivada_em
  from public.surveys
  where id = p_pesquisa
  for update;

  if not found then
    raise exception 'Avaliação não encontrada.';
  end if;

  if v_arquivada_em is null then
    raise exception 'Apenas avaliações arquivadas podem ser apagadas definitivamente.';
  end if;

  return public.fc_excluir_pesquisa_rascunho(p_pesquisa);
end;
$$;

revoke all on function public.fc_excluir_pesquisa_arquivada(uuid) from public, anon;
grant execute on function public.fc_excluir_pesquisa_arquivada(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
