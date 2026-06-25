import type { CustomArrayDict } from '@obsidian-typings/obsidian-public-latest';
import type { Reference } from 'obsidian';
import type { GenerateMarkdownLinkParams } from 'obsidian-dev-utils/obsidian/link';

import {
  isFrontmatterLinkCache,
  isReferenceCache
} from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  Notice,
  TFile
} from 'obsidian';
import {
  normalizeOptionalProperties,
  toJson
} from 'obsidian-dev-utils/object-utils';
import { AppActiveFileProvider } from 'obsidian-dev-utils/obsidian/active-file-provider';
import { CommandHandlerComponent } from 'obsidian-dev-utils/obsidian/command-handlers/command-handler-component';
import { PluginCommandRegistrar } from 'obsidian-dev-utils/obsidian/command-registrar';
import { MenuEventRegistrarComponent } from 'obsidian-dev-utils/obsidian/components/menu-event-registrar-component';
import { PluginSettingsTabComponent } from 'obsidian-dev-utils/obsidian/components/plugin-settings-tab-component';
import { PluginDataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import {
  addAlias,
  processFrontmatter
} from 'obsidian-dev-utils/obsidian/file-manager';
import {
  getFile,
  isMarkdownFile
} from 'obsidian-dev-utils/obsidian/file-system';
import {
  editLinks,
  extractLinkFile,
  generateMarkdownLink
} from 'obsidian-dev-utils/obsidian/link';
import {
  getBacklinksForFileSafe,
  getCacheSafe
} from 'obsidian-dev-utils/obsidian/metadata-cache';
import { prompt } from 'obsidian-dev-utils/obsidian/modals/prompt';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin';
import { addToQueue } from 'obsidian-dev-utils/obsidian/queue';
import { getOsAndObsidianUnsafePathCharsRegExp } from 'obsidian-dev-utils/obsidian/validation';
import { process } from 'obsidian-dev-utils/obsidian/vault';
import {
  basename,
  extname,
  join,
  makeFileName
} from 'obsidian-dev-utils/path';
import { insertAt } from 'obsidian-dev-utils/string';
import { ensureNonNullable } from 'obsidian-dev-utils/type-guards';

import { InvokeCommandHandler } from './command-handlers/invoke-command-handler.ts';
import { InvalidCharacterAction } from './invalid-character-action.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';
import { PluginSettings } from './plugin-settings.ts';

export class Plugin extends PluginBase {
  private _pluginSettingsComponent?: PluginSettingsComponent;

  private get pluginSettingsComponent(): PluginSettingsComponent {
    return ensureNonNullable(this._pluginSettingsComponent);
  }

  private hasInvalidCharacters(str: string): boolean {
    return getOsAndObsidianUnsafePathCharsRegExp().test(str);
  }

  private async smartRename(file: TFile): Promise<void> {
    const oldTitle = file.basename;
    let newTitle = await prompt({
      app: this.app,
      defaultValue: oldTitle,
      title: 'Enter new title'
    }) ?? '';

    let titleToStore = newTitle;

    if (this.hasInvalidCharacters(newTitle)) {
      switch (this.pluginSettingsComponent.settings.invalidCharacterAction) {
        case InvalidCharacterAction.Error:
          new Notice('The new title has invalid characters');
          return;
        case InvalidCharacterAction.Remove:
          newTitle = this.replaceInvalidCharacters(newTitle, '');
          break;
        case InvalidCharacterAction.Replace:
          newTitle = this.replaceInvalidCharacters(newTitle, this.pluginSettingsComponent.settings.replacementCharacter);
          break;
        default:
          throw new Error('Invalid character action');
      }
    }

    if (!this.pluginSettingsComponent.settings.shouldStoreInvalidTitle) {
      titleToStore = newTitle;
    }

    const newPath = join(file.parent?.getParentPrefix() ?? '', makeFileName(newTitle, file.extension));

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

    addToQueue({
      operationFn: async () => {
        await this.processRename(oldPath, newPath, titleToStore, backlinks);
      },
      operationName: 'Smart rename'
    });
  }

  protected override onloadImpl(): void {
    const dataHandler = new PluginDataHandler(this);
    this._pluginSettingsComponent = this.addChild(
      new PluginSettingsComponent({
        dataHandler,
        hasInvalidCharacters: this.hasInvalidCharacters.bind(this),
        pluginEventSource: this,
        pluginSettingsClass: PluginSettings
      })
    );
    this.addChild(
      new PluginSettingsTabComponent({
        plugin: this,
        pluginSettingsTab: new PluginSettingsTab({
          plugin: this,
          pluginSettingsComponent: this.pluginSettingsComponent
        })
      })
    );
    const menuEventRegistrar = this.addChild(new MenuEventRegistrarComponent(this.app));
    this.addChild(
      new CommandHandlerComponent({
        activeFileProvider: new AppActiveFileProvider(this.app),
        commandHandlers: [
          new InvokeCommandHandler({
            checkIsMarkdownFile: (file): boolean => isMarkdownFile(file),
            getSettings: (): PluginSettings => this.pluginSettingsComponent.settings,
            smartRename: this.smartRename.bind(this)
          })
        ],
        commandRegistrar: new PluginCommandRegistrar(this),
        menuEventRegistrar,
        pluginName: this.manifest.name
      })
    );
  }

  private async addAliases(newPath: string, oldTitle: string, titleToStore: string): Promise<void> {
    const newTitle = basename(newPath, extname(newPath));
    await addAlias(this.app, newPath, oldTitle);

    if (this.pluginSettingsComponent.settings.shouldStoreInvalidTitle && titleToStore !== newTitle) {
      await addAlias(this.app, newPath, titleToStore);
    }
  }

  private async getValidationError(oldTitle: string, newTitle: string, newPath: string): Promise<null | string> {
    if (!newTitle) {
      return 'No new title provided';
    }

    if (newTitle === oldTitle) {
      return 'The title did not change';
    }

    if (newTitle.toLowerCase() === oldTitle.toLowerCase()) {
      return null;
    }

    if (await this.app.vault.exists(newPath)) {
      return 'Note with the new title already exists';
    }

    if (newTitle.startsWith('.')) {
      return 'The title cannot start with a dot';
    }

    return null;
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

        const isNewTitle = (link.displayText ?? '').toLowerCase() === newTitle.toLowerCase();
        const shouldPreservePreviousDisplayText = (isReferenceCache(link) && this.pluginSettingsComponent.settings.shouldPreservePreviousDisplayTextInNoteLinks)
          || (isFrontmatterLinkCache(link) && this.pluginSettingsComponent.settings.shouldPreservePreviousDisplayTextInFrontmatterLinks);

        const alias = isNewTitle && shouldPreservePreviousDisplayText ? oldTitle : link.displayText;

        return generateMarkdownLink(normalizeOptionalProperties<GenerateMarkdownLinkParams>({
          alias,
          app: this.app,
          originalLink: link.original,
          sourcePathOrFile: backlinkNotePath,
          targetPathOrFile: newPath
        }));
      });
    }
  }

  private async processRename(oldPath: string, newPath: string, titleToStore: string, backlinks: CustomArrayDict<Reference>): Promise<void> {
    const oldTitle = basename(oldPath, extname(oldPath));
    await this.processBacklinks(oldPath, newPath, backlinks);

    if (!isMarkdownFile(newPath)) {
      return;
    }

    await this.addAliases(newPath, oldTitle, titleToStore);
    await this.updateTitle(newPath, titleToStore);
    await this.updateFirstHeader(newPath, titleToStore);
  }

  private replaceInvalidCharacters(str: string, replacement: string): string {
    return str.replace(getOsAndObsidianUnsafePathCharsRegExp(), replacement);
  }

  private async updateFirstHeader(newPath: string, titleToStore: string): Promise<void> {
    if (!this.pluginSettingsComponent.settings.shouldUpdateFirstHeader) {
      return;
    }

    await process(this.app, newPath, async ({ abortSignal, content }) => {
      abortSignal.throwIfAborted();
      const cache = await getCacheSafe(this.app, newPath);
      abortSignal.throwIfAborted();
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

  private async updateTitle(newPath: string, titleToStore: string): Promise<void> {
    if (!this.pluginSettingsComponent.settings.shouldUpdateTitleKey) {
      return;
    }
    await processFrontmatter(this.app, newPath, (frontMatter) => {
      frontMatter['title'] = titleToStore;
    });
  }
}
