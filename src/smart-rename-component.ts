import type { CustomArrayDict } from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  Reference,
  TFile
} from 'obsidian';
import type { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';
import type { GenerateMarkdownLinkParams } from 'obsidian-dev-utils/obsidian/link';
import type { ResourceLockComponent } from 'obsidian-dev-utils/obsidian/resource-lock';

import {
  isFrontmatterLinkCache,
  isReferenceCache
} from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  normalizeOptionalProperties,
  toJson
} from 'obsidian-dev-utils/object-utils';
import { ComponentEx } from 'obsidian-dev-utils/obsidian/components/component-ex';
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

import type { PluginSettingsComponent } from './plugin-settings-component.ts';

import { InvalidCharacterAction } from './invalid-character-action.ts';
import { hasInvalidCharacters } from './invalid-character.ts';

interface SmartRenameComponentAddAliasesParams {
  readonly newPath: string;
  readonly oldTitle: string;
  readonly titleToStore: string;
}

interface SmartRenameComponentConstructorParams {
  readonly app: App;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly resourceLockComponent: null | ResourceLockComponent;
}

interface SmartRenameComponentGetValidationErrorParams {
  readonly newPath: string;
  readonly newTitle: string;
  readonly oldTitle: string;
}

interface SmartRenameComponentProcessBacklinksParams {
  readonly backlinks: CustomArrayDict<Reference>;
  readonly newPath: string;
  readonly oldPath: string;
}

interface SmartRenameComponentProcessRenameParams {
  readonly backlinks: CustomArrayDict<Reference>;
  readonly newPath: string;
  readonly oldPath: string;
  readonly titleToStore: string;
}

interface SmartRenameComponentReplaceInvalidCharactersParams {
  readonly replacement: string;
  readonly str: string;
}

interface SmartRenameComponentUpdateFirstHeaderParams {
  readonly newPath: string;
  readonly titleToStore: string;
}

interface SmartRenameComponentUpdateTitleParams {
  readonly newPath: string;
  readonly titleToStore: string;
}

export class SmartRenameComponent extends ComponentEx {
  private readonly app: App;
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private readonly resourceLockComponent: null | ResourceLockComponent;

  public constructor(params: SmartRenameComponentConstructorParams) {
    super();
    this.app = params.app;
    this.resourceLockComponent = params.resourceLockComponent;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public async smartRename(file: TFile): Promise<void> {
    const oldTitle = file.basename;
    let newTitle = await prompt({
      app: this.app,
      defaultValue: oldTitle,
      title: 'Enter new title'
    }) ?? '';

    let titleToStore = newTitle;

    if (hasInvalidCharacters(newTitle)) {
      switch (this.pluginSettingsComponent.settings.invalidCharacterAction) {
        case InvalidCharacterAction.Error:
          this.pluginNoticeComponent.showNotice('The new title has invalid characters');
          return;
        case InvalidCharacterAction.Remove:
          newTitle = this.replaceInvalidCharacters({ replacement: '', str: newTitle });
          break;
        case InvalidCharacterAction.Replace:
          newTitle = this.replaceInvalidCharacters({ replacement: this.pluginSettingsComponent.settings.replacementCharacter, str: newTitle });
          break;
        default:
          throw new Error('Invalid character action');
      }
    }

    if (!this.pluginSettingsComponent.settings.shouldStoreInvalidTitle) {
      titleToStore = newTitle;
    }

    const newPath = join(file.parent?.getParentPrefix() ?? '', makeFileName({ fileBaseName: newTitle, fileExtension: file.extension }));

    const validationError = await this.getValidationError({ newPath, newTitle, oldTitle });
    if (validationError) {
      this.pluginNoticeComponent.showNotice(validationError);
      return;
    }

    const backlinks = await getBacklinksForFileSafe({ app: this.app, pathOrFile: file });
    const oldPath = file.path;

    try {
      await this.app.vault.rename(file, newPath);
    } catch (error) {
      this.pluginNoticeComponent.showNotice('Failed to rename file');
      console.error(new Error('Failed to rename file', { cause: error }));
      return;
    }

    addToQueue({
      operationFn: async () => {
        await this.processRename({ backlinks, newPath, oldPath, titleToStore });
      },
      operationName: 'Smart rename'
    });
  }

  private async addAliases(params: SmartRenameComponentAddAliasesParams): Promise<void> {
    const { newPath, oldTitle, titleToStore } = params;
    const newTitle = basename(newPath, extname(newPath));
    await addAlias({ alias: oldTitle, app: this.app, pathOrFile: newPath, resourceLockComponent: this.resourceLockComponent });

    if (this.pluginSettingsComponent.settings.shouldStoreInvalidTitle && titleToStore !== newTitle) {
      await addAlias({ alias: titleToStore, app: this.app, pathOrFile: newPath, resourceLockComponent: this.resourceLockComponent });
    }
  }

  private async getValidationError(params: SmartRenameComponentGetValidationErrorParams): Promise<null | string> {
    const { newPath, newTitle, oldTitle } = params;
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

  private async processBacklinks(params: SmartRenameComponentProcessBacklinksParams): Promise<void> {
    const { backlinks, newPath, oldPath } = params;
    const newFile = getFile({ app: this.app, pathOrFile: newPath });
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

      await editLinks({
        app: this.app,
        linkConverter: (link) => {
          if (extractLinkFile({ app: this.app, link, sourcePathOrFile: backlinkNotePath }) !== newFile && !linkJsons.has(toJson(link))) {
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
        },
        pathOrFile: backlinkNotePath,
        pluginNoticeComponent: null,
        resourceLockComponent: this.resourceLockComponent
      });
    }
  }

  private async processRename(params: SmartRenameComponentProcessRenameParams): Promise<void> {
    const { backlinks, newPath, oldPath, titleToStore } = params;
    const oldTitle = basename(oldPath, extname(oldPath));
    await this.processBacklinks({ backlinks, newPath, oldPath });

    if (!isMarkdownFile(newPath)) {
      return;
    }

    await this.addAliases({ newPath, oldTitle, titleToStore });
    await this.updateTitle({ newPath, titleToStore });
    await this.updateFirstHeader({ newPath, titleToStore });
  }

  private replaceInvalidCharacters(params: SmartRenameComponentReplaceInvalidCharactersParams): string {
    const { replacement, str } = params;
    return str.replace(getOsAndObsidianUnsafePathCharsRegExp(), replacement);
  }

  private async updateFirstHeader(params: SmartRenameComponentUpdateFirstHeaderParams): Promise<void> {
    const { newPath, titleToStore } = params;
    if (!this.pluginSettingsComponent.settings.shouldUpdateFirstHeader) {
      return;
    }

    await process({
      app: this.app,
      newContentProvider: async ({ abortSignal, content }) => {
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

        return insertAt({
          endIndex: firstHeading.position.end.offset,
          startIndex: firstHeading.position.start.offset,
          str: content,
          substring: `# ${titleToStore}`
        });
      },
      pathOrFile: newPath,
      pluginNoticeComponent: null,
      resourceLockComponent: this.resourceLockComponent
    });
  }

  private async updateTitle(params: SmartRenameComponentUpdateTitleParams): Promise<void> {
    const { newPath, titleToStore } = params;
    if (!this.pluginSettingsComponent.settings.shouldUpdateTitleKey) {
      return;
    }
    await processFrontmatter({
      app: this.app,
      frontmatterFn: (frontMatter) => {
        frontMatter['title'] = titleToStore;
      },
      pathOrFile: newPath,
      pluginNoticeComponent: null,
      resourceLockComponent: this.resourceLockComponent
    });
  }
}
