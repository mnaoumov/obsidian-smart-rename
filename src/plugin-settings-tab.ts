import type { SettingDefinitionItem } from 'obsidian';

import { appendCodeBlock } from 'obsidian-dev-utils/obsidian/html-element';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';

import type { PluginSettings } from './plugin-settings.ts';

import { InvalidCharacterAction } from './invalid-character-action.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  protected override getSettingDefinitionItems(): SettingDefinitionItem[] {
    return [
      this.settingGroupEx({
        heading: 'Invalid characters',
        items: [
          this.settingEx({
            desc: 'How to process invalid characters in the new title.',
            name: 'Invalid characters action',
            render: (setting) => {
              setting.addDropdown((dropdown) => {
                dropdown.addOptions({
                  Error: 'Show error',
                  Remove: 'Remove invalid characters',
                  Replace: 'Replace invalid characters'
                });
                this.bind({
                  onChanged: () => {
                    // Only the replacement-character row's `disabled` predicate depends on this value, so
                    // Obsidian re-evaluates it in place instead of re-rendering the tab.
                    this.refreshDomState();
                  },
                  propertyName: 'invalidCharacterAction',
                  valueComponent: dropdown
                });
              });
            }
          }),
          this.settingEx({
            desc: createFragment((f) => {
              f.appendText('Character to replace invalid character with.');
              f.createEl('br');
              f.appendText('Applicable only if ');
              appendCodeBlock(f, 'Invalid characters action');
              f.appendText(' setting is set to ');
              appendCodeBlock(f, 'Replace invalid characters');
              f.appendText('.');
            }),
            disabled: () => this.pluginSettingsComponent.settings.invalidCharacterAction !== InvalidCharacterAction.Replace,
            name: 'Replacement character',
            render: (setting) => {
              setting.addText((text) => {
                text.inputEl.maxLength = 1;
                this.bind({ propertyName: 'replacementCharacter', valueComponent: text });
              });
            }
          })
        ]
      }),
      this.settingGroupEx({
        heading: 'Title',
        items: [
          this.settingEx({
            desc: 'Whether to update the title key in frontmatter.',
            name: 'Should update title key',
            render: (setting) => {
              setting.addToggle((toggle) => {
                this.bind({ propertyName: 'shouldUpdateTitleKey', valueComponent: toggle });
              });
            }
          }),
          this.settingEx({
            desc: createFragment((f) => {
              f.appendText('Whether to store the title with invalid characters.');
              f.createEl('br');
              f.appendText('If disabled, stores the sanitized version.');
            }),
            name: 'Should store invalid title',
            render: (setting) => {
              setting.addToggle((toggle) => {
                this.bind({ propertyName: 'shouldStoreInvalidTitle', valueComponent: toggle });
              });
            }
          })
        ]
      }),
      this.settingGroupEx({
        heading: 'Previous display text',
        items: [
          this.settingEx({
            desc: 'Whether to preserve the previous display text in note links.',
            name: 'Should preserve previous display text in note links',
            render: (setting) => {
              setting.addToggle((toggle) => {
                this.bind({ propertyName: 'shouldPreservePreviousDisplayTextInNoteLinks', valueComponent: toggle });
              });
            }
          }),
          this.settingEx({
            desc: 'Whether to preserve the previous display text in frontmatter links.',
            name: 'Should preserve previous display text in frontmatter links',
            render: (setting) => {
              setting.addToggle((toggle) => {
                this.bind({ propertyName: 'shouldPreservePreviousDisplayTextInFrontmatterLinks', valueComponent: toggle });
              });
            }
          })
        ]
      }),
      this.settingGroupEx({
        heading: 'Other',
        items: [
          this.settingEx({
            desc: createFragment((f) => {
              f.appendText('Whether to update the first header if it is present in the note. May conflict with the ');
              f.createEl('a', {
                attr: {
                  href: 'https://obsidian.md/plugins?id=obsidian-filename-heading-sync'
                },
                text: 'Filename Heading Sync'
              });
              f.appendText(' plugin.');
            }),
            name: 'Should update first header',
            render: (setting) => {
              setting.addToggle((toggle) => {
                this.bind({ propertyName: 'shouldUpdateFirstHeader', valueComponent: toggle });
              });
            }
          }),
          this.settingEx({
            desc: createFragment((f) => {
              f.appendText('Whether to support non-markdown files.');
              f.createEl('br');
              f.appendText('If disabled, context menu and ');
              appendCodeBlock(f, 'Smart rename');
              f.appendText(' command will not be available for non-markdown files.');
            }),
            name: 'Should support non-markdown files',
            render: (setting) => {
              setting.addToggle((toggle) => {
                this.bind({ propertyName: 'shouldSupportNonMarkdownFiles', valueComponent: toggle });
              });
            }
          })
        ]
      })
    ];
  }
}
