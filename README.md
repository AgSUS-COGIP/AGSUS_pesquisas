# AgSUS Pesquisas

Plataforma institucional de pesquisas, avaliações e formulários da AgSUS.

O CDDI 2026 será o primeiro módulo da plataforma. A arquitetura será preparada para receber outras pesquisas, ciclos, públicos, formulários e regras de negócio.

## Tecnologias

- Next.js com App Router
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL e Auth
- GitHub
- Vercel

## Execução local

```bash
npm install
cp .env.example .env.local
npm run dev
```

A aplicação ficará disponível em `http://localhost:3000`.

## Verificações

```bash
npm run lint
npm run typecheck
npm run build
```

## Variáveis de ambiente

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

A chave `SUPABASE_SERVICE_ROLE_KEY` é exclusivamente de servidor e nunca deve ser utilizada em componentes executados no navegador.

## Fluxo de branches

- `main`: versão estável
- `develop`: integração e homologação
- `feature/*`: funcionalidades isoladas

## Banco de dados

As mudanças no Supabase serão versionadas em `supabase/migrations`. Nenhuma credencial ou senha deve ser gravada no repositório.
