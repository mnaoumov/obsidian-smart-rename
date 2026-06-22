import type { TFile } from 'obsidian';
import type { ReadonlyDeep } from 'type-fest';

import { FileCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/file-command-handler';

import type { PluginSettings } from '../plugin-settings.ts';

interface InvokeCommandHandlerConstructorParams {
  checkIsMarkdownFile(this: void, file: TFile): boolean;
  getSettings(this: void): ReadonlyDeep<PluginSettings>;
  smartRename(this: void, file: TFile): Promise<void>;
}

export class InvokeCommandHandler extends FileCommandHandler {
  private readonly checkIsMarkdownFile: (file: TFile) => boolean;
  private readonly getSettings: () => ReadonlyDeep<PluginSettings>;
  private readonly smartRename: (file: TFile) => Promise<void>;

  public constructor(params: InvokeCommandHandlerConstructorParams) {
    super({
      fileMenuItemName: 'Smart rename',
      icon: 'edit-3',
      id: 'invoke',
      name: 'Invoke'
    });
    const { checkIsMarkdownFile, getSettings, smartRename } = params;
    this.checkIsMarkdownFile = checkIsMarkdownFile;
    this.getSettings = getSettings;
    this.smartRename = smartRename;
  }

  protected override canExecuteFile(file: TFile): boolean {
    return this.checkIsMarkdownFile(file) || this.getSettings().shouldSupportNonMarkdownFiles;
  }

  protected override async executeFile(file: TFile): Promise<void> {
    await this.smartRename(file);
  }

  protected override shouldAddToFileMenu(_file: TFile, _source: string, _leaf?: unknown): boolean {
    return true;
  }
}
