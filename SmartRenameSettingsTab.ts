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
                    });

                const replacementCharacterSettingEl = containerEl.createDiv();
                this.renderReplacementCharacterSettingEl(replacementCharacterSettingEl);
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
}
