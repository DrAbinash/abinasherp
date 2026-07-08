import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "ref-repo/**",
      "node_modules/**",
      ".next/**",
      "scripts/**",
      "tool-results/**",
    ],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
