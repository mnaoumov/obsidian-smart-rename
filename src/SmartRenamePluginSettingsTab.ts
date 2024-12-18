import { Setting } from 'obsidian';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsTabBase';
import { extend } from 'obsidian-dev-utils/obsidian/Plugin/ValueComponent';

import type { SmartRenamePlugin } from './SmartRenamePlugin.ts';

import { InvalidCharacterAction } from './InvalidCharacterAction.ts';

export class SmartRenamePluginSettingsTab extends PluginSettingsTabBase<SmartRenamePlugin> {
  public display(): void {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName('Invalid characters action')
      .setDesc('How to process invalid characters in the new title')
      .addDropdown((dropdown) => {
        dropdown
          .addOptions({
            Error: 'Show error',
            Remove: 'Remove invalid characters',
            Replace: 'Replace invalid character with'
          });
        extend(dropdown)
          .bind(this.plugin, 'invalidCharacterAction', {
            onChanged: () => { this.display(); }
          });
      });

    if (this.plugin.settingsCopy.invalidCharacterAction === InvalidCharacterAction.Replace) {
      new Setting(this.containerEl)
        .setName('Replacement character')
        .setDesc('Character to replace invalid character with')
        .addText((text) => {
          text.inputEl.maxLength = 1;
          text.inputEl.required = true;

          extend(text)
            .bind(this.plugin, 'replacementCharacter', {
              valueValidator: (value) => {
                if (this.plugin.hasInvalidCharacters(value)) {
                  return 'Invalid replacement character';
                } else {
                  return null;
                }
              }
            });
        });
    }

    if (this.plugin.settingsCopy.invalidCharacterAction !== InvalidCharacterAction.Error) {
      new Setting(this.containerEl)
        .setName('Store invalid title')
        .setDesc('If enabled, stores title with invalid characters. If disabled, stores the sanitized version')
        .addToggle((toggle) =>
          extend(toggle)
            .bind(this.plugin, 'shouldStoreInvalidTitle')
        );
    }

    new Setting(this.containerEl)
      .setName('Update title key')
      .setDesc('Update title key in frontmatter')
      .addToggle((toggle) =>
        extend(toggle)
          .bind(this.plugin, 'shouldUpdateTitleKey')
      );

    new Setting(this.containerEl)
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
      .addToggle((toggle) =>
        extend(toggle)
          .bind(this.plugin, 'shouldUpdateFirstHeader')
      );
  }
}
