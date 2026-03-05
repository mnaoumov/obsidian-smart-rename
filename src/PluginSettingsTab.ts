import { appendCodeBlock } from 'obsidian-dev-utils/HTMLElement';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsTabBase';
import { SettingGroupEx } from 'obsidian-dev-utils/obsidian/SettingGroupEx';

import type { PluginTypes } from './PluginTypes.ts';

import { InvalidCharacterAction } from './InvalidCharacterAction.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginTypes> {
  public override display(): void {
    super.display();
    this.containerEl.empty();

    new SettingGroupEx(this.containerEl)
      .setHeading('Invalid characters')
      .addSettingEx((setting) => {
        setting
          .setName('Invalid characters action')
          .setDesc('How to process invalid characters in the new title.')
          .addDropdown((dropdown) => {
            dropdown.addOptions({
              Error: 'Show error',
              Remove: 'Remove invalid characters',
              Replace: 'Replace invalid characters'
            });
            this.bind(dropdown, 'invalidCharacterAction', {
              onChanged: () => {
                this.display();
              }
            });
          });
      })
      .addSettingEx((setting) => {
        setting
          .setName('Replacement character')
          .setDesc(createFragment((f) => {
            f.appendText('Character to replace invalid character with.');
            f.createEl('br');
            f.appendText('Applicable only if ');
            appendCodeBlock(f, 'Invalid characters action');
            f.appendText(' setting is set to ');
            appendCodeBlock(f, 'Replace invalid characters');
            f.appendText('.');
          }))
          .setDisabled(this.plugin.settings.invalidCharacterAction !== InvalidCharacterAction.Replace)
          .addText((text) => {
            text.inputEl.maxLength = 1;
            this.bind(text, 'replacementCharacter');
          });
      });

    new SettingGroupEx(this.containerEl)
      .setHeading('Title')
      .addSettingEx((setting) => {
        setting
          .setName('Should update title key')
          .setDesc('Whether to update the title key in frontmatter.')
          .addToggle((toggle) => {
            this.bind(toggle, 'shouldUpdateTitleKey');
          });
      })
      .addSettingEx((setting) => {
        setting
          .setName('Should store invalid title')
          .setDesc(createFragment((f) => {
            f.appendText('Whether to store the title with invalid characters.');
            f.createEl('br');
            f.appendText('If disabled, stores the sanitized version.');
          }))
          .addToggle((toggle) => {
            this.bind(toggle, 'shouldStoreInvalidTitle');
          });
      });

    new SettingGroupEx(this.containerEl)
      .setHeading('Previous display text')
      .addSettingEx((setting) => {
        setting
          .setName('Should preserve previous display text in note links')
          .setDesc('Whether to preserve the previous display text in note links.')
          .addToggle((toggle) => {
            this.bind(toggle, 'shouldPreservePreviousDisplayTextInNoteLinks');
          });
      })
      .addSettingEx((setting) => {
        setting
          .setName('Should preserve previous display text in frontmatter links')
          .setDesc('Whether to preserve the previous display text in frontmatter links.')
          .addToggle((toggle) => {
            this.bind(toggle, 'shouldPreservePreviousDisplayTextInFrontmatterLinks');
          });
      });

    new SettingGroupEx(this.containerEl)
      .setHeading('Other')
      .addSettingEx((setting) => {
        setting
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
      })
      .addSettingEx((setting) => {
        setting
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
      });
  }
}
