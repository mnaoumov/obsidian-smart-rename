// eslint-disable-next-line import/no-namespace
import * as typescriptEslintParser from "@typescript-eslint/parser";
// eslint-disable-next-line import/no-namespace
import * as eslintPluginImport from "eslint-plugin-import";

import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import stylisticEslintPlugin from "@stylistic/eslint-plugin";
import eslintPluginModulesNewlines from "eslint-plugin-modules-newlines";
import globals from "globals";
import "eslint-import-resolver-typescript";
import type {
  ESLint,
  Linter
} from "eslint";

const configs: Linter.FlatConfig[] = [
  {
    files: ["**/*.ts"],
    ignores: ["dist/**"],
    languageOptions: {
      parser: typescriptEslintParser as Linter.ParserModule,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {
        project: "./tsconfig.json"
      }
    },
    plugins: {
      "@typescript-eslint": typescriptEslintPlugin,
      "import": eslintPluginImport,
      "modules-newlines": eslintPluginModulesNewlines,
      "@stylistic": stylisticEslintPlugin as ESLint.Plugin
    },
    rules: {
      ...typescriptEslintPlugin.configs["eslint-recommended"]!.overrides[0]!.rules,
      ...typescriptEslintPlugin.configs["recommended"]!.rules,
      ...typescriptEslintPlugin.configs["recommended-type-checked"]!.rules,
      "import/no-unresolved": "error",
      "import/no-namespace": "error",
      "modules-newlines/import-declaration-newline": "error",
      "modules-newlines/export-declaration-newline": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@stylistic/indent": ["error", 2],
      "@stylistic/quotes": ["error", "double"],
      semi: "error",
      "no-extra-semi": "error",
      "@typescript-eslint/explicit-member-accessibility": "error"
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true
        }
      }
    }
  }
];

export default configs;
