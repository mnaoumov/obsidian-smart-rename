import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsTabBase';
import { SettingEx } from 'obsidian-dev-utils/obsidian/SettingEx';

import type { PluginTypes } from './PluginTypes.ts';

import { InvalidCharacterAction } from './InvalidCharacterAction.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginTypes> {
  public display(): void {
    this.containerEl.empty();

    new SettingEx(this.containerEl)
      .setName('Invalid characters action')
      .setDesc('How to process invalid characters in the new title')
      .addDropdown((dropdown) => {
        dropdown.addOptions({
          Error: 'Show error',
          Remove: 'Remove invalid characters',
          Replace: 'Replace invalid character with'
        });
        this.bind(dropdown, 'invalidCharacterAction', {
          onChanged: () => {
            this.display();
          }
        });
      });

    if (this.plugin.settings.invalidCharacterAction === InvalidCharacterAction.Replace) {
      new SettingEx(this.containerEl)
        .setName('Replacement character')
        .setDesc('Character to replace invalid character with')
        .addText((text) => {
          text.inputEl.maxLength = 1;
          text.inputEl.required = true;

          this.bind(text, 'replacementCharacter');
        });
    }

    if (this.plugin.settings.invalidCharacterAction !== InvalidCharacterAction.Error) {
      new SettingEx(this.containerEl)
        .setName('Store invalid title')
        .setDesc('If enabled, stores title with invalid characters. If disabled, stores the sanitized version')
        .addToggle((toggle) => {
          this.bind(toggle, 'shouldStoreInvalidTitle');
        });
    }

    new SettingEx(this.containerEl)
      .setName('Update title key')
      .setDesc('Update title key in frontmatter')
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldUpdateTitleKey');
      });

    new SettingEx(this.containerEl)
      .setName('Update first header')
      .setDesc(createFragment((f) => {
        f.appendText('Update first header if it is present in the document. May conflict with the ');
        f.createEl('a', {
          attr: {
            href: 'https://obsidian.md/plugins?id=obsidian-filename-heading-sync'
          },
          text: 'Filename Heading Sync'
        });
        f.appendText(' plugin.');
      }))
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldUpdateFirstHeader');
      });
  }
}
