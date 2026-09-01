# Auditoria da base oficial do CDDI 2026

Data da análise: 30/07/2026.

## Fontes

- Base Participantes CDDI 2026 — OFICIAL LIMPA;
- Base Lideranças CDDI — Atualizada;
- Formulário Avaliação CDDI (respostas).

## Resultado da base de participantes

| Indicador | Quantidade |
|---|---:|
| Participantes autorizados | 5.223 |
| Matrículas únicas | 5.223 |
| Pessoas com e-mail informado | 1.542 |
| Pessoas sem e-mail informado | 3.681 |
| Endereços de e-mail repetidos | 37 |
| Registros envolvidos em duplicidade de e-mail | 74 |
| Perfis de liderança | 162 |
| Perfis de usuário comum | 5.061 |
| Registros marcados para participar do ciclo | 5.223 |

Não foram encontradas duplicidades de matrícula ou de chave de participante.

## Decisão sobre identidade de acesso

O e-mail informado na base cadastral não pode ser tratado como chave única de pessoa, porque existem endereços repetidos entre matrículas distintas. A matrícula permanece como identificador institucional da pessoa.

Foi criada a tabela `TB_IDENTIDADE_ACESSO` para controlar separadamente os e-mails efetivamente validados para acesso. Assim:

- `TB_PESSOA.institutional_email` preserva o dado recebido da fonte;
- `TB_IDENTIDADE_ACESSO.email` representa uma identidade de acesso validada;
- e-mails duplicados não são ativados automaticamente;
- participantes sem e-mail permanecem cadastráveis, mas sem identidade de login até saneamento;
- a vinculação automática apenas por matrícula continua desabilitada.

## Estrutura do ciclo cadastrada

O PostgreSQL contém:

- pesquisa `CDDI`;
- versão `2026`;
- aplicação `CDDI-2026`;
- 12 seções de competências;
- 1 seção de considerações finais;
- 48 perguntas de escala;
- 4 perguntas finais;
- 240 alternativas de escala.

## Regras preservadas

- peso dos três comportamentos: 70%;
- peso do nível de desenvolvimento: 30%;
- peso da autoavaliação: 40%;
- peso da avaliação da chefia: 60%;
- escala de notas: 1 a 5;
- uma avaliação de chefia por pessoa e ciclo;
- edição de respostas somente enquanto a submissão estiver em rascunho;
- avaliação de chefia condicionada a vínculo de liderança ativo.

## Carga de participantes

Os dados pessoais não serão armazenados no GitHub. A importação será executada diretamente no PostgreSQL por processo controlado, com registro em `TB_LOTE_IMPORTACAO` e pendências em `TB_OCORRENCIA_IMPORTACAO`.

A primeira tentativa operacional foi encerrada sem importar registros porque o ambiente de processamento não possuía acesso externo ao Edge Function. A função temporária foi desativada, a função SQL de importação foi removida e o lote foi registrado como `FAILED`, com `data_imported=false`.
