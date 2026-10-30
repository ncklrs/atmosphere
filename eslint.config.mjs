import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    settings: { react: { version: "19.2" }, next: { rootDir: "apps/web/" } },
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  globalIgnores([
    "**/.next/**",
    "**/dist/**",
    "**/next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
  ]),
]);
