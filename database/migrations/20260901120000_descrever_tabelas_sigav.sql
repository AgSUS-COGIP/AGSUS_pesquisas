-- Descrição de todas as tabelas do schema `sigav`.
--
-- ## Por que no banco, e não só na documentação
--
-- `docs/` descreve o modelo para quem lê o repositório. Quem abre o DBeaver
-- apontado para o `db_dataware` não tem o repositório à mão, e é justamente aí
-- que a pergunta "o que é esta tabela?" aparece. `COMMENT ON TABLE` é o único
-- lugar que viaja junto do próprio banco: sai no `\dt+` do psql, na coluna de
-- comentário do DBeaver e em `obj_description()`. Cada cópia da réplica leva a
-- descrição consigo, sem depender de ninguém sincronizar um arquivo à parte.
--
-- ## O que entra em cada descrição
--
-- Não a lista de colunas — isso o catálogo já responde melhor. O que entra é o
-- que não se lê no DDL: para que a tabela existe, quem escreve nela e qual
-- invariante ela sustenta. Onde uma tabela está prevista no modelo mas ainda
-- não é usada por nenhuma RPC nem tela, a descrição diz isso, para que ninguém
-- perca tempo procurando o código que a alimenta.
--
-- ## Escopo
--
-- As 14 tabelas que estavam sem descrição, mais três descrições existentes que
-- citavam objetos com o nome anterior à padronização de 31/08/2026
-- (`20260831150000` em diante) e por isso mandavam o leitor procurar coisa que
-- não existe mais. As demais descrições foram conferidas e ficam como estão.
--
-- Nenhuma estrutura é alterada: `COMMENT ON` não toca em dado, não reescreve
-- linha, não invalida plano e não dispara gatilho.

begin;

-- ---------------------------------------------------------------------------
-- Estrutura da pesquisa: seção, pergunta e opção
-- ---------------------------------------------------------------------------

comment on table sigav."TB_SECAO_PESQUISA" is
  'Seções de uma versão de pesquisa, aninháveis por "SQ_SECAO_PAI". A chave única (seção, versão) existe para que a pergunta referencie as duas juntas: é o que impede uma seção de ser reaproveitada por outra versão e mantém a estrutura publicada imutável.';

comment on table sigav."TB_PERGUNTA_PESQUISA" is
  'Perguntas de uma versão de pesquisa, presas à seção e à versão pelo mesmo par de chaves — pergunta não migra de versão. "TP_PERGUNTA" decide o componente da tela e a forma de gravar em "TB_RESPOSTA"; validação, lógica de exibição, pontuação e configuração ficam em campos jsonb próprios, lidos pelo runtime genérico.';

comment on table sigav."TB_OPCAO_PERGUNTA" is
  'Alternativas de uma pergunta de escolha ou escala, na ordem de exibição. "VL_NOTA" é o peso usado no cálculo de resultado e "CO_OPCAO" é o código estável da alternativa, único dentro da pergunta. A exclusão é restrita a partir de "RL_RESPOSTA_OPCAO": opção já escolhida por alguém não sai enquanto a resposta existir.';

comment on table sigav."RL_RESPOSTA_OPCAO" is
  'Alternativas escolhidas em uma resposta de escolha múltipla — o N:N entre "TB_RESPOSTA" e "TB_OPCAO_PERGUNTA". Pergunta de escolha única tem no máximo uma linha aqui; "NU_ORDEM" registra a ordem quando a pergunta a considera.';

-- ---------------------------------------------------------------------------
-- Aplicação e público
-- ---------------------------------------------------------------------------

comment on table sigav."RL_APLICACAO_PESSOA" is
  'Público de cada aplicação: quem participa, em que papel ("TP_PARTICIPANTE") e em que ponto do ciclo ("ST_SITUACAO", de ELIGIBLE a EXCLUDED). A chave única (aplicação, pessoa, papel) permite a mesma pessoa constar em papéis diferentes do mesmo ciclo sem duplicar vínculo, e é o denominador de todo cálculo de adesão.';

-- ---------------------------------------------------------------------------
-- Autorização e acesso
-- ---------------------------------------------------------------------------

comment on table sigav."TB_MODULO_PLATAFORMA" is
  'Catálogo dos módulos de navegação da plataforma: código, rótulo exibido, categoria e ordem no menu. É a lista fechada de códigos que "RL_PESSOA_MODULO" pode conceder. Desligar "ST_ATIVO" tira o módulo de todo mundo em "FC_MODULOS_EFETIVOS" sem apagar as permissões já concedidas.';

comment on table sigav."RL_PESSOA_MODULO" is
  'Permissão de módulo por pessoa: "ST_PERMITIDO" concede ou nega explicitamente, sobrepondo o padrão embutido em "FC_MODULOS_EFETIVOS" (que sem linha aqui libera apenas HOME e SURVEYS). Escrita por "FC_DEFINIR_PERMISSOES_PESSOA". Desde a remoção das roles legadas do cluster, esta tabela — e não uma role do PostgreSQL — é a fonte de autorização de navegação.';

comment on table sigav."TB_DOMINIO_INSTITUCIONAL" is
  'Domínios de e-mail aceitos no acesso institucional, gravados em minúsculas e sem o "@". É a mesma fonte consultada pelo callback de login da aplicação e por "FC_RESOLVER_PESSOA_AUTENTIC", de modo que autenticar e vincular ao cadastro nunca discordem — a regra mora no banco, não em lista no código.';

comment on table sigav."TB_LIMITE_REQUISICAO_PUBLICA" is
  'Contadores de rate limit das rotas públicas, por escopo e janela de tempo. "CO_CHAVE" é o SHA-256 do endereço do chamador com um discriminador opcional: o IP nunca é gravado em claro. Mantida só por "FC_SRV_CONSUMIR_LIMITE_PUBLICO", que também descarta janelas com mais de dois dias por limpeza probabilística, evitando um DELETE em toda requisição.';

