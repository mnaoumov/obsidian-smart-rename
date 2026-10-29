import type { SettingDefinitionItem } from 'obsidian';

import { appendCodeBlock } from '@mnaoumov/obsidian-lib/html-element';
import { PluginSettingsTabBase } from '@mnaoumov/obsidian-lib/plugin/plugin-settings-tab';

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
        heading: 'Rename intent',
        items: [
          this.settingEx({
            desc: createFragment((f) => {
              f.appendText('Whether renaming a note through Obsidian itself - the inline title, the file explorer, the rename dialog - asks what the rename is meant to do: ');
              appendCodeBlock(f, 'Rename and sync to title/H1');
              f.appendText(', ');
              appendCodeBlock(f, 'Rename and store previous name/title/H1');
              f.appendText(' or ');
              appendCodeBlock(f, 'Rename only');
              f.appendText('.');
              f.createEl('br');
              f.appendText('Renames made by other plugins, by sync or by scripts never ask.');
            }),
            name: 'Ask rename intent',
            render: (setting) => {
              setting.addToggle((toggle) => {
                this.bind({ propertyName: 'shouldAskRenameIntent', valueComponent: toggle });
              });
            }
          }),
          this.settingEx({
            desc: 'Whether the rename intent dialog preselects the choice made last time instead of syncing to title/H1. The dialog\'s own checkbox changes it too.',
            name: 'Save last used choice',
            render: (setting) => {
              setting.addToggle((toggle) => {
                this.bind({ propertyName: 'shouldSaveLastRenameIntent', valueComponent: toggle });
              });
            }
          })
        ]
      }),
      this.settingGroupEx({
        heading: 'Title',
        items: [
          this.settingEx({
            desc: 'Whether to add the old title as an alias of the renamed note, so searches and links using it still resolve.',
            name: 'Should add old title as alias',
            render: (setting) => {
              setting.addToggle((toggle) => {
                this.bind({ propertyName: 'shouldAddOldTitleAsAlias', valueComponent: toggle });
              });
            }
          }),
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
                  href: 'https://community.obsidian.md/plugins/obsidian-filename-heading-sync'
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
