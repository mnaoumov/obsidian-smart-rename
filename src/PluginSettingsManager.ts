import type { MaybeReturn } from 'obsidian-dev-utils/Type';

import { PluginSettingsManagerBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsManagerBase';

import type { PluginTypes } from './PluginTypes.ts';

import { PluginSettings } from './PluginSettings.ts';

export class PluginSettingsManager extends PluginSettingsManagerBase<PluginTypes> {
  protected override addValidators(): void {
    this.addValidator('replacementCharacter', (value): MaybeReturn<string> => {
      if (this.plugin.hasInvalidCharacters(value)) {
        return 'Invalid replacement character';
      }
    });
  }

  protected override createDefaultSettings(): PluginSettings {
    return new PluginSettings();
  }
}
