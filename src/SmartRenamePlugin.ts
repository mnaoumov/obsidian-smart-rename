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
import { chain } from 'obsidian-dev-utils/obsidian/ChainedPromise';
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
import { escapeRegExp } from 'obsidian-dev-utils/RegExp';
import { insertAt } from 'obsidian-dev-utils/String';

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

    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (!(file instanceof TFile)) {
        return;
      }

      menu.addItem((item) =>
        item.setTitle('Smart Rename')
          .setIcon('edit-3')
          .onClick(async () => this.smartRename(file))
      );
    }));

    const OBSIDIAN_FORBIDDEN_CHARACTERS = '#^[]|';
    const SYSTEM_FORBIDDEN_CHARACTERS = Platform.isWin ? '*\\/<>:|?"' : '\0/';
    const invalidCharacters = Array.from(new Set([...OBSIDIAN_FORBIDDEN_CHARACTERS, ...SYSTEM_FORBIDDEN_CHARACTERS])).join('');
    this.invalidCharactersRegExp = new RegExp(`[${escapeRegExp(invalidCharacters)}]`, 'g');
  }

  private async smartRename(activeFile: TFile): Promise<void> {
    const currentNoteFile = activeFile;
    const oldTitle = currentNoteFile.basename;
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

    const newPath = normalizePath(join(currentNoteFile.parent?.path ?? '', `${newTitle}.md`));

    const validationError = await this.getValidationError(oldTitle, newTitle, newPath);
    if (validationError) {
      new Notice(validationError);
      return;
    }

    const backlinks = await getBacklinksForFileSafe(this.app, currentNoteFile);
    const oldPath = currentNoteFile.path;

    try {
      await this.app.vault.rename(currentNoteFile, newPath);
    } catch (error) {
      new Notice('Failed to rename file');
      console.error(new Error('Failed to rename file', { cause: error }));
      return;
    }

    chain(this.app, async () => {
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
          if (extractLinkFile(this.app, link, backlinkNotePath) !== currentNoteFile && !linkJsons.has(toJson(link))) {
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

      await addAlias(this.app, newPath, oldTitle);

      if (this.settings.shouldStoreInvalidTitle && titleToStore !== newTitle) {
        await addAlias(this.app, newPath, titleToStore);
      }

      if (this.settings.shouldUpdateTitleKey) {
        await processFrontMatter(this.app, newPath, (frontMatter) => {
          frontMatter['title'] = titleToStore;
        });
      }

      if (this.settings.shouldUpdateFirstHeader) {
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
