// Gerado automaticamente a partir de pg_proc.proargtypes (sigav/private),
// restrito às funções em rpc-permissions.ts. Não editar à mão.
//
// node-postgres NÃO serializa objetos/arrays JS para JSON automaticamente ao
// vincular parâmetros — um objeto vira a string "[object Object]", e um array
// JS é tratado como array literal do Postgres (uuid[], text[]...), não como
// array JSON. Isso quebra silenciosamente qualquer argumento jsonb/json a
// menos que o adaptador (rpc-adapter.ts) saiba, por nome de função + nome de
// argumento, quais valores precisam de JSON.stringify antes do bind.

export const RPC_JSON_ARGS: Readonly<Record<string, readonly string[]>> = {
  "FC_INCLUIR_PERGUNTA": ["question_options"],
  "FC_APLICAR_PUBLICO_AVALIACAO": ["p_regra"],
  "FC_BUSCAR_PESSOAS_PUBLICO": ["p_regra"],
  "FC_LISTAR_DIMENSOES_PUBLICO": ["p_regra"],
  "FC_PREVISUALIZAR_PUBLICO": ["p_regra"],
  "FC_SALVAR_REGRA_CONDICIONAL": ["p_condicoes"],
  "FC_SRV_GRAVAR_RESP_ANON": ["target_json"],
  "FC_SRV_REGISTRAR_ERRO": ["p_ds_contexto"],
  "FC_SALVAR_RESPOSTA_PESQUISA": ["target_json"],
  "FC_SINCR_LINHAS_GESTOR_CDDI": ["p_rows"],
  "FC_SINCR_LINHAS_BASE_PESSOA": ["p_rows"],
  "FC_ATUALIZAR_PERGUNTA": ["question_options"],
};
