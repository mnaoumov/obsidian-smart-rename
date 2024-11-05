import type {
  Menu,
  PluginSettingTab,
  Reference,
  TAbstractFile
} from 'obsidian';
import {
  Notice,
  Platform,
  TFile
} from 'obsidian';
import type { MaybePromise } from 'obsidian-dev-utils/Async';
import { invokeAsyncSafely } from 'obsidian-dev-utils/Async';
import { toJson } from 'obsidian-dev-utils/Object';
import { chain } from 'obsidian-dev-utils/obsidian/ChainedPromise';
import {
  addAlias,
  processFrontMatter
} from 'obsidian-dev-utils/obsidian/FileManager';
import { getFile } from 'obsidian-dev-utils/obsidian/FileSystem';
import {
  editLinks,
  extractLinkFile,
  generateMarkdownLink
} from 'obsidian-dev-utils/obsidian/Link';
import {
  getBacklinksForFileSafe,
  getCacheSafe
} from 'obsidian-dev-utils/obsidian/MetadataCache';
import { prompt } from 'obsidian-dev-utils/obsidian/Modal/Prompt';
import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';
import { process } from 'obsidian-dev-utils/obsidian/Vault';
import {
  basename,
  extname,
  join
} from 'obsidian-dev-utils/Path';
import { escapeRegExp } from 'obsidian-dev-utils/RegExp';
import { insertAt } from 'obsidian-dev-utils/String';
import type { CustomArrayDict } from 'obsidian-typings';

import { InvalidCharacterAction } from './InvalidCharacterAction.ts';
import SmartRenamePluginSettings from './SmartRenamePluginSettings.ts';
import SmartRenamePluginSettingsTab from './SmartRenamePluginSettingsTab.ts';

export default class SmartRenamePlugin extends PluginBase<SmartRenamePluginSettings> {
  private invalidCharactersRegExp!: RegExp;

  protected override createDefaultPluginSettings(): SmartRenamePluginSettings {
    return new SmartRenamePluginSettings();
  }

  protected override createPluginSettingsTab(): PluginSettingTab | null {
    return new SmartRenamePluginSettingsTab(this);
  }

