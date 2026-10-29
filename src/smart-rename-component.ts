import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type { GenerateMarkdownLinkParams } from '@mnaoumov/obsidian-lib/link';
import type { ResourceLockComponent } from '@mnaoumov/obsidian-lib/resource-lock';
import type { CustomArrayDict } from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  Reference,
  TFile
} from 'obsidian';

import { ComponentEx } from '@mnaoumov/obsidian-lib/components/component-ex';
import {
  addAlias,
  processFrontmatter
} from '@mnaoumov/obsidian-lib/file-manager';
import {
  getFile,
  isMarkdownFile
} from '@mnaoumov/obsidian-lib/file-system';
import {
  buildBacklinksSnapshot,
  editBacklinksSnapshot,
  extractLinkFile,
  generateMarkdownLink,
  hasWikilinkSyntax,
  shouldResetAlias
} from '@mnaoumov/obsidian-lib/link';
import {
  getBacklinksForFileSafe,
  getCacheSafe
} from '@mnaoumov/obsidian-lib/metadata-cache';
import { ModalCommandBuilder } from '@mnaoumov/obsidian-lib/modals/modal-command-builder';
import { prompt } from '@mnaoumov/obsidian-lib/modals/prompt';
import { addToQueue } from '@mnaoumov/obsidian-lib/queue';
import {
  getFileNameValidationMessage,
  getOsAndObsidianUnsafePathCharsRegExp
} from '@mnaoumov/obsidian-lib/validation';
import { process } from '@mnaoumov/obsidian-lib/vault';
import { normalizeOptionalProperties } from '@mnaoumov/typescript-lib/object-utils';
import {
  basename,
  extname,
  join,
  makeFileName
} from '@mnaoumov/typescript-lib/path';
import { insertAt } from '@mnaoumov/typescript-lib/string';
import {
  isFrontmatterLinkCache,
  isReferenceCache
} from '@obsidian-typings/obsidian-public-latest/implementations';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';
import type { RenameIntentChoice } from './rename-intent-modal.ts';

import { InvalidCharacterAction } from './invalid-character-action.ts';
import { hasInvalidCharacters } from './invalid-character.ts';
import { selectRenameIntent } from './rename-intent-modal.ts';
import { RenameIntent } from './rename-intent.ts';

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
  readonly stepName: Exclude<keyof PostRenameSteps, 'shouldStoreInvalidTitleAsAlias'>;
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
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- The rename prompt checkbox toggles this per-rename flag.
  shouldAddOldTitleAsAlias: boolean;
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- The rename prompt checkbox toggles this per-rename flag.
  shouldPreservePreviousDisplayTextInFrontmatterLinks: boolean;
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- The rename prompt checkbox toggles this per-rename flag.
  shouldPreservePreviousDisplayTextInNoteLinks: boolean;
  // No checkbox: the new title as typed, kept as an alias when the rename had to sanitize it.
  readonly shouldStoreInvalidTitleAsAlias: boolean;
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- The rename prompt checkbox toggles this per-rename flag.
  shouldUpdateFirstHeader: boolean;
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- The rename prompt checkbox toggles this per-rename flag.
  shouldUpdateTitleKey: boolean;
}

/**
 * Where a validated rename goes, and the title the note keeps for it.
 */
interface ResolvedRename {
  readonly newPath: string;
  readonly titleToStore: string;
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

interface SmartRenameComponentPerformRenameParams {
  readonly file: TFile;
  readonly resolvedRename: ResolvedRename;
  readonly steps: PostRenameSteps;
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

interface SmartRenameComponentRenameWithIntentParams {
  readonly file: TFile;
  readonly typedTitle: string;
}

interface SmartRenameComponentReplaceInvalidCharactersParams {
  readonly $string: string;
  readonly replacement: string;
}

interface SmartRenameComponentResolveRenameParams {
  readonly file: TFile;
  readonly typedTitle: string;
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

