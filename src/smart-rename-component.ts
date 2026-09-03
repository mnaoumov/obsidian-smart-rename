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
import { ModalCommandBuilder } from 'obsidian-dev-utils/obsidian/modals/modal-command-builder';
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

/**
 * One checkbox in the rename prompt's control strip, bound to the {@link PostRenameSteps} member it
 * toggles.
 */
interface PostRenameStepCheckbox {
  /**
   * Whether the step it controls runs only for markdown files, in which case the checkbox is rendered
   * disabled for any other file — `processRename` returns before those steps.
   */
  readonly isMarkdownOnly: boolean;

  readonly key: string;
  readonly purpose: string;
  readonly stepName: keyof PostRenameSteps;
}

/**
 * The post-rename steps, as they apply to ONE rename.
 *
 * Seeded from the settings and then handed to the prompt's checkboxes, so a single rename can deviate
 * without a trip to Settings. Deliberately mutable and deliberately NOT written back: the checkboxes are
 * scoped to this rename, and the queued operation captures this object, so a settings change made while
 * the rename is in flight cannot retroactively alter it.
 */
interface PostRenameSteps {
  shouldAddOldTitleAsAlias: boolean;
  shouldPreservePreviousDisplayTextInFrontmatterLinks: boolean;
  shouldPreservePreviousDisplayTextInNoteLinks: boolean;
  shouldUpdateFirstHeader: boolean;
  shouldUpdateTitleKey: boolean;
}

interface SmartRenameComponentAddAliasesParams {
  readonly newPath: string;
  readonly oldTitle: string;
  readonly steps: PostRenameSteps;
  readonly titleToStore: string;
}

interface SmartRenameComponentBuildCommandBuilderParams {
  readonly file: TFile;
  readonly steps: PostRenameSteps;
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
  readonly steps: PostRenameSteps;
}

interface SmartRenameComponentProcessRenameParams {
  readonly backlinks: CustomArrayDict<Reference>;
  readonly newPath: string;
  readonly oldPath: string;
  readonly steps: PostRenameSteps;
  readonly titleToStore: string;
}

interface SmartRenameComponentReplaceInvalidCharactersParams {
  readonly $string: string;
  readonly replacement: string;
}

interface SmartRenameComponentUpdateFirstHeaderParams {
  readonly newPath: string;
  readonly steps: PostRenameSteps;
  readonly titleToStore: string;
}

interface SmartRenameComponentUpdateTitleParams {
  readonly newPath: string;
  readonly steps: PostRenameSteps;
  readonly titleToStore: string;
}

