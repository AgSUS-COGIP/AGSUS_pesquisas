# AgSUS Pesquisas

Plataforma institucional de pesquisas, avaliações e formulários.

## Arquitetura

- Next.js 16 e React 19 no frontend e nas rotas HTTP.
- Auth.js com Google OAuth para autenticação.
- PostgreSQL, no schema `sigav`, para dados, regras e RPCs.
- As rotas em `src/app/api` executam RPCs por `src/lib/db/rpc-adapter.ts`; o navegador nunca acessa tabelas de domínio diretamente.

## Configuração

Copie `.env.example` para `.env.local` e preencha:

- `EMPRESA_DATABASE_URL`, `USERNAME_DATABASE_URL` e `PASSWORD_DATABASE_URL`;
- `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_CLIENT_ID` e `AUTH_GOOGLE_CLIENT_SECRET`;
- credenciais de e-mail e `CRON_SECRET`, quando aplicável.

## Comandos

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run db:migrations
```

As migrations SQL ficam em [database/migrations](database/migrations). Para consultar ou aplicar pendências no banco configurado, use `node --env-file=.env.local scripts/aplicar-migrations.mjs`; acrescente `--aplicar` para executar as pendências.
