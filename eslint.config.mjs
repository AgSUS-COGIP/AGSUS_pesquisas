import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // O parâmetro `use` do fixture do Playwright (`async (_, use) => …`) faz o
  // plugin de React Hooks confundir a função com um hook, só pelo nome.
  // `tests/**` não tem componente React — a regra não se aplica.
  {
    files: ["tests/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // `supabase/.temp` guarda o andaime que o `supabase start` gera para o
  // runtime local. É código de terceiro, ignorado pelo git — mas o ESLint tem
  // lista própria e acusava 99 erros em quem sobe o Supabase na máquina.
  globalIgnores([".next/**", "out/**", "coverage/**", "supabase/.temp/**"]),
]);
