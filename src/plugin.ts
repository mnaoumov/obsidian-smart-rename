import { AppActiveFileProvider } from 'obsidian-dev-utils/obsidian/active-file-provider';
import { CommandHandlerComponent } from 'obsidian-dev-utils/obsidian/command-handlers/command-handler-component';
import { PluginCommandRegistrar } from 'obsidian-dev-utils/obsidian/command-registrar';
import { MenuEventRegistrarComponent } from 'obsidian-dev-utils/obsidian/components/menu-event-registrar-component';
import { PluginSettingsTabComponent } from 'obsidian-dev-utils/obsidian/components/plugin-settings-tab-component';
import { PluginDataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin';

import { InvokeCommandHandler } from './command-handlers/invoke-command-handler.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';
import { PluginSettings } from './plugin-settings.ts';
import { SmartRenameComponent } from './smart-rename-component.ts';

export class Plugin extends PluginBase {
  protected override onloadImpl(): void {
    const dataHandler = new PluginDataHandler(this);
    const pluginSettingsComponent = this.addChild(
      new PluginSettingsComponent({
        dataHandler,
        pluginEventSource: this,
        pluginSettingsClass: PluginSettings
      })
    );
    this.addChild(
      new PluginSettingsTabComponent({
        plugin: this,
        pluginSettingsTab: new PluginSettingsTab({
          plugin: this,
          pluginSettingsComponent
        })
      })
    );
    const menuEventRegistrar = this.addChild(new MenuEventRegistrarComponent(this.app));
    const smartRenameComponent = this.addChild(
      new SmartRenameComponent({
        app: this.app,
        pluginSettingsComponent
      })
    );
    this.addChild(
      new CommandHandlerComponent({
        activeFileProvider: new AppActiveFileProvider(this.app),
        commandHandlers: [
          new InvokeCommandHandler({
            pluginSettingsComponent,
            smartRenameComponent
          })
        ],
        commandRegistrar: new PluginCommandRegistrar(this),
        menuEventRegistrar,
        pluginName: this.manifest.name
      })
    );
  }
}