  /**
   * Asks for the new name, then for the rename intent, and renames - the rename modal Obsidian opens from F2 when
   * no title is shown, and from the pane, tab and link menus.
   *
   * @param file - The note to rename.
   */
  public async promptAndRenameWithIntent(file: TFile): Promise<void> {
    const typedTitle = await prompt({
      app: this.app,
      defaultValue: file.basename,
      title: 'Rename note'
    });

    if (typedTitle === null) {
      return;
    }

    await this.renameWithIntent({ file, typedTitle });
  }

  /**
   * Asks the rename intent for a new name the user already typed, and renames accordingly.
   *
   * @param params - The parameters.
   * @returns Whether the note was renamed. `false` when the name is refused or the dialog is dismissed.
   */
  public async renameWithIntent(params: SmartRenameComponentRenameWithIntentParams): Promise<boolean> {
    const { file, typedTitle } = params;
    const resolvedRename = await this.resolveRename({ file, typedTitle });
    if (!resolvedRename) {
      return false;
    }

    const settings = this.pluginSettingsComponent.settings;
    const choice = await selectRenameIntent({
      app: this.app,
      newTitle: resolvedRename.titleToStore,
      oldTitle: file.basename,
      preselectedIntent: settings.shouldSaveLastRenameIntent ? settings.lastRenameIntent : RenameIntent.SyncTitleAndHeading,
      shouldSaveLastUsedChoice: settings.shouldSaveLastRenameIntent
    });

    if (!choice) {
      return false;
    }

    await this.saveLastUsedChoice(choice);
    return await this.performRename({ file, resolvedRename, steps: this.buildIntentSteps(choice.intent) });
  }

  public async smartRename(file: TFile): Promise<void> {
    const steps = this.buildPostRenameSteps();
    const typedTitle = await prompt({
      app: this.app,
      commandBuilder: this.buildCommandBuilder({ file, steps }),
      defaultValue: file.basename,
      title: 'Enter new title'
    }) ?? '';

    const resolvedRename = await this.resolveRename({ file, typedTitle });
    if (!resolvedRename) {
      return;
    }

    await this.performRename({ file, resolvedRename, steps });
  }

