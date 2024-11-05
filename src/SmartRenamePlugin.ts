import type { PluginSettingTab } from 'obsidian';
import {
  normalizePath,
  Notice,
  Platform,
  TFile
} from 'obsidian';
import type { MaybePromise } from 'obsidian-dev-utils/Async';
import { invokeAsyncSafely } from 'obsidian-dev-utils/Async';
import { toJson } from 'obsidian-dev-utils/Object';
import {
  addAlias,
  processFrontMatter
} from 'obsidian-dev-utils/obsidian/FileManager';
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
import { join } from 'obsidian-dev-utils/Path';

import { InvalidCharacterAction } from './InvalidCharacterAction.ts';
import SmartRenamePluginSettings from './SmartRenamePluginSettings.ts';
import SmartRenamePluginSettingsTab from './SmartRenamePluginSettingsTab.ts';

export default class SmartRenamePlugin extends PluginBase<SmartRenamePluginSettings> {
  private systemForbiddenCharactersRegExp!: RegExp;
  private readonly obsidianForbiddenCharactersRegExp = /[#^[\]|]/g;
  private currentNoteFile!: TFile;
  private oldTitle!: string;
  private newTitle!: string;
  private newPath!: string;

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
      checkCallback: (checking: boolean): boolean => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
          return false;
        }

        if (!checking) {
          invokeAsyncSafely(() => this.smartRename(activeFile));
        }
        return true;
      }
    });

    const isWindows = Platform.isWin;
    this.systemForbiddenCharactersRegExp = isWindows ? /[*"\\/<>:|?]/g : /[\\/]/g;
  }

  private async smartRename(activeFile: TFile): Promise<void> {
    this.currentNoteFile = activeFile;
    this.oldTitle = this.currentNoteFile.basename;
    this.newTitle = await prompt({
      app: this.app,
      title: 'Enter new title',
      defaultValue: this.oldTitle
    }) ?? '';

    let titleToStore = this.newTitle;

    if (this.hasInvalidCharacters(this.newTitle)) {
      switch (this.settings.invalidCharacterAction) {
        case InvalidCharacterAction.Error:
          new Notice('The new title has invalid characters');
          return;
        case InvalidCharacterAction.Remove:
          this.newTitle = this.replaceInvalidCharacters(this.newTitle, '');
          break;
        case InvalidCharacterAction.Replace:
          this.newTitle = this.replaceInvalidCharacters(this.newTitle, this.settings.replacementCharacter);
          break;
      }
    }

    if (!this.settings.shouldStoreInvalidTitle) {
      titleToStore = this.newTitle;
    }

    this.newPath = normalizePath(join(this.currentNoteFile.parent?.path ?? '', `${this.newTitle}.md`));

    const validationError = await this.getValidationError();
    if (validationError) {
      new Notice(validationError);
      return;
    }

    const backlinks = await getBacklinksForFileSafe(this.app, this.currentNoteFile);

    try {
      await this.app.vault.rename(this.currentNoteFile, this.newPath);
    } catch (error) {
      new Notice('Failed to rename file');
      console.error(new Error('Failed to rename file', { cause: error }));
      return;
    }

    for (const backlinkNotePath of backlinks.keys()) {
      const links = backlinks.get(backlinkNotePath);
      if (!links) {
        continue;
      }

      const linkJsons = new Set(links.map((link) => toJson(link)));

      await editLinks(this.app, backlinkNotePath, (link) => {
        if (extractLinkFile(this.app, link, backlinkNotePath) !== this.currentNoteFile && !linkJsons.has(toJson(link))) {
          return;
        }

        return generateMarkdownLink({
          app: this.app,
          pathOrFile: this.newPath,
          sourcePathOrFile: backlinkNotePath,
          alias: link.displayText ?? this.oldTitle,
          originalLink: link.original
        });
      });
    }

    await addAlias(this.app, this.newPath, this.oldTitle);

    if (this.settings.shouldStoreInvalidTitle && titleToStore !== this.newTitle) {
      await addAlias(this.app, this.newPath, titleToStore);
    }

    if (this.settings.shouldUpdateTitleKey) {
      await processFrontMatter(this.app, this.newPath, (frontMatter) => {
        frontMatter['title'] = titleToStore;
      });
    }

    if (this.settings.shouldUpdateFirstHeader) {
      await process(this.app, this.newPath, async (content) => {
        const cache = await getCacheSafe(this.app, this.newPath);
        if (cache === null) {
          return null;
        }

        const firstHeading = cache.headings?.filter((h) => h.level === 1).sort((a, b) => a.position.start.offset - b.position.start.offset)[0];
        if (!firstHeading) {
          return content;
        }

        return content.slice(0, firstHeading.position.start.offset) + `# ${titleToStore}` + content.slice(firstHeading.position.end.offset);
      });
    }
  }

  private async getValidationError(): Promise<string | null> {
    if (!this.newTitle) {
      return 'No new title provided';
    }

    if (this.newTitle === this.oldTitle) {
      return 'The title did not change';
    }

    if (await this.app.vault.exists(this.newPath)) {
      return 'Note with the new title already exists';
    }

    return null;
  }

  public hasInvalidCharacters(str: string): boolean {
    return this.systemForbiddenCharactersRegExp.test(str) || this.obsidianForbiddenCharactersRegExp.test(str);
  }

  private replaceInvalidCharacters(str: string, replacement: string): string {
    return str.replace(this.systemForbiddenCharactersRegExp, replacement).replace(this.obsidianForbiddenCharactersRegExp, replacement);
  }
}
