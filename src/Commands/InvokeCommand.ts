import type { TFile } from 'obsidian';

import {
  FileCommandBase,
  FileCommandInvocationBase
} from 'obsidian-dev-utils/obsidian/Commands/FileCommandBase';
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/FileSystem';

import type { Plugin } from '../Plugin.ts';

class InvokeCommandInvocation extends FileCommandInvocationBase<Plugin> {
  public constructor(plugin: Plugin, file: null | TFile) {
    super(plugin, file);
  }

  public override async execute(): Promise<void> {
    await this.plugin.smartRename(this.file);
  }

  protected override canExecute(): boolean {
    if (!super.canExecute()) {
      return false;
    }
    if (!this.plugin.settings.shouldSupportNonMarkdownFiles && !isMarkdownFile(this.app, this.file)) {
      return false;
    }

    return true;
  }
}

export class InvokeCommand extends FileCommandBase<Plugin> {
  public constructor(plugin: Plugin) {
    super({
      fileMenuItemName: 'Smart rename',
      icon: 'edit-3',
      id: 'invoke',
      name: 'Invoke',
      plugin
    });
  }

  protected override createCommandInvocationForFile(file: null | TFile): FileCommandInvocationBase<Plugin> {
    return new InvokeCommandInvocation(this.plugin, file);
  }

  protected override shouldAddToFileMenu(): boolean {
    return true;
  }
}