  private async addAliases(params: SmartRenameComponentAddAliasesParams): Promise<void> {
    const { newPath, oldTitle, steps, titleToStore } = params;
    const newTitle = basename(newPath, extname(newPath));
    if (steps.shouldAddOldTitleAsAlias) {
      await addAlias({ alias: oldTitle, app: this.app, pathOrFile: newPath, resourceLockComponent: this.resourceLockComponent });
    }

    // Not governed by the checkbox above: this alias is the NEW title as it was typed, kept because the
    // rename had to sanitize it — a different thing from carrying the old title forward.
    if (steps.shouldStoreInvalidTitleAsAlias && titleToStore !== newTitle) {
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

  /**
   * The post-rename steps a rename intent stands for.
   *
   * Rename only runs none of them, so it matches a rename made by code: the links follow the new name and the
   * note itself is left alone. The display-text steps belong to storing the previous name, because a link that
   * keeps showing the old name is the other half of keeping it as an alias.
   *
   * @param intent - The intent chosen in the dialog.
   * @returns The steps.
   */
  private buildIntentSteps(intent: RenameIntent): PostRenameSteps {
    const settings = this.pluginSettingsComponent.settings;
    const shouldSync = intent !== RenameIntent.RenameOnly;
    const shouldStorePreviousName = intent === RenameIntent.StorePreviousName;
    return {
      shouldAddOldTitleAsAlias: shouldStorePreviousName,
      shouldPreservePreviousDisplayTextInFrontmatterLinks: shouldStorePreviousName && settings.shouldPreservePreviousDisplayTextInFrontmatterLinks,
      shouldPreservePreviousDisplayTextInNoteLinks: shouldStorePreviousName && settings.shouldPreservePreviousDisplayTextInNoteLinks,
      shouldStoreInvalidTitleAsAlias: shouldSync && settings.shouldStoreInvalidTitle,
      shouldUpdateFirstHeader: shouldSync,
      shouldUpdateTitleKey: shouldSync
    };
  }

  private buildPostRenameSteps(): PostRenameSteps {
    const settings = this.pluginSettingsComponent.settings;
    return {
      shouldAddOldTitleAsAlias: settings.shouldAddOldTitleAsAlias,
      shouldPreservePreviousDisplayTextInFrontmatterLinks: settings.shouldPreservePreviousDisplayTextInFrontmatterLinks,
      shouldPreservePreviousDisplayTextInNoteLinks: settings.shouldPreservePreviousDisplayTextInNoteLinks,
      shouldStoreInvalidTitleAsAlias: settings.shouldStoreInvalidTitle,
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

    /*
     * Ahead of the case-only shortcut, so a case change cannot sneak a device name or a trailing dot past it.
     * The title is validated rather than the file name: `Note.` would become `Note..md`, which Windows accepts,
     * yet a title ending in a dot is exactly what the rule exists to refuse.
     */
    const fileNameValidationMessage = getFileNameValidationMessage(newTitle);
    if (fileNameValidationMessage) {
      return fileNameValidationMessage;
    }

    if (newTitle.toLowerCase() === oldTitle.toLowerCase()) {
      return null;
    }

    if (await this.app.vault.exists(newPath)) {
      return 'Note with the new title already exists';
    }

    return newTitle.startsWith('.') ? 'The title cannot start with a dot' : null;
  }

  private async performRename(params: SmartRenameComponentPerformRenameParams): Promise<boolean> {
    const { file, resolvedRename: { newPath, titleToStore }, steps } = params;
    const backlinks = await getBacklinksForFileSafe({ app: this.app, pathOrFile: file });
    const oldPath = file.path;

    try {
      await this.app.vault.rename(file, newPath);
    } catch (error) {
      this.pluginNoticeComponent.showNotice('Failed to rename file');
      console.error(new Error('Failed to rename file', { cause: error }));
      return false;
    }

    addToQueue({
      operationFunction: async () => {
        await this.processRename({ backlinks, newPath, oldPath, steps, titleToStore });
      },
      operationName: 'Smart rename'
    });
    return true;
  }

  private async processBacklinks(params: SmartRenameComponentProcessBacklinksParams): Promise<void> {
    const { backlinks, newPath, oldPath, steps } = params;
    const newFile = getFile({ app: this.app, pathOrFile: newPath });
    const oldTitle = basename(oldPath, extname(oldPath));
    const newTitle = newFile.basename;

    /*
     * The backlinks were captured BEFORE `vault.rename`, so they cannot be re-fetched here — the cache no
     * longer answers for the old path. `pathRemapper` covers the one holder the rename moved: the note
     * itself, whose self-links now live at the new path.
     *
     * No `linkIdentityKeyProvider` on either call, on purpose. The snapshot is keyed by one provider and
     * `editBacklinksSnapshot` looks each link up by its own, so the two must agree - and a provider passed to
     * only one of them makes every captured link read as uncaptured. That is how this rewrite once silently
     * edited nothing: by then the old link no longer resolves, so the `extractLinkFile` fallback declined it
     * too. Leaving both on the library default keeps them in step by construction.
     */
    const snapshot = buildBacklinksSnapshot<true>({
      backlinks,
      pathRemapper: (backlinkNotePath) => backlinkNotePath === oldPath ? newPath : backlinkNotePath,
      // The payload is the capture itself: `true` where the link was snapshotted, `undefined` where it was not.
      payloadProvider: () => true
    });

    await editBacklinksSnapshot<true>({
      app: this.app,
      linkConverter: ({ link, payload: wasCaptured, sourcePath }) => {
        /*
         * Wider than the snapshot on purpose: a link that already resolves to the renamed file is ours to
         * restyle even when it was absent from the capture, which is why unmatched links are visited.
         */
        if (!wasCaptured && extractLinkFile({ app: this.app, link, sourcePathOrFile: sourcePath }) !== newFile) {
          return;
        }

        const isNewTitle = (link.displayText ?? '').toLowerCase() === newTitle.toLowerCase();
        const shouldPreservePreviousDisplayText = (isReferenceCache(link) && steps.shouldPreservePreviousDisplayTextInNoteLinks)
          || (isFrontmatterLinkCache(link) && steps.shouldPreservePreviousDisplayTextInFrontmatterLinks);

        /*
         * A display text Obsidian derived from the old name is not the author's choice: it shows the old title
         * only when that is asked for, and otherwise goes, so the link follows the new name as after a plain
         * rename. A display text the author chose is kept as is.
         */
        const isDerivedDisplayText = shouldResetAlias({
          app: this.app,
          displayText: link.displayText,
          isWikilink: hasWikilinkSyntax(link.original),
          newSourcePathOrFile: sourcePath,
          oldTargetPath: oldPath,
          targetPathOrFile: newPath
        });

        let alias = link.displayText;
        if (isNewTitle || isDerivedDisplayText) {
          alias = shouldPreservePreviousDisplayText ? oldTitle : undefined;
        }

        return generateMarkdownLink(normalizeOptionalProperties<GenerateMarkdownLinkParams>({
          alias,
          app: this.app,
          originalLink: link.original,
          sourcePathOrFile: sourcePath,
          targetPathOrFile: newPath
        }));
      },
      pluginNoticeComponent: this.pluginNoticeComponent,
      resourceLockComponent: this.resourceLockComponent,
      shouldVisitUnmatchedLinks: true,
      snapshot
    });
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

  /**
   * Sanitizes and validates a typed title into the rename it asks for, showing why when it is refused.
   *
   * @param params - The parameters.
   * @returns The rename, or `null` when the title is refused.
   */
  private async resolveRename(params: SmartRenameComponentResolveRenameParams): Promise<null | ResolvedRename> {
    const { file, typedTitle } = params;
    const settings = this.pluginSettingsComponent.settings;
    let newTitle = typedTitle;

    if (hasInvalidCharacters(newTitle)) {
      switch (settings.invalidCharacterAction) {
        case InvalidCharacterAction.Error: {
          this.pluginNoticeComponent.showNotice('The new title has invalid characters');
          return null;
        }
        case InvalidCharacterAction.Remove: {
          newTitle = this.replaceInvalidCharacters({ $string: newTitle, replacement: '' });
          break;
        }
        case InvalidCharacterAction.Replace: {
          newTitle = this.replaceInvalidCharacters({ $string: newTitle, replacement: settings.replacementCharacter });
          break;
        }
        default: {
          throw new Error('Invalid character action');
        }
      }
    }

    const titleToStore = settings.shouldStoreInvalidTitle ? typedTitle : newTitle;
    const newPath = join(file.parent?.getParentPrefix() ?? '', makeFileName({ fileBaseName: newTitle, fileExtension: file.extension }));

    const validationError = await this.getValidationError({ newPath, newTitle, oldTitle: file.basename });
    if (validationError) {
      this.pluginNoticeComponent.showNotice(validationError);
      return null;
    }

    return { newPath, titleToStore };
  }

  /**
   * Remembers the dialog's sticky checkbox, and the choice itself while it is ticked.
   *
   * Writes only on a change, so a dialog answered the same way as last time does not rewrite `data.json`.
   *
   * @param choice - The choice made in the dialog.
   */
  private async saveLastUsedChoice(choice: RenameIntentChoice): Promise<void> {
    const settings = this.pluginSettingsComponent.settings;
    const lastRenameIntent = choice.shouldSaveLastUsedChoice ? choice.intent : settings.lastRenameIntent;
    if (settings.shouldSaveLastRenameIntent === choice.shouldSaveLastUsedChoice && settings.lastRenameIntent === lastRenameIntent) {
      return;
    }

    await this.pluginSettingsComponent.editAndSave((editedSettings) => {
      editedSettings.shouldSaveLastRenameIntent = choice.shouldSaveLastUsedChoice;
      editedSettings.lastRenameIntent = lastRenameIntent;
    });
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
