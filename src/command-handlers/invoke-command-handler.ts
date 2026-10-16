import type { TFile } from 'obsidian';

import { FileCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/file-command-handler';
import { isMarkdownFile } from '@mnaoumov/obsidian-lib/file-system';

import type { PluginSettingsComponent } from '../plugin-settings-component.ts';
import type { SmartRenameComponent } from '../smart-rename-component.ts';

interface InvokeCommandHandlerConstructorParams {
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly smartRenameComponent: SmartRenameComponent;
}

export class InvokeCommandHandler extends FileCommandHandler {
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private readonly smartRenameComponent: SmartRenameComponent;

  public constructor(params: InvokeCommandHandlerConstructorParams) {
    super({
      fileMenuItemName: 'Smart rename',
      icon: 'edit-3',
      id: 'invoke',
      name: 'Invoke'
    });

    this.pluginSettingsComponent = params.pluginSettingsComponent;
    this.smartRenameComponent = params.smartRenameComponent;
  }

  protected override canExecuteFile(file: TFile): boolean {
    return isMarkdownFile(file) || this.pluginSettingsComponent.settings.shouldSupportNonMarkdownFiles;
  }

  protected override async executeFile(file: TFile): Promise<void> {
    await this.smartRenameComponent.smartRename(file);
  }

  protected override shouldAddToFileMenu(): boolean {
    return true;
  }
}
