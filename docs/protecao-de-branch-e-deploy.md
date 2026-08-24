# Proteção de branch e ordem de deploy — configuração fora do repositório

Este arquivo existe porque parte da segurança de deploy **não mora no
repositório**: são segredos e ajustes nos painéis do GitHub e da Vercel. Código
não consegue registrá-los, e conversa não é lugar de guardá-los — quando a
configuração falta, o sintoma aparece meses depois, na forma de um deploy que
simplesmente não acontece ou de um esquema que ficou para trás.

O portão de ordem de deploy em si **já está no repositório** (seção 2). O que
está aqui é o que ele precisa encontrar configurado para funcionar, e o que
acontece quando não encontra.

Quem aplicar, marque a data e o responsável ao final.

---

## 1. Proteção da branch `main` (item 4)

Hoje a `main` aceita push direto. O histórico mostra o custo disso: em 20 e 21
de agosto de 2026 houve trabalho em paralelo no mesmo assunto, com funções de
banco sobrescritas entre sessões, porque nada obrigava a passar por revisão.

Habilitar em **Settings → Branches → Branch protection rules**, para `main`:

| Configuração | Estado desejado | Por quê |
|---|---|---|
| Require a pull request before merging | **ligado** | é o que impede o push direto que causou a sobrescrita |
| Require approvals | **1** | segunda leitura em alteração de banco e de autorização |
| Dismiss stale approvals on new commits | **ligado** | aprovação vale para o que foi lido, não para o que veio depois |
| Require status checks to pass | **ligado** | ver a lista abaixo |
| Require branches to be up to date | **ligado** | força reconciliar antes de mesclar, não depois |
| Do not allow bypassing | **ligado** | inclusive para administradores — o histórico é de administrador |
| Allow force pushes | **desligado** | force push apaga trabalho de outra pessoa sem deixar rastro |
| Allow deletions | **desligado** | — |

**Checks obrigatórios**, exatamente com estes nomes:

```text
Application validation
Supabase migrations and RLS
```

São os dois jobs de `.github/workflows/validate.yml`. Sem marcá-los, a regra
exige "algum check" e qualquer um serve.

---

## 2. A aplicação não pode ser promovida antes do banco (item 1)

### O que já está resolvido no repositório

`.github/workflows/deploy-db-production.yml` aplica as migrations e, desde a
correção do item 1, executa `scripts/smoke-rpc-contract.mjs` logo depois. O
script pergunta ao banco real quais RPCs do contrato mínimo estão ausentes e
falha nomeando cada uma.

Isso bloqueia o **workflow do banco**. Não bloqueia a **promoção da aplicação**.

### O portão existe, e mora no repositório

A Vercel publica por conta própria a cada push na `main`, sem esperar por GitHub
Actions. Um push que traga frontend novo e migration nova dispara os dois em
paralelo — e a aplicação costuma subir primeiro, porque o build é mais rápido
que aplicar migration. É exatamente essa corrida que produziu `PGRST202` em
10/08 e em 20/08/2026.

Um Action não consegue segurar uma publicação da Vercel: quem decide se um build
acontece é a própria Vercel. Por isso o portão é a decisão dela, delegada ao
repositório — `scripts/vercel-ignore-build.mjs`, ligado por `ignoreCommand` em
`vercel.json`.

Ele fica **no repositório**, e não em Project Settings → Git → Ignored Build
Step, porque `ignoreCommand` sobrescreve aquela configuração e é versionado
junto com o código: quem lê o repositório vê o portão, e mudá-lo passa por
revisão em vez de acontecer num painel sem histórico.

O portão pergunta pelo **estado acumulado** do banco, não pelo conteúdo do
commit. A distinção não é acadêmica: perguntar "este commit altera
`supabase/migrations/`?" deixa passar migration de commit anterior que nunca foi
aplicada — e aí todo commit seguinte que não toque no banco publica livre. Foi o
que aconteceu depois do merge da #59.

**Atenção à semântica invertida.** No Ignored Build Step, `exit 0` **cancela** o
build e `exit 1` deixa seguir — o contrário da convenção Unix. Quem "corrigir"
os dois inverte o portão sem quebrar nada visivelmente. Os testes em
`scripts/vercel-ignore-build.test.mjs` existem por causa disso, e afirmam o
código de saída, não a mensagem.

### O que precisa estar configurado fora do repositório

Duas plataformas, e a falta em qualquer uma delas tem sintoma próprio.

**Na Vercel** — Settings → Environment Variables, escopo **Production**:

| Variável | Para quê | Se faltar |
|---|---|---|
| `GITHUB_DEPLOY_GATE_TOKEN` | ler o resultado do workflow e os arquivos do commit | commit com migration é **barrado** (falha fechada) |
| `SUPABASE_SERVICE_ROLE_KEY` | consultar o contrato no banco | **todo** deploy de produção é barrado |
| `NEXT_PUBLIC_SUPABASE_URL` | idem | idem |

