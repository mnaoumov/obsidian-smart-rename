import { appendCodeBlock } from 'obsidian-dev-utils/HTMLElement';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsTabBase';
import { SettingEx } from 'obsidian-dev-utils/obsidian/SettingEx';

import type { PluginTypes } from './PluginTypes.ts';

import { InvalidCharacterAction } from './InvalidCharacterAction.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginTypes> {
  public override display(): void {
    super.display();
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

          this.bind(text, 'replacementCharacter');
        });
    }

    if (this.plugin.settings.invalidCharacterAction !== InvalidCharacterAction.Error) {
      new SettingEx(this.containerEl)
        .setName('Should store invalid title')
        .setDesc(createFragment((f) => {
          f.appendText('Whether to store the title with invalid characters.');
          f.createEl('br');
          f.appendText('If disabled, stores the sanitized version');
        }))
        .addToggle((toggle) => {
          this.bind(toggle, 'shouldStoreInvalidTitle');
        });
    }

    new SettingEx(this.containerEl)
      .setName('Should update title key')
      .setDesc('Whether to update the title key in frontmatter.')
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldUpdateTitleKey');
      });

    new SettingEx(this.containerEl)
      .setName('Should update first header')
      .setDesc(createFragment((f) => {
        f.appendText('Whether to update the first header if it is present in the note. May conflict with the ');
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

    new SettingEx(this.containerEl)
      .setName('Should support non-markdown files')
      .setDesc(createFragment((f) => {
        f.appendText('Whether to support non-markdown files.');
        f.createEl('br');
        f.appendText('If disabled, context menu and ');
        appendCodeBlock(f, 'Smart rename');
        f.appendText(' command will not be available for non-markdown files.');
      }))
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldSupportNonMarkdownFiles');
      });
  }
}