  protected override onloadComplete(): MaybePromise<void> {
    this.addCommand({
      id: 'smart-rename',
      name: 'Smart Rename',
      checkCallback: this.smartRenameCommandCheck.bind(this)
    });

    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      this.fileMenuHandler(menu, file);
    }));

    const OBSIDIAN_FORBIDDEN_CHARACTERS = '#^[]|';
    const SYSTEM_FORBIDDEN_CHARACTERS = Platform.isWin ? '*\\/<>:|?"' : '\0/';
    const invalidCharacters = Array.from(new Set([...OBSIDIAN_FORBIDDEN_CHARACTERS, ...SYSTEM_FORBIDDEN_CHARACTERS])).join('');
    this.invalidCharactersRegExp = new RegExp(`[${escapeRegExp(invalidCharacters)}]`, 'g');
  }

  private fileMenuHandler(menu: Menu, file: TAbstractFile): void {
    if (!(file instanceof TFile)) {
      return;
    }

    menu.addItem((item) =>
      item.setTitle('Smart Rename')
        .setIcon('edit-3')
        .onClick(() => { invokeAsyncSafely(() => this.smartRename(file)); })
    );
  }

  private smartRenameCommandCheck(checking: boolean): boolean {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      return false;
    }

    if (!checking) {
      invokeAsyncSafely(() => this.smartRename(activeFile));
    }
    return true;
  }

  private async smartRename(file: TFile): Promise<void> {
    const oldTitle = file.basename;
    let newTitle = await prompt({
      app: this.app,
      title: 'Enter new title',
      defaultValue: oldTitle
    }) ?? '';

    let titleToStore = newTitle;

    if (this.hasInvalidCharacters(newTitle)) {
      switch (this.settings.invalidCharacterAction) {
        case InvalidCharacterAction.Error:
          new Notice('The new title has invalid characters');
          return;
        case InvalidCharacterAction.Remove:
          newTitle = this.replaceInvalidCharacters(newTitle, '');
          break;
        case InvalidCharacterAction.Replace:
          newTitle = this.replaceInvalidCharacters(newTitle, this.settings.replacementCharacter);
          break;
      }
    }

    if (!this.settings.shouldStoreInvalidTitle) {
      titleToStore = newTitle;
    }

    const newPath = join(file.parent?.getParentPrefix() ?? '', `${newTitle}.md`);

    const validationError = await this.getValidationError(oldTitle, newTitle, newPath);
    if (validationError) {
      new Notice(validationError);
      return;
    }

    const backlinks = await getBacklinksForFileSafe(this.app, file);
    const oldPath = file.path;

    try {
      await this.app.vault.rename(file, newPath);
    } catch (error) {
      new Notice('Failed to rename file');
      console.error(new Error('Failed to rename file', { cause: error }));
      return;
    }

    chain(this.app, async () => {
      await this.processRename(oldPath, newPath, titleToStore, backlinks);
    });
  }

  private async processRename(oldPath: string, newPath: string, titleToStore: string, backlinks: CustomArrayDict<Reference>): Promise<void> {
    const oldTitle = basename(oldPath, extname(oldPath));
    await this.processBacklinks(oldPath, newPath, backlinks);
    await this.addAliases(newPath, oldTitle, titleToStore);
    await this.updateTitle(newPath, titleToStore);
    await this.updateFirstHeader(newPath, titleToStore);
  }

  private async processBacklinks(oldPath: string, newPath: string, backlinks: CustomArrayDict<Reference>): Promise<void> {
    const newFile = getFile(this.app, newPath);
    const oldTitle = basename(oldPath, extname(oldPath));
    const newTitle = newFile.basename;

    for (let backlinkNotePath of backlinks.keys()) {
      const links = backlinks.get(backlinkNotePath);
      if (!links) {
        continue;
      }

      if (backlinkNotePath === oldPath) {
        backlinkNotePath = newPath;
      }

      const linkJsons = new Set(links.map((link) => toJson(link)));

      await editLinks(this.app, backlinkNotePath, (link) => {
        if (extractLinkFile(this.app, link, backlinkNotePath) !== newFile && !linkJsons.has(toJson(link))) {
          return;
        }

        const alias = (link.displayText ?? '').toLowerCase() === newTitle.toLowerCase() ? oldTitle : link.displayText;

        return generateMarkdownLink({
          app: this.app,
          pathOrFile: newPath,
          sourcePathOrFile: backlinkNotePath,
          alias,
          originalLink: link.original
        });
      });
    }
  }

  private async addAliases(newPath: string, oldTitle: string, titleToStore: string): Promise<void> {
    const newTitle = basename(newPath, extname(newPath));
    await addAlias(this.app, newPath, oldTitle);

    if (this.settings.shouldStoreInvalidTitle && titleToStore !== newTitle) {
      await addAlias(this.app, newPath, titleToStore);
    }
  }

  private async updateTitle(newPath: string, titleToStore: string): Promise<void> {
    if (!this.settings.shouldUpdateTitleKey) {
      return;
    }
    await processFrontMatter(this.app, newPath, (frontMatter) => {
      frontMatter['title'] = titleToStore;
    });
  }

  private async updateFirstHeader(newPath: string, titleToStore: string): Promise<void> {
    if (!this.settings.shouldUpdateFirstHeader) {
      return;
    }

    await process(this.app, newPath, async (content) => {
      const cache = await getCacheSafe(this.app, newPath);
      if (cache === null) {
        return null;
      }

      const firstHeading = cache.headings?.filter((h) => h.level === 1).sort((a, b) => a.position.start.offset - b.position.start.offset)[0];
      if (!firstHeading) {
        return content;
      }

      return insertAt(content, `# ${titleToStore}`, firstHeading.position.start.offset, firstHeading.position.end.offset);
    });
  }

  private async getValidationError(oldTitle: string, newTitle: string, newPath: string): Promise<string | null> {
    if (!newTitle) {
      return 'No new title provided';
    }

    if (newTitle === oldTitle) {
      return 'The title did not change';
    }

    if (await this.app.vault.exists(newPath)) {
      return 'Note with the new title already exists';
    }

    return null;
  }

  public hasInvalidCharacters(str: string): boolean {
    return this.invalidCharactersRegExp.test(str);
  }

  private replaceInvalidCharacters(str: string, replacement: string): string {
    return str.replace(this.invalidCharactersRegExp, replacement);
  }
}
