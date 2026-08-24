import type { NextConfig } from "next";

/*
 * `eval()` é liberado **apenas** em desenvolvimento.
 *
 * O React em modo de desenvolvimento usa `eval()` para recursos de depuração —
 * reconstruir pilha de chamadas vinda de outro ambiente, entre outros. Sem
 * `'unsafe-eval'`, o console abre com "eval() is not supported in this
 * environment" a cada carregamento, e os recursos de depuração ficam mudos.
 *
 * Em produção o React **nunca** usa `eval()`, então liberar lá seria afrouxar a
 * política sem nenhum ganho — e `'unsafe-eval'` é justamente o que transforma
 * uma injeção de string em execução de código. Por isso a distinção é por
 * ambiente, e não uma linha só que serve aos dois.
 *
 * `NODE_ENV` é definido pelo próprio Next: `development` em `next dev`,
 * `production` em `next build`. Não depende de variável de ambiente do projeto.
 */
const ehDesenvolvimento = process.env.NODE_ENV !== "production";

/*
 * `'unsafe-inline'` em `script-src` continua aqui, e é dívida conhecida.
 *
 * Os dois scripts `beforeInteractive` do layout raiz (tema e sidebar) precisam
 * rodar antes da primeira pintura para não piscar, e hoje são inline. A saída
 * correta é `nonce`, que exige gerar o valor por requisição e propagá-lo — o
 * que torna as páginas dinâmicas e conflita com a revalidação da tela de
 * acesso. Trocar isso é trabalho próprio, com medição, não efeito colateral
 * desta correção.
 */
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(ehDesenvolvimento ? ["'unsafe-eval'"] : []),
  "https://accounts.google.com",
].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://accounts.google.com",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://envajznrzfuuumcdtvcj.supabase.co https://*.googleusercontent.com https://i.postimg.cc",
  "font-src 'self' data:",
  "connect-src 'self' https://envajznrzfuuumcdtvcj.supabase.co wss://envajznrzfuuumcdtvcj.supabase.co https://accounts.google.com",
  "frame-src https://accounts.google.com",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  allowedDevOrigins: [
    "mucid-precorneal-haleigh.ngrok-free.dev",
  ],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.postimg.cc",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