-- ---------------------------------------------------------------------------
-- Importação de base cadastral
-- ---------------------------------------------------------------------------

comment on table sigav."TB_LOTE_IMPORTACAO" is
  'Uma linha por execução de importação de base cadastral: origem, arquivo, entidade importada, contagem de linhas recebidas, aceitas, rejeitadas e com alerta, e o desfecho em "ST_SITUACAO". Alimentada por processo controlado executado diretamente no banco — nenhuma RPC da aplicação escreve aqui.';

comment on table sigav."TB_OCORRENCIA_IMPORTACAO" is
  'Ocorrências registradas linha a linha por um lote de importação, classificadas em INFO, WARNING e ERROR. "DS_CONTEUDO" guarda o trecho do registro que motivou a ocorrência, para conferir a pendência sem voltar ao arquivo de origem; "DT_RESOLUCAO" marca o que já foi tratado.';

-- ---------------------------------------------------------------------------
-- Cadastro institucional
-- ---------------------------------------------------------------------------

comment on table sigav."TB_UNIDADE_ORGANIZACIONAL" is
  'Estrutura organizacional em hierarquia (diretoria, unidade, coordenação), apontada pela lotação da pessoa e pela unidade responsável da pesquisa. A ligação com a unidade-pai é restrita na exclusão: unidade com filha não sai do cadastro.';

-- ---------------------------------------------------------------------------
-- Previstas no modelo e ainda sem uso
-- ---------------------------------------------------------------------------

comment on table sigav."TB_PREFERENCIA_USUARIO" is
  'Preferências de interface por pessoa, uma linha por chave, com valor livre em jsonb. Prevista no modelo de dados do CDDI e ainda sem uso: nenhuma RPC, rota ou tela lê ou grava aqui.';

comment on table sigav."TB_CORRECAO_VINCULO_CDDI" is
  'Pedidos de correção do vínculo de liderança em uma aplicação do CDDI: quem pediu, qual líder consta, qual propõe, a justificativa e o desfecho da análise. Criada junto do módulo CDDI e hoje sem escrita — nenhuma RPC ou tela a alimenta; a liderança vigente está em "RT_LIDERANCA_CDDI".';

-- ---------------------------------------------------------------------------
-- Descrições existentes que citavam nomes anteriores à padronização
--
-- O texto continua o mesmo; o que muda é o objeto apontado, que hoje se chama
-- de outro jeito. Descrição que manda procurar objeto inexistente custa mais
-- caro que descrição nenhuma.
-- ---------------------------------------------------------------------------

comment on table sigav."TB_USUARIO_IDENTIDADE" is
  'Contas de acesso. Herdada da tabela de usuários do GoTrue e hoje mantida por "FC_SRV_RESOLVER_IDENT_OAUTH", sob Auth.js. Alvo da FK "SQ_USUARIO_IDENTIDADE" de "TB_PESSOA".';

comment on table sigav."TB_IDENTIDADE_OAUTH" is
  'Vínculo entre uma conta e o provedor OAuth que a autenticou. Herdada da tabela de identidades do GoTrue; "DS_DADO_IDENTIDADE" guarda a foto lida por "FC_SINCR_AVATAR_GOOGLE".';

comment on table sigav."TB_PRESENCA_ONLINE" is
  'Última batida de presença de cada pessoa. Sobrescrita, não acumulada: o histórico de quem esteve online é dado descartável.';

-- ---------------------------------------------------------------------------
-- Prova
--
-- O pedido era "todas as tabelas", e o jeito de provar isso é falhar quando
-- não for verdade. Se qualquer tabela de `sigav` ficar sem descrição depois
-- deste arquivo, a migration não passa e o efeito inteiro volta atrás.
-- ---------------------------------------------------------------------------

do $prova$
declare
  v_sem_descricao text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into v_sem_descricao
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'sigav'
    and c.relkind in ('r', 'p')
    and coalesce(btrim(obj_description(c.oid, 'pg_class')), '') = '';

  if v_sem_descricao is not null then
    raise exception 'Tabelas de sigav sem descrição: %', v_sem_descricao;
  end if;

  raise notice 'Todas as tabelas de sigav têm descrição.';
end
$prova$;

commit;

-- Rollback: não há o que desfazer em dado. Para remover as descrições
-- acrescentadas aqui (a prova acima passaria a falhar na próxima aplicação):
-- begin;
--   comment on table sigav."TB_SECAO_PESQUISA" is null;
--   comment on table sigav."TB_PERGUNTA_PESQUISA" is null;
--   comment on table sigav."TB_OPCAO_PERGUNTA" is null;
--   comment on table sigav."RL_RESPOSTA_OPCAO" is null;
--   comment on table sigav."RL_APLICACAO_PESSOA" is null;
--   comment on table sigav."TB_MODULO_PLATAFORMA" is null;
--   comment on table sigav."RL_PESSOA_MODULO" is null;
--   comment on table sigav."TB_DOMINIO_INSTITUCIONAL" is null;
--   comment on table sigav."TB_LIMITE_REQUISICAO_PUBLICA" is null;
--   comment on table sigav."TB_LOTE_IMPORTACAO" is null;
--   comment on table sigav."TB_OCORRENCIA_IMPORTACAO" is null;
--   comment on table sigav."TB_UNIDADE_ORGANIZACIONAL" is null;
--   comment on table sigav."TB_PREFERENCIA_USUARIO" is null;
--   comment on table sigav."TB_CORRECAO_VINCULO_CDDI" is null;
-- commit;
