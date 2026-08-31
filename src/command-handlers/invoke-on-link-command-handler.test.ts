import type {
  App as AppOriginal,
  Editor,
  MarkdownFileInfo,
  TFile
} from 'obsidian';
import type { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';
import type { ReadonlyDeep } from 'type-fest';

import { noopAsync } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { ensureNonNullable } from 'obsidian-dev-utils/type-guards';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettingsComponent } from '../plugin-settings-component.ts';
import type { PluginSettings } from '../plugin-settings.ts';
import type { SmartRenameComponent } from '../smart-rename-component.ts';

import { InvokeOnLinkCommandHandler } from './invoke-on-link-command-handler.ts';

const SOURCE_PATH = 'Source.md';
const TARGET_PATH = 'Target.md';
const ATTACHMENT_PATH = 'attachment.png';
const NO_LINK_NOTICE = 'No link to an existing file under the cursor';

interface CreatedHandler {
  readonly app: AppOriginal;
  readonly handler: TestableHandler;
  readonly showNotice: ReturnType<typeof vi.fn>;
  readonly smartRename: ReturnType<typeof vi.fn>;
}

interface CreateHandlerOptions {
  readonly shouldSupportNonMarkdownFiles?: boolean;
}

// The handler's own hooks are `protected`; a cast reaches them without widening production visibility,
// Which `find-overexposed:fix --force` would narrow straight back.
interface TestableHandler {
  canExecuteEditor(editor: Editor, context: MarkdownFileInfo): boolean;
  executeEditor(editor: Editor, context: MarkdownFileInfo): Promise<void>;
  shouldAddToEditorMenu(editor: Editor, context: MarkdownFileInfo): boolean;
}

function createContext(app: AppOriginal, path: null | string): MarkdownFileInfo {
  return strictProxy<MarkdownFileInfo>({
    file: path === null ? null : getFile(app, path)
  });
}

function createEditor(line: string, ch: number): Editor {
  return strictProxy<Editor>({
    getCursor: () => ({ ch, line: 0 }),
    getLine: () => line
  });
}

function createHandler(options?: CreateHandlerOptions): CreatedHandler {
  const app = App.createConfigured__({
    files: {
      [ATTACHMENT_PATH]: '',
      [SOURCE_PATH]: '',
      [TARGET_PATH]: ''
    }
  }).asOriginalType__();

  const showNotice = vi.fn();
  const smartRename = vi.fn<(file: TFile) => Promise<void>>(() => noopAsync());

  const handler = new InvokeOnLinkCommandHandler({
    app,
    pluginNoticeComponent: strictProxy<PluginNoticeComponent>({ showNotice }),
    pluginSettingsComponent: strictProxy<PluginSettingsComponent>({
      settings: strictProxy<ReadonlyDeep<PluginSettings>>({
        shouldSupportNonMarkdownFiles: options?.shouldSupportNonMarkdownFiles ?? false
      })
    }),
    smartRenameComponent: strictProxy<SmartRenameComponent>({ smartRename })
  });

  return {
    app,
    handler: castTo<TestableHandler>(handler),
    showNotice,
    smartRename
  };
}

function getFile(app: AppOriginal, path: string): TFile {
  return ensureNonNullable(app.vault.getFileByPath(path));
}

describe('InvokeOnLinkCommandHandler', () => {
  it('should build a command with the expected identity', () => {
    const { handler } = createHandler();
    const command = castTo<InvokeOnLinkCommandHandler>(handler).buildCommand();

    expect(command.id).toBe('invoke-on-link');
    expect(command.name).toBe('Invoke on link under cursor');
    expect(command.icon).toBe('edit-3');
  });

  describe('canExecuteEditor', () => {
    it('should be available on a link to a markdown note', () => {
      const { app, handler } = createHandler();
      expect(handler.canExecuteEditor(createEditor('[[Target]]', 3), createContext(app, SOURCE_PATH))).toBe(true);
    });

    it('should be unavailable when the cursor is not on a link', () => {
      const { app, handler } = createHandler();
      expect(handler.canExecuteEditor(createEditor('just some prose', 4), createContext(app, SOURCE_PATH))).toBe(false);
    });

    it('should be unavailable when the editor is not backed by a file', () => {
      const { app, handler } = createHandler();
      expect(handler.canExecuteEditor(createEditor('[[Target]]', 3), createContext(app, null))).toBe(false);
    });

    it('should be unavailable on a non-markdown target when non-markdown files are not supported', () => {
      const { app, handler } = createHandler({ shouldSupportNonMarkdownFiles: false });
      expect(handler.canExecuteEditor(createEditor('[[attachment.png]]', 3), createContext(app, SOURCE_PATH))).toBe(false);
    });

    it('should be available on a non-markdown target when non-markdown files are supported', () => {
      const { app, handler } = createHandler({ shouldSupportNonMarkdownFiles: true });
      expect(handler.canExecuteEditor(createEditor('[[attachment.png]]', 3), createContext(app, SOURCE_PATH))).toBe(true);
    });
  });

  describe('executeEditor', () => {
    it('should smart rename the link target rather than the active note', async () => {
      const { app, handler, smartRename } = createHandler();

      await handler.executeEditor(createEditor('[[Target]]', 3), createContext(app, SOURCE_PATH));

      expect(smartRename).toHaveBeenCalledWith(getFile(app, TARGET_PATH));
    });

    // Reachable only when the target stops resolving between the availability check and the invocation.
    it('should show a notice and rename nothing when the target no longer resolves', async () => {
      const {
        app,
        handler,
        showNotice,
        smartRename
      } = createHandler();

      await handler.executeEditor(createEditor('[[Missing]]', 3), createContext(app, SOURCE_PATH));

      expect(showNotice).toHaveBeenCalledWith(NO_LINK_NOTICE);
      expect(smartRename).not.toHaveBeenCalled();
    });
  });

  describe('shouldAddToEditorMenu', () => {
    it('should opt into the editor context menu', () => {
      const { app, handler } = createHandler();
      expect(handler.shouldAddToEditorMenu(createEditor('[[Target]]', 3), createContext(app, SOURCE_PATH))).toBe(true);
    });
  });
});
