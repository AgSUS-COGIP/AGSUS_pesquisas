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
  "add_survey_question": ["question_options"],
  "fc_aplicar_publico_avaliacao": ["p_regra"],
  "fc_buscar_pessoas_publico": ["p_regra"],
  "fc_listar_dimensoes_publico": ["p_regra"],
  "fc_previsualizar_publico_avaliacao": ["p_regra"],
  "fc_salvar_regra_condicional": ["p_condicoes"],
  "fc_srv_gravar_resp_anon": ["target_json"],
  "fc_srv_registrar_erro_aplicacao": ["p_ds_contexto"],
  "save_my_survey_answer": ["target_json"],
  "sync_cddi_manager_rows": ["p_rows"],
  "sync_people_base_rows": ["p_rows"],
  "update_survey_question": ["question_options"],
};
