import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  ...tseslint.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
