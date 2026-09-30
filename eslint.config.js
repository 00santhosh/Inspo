// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // tsc already fails on unresolved imports, and the import resolver cannot find
    // tsconfig.json when the project path contains glob characters such as "(4)".
    files: ['**/*.ts', '**/*.tsx'],
    rules: { 'import/no-unresolved': 'off' },
  },
  {
    // Deno code; linted and type-checked by the Supabase CLI instead.
    ignores: ["dist/*", "supabase/functions/*"],
  }
]);
