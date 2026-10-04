import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "features/swap/**/*.{ts,tsx}", "features/order-history/**/*.{ts,tsx}", "features/wallet-connection/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{
        group: ["@/features/developer-tools/*", "@/features/eip712-inspector/*", "**/developer-tools/*", "**/snippets/*"],
        message: "Use the build-selected @developer-tools or @developer-inspector boundary. Production modules must not import developer implementations.",
      }] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
