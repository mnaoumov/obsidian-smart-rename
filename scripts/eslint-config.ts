import type { Linter } from 'eslint';

import { defineEslintConfigs } from '@mnaoumov/obsidian-dev-toolkit/linters/eslint-config';
import { defineConfig } from 'eslint/config';

export const configs: Linter.Config[] = defineEslintConfigs({
  customConfigs() {
    return defineConfig({
      rules: {
        'obsidianmd/ui/sentence-case': [
          'error',
          {
            brands: ['Filename Heading Sync']
          }
        ]
      }
    });
  }
});
