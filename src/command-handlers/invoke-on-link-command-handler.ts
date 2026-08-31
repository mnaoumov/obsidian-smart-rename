import type {
  App,
  Editor,
  MarkdownFileInfo,
  TFile
} from 'obsidian';
import type { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';

import { EditorCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/editor-command-handler';
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/file-system';

import type { PluginSettingsComponent } from '../plugin-settings-component.ts';
import type { SmartRenameComponent } from '../smart-rename-component.ts';

import { resolveLinkFileAtEditorCursor } from '../link-target.ts';

interface InvokeOnLinkCommandHandlerConstructorParams {
  readonly app: App;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly smartRenameComponent: SmartRenameComponent;
}

export class InvokeOnLinkCommandHandler extends EditorCommandHandler {
  private readonly app: App;
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private readonly smartRenameComponent: SmartRenameComponent;

  public constructor(params: InvokeOnLinkCommandHandlerConstructorParams) {
    super({
      editorMenuItemName: 'Smart rename link target',
      editorMenuSection: 'selection',
      icon: 'edit-3',
      id: 'invoke-on-link',
      name: 'Invoke on link under cursor'
    });

    this.app = params.app;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
    this.smartRenameComponent = params.smartRenameComponent;
  }

  protected override canExecuteEditor(editor: Editor, context: MarkdownFileInfo): boolean {
    // Deliberately no `super.canExecuteEditor` guard: the base returns `true` unconditionally, so the
    // Guard would be a branch no test can reach.
    return this.resolveLinkFileToRename(editor, context) !== null;
  }

  protected override async executeEditor(editor: Editor, context: MarkdownFileInfo): Promise<void> {
    const file = this.resolveLinkFileToRename(editor, context);

    // `canExecuteEditor` has already passed, so this only fires when the target stopped resolving between
    // The check and the invocation — the link's file was renamed or deleted in between.
    if (!file) {
      this.pluginNoticeComponent.showNotice('No link to an existing file under the cursor');
      return;
    }

    await this.smartRenameComponent.smartRename(file);
  }

  protected override shouldAddToEditorMenu(editor: Editor, context: MarkdownFileInfo): boolean {
    super.shouldAddToEditorMenu(editor, context);
    return true;
  }

  /**
   * Resolves the link under the cursor, and keeps only a file this plugin is willing to rename.
   *
   * The non-markdown gate is the same one `InvokeCommandHandler` applies to the active note, so a linked
   * attachment behaves exactly as an active attachment does.
   *
   * @param editor - The editor to inspect.
   * @param context - The markdown file context.
   * @returns The file to rename, or `null` when there is nothing to rename under the cursor.
   */
  private resolveLinkFileToRename(editor: Editor, context: MarkdownFileInfo): null | TFile {
    const file = resolveLinkFileAtEditorCursor({
      app: this.app,
      editor,
      sourceFile: context.file ?? null
    });

    if (!file) {
      return null;
    }

    return isMarkdownFile(file) || this.pluginSettingsComponent.settings.shouldSupportNonMarkdownFiles ? file : null;
  }
}