const POST_RENAME_STEP_CHECKBOXES: readonly PostRenameStepCheckbox[] = [
  { isMarkdownOnly: false, key: '1', purpose: 'Keep old title in note links', stepName: 'shouldPreservePreviousDisplayTextInNoteLinks' },
  { isMarkdownOnly: false, key: '2', purpose: 'Keep old title in frontmatter links', stepName: 'shouldPreservePreviousDisplayTextInFrontmatterLinks' },
  { isMarkdownOnly: true, key: '3', purpose: 'Add old title as alias', stepName: 'shouldAddOldTitleAsAlias' },
  { isMarkdownOnly: true, key: '4', purpose: 'Update title key', stepName: 'shouldUpdateTitleKey' },
  { isMarkdownOnly: true, key: '5', purpose: 'Update first header', stepName: 'shouldUpdateFirstHeader' }
];

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
    const steps = this.buildPostRenameSteps();
    let newTitle = await prompt({
      app: this.app,
      commandBuilder: this.buildCommandBuilder({ file, steps }),
      defaultValue: oldTitle,
      title: 'Enter new title'
    }) ?? '';

    let titleToStore = newTitle;

    if (hasInvalidCharacters(newTitle)) {
      switch (this.pluginSettingsComponent.settings.invalidCharacterAction) {
        case InvalidCharacterAction.Error: {
          this.pluginNoticeComponent.showNotice('The new title has invalid characters');
          return;
        }
        case InvalidCharacterAction.Remove: {
          newTitle = this.replaceInvalidCharacters({ $string: newTitle, replacement: '' });
          break;
        }
        case InvalidCharacterAction.Replace: {
          newTitle = this.replaceInvalidCharacters({ $string: newTitle, replacement: this.pluginSettingsComponent.settings.replacementCharacter });
          break;
        }
        default: {
          throw new Error('Invalid character action');
        }
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
      operationFunction: async () => {
        await this.processRename({ backlinks, newPath, oldPath, steps, titleToStore });
      },
      operationName: 'Smart rename'
    });
  }

  private async addAliases(params: SmartRenameComponentAddAliasesParams): Promise<void> {
    const { newPath, oldTitle, steps, titleToStore } = params;
    const newTitle = basename(newPath, extname(newPath));
    if (steps.shouldAddOldTitleAsAlias) {
      await addAlias({ alias: oldTitle, app: this.app, pathOrFile: newPath, resourceLockComponent: this.resourceLockComponent });
    }

    // Not governed by the checkbox above: this alias is the NEW title as it was typed, kept because the
    // Rename had to sanitize it — a different thing from carrying the old title forward.
    if (this.pluginSettingsComponent.settings.shouldStoreInvalidTitle && titleToStore !== newTitle) {
      await addAlias({ alias: titleToStore, app: this.app, pathOrFile: newPath, resourceLockComponent: this.resourceLockComponent });
    }
  }

  private buildCommandBuilder(params: SmartRenameComponentBuildCommandBuilderParams): ModalCommandBuilder {
    const { file, steps } = params;
    const isMarkdown = isMarkdownFile(file);
    const commandBuilder = new ModalCommandBuilder();

    for (const stepCheckbox of POST_RENAME_STEP_CHECKBOXES) {
      commandBuilder.addCheckbox({
        checkIsAvailable: () => isMarkdown || !stepCheckbox.isMarkdownOnly,
        key: stepCheckbox.key,
        modifiers: ['Alt'],
        onChange: (isChecked) => {
          steps[stepCheckbox.stepName] = isChecked;
        },
        onInit: (checkboxEl) => {
          checkboxEl.checked = steps[stepCheckbox.stepName];
        },
        purpose: stepCheckbox.purpose
      });
    }

    return commandBuilder;
  }

  private buildPostRenameSteps(): PostRenameSteps {
    const settings = this.pluginSettingsComponent.settings;
    return {
      shouldAddOldTitleAsAlias: settings.shouldAddOldTitleAsAlias,
      shouldPreservePreviousDisplayTextInFrontmatterLinks: settings.shouldPreservePreviousDisplayTextInFrontmatterLinks,
      shouldPreservePreviousDisplayTextInNoteLinks: settings.shouldPreservePreviousDisplayTextInNoteLinks,
      shouldUpdateFirstHeader: settings.shouldUpdateFirstHeader,
      shouldUpdateTitleKey: settings.shouldUpdateTitleKey
    };
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
    const { backlinks, newPath, oldPath, steps } = params;
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
          const shouldPreservePreviousDisplayText = (isReferenceCache(link) && steps.shouldPreservePreviousDisplayTextInNoteLinks)
            || (isFrontmatterLinkCache(link) && steps.shouldPreservePreviousDisplayTextInFrontmatterLinks);

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
        pluginNoticeComponent: this.pluginNoticeComponent,
        resourceLockComponent: this.resourceLockComponent
      });
    }
  }

  private async processRename(params: SmartRenameComponentProcessRenameParams): Promise<void> {
    const { backlinks, newPath, oldPath, steps, titleToStore } = params;
    const oldTitle = basename(oldPath, extname(oldPath));
    await this.processBacklinks({ backlinks, newPath, oldPath, steps });

    if (!isMarkdownFile(newPath)) {
      return;
    }

    await this.addAliases({ newPath, oldTitle, steps, titleToStore });
    await this.updateTitle({ newPath, steps, titleToStore });
    await this.updateFirstHeader({ newPath, steps, titleToStore });
  }

  private replaceInvalidCharacters(params: SmartRenameComponentReplaceInvalidCharactersParams): string {
    const { $string, replacement } = params;
    return $string.replace(getOsAndObsidianUnsafePathCharsRegExp(), () => replacement);
  }

  private async updateFirstHeader(params: SmartRenameComponentUpdateFirstHeaderParams): Promise<void> {
    const { newPath, steps, titleToStore } = params;
    if (!steps.shouldUpdateFirstHeader) {
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
          $string: content,
          endIndex: firstHeading.position.end.offset,
          startIndex: firstHeading.position.start.offset,
          substring: `# ${titleToStore}`
        });
      },
      pathOrFile: newPath,
      pluginNoticeComponent: this.pluginNoticeComponent,
      resourceLockComponent: this.resourceLockComponent
    });
  }

  private async updateTitle(params: SmartRenameComponentUpdateTitleParams): Promise<void> {
    const { newPath, steps, titleToStore } = params;
    if (!steps.shouldUpdateTitleKey) {
      return;
    }
    await processFrontmatter({
      app: this.app,
      frontmatterFunction: (frontMatter) => {
        frontMatter['title'] = titleToStore;
      },
      pathOrFile: newPath,
      pluginNoticeComponent: this.pluginNoticeComponent,
      resourceLockComponent: this.resourceLockComponent
    });
  }
}
