# Mapeamento de dados — CDDI para AgSUS Pesquisas

Este documento registra como as três planilhas oficiais do CDDI serão decompostas no modelo relacional da Plataforma de Pesquisas e Avaliações da AgSUS.

## 1. Base Participantes CDDI 2026 — OFICIAL LIMPA

### BASE_PARTICIPANTES

Origem principal dos dados cadastrais e de elegibilidade.

| Coluna atual | Destino proposto |
|---|---|
| Matrícula | `people.employee_number` |
| Nome | `people.full_name` |
| E-mail institucional | `people.institutional_email` |
| Cargo atual | `people.job_title` |
| Centro de custo | `people.cost_center` |
| Diretoria / Unidade / Coordenação | `organizational_units` em hierarquia |
| Status / Situação detalhada | `people.employment_status` e `people.metadata` |
| Perfil de acesso | `person_role_assignments` |
| Participa do ciclo | `application_participants.status` |
| Chave participante | chave de origem em `people.source_key` ou metadado da importação |

### PREFERENCIAS_USUARIO

Será migrada para `user_preferences`.

Exemplo:

```text
preference_key = avatar
preference_value = { "avatar_id": "avatar_20" }
```

### Carga, validação e pendências

As abas de carga não serão reproduzidas como tabelas definitivas de negócio. Elas serão substituídas, em etapa posterior, por um domínio de importação com:

- lotes de importação;
- registros recebidos;
- erros e alertas de validação;
- publicação transacional;
- histórico e possibilidade de reversão.

## 2. Base Lideranças CDDI — Atualizada

### VINCULOS_LIDERANCA

Esse conteúdo pertence ao módulo específico de avaliação e não ao núcleo genérico. Será modelado na migration do CDDI com referências a:

- aplicação;
- pessoa líder;
- pessoa subordinada;
- vigência;
- origem;
- status;
- trilha de alteração.

### CONFIG_ADMIN

Os parâmetros serão separados conforme sua natureza:

- período de abertura e encerramento → `survey_applications.opens_at` e `closes_at`;
- modo de teste e regras da aplicação → `survey_applications.settings`;
- URLs e identidade visual → configuração da pesquisa, versão ou aplicação;
- IDs das planilhas → metadados temporários de migração, não configuração permanente do sistema;
- e-mail administrador → atribuição de papel administrativo, não texto de configuração.

### SOLICITACOES_CORRECAO_VINCULO

Será uma tabela específica do módulo CDDI, com estados de análise e referências normalizadas às pessoas envolvidas.

## 3. Formulário Avaliação CDDI (respostas)

### REGISTRO_AVALIACOES

A estrutura horizontal com colunas como `C01_B1`, `C01_B2`, `C01_B3` e `C01_NIVEL` será normalizada.

| Estrutura atual | Destino proposto |
|---|---|
| Uma linha por avaliação | `submissions` |
| Tipo AUTO/CHEFIA | `submissions.submission_type` |
| Avaliador | `submissions.respondent_person_id` |
| Avaliado | `submissions.subject_person_id` |
| Resposta a comportamento | `answers` |
| Nota da competência | tabela de resultados do módulo CDDI |
| Devolutiva, ações e justificativa | perguntas de texto ou campos específicos do módulo |

### RASCUNHOS

O payload JSON atual será convertido em respostas normalizadas ligadas a uma submissão com status `DRAFT`. JSON continuará disponível apenas para metadados ou estruturas excepcionais.

### INDICE_STATUS_EQUIPE

Não será uma tabela operacional de verdade. Seus indicadores deverão ser obtidos por view ou consulta derivada de:

- participantes da aplicação;
- submissões;
- vínculos de avaliação;
- status dos rascunhos e conclusões.

### CONSOLIDADO e CALCULOS_AVALIACOES

Serão substituídos por consultas, views e tabelas de resultado calculado. O objetivo é impedir duplicação de dados e divergência entre registro original e consolidação.

### MAPA_COMPETENCIAS e CONFIG

As 12 competências, comportamentos, níveis e pesos serão dados configuráveis do módulo CDDI:

- pesquisa: CDDI;
- versão: 2026;
- aplicação: Ciclo CDDI 2026;
- seções: competências;
- perguntas: comportamentos e nível;
- pesos: regras de cálculo versionadas.

## Decisões de modelagem

1. `people` é cadastro institucional e não depende de uma pesquisa.
2. `tb_usuario_identidade` (o antigo `auth.users`) representa conta de acesso; uma pessoa pode existir antes de possuir login.
3. `surveys` representa o produto permanente, como CDDI ou Pesquisa de Clima.
4. `survey_versions` congela a estrutura de uma edição do questionário.
5. `survey_applications` define período, público e regras de uma execução.
6. `submissions` permite autoavaliação, avaliação de chefia e outros fluxos por meio de `submission_type`.
7. `answers` é normalizada para viabilizar relatórios e integridade referencial.
8. tabelas consolidadas serão preferencialmente views ou resultados derivados.
9. todas as tabelas expostas terão RLS habilitado e políticas explícitas.
10. migrations serão revisadas no GitHub antes de qualquer aplicação ao Supabase.