O token do GitHub é *fine-grained*, restrito a `AGSUS_pesquisas`, com **Actions:
Read-only** e **Contents: Read-only**. Organização exige aprovação de owner em
`Settings → Personal access tokens → Pending requests`; enquanto pendente ele
responde 401 e o portão barra.

**Ele expira.** No dia do vencimento, deploy que altere migration para de
acontecer, e o sintoma vai parecer misterioso meses depois. A pista está no log
do build: `[gate] BUILD BARRADO — não foi possível verificar o contrato`.

**No GitHub** — environment `production`, em Settings → Environments:

| Segredo | Usado por |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | `supabase link` e `db push` |
| `PRODUCTION_DB_PASSWORD` | idem |
| `PRODUCTION_SUPABASE_URL` | smoke test de contrato, depois do push |
| `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` | idem |

**Os quatro são cobrados no primeiro passo do workflow**, antes de qualquer
`db push`. Isso é deliberado: cobrar os dois últimos apenas no passo que os usa
significaria descobrir a ausência **depois** de as migrations já terem sido
aplicadas — o banco mudaria e o portão que autoriza a promoção nunca chegaria a
rodar.

A consequência precisa estar clara para quem for diagnosticar: **se algum dos
quatro faltar, o job falha em `Validate deployment credentials` e as migrations
não são aplicadas.** O sintoma é silencioso do lado de fora — o merge acontece,
o código sobe, e o esquema fica para trás. Aconteceu no merge da #59, e as duas
migrations tiveram de ser aplicadas à mão.

A resposta certa nesse caso é **cadastrar os segredos que faltam**, nunca
afrouxar a checagem: ela existe justamente para a falha aparecer antes de tocar
em produção, e não depois.

### Quando o portão barrar

Build barrado não se perde. Depois de `deploy-db-production.yml` ficar verde,
**Redeploy** no mesmo commit passa pelo portão de novo e agora segue.

Separar em dois PRs — banco primeiro, aplicação depois — continua sendo a
prática recomendada: reduz a janela em que o portão precisa esperar, e torna
óbvio, na revisão, o que muda esquema e o que muda interface.

---

## 3. Monitor de prontidão

`/api/health/readiness` responde `503` quando o esquema não tem as RPCs desta
versão da aplicação. Vale apontar o monitor externo para ela, e **não** para
`/api/health`, que a partir da correção do item 2 responde apenas sobre
liveness — se o processo responde, está viva.

A distinção importa para o que o monitor faz com a resposta: `/api/health`
falhando pede **reinício**; `readiness` falhando pede **tirar do balanço** e
olhar o banco.

---

## Registro de aplicação

| Item | Aplicado em | Por |
|---|---|---|
| Proteção da `main` | | |
| Vercel · `GITHUB_DEPLOY_GATE_TOKEN` (Production) | 24/08/2026 | |
| Vercel · token aprovado na organização | 24/08/2026 | |
| GitHub · `SUPABASE_ACCESS_TOKEN` | | |
| GitHub · `PRODUCTION_DB_PASSWORD` | | |
| GitHub · `PRODUCTION_SUPABASE_URL` | | |
| GitHub · `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` | | |
| Monitor apontado para `readiness` | | |

O token do GitHub vence em **24/08/2027**. Renová-lo antes disso evita a falha
descrita na seção 2 — deploy de migration barrado sem causa aparente.

## Ocorrências

**24/08/2026 — migrations da #59 não foram aplicadas pelo workflow.**
O merge aconteceu, o código subiu, e `fc_srv_verificar_contrato_rpc` e
`fc_srv_registrar_transporte` não existiam em produção. Foram aplicadas à mão
pelo SQL Editor, com registro em `supabase_migrations.schema_migrations` no mesmo
script — sem esse registro, o histórico afirmaria que as duas nunca rodaram e o
próximo `db push` tentaria aplicá-las de novo.

Diagnóstico do que falhou no workflow: **pendente**. A hipótese é ausência de
`PRODUCTION_SUPABASE_URL` e `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` no environment
`production`, barrando em `Validate deployment credentials` antes do `db push` —
checagem acrescentada na mesma revisão. Confirmar no log do Actions e preencher
a tabela acima é o que impede a repetição.

**Como conferir se uma função chegou ao banco, sem service role.** Chamar a RPC
com as chaves públicas e ler o código de erro: `42501` significa que ela existe e
o papel foi barrado; `PGRST202` significa que o PostgREST não a resolveu. Os dois
não são intercambiáveis, e `PGRST202` **não** prova ausência — ele também aparece
quando o conjunto de argumentos nomeados diverge da assinatura. Sonda sem os
argumentos certos produz falso negativo.
