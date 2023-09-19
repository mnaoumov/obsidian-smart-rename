import { InvalidCharacterAction } from 'InvalidCharacterAction';
import SmartRenamePlugin from 'SmartRenamePlugin';
import { App, PluginSettingTab, Setting } from 'obsidian';

export default class SmartRenameSettingsTab extends PluginSettingTab {
    private plugin: SmartRenamePlugin;

    constructor(app: App, plugin: SmartRenamePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        let { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Smart Rename' });

        new Setting(containerEl)
            .setName('Invalid characters action')
            .setDesc('How to process invalid characters in the new title')
            .addDropdown((dropdownComponent) => {
                dropdownComponent
                    .addOptions({
                        Error: 'Show error',
                        Remove: 'Remove invalid characters',
                        Replace: 'Replace invalid character with'
                    })
                    .setValue(this.plugin.settings.invalidCharacterAction)
                    .onChange(async (value) => {
                        this.plugin.settings.invalidCharacterAction = InvalidCharacterAction[value as keyof typeof InvalidCharacterAction];
                        await this.plugin.saveSettings();
                        this.renderReplacementCharacterSettingEl(replacementCharacterSettingEl);
                        this.renderStoreInvalidTitleSettingEl(storeInvalidTitleSettingEl);
                    });

                const replacementCharacterSettingEl = containerEl.createDiv();
                this.renderReplacementCharacterSettingEl(replacementCharacterSettingEl);

                const storeInvalidTitleSettingEl = containerEl.createDiv();
                this.renderStoreInvalidTitleSettingEl(storeInvalidTitleSettingEl);
            });

        new Setting(containerEl)
            .setName('Update title key')
            .setDesc('Update title key in frontmatter')
            .addToggle(togleComponent => {
                togleComponent
                    .setValue(this.plugin.settings.shouldUpdateTitleKey)
                    .onChange(async (value) => {
                        this.plugin.settings.shouldUpdateTitleKey = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Update first header')
            .setDesc('Update first header if it is present in the document. May conflict with the `Filename Heading Sync` plugin')
            .addToggle(togleComponent => {
                togleComponent
                    .setValue(this.plugin.settings.shouldUpdateFirstHeader)
                    .onChange(async (value) => {
                        this.plugin.settings.shouldUpdateFirstHeader = value;
                        await this.plugin.saveSettings();
                    });
            });
    }

    private renderReplacementCharacterSettingEl(replacementCharacterSettingEl: HTMLDivElement) {
        replacementCharacterSettingEl.empty();

        if (this.plugin.settings.invalidCharacterAction === InvalidCharacterAction.Replace) {
            new Setting(replacementCharacterSettingEl)
                .setName('Replacement character')
                .setDesc('Character to replace invalid character with')
                .addText(textComponent => {
                    textComponent.inputEl.maxLength = 1;
                    textComponent.inputEl.required = true;
                    textComponent.inputEl.addEventListener('blur', () => {
                        textComponent.inputEl.reportValidity();
                    });
                    textComponent
                        .setValue(this.plugin.settings.replacementCharacter)
                        .onChange(async (value) => {
                            if (this.plugin.hasInvalidCharacters(value)) {
                                textComponent.inputEl.setCustomValidity('Invalid replacement character');
                            } else {
                                textComponent.inputEl.setCustomValidity('');
                            }

                            if (textComponent.inputEl.reportValidity()) {
                                this.plugin.settings.replacementCharacter = value;
                                await this.plugin.saveSettings();
                            }
                        });
                });
        }
    }

    private renderStoreInvalidTitleSettingEl(storeInvalidTitleSettingEl: HTMLDivElement) {
        storeInvalidTitleSettingEl.empty();

        if (this.plugin.settings.invalidCharacterAction === InvalidCharacterAction.Error) {
            return;
        }

        new Setting(storeInvalidTitleSettingEl)
            .setName('Store invalid title')
            .setDesc('If enabled, stores title with invalid characters. If disabled, stores the sanitized version')
            .addToggle(togleComponent => {
                togleComponent
                    .setValue(this.plugin.settings.shouldStoreInvalidTitle)
                    .onChange(async (value) => {
                        this.plugin.settings.shouldStoreInvalidTitle = value;
                        await this.plugin.saveSettings();
                    });
            });
    }
}
