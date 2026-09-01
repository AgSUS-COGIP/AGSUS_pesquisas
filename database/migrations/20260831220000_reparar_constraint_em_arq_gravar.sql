-- Repara `FC_ARQ_GRAVAR`, que cita uma constraint pelo nome antigo.
--
-- O DEFEITO. 20260831150000 renomeou a constraint
-- `uk_tb_arquivo_caminho` para `"UK_ARQUIVO_CAMINHO"` (linha 221) e, mais
-- abaixo no MESMO arquivo (linha 1756), recriou esta função com o corpo antigo
-- — que ainda diz `on conflict on constraint uk_tb_arquivo_caminho`. O gerador
-- daquela migration trocava referência a TABELA nos corpos; nome de constraint
-- não estava no seu alcance. 20260831160000 carregou o mesmo corpo adiante.
--
-- Nome de constraint em `on conflict on constraint` é IDENTIFICADOR: sem aspas
-- o PostgreSQL dobra para minúscula, e desde o rename não existe mais nenhuma
-- constraint minúscula no schema. Como todo o resto neste banco, o corpo é
-- texto resolvido em execução: `create or replace` não reclamou e a migration
-- aplicou limpa.
--
-- Verificado no banco, antes deste reparo:
--   insert into sigav."TB_ARQUIVO" (...) on conflict on constraint uk_tb_arquivo_caminho ...
--   ERROR: constraint "uk_tb_arquivo_caminho" for table "TB_ARQUIVO" does not exist
--
-- O que quebrava: gravar arquivo é o caminho de subir a marca da plataforma e a
-- capa de pesquisa (`/api/arquivos`). A primeira gravação de qualquer imagem
-- falharia com erro de servidor.
--
-- O corpo abaixo é o corpo vivo, com uma troca só. A varredura que achou isto
-- virou o invariante 11 em database/tests/invariantes_schema.sql.

begin;

CREATE OR REPLACE FUNCTION sigav."FC_ARQ_GRAVAR"(p_balde text, p_caminho text, p_tipo text, p_conteudo_base64 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_caminho text := btrim(coalesce(p_caminho, ''));
  v_conteudo bytea;
  v_tamanho integer;
  v_id uuid;
begin
  -- Mesma autoridade que decidia a escrita nas políticas dos dois buckets:
  -- quem administra pesquisas administra a marca e as capas.
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Sem permissão para gravar arquivos.' using errcode = '42501';
  end if;

  if v_caminho = '' then
    raise exception 'O caminho do arquivo é obrigatório.' using errcode = '22023';
  end if;

  -- Impede que um caminho escape do próprio balde ou monte um endereço que a
  -- rota de leitura interpretaria de outro modo.
  if v_caminho like '/%' or v_caminho like '%..%' then
    raise exception 'Caminho de arquivo inválido: %', v_caminho using errcode = '22023';
  end if;

  if coalesce(p_conteudo_base64, '') = '' then
    raise exception 'O conteúdo do arquivo é obrigatório.' using errcode = '22023';
  end if;

  v_conteudo := decode(p_conteudo_base64, 'base64');
  v_tamanho := octet_length(v_conteudo);

  insert into sigav."TB_ARQUIVO" (co_balde, ds_caminho, tp_conteudo, nu_tamanho, im_conteudo, co_autor)
  values (p_balde, v_caminho, p_tipo, v_tamanho, v_conteudo, sigav."FC_UID_SESSAO"())
  on conflict on constraint "UK_ARQUIVO_CAMINHO" do update
    set tp_conteudo    = excluded.tp_conteudo,
        nu_tamanho     = excluded.nu_tamanho,
        im_conteudo    = excluded.im_conteudo,
        co_autor       = excluded.co_autor,
        dt_atualizacao = now()
  returning sq_arquivo into v_id;

  return jsonb_build_object(
    'sqArquivo', v_id,
    'balde', p_balde,
    'caminho', v_caminho,
    'tamanho', v_tamanho,
    'url', '/api/arquivos/' || p_balde || '/' || v_caminho
  );
end;
$function$;

do $verificacao$
declare
  v_fora text;
begin
  -- A prova é executar o `on conflict` de fato, com linha criada e descartada
  -- na mesma transação. Recriar a função não valida a citação: ela só é
  -- resolvida quando o comando roda.
  insert into sigav."TB_ARQUIVO" (co_balde, ds_caminho, tp_conteudo, nu_tamanho, im_conteudo)
  values ('platform-assets', 'zz-verificacao-reparo.png', 'image/png', 1, '\x00'::bytea)
  on conflict on constraint "UK_ARQUIVO_CAMINHO" do update set nu_tamanho = 1;

  delete from sigav."TB_ARQUIVO"
   where co_balde = 'platform-assets' and ds_caminho = 'zz-verificacao-reparo.png';

  -- E a classe inteira: nenhuma função pode citar constraint que não existe.
  select string_agg(nome, ', ' order by nome) into v_fora
    from (
      select distinct p.proname || ' -> ' || m[2] as nome
        from pg_proc p
        cross join lateral regexp_matches(
          regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g'),
          'on[[:space:]]+constraint[[:space:]]+("?)([a-zA-Z_][a-zA-Z_0-9]*)\1', 'gi') as m
       where p.pronamespace = 'sigav'::regnamespace and p.prokind = 'f'
         and not exists (
           select 1 from pg_constraint con
             join pg_class rel on rel.oid = con.conrelid
            where rel.relnamespace = 'sigav'::regnamespace
              and con.conname = case when m[1] = '' then lower(m[2]) else m[2] end)
    ) q;
  if v_fora is not null then
    raise exception 'VERIFICAÇÃO: função cita constraint inexistente: %', v_fora;
  end if;

  raise notice 'FC_ARQ_GRAVAR aponta para "UK_ARQUIVO_CAMINHO" e o on conflict executa';
end
$verificacao$;

commit;
