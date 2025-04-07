import type { MaybeReturn } from 'obsidian-dev-utils/Type';

import { PluginSettingsManagerBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsManagerBase';

import type { PluginTypes } from './PluginTypes.ts';

import { PluginSettings } from './PluginSettings.ts';

export class PluginSettingsManager extends PluginSettingsManagerBase<PluginTypes> {
  protected override createDefaultSettings(): PluginSettings {
    return new PluginSettings();
  }

  protected override registerValidators(): void {
    this.registerValidator('replacementCharacter', (value): MaybeReturn<string> => {
      if (this.plugin.hasInvalidCharacters(value)) {
        return 'Invalid replacement character';
      }
    });
  }
}
