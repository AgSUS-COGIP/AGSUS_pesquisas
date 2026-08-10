# Módulo `docs` — decisões de produto, dados e design

## Objetivo

Registrar **por que** a plataforma é como é. São documentos de decisão, não manuais de API: quando o código e um destes documentos divergem, o código descreve o estado atual e o documento descreve a intenção — ambos precisam ser reconciliados por decisão explícita.

Instruções operacionais (instalar, rodar, testar) ficam no [../README.md](../README.md), não aqui.

## Responsabilidades

- Preservar o raciocínio das decisões estruturantes (identidade por matrícula, arquitetura híbrida de formulários, adaptação do padrão de nomenclatura).
- Definir os contratos de design e de dados que o código implementa.
- Servir de referência para revisão: "isso está conforme o combinado?".

## Arquivos importantes

| Arquivo | Consulte quando… |
|---|---|
| `visao-produto-e-arquitetura.md` | Precisar entender posicionamento, princípios, arquitetura-alvo, roadmap ou os critérios de "pronto". |
| `modelo-dados-cddi.md` | For mexer no esquema ou entender de onde vem cada coluna das planilhas originais. |
| `auditoria-base-cddi-2026.md` | Precisar dos números da base, da decisão sobre identidade de acesso e dos **pesos do cálculo** do CDDI. |
| `acesso-institucional.md` | For alterar autenticação, domínios permitidos ou `access_mode` de aplicação. |
| `operacao-permissoes.md` | For **aplicar** o modelo de perfis num banco, diagnosticar banco fora de sincronia com as migrations, ou investigar erro de "função não encontrada" após deploy. Operação, não conceito. |
| `correcao-fc-definir-perfil-pessoa.md` | `/admin/acessos` acusar `fc_definir_perfil_pessoa` ausente do schema cache. Traz o teste que separa "função não existe" de "sem permissão" (`PGRST202` × `42501`). |
| `database-naming-standard.md` | For criar objeto de banco. Regra obrigatória, validada por `npm run db:naming`. |
| `design-system.md` | For criar ou revisar interface. Tokens, semântica de estado, checklist de revisão. |
| `equipe-tecnica-fluxos.md` | For alterar gestão de equipe ou de pesquisas. |
| `formulario-cddi-ui.md` | For mexer na experiência do formulário CDDI. |
| `referencias-visuais.md` | Precisar saber quais sistemas inspiraram a interface. |

## Decisões que mais afetam o código

**Matrícula é a chave da pessoa.** A base oficial tem 5.223 participantes, 1.542 com e-mail, 37 endereços repetidos cobrindo 74 registros. Por isso `person_access_identities` separa "e-mail cadastral" de "identidade de acesso validada", e e-mail duplicado nunca é ativado automaticamente. (`auditoria-base-cddi-2026.md`)

**Pesos do CDDI 2026.** Comportamentos 70 % / nível de desenvolvimento 30 %; autoavaliação 40 % / chefia 60 %; escala 1–5. Estão codificados em `calculation_version = 'CDDI-2026-V1'`. (`auditoria-base-cddi-2026.md`)

**Consolidação é derivada, nunca duplicada.** As abas `CONSOLIDADO`, `CALCULOS_AVALIACOES` e `INDICE_STATUS_EQUIPE` das planilhas viraram views e resultados calculados — para impedir divergência entre registro original e consolidação. (`modelo-dados-cddi.md`)

**Nomenclatura em minúsculas.** O padrão institucional define maiúsculas, mas o PostgreSQL rebaixa identificadores não delimitados e aspas prejudicam PostgREST, Supabase e portabilidade. O projeto mantém os mesmos prefixos e a mesma semântica em minúsculas. Exceção: as views do schema `"DB_PESQUISAS"`, deliberadamente em maiúsculas com aspas por serem camada de leitura externa. (`database-naming-standard.md`)

**Arquitetura híbrida de formulários.** Motor nativo para jornadas institucionais integradas (CDDI, avaliações de liderança); ODK Web Forms / Enketo previsto para instrumentos extensos, coleta de campo e operação offline. A plataforma permaneceria responsável por autenticação, autorização, participantes, ciclo e auditoria. **Ainda não implementado.** (`visao-produto-e-arquitetura.md`)

**Tokens de cor.** Primária `#003B70`, primária forte `#002B54`, secundária `#0B8F58`, destaque `#00A8D6`. Definidos em `src/app/globals.css`. Cor nunca é o único indicador de estado. (`design-system.md`)

## Convenções específicas

- Português, prosa direta, sem jargão de implementação.
- Estrutura de decisão: contexto → alternativas → decisão → consequência.
- Data explícita quando o documento registra um retrato temporal (ex.: a auditoria informa 30/07/2026).
- Números concretos em vez de adjetivos ("5.223 participantes", não "muitos").
- Tabela de mapeamento quando houver correspondência origem → destino.
- Estes documentos **não** repetem instrução de instalação, comando de terminal nem assinatura de função.

## Relação com os outros módulos

| Documento | É implementado por |
|---|---|
| `modelo-dados-cddi.md`, `auditoria-base-cddi-2026.md` | [../supabase/CLAUDE.md](../supabase/CLAUDE.md) |
| `acesso-institucional.md` | `supabase` + [../src/app/api/CLAUDE.md](../src/app/api/CLAUDE.md) + `src/lib/platform-context.ts` |
| `operacao-permissoes.md` | `supabase/migrations/20260810120000` + `20260810130000` + `src/lib/platform-modules.ts` |
| `database-naming-standard.md` | [../scripts/CLAUDE.md](../scripts/CLAUDE.md) + `supabase` |
| `design-system.md`, `referencias-visuais.md` | [../src/components/CLAUDE.md](../src/components/CLAUDE.md) |
| `equipe-tecnica-fluxos.md` | [../src/app/CLAUDE.md](../src/app/CLAUDE.md) + [../src/app/admin/CLAUDE.md](../src/app/admin/CLAUDE.md) |
| `formulario-cddi-ui.md` | `src/app/cddi/` |
| `visao-produto-e-arquitetura.md` | todos |

## Pontos de atenção

- **`formulario-cddi-ui.md` está parcialmente desatualizado.** Cita rascunho em `sessionStorage` e envio definitivo bloqueado; o código atual persiste no banco via `save_my_cddi_answer` e o envio funciona (`submit_my_cddi_submission`). O mesmo vale para `src/app/cddi/README.md`.
- **`acesso-institucional.md` documenta `ALLOWED_INSTITUTIONAL_DOMAINS`** com dois domínios, mas `src/app/auth/confirm/route.ts` aceita apenas `agenciasus.org.br` no código. Divergência real, registrada nas melhorias do [../README.md](../README.md).
- **Parte de `visao-produto-e-arquitetura.md` é roadmap, não estado atual.** Convites, lembretes, encerramento automatizado, integração ODK, biblioteca de modelos e API institucional ainda não existem. Não presuma que uma capacidade descrita ali está implementada — confirme no código.
- **`modelo-dados-cddi.md` usa "destino proposto".** Alguns nomes de coluna coincidem com o esquema atual, outros descrevem intenção. A fonte da verdade é `supabase/migrations/`.
- Ao mudar comportamento documentado aqui, atualize o documento na **mesma** alteração — documentação desatualizada custa mais que ausência de documentação.
