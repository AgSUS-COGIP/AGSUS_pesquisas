# Proteção de branch e ordem de deploy — configuração fora do repositório

Este arquivo existe porque duas correções da revisão técnica **não se resolvem
com código**. São ajustes na configuração do GitHub e da Vercel, e ficam
registrados aqui para que a decisão não se perca numa conversa.

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

### O que falta, e por que não dá para resolver por código

A Vercel publica por conta própria a cada push na `main`, sem esperar por
GitHub Actions. Um push que traga frontend novo e migration nova dispara os dois
em paralelo — e a aplicação costuma subir primeiro, porque o build é mais
rápido que aplicar migration. É exatamente essa corrida que produziu
`PGRST202` em 10/08 e em 20/08/2026.

Escolha **uma** das duas saídas:

**A. Ignored Build Step na Vercel** *(recomendada)*

Em **Project Settings → Git → Ignored Build Step**, comando que só permite o
build quando o contrato está íntegro:

```bash
node scripts/smoke-rpc-contract.mjs
```

Exige `SUPABASE_URL` e `SUPABASE_SECRET_KEY` disponíveis no ambiente de build.
Sai com `0` quando o contrato está completo — e a Vercel prossegue apenas nesse
caso.

**Limitação honesta:** isso confere o contrato **antes** do build, então uma
migration que ainda esteja sendo aplicada nesse instante produz um falso
negativo e cancela um deploy legítimo. É preferível ao inverso — deploy
incompatível no ar —, mas quem operar precisa saber que "build cancelado" pode
significar "tente de novo em um minuto".

**B. Deployment Protection por check do GitHub**

Configurar a Vercel para aguardar os checks obrigatórios da `main`. Depende do
plano contratado; conferir se está disponível no plano atual (o projeto está em
**Hobby**, e recursos de proteção de deployment costumam exigir plano pago).

### Enquanto nenhuma das duas estiver ativa

A ordem segura é **manual**, e vale registrar em cada publicação:

```text
1. mesclar a migration na main
2. aguardar o workflow "Deploy database migrations to production" concluir
3. conferir que o passo de smoke test passou
4. só então mesclar o frontend que depende dela
```

Separar em dois PRs — banco primeiro, aplicação depois — é o que torna essa
ordem possível sem depender de disciplina no momento do merge.

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
| Ignored Build Step ou Deployment Protection | | |
| Monitor apontado para `readiness` | | |
