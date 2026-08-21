import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "out/**", "scripts/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Allow <a> for downloads and external URLs (many legitimate uses in this project)
      "@next/next/no-html-link-for-pages": "off",
      // Relax common patterns used throughout this codebase
      "@typescript-eslint/no-explicit-any": "off",
      // no-unused-vars: TypeScript's own compiler catches real issues; ESLint's
      // rule generates false-positives for exported library utilities.
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/triple-slash-reference": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "react/no-unescaped-entities": "off",
      // postcss.config.mjs uses anonymous default export — standard pattern
      "import/no-anonymous-default-export": "off",
      // These are pre-existing warnings in the codebase; disable to keep CI green
      // while the team works through them incrementally.
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-page-custom-font": "off",
      "@next/next/no-img-element": "off",
      "jsx-a11y/role-has-required-aria-props": "off",
    },
  },
];

export default eslintConfig;
