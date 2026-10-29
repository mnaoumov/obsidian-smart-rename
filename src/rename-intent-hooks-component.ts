import type { FileExplorerView } from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  TAbstractFile
} from 'obsidian';

import { CallbackLayoutReadyComponent } from '@mnaoumov/obsidian-lib/components/layout-ready-component';
import { MonkeyAroundComponent } from '@mnaoumov/obsidian-lib/components/monkey-around-component';
import { isMarkdownFile } from '@mnaoumov/obsidian-lib/file-system';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { ViewType } from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  EditableFileView,
  TFile
} from 'obsidian';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';
import type { SmartRenameComponent } from './smart-rename-component.ts';

/**
 * The file explorer's inline-rename members `obsidian-typings` does not declare yet.
 *
 * TODO: Drop once `obsidian-typings` declares `fileBeingRenamed` and `saveRename` on `FileExplorerView`.
 */
interface FileExplorerViewRenameMembers {
  readonly fileBeingRenamed: null | TAbstractFile;
  readonly saveRename: () => Promise<boolean>;
}

type FileExplorerViewWithRenameMembers = FileExplorerView & FileExplorerViewRenameMembers;

interface RenameIntentHooksComponentConstructorParams {
  readonly app: App;
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly smartRenameComponent: SmartRenameComponent;
}

interface RenameIntentHooksComponentSaveRenameParams {
  readonly fallback: () => Promise<boolean>;
  readonly view: FileExplorerViewWithRenameMembers;
}

interface RenameIntentHooksComponentSaveTitleParams {
  readonly fallback: () => Promise<boolean>;
  readonly titleEl: HTMLElement;
  readonly view: EditableFileView;
}

/**
 * Makes Obsidian's own rename surfaces ask the rename intent before a note is renamed.
 *
 * Hooks the three named entry points every user rename passes through, never the rename API itself, so a rename
 * made by code, by sync or by another plugin is left alone and behaves as rename only:
 *
 * - `EditableFileView.saveTitle` - the inline title and the view header title, which is where F2 lands when either
 *   is shown;
 * - `FileExplorerView.saveRename` - the file explorer's inline rename;
 * - `FileManager.promptForFileRename` - the rename modal, opened by F2 when no title is shown and by the pane, tab
 *   and link menus.
 *
 * Only markdown notes are intercepted, since the intent is about `title:` and the first H1.
 */
export class RenameIntentHooksComponent extends MonkeyAroundComponent {
  private readonly app: App;
  private isFileExplorerPatched = false;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private readonly smartRenameComponent: SmartRenameComponent;

  public constructor(params: RenameIntentHooksComponentConstructorParams) {
    super();
    this.app = params.app;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
    this.smartRenameComponent = params.smartRenameComponent;
  }

  public override onload(): void {
    super.onload();

    this.registerMethodPatch({
      $object: this.app.fileManager,
      methodName: 'promptForFileRename',
      patchHandler: async ({ fallback, originalArguments: [file] }) => {
        if (!this.shouldIntercept(file)) {
          await fallback();
          return;
        }

        await this.smartRenameComponent.promptAndRenameWithIntent(file);
      }
    });

    this.registerMethodPatch({
      $object: EditableFileView.prototype,
      methodName: 'saveTitle',
      patchHandler: ({ fallback, originalArguments: [titleEl], originalThis }) =>
        // TODO: Drop both casts once `obsidian-typings` types `EditableFileView.saveTitle` as returning `Promise<boolean>`.
        castTo<Promise<void>>(this.saveTitle({ fallback: castTo<() => Promise<boolean>>(fallback), titleEl, view: originalThis }))
    });

    // The explorer view is created lazily, so its class is reached through the first loaded instance.
    this.addChild(new CallbackLayoutReadyComponent(this.app, this.patchFileExplorer.bind(this)));
    this.registerEvent(this.app.workspace.on('layout-change', this.patchFileExplorer.bind(this)));
  }

  private patchFileExplorer(): void {
    if (this.isFileExplorerPatched) {
      return;
    }

    for (const leaf of this.app.workspace.getLeavesOfType(ViewType.FileExplorer)) {
      if (!('fileItems' in leaf.view)) {
        continue;
      }

      const prototype = castTo<FileExplorerViewWithRenameMembers>(Object.getPrototypeOf(leaf.view));
      this.registerMethodPatch({
        $object: prototype,
        methodName: 'saveRename',
        patchHandler: ({ fallback, originalThis }) => this.saveRename({ fallback, view: originalThis })
      });
      this.isFileExplorerPatched = true;
      return;
    }
  }

  private async saveRename(params: RenameIntentHooksComponentSaveRenameParams): Promise<boolean> {
    const { fallback, view } = params;
    const file = view.fileBeingRenamed;
    if (!(file instanceof TFile) || !this.shouldIntercept(file)) {
      return await fallback();
    }

    const typedTitle = view.fileItems[file.path]?.innerEl.getText().trim() ?? '';
    if (!typedTitle || typedTitle === file.basename) {
      return await fallback();
    }

    // Ends the inline edit first, so the blur the dialog causes finds nothing left to save a second time.
    view.exitRename();
    await this.smartRenameComponent.renameWithIntent({ file, typedTitle });
    return true;
  }

  private async saveTitle(params: RenameIntentHooksComponentSaveTitleParams): Promise<boolean> {
    const { fallback, titleEl, view } = params;
    const file = view.file;
    if (!file || view.fileBeingRenamed !== file || !this.shouldIntercept(file)) {
      return await fallback();
    }

    const typedTitle = titleEl.getText().trim();
    if (!typedTitle || typedTitle === file.basename) {
      return await fallback();
    }

    // Taken over, so the blur the dialog causes finds no rename in progress and saves nothing a second time.
    view.fileBeingRenamed = null;
    const isRenamed = await this.smartRenameComponent.renameWithIntent({ file, typedTitle });
    if (!isRenamed) {
      titleEl.setText(file.basename);
    }

    return true;
  }

  private shouldIntercept(file: TFile): boolean {
    return this.pluginSettingsComponent.settings.shouldAskRenameIntent && isMarkdownFile(file);
  }
}
