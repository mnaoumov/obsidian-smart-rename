import type { MaybeReturn } from '@mnaoumov/typescript-lib/type';

import { PluginSettingsComponentBase } from '@mnaoumov/obsidian-lib/components/plugin-settings-component';

import { hasInvalidCharacters } from './invalid-character.ts';
import { PluginSettings } from './plugin-settings.ts';

export class PluginSettingsComponent extends PluginSettingsComponentBase<PluginSettings> {
  protected override registerValidators(): void {
    this.registerValidator('replacementCharacter', (value): MaybeReturn<string> => {
      if (hasInvalidCharacters(value)) {
        return 'Invalid replacement character';
      }
    });
  }
}
