import { PluginSettingsBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsBase';

import { InvalidCharacterAction } from './InvalidCharacterAction.ts';

export class SmartRenamePluginSettings extends PluginSettingsBase {
  public invalidCharacterAction = InvalidCharacterAction.Error;

  public replacementCharacter = '_';
  public shouldStoreInvalidTitle = true;
  public shouldUpdateFirstHeader = false;
  public shouldUpdateTitleKey = false;
  public constructor(data: unknown) {
    super();
    this.init(data);
  }
}
