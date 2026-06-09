import type { PluginSettingsComponentBaseConstructorParams } from 'obsidian-dev-utils/obsidian/components/plugin-settings-component';
import type { MaybeReturn } from 'obsidian-dev-utils/type';

import { PluginSettingsComponentBase } from 'obsidian-dev-utils/obsidian/components/plugin-settings-component';

import { PluginSettings } from './plugin-settings.ts';

interface PluginSettingsComponentConstructorParams extends PluginSettingsComponentBaseConstructorParams<PluginSettings> {
  hasInvalidCharacters(this: void, str: string): boolean;
}

export class PluginSettingsComponent extends PluginSettingsComponentBase<PluginSettings> {
  private readonly hasInvalidCharacters: (str: string) => boolean;

  public constructor(params: PluginSettingsComponentConstructorParams) {
    super(params);
    const { hasInvalidCharacters } = params;
    this.hasInvalidCharacters = hasInvalidCharacters;
  }

  protected override registerValidators(): void {
    this.registerValidator('replacementCharacter', (value): MaybeReturn<string> => {
      if (this.hasInvalidCharacters(value)) {
        return 'Invalid replacement character';
      }
    });
  }
}
