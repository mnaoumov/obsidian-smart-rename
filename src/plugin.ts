import { OpenDemoVaultCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/open-demo-vault-command-handler';
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
    const smartRenameComponent = this.addChild(
      new SmartRenameComponent({
        app: this.app,
        pluginNoticeComponent: this.pluginNoticeComponent,
        pluginSettingsComponent,
        resourceLockComponent: this.resourceLockComponent
      })
    );
    this.commandHandlerComponent.registerCommandHandlers([
      new InvokeCommandHandler({
        pluginSettingsComponent,
        smartRenameComponent
      }),
      new OpenDemoVaultCommandHandler({
        app: this.app,
        pluginId: this.manifest.id,
        pluginNoticeComponent: this.pluginNoticeComponent,
        pluginVersion: this.manifest.version
      })
    ]);
  }
}
