import type {
  Menu,
  TFile
} from 'obsidian';
import type { CommandHandlerRegistrationContext } from 'obsidian-dev-utils/obsidian/command-handlers/command-handler';
import type {
  FileMenuEventHandler,
  FilesMenuEventHandler
} from 'obsidian-dev-utils/obsidian/menu-event-registrar';
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

import { InvokeCommandHandler } from './invoke-command-handler.ts';

const MARKDOWN_FILE_PATH = 'note.md';
const NON_MARKDOWN_FILE_PATH = 'image.png';
const PLUGIN_NAME = 'Smart Rename';

interface CreateHandlerOptions {
  readonly shouldSupportNonMarkdownFiles?: boolean;
  smartRename?(file: TFile): Promise<void>;
}

interface MockContext {
  context: CommandHandlerRegistrationContext;
  fileMenuHandlers: FileMenuEventHandler[];
}

function createApp(): App {
  return App.createConfigured__({
    files: {
      [MARKDOWN_FILE_PATH]: '',
      [NON_MARKDOWN_FILE_PATH]: ''
    }
  });
}

function createHandler(options?: CreateHandlerOptions): InvokeCommandHandler {
  const pluginSettingsComponent = strictProxy<PluginSettingsComponent>({
    settings: strictProxy<ReadonlyDeep<PluginSettings>>({
      shouldSupportNonMarkdownFiles: options?.shouldSupportNonMarkdownFiles ?? false
    })
  });
  const smartRenameComponent = strictProxy<SmartRenameComponent>({
    smartRename: options?.smartRename ?? ((): Promise<void> => {
      return noopAsync();
    })
  });

  return new InvokeCommandHandler({
    pluginSettingsComponent,
    smartRenameComponent
  });
}

function createMockContext(activeFile?: TFile): MockContext {
  const fileMenuHandlers: FileMenuEventHandler[] = [];
  const filesMenuHandlers: FilesMenuEventHandler[] = [];

  return {
    context: {
      activeFileProvider: {
        getActiveFile: (): null | TFile => {
          return activeFile ?? null;
        }
      },
      menuEventRegistrar: {
        registerEditorMenuEventHandler: vi.fn(),
        registerFileMenuEventHandler: (handler: FileMenuEventHandler): void => {
          fileMenuHandlers.push(handler);
        },
        registerFilesMenuEventHandler: (handler: FilesMenuEventHandler): void => {
          filesMenuHandlers.push(handler);
        }
      },
      pluginName: PLUGIN_NAME
    },
    fileMenuHandlers
  };
}

function getFile(app: App, path: string): TFile {
  // `app` is a test-mocks `App`, so `getFileByPath` returns the test-mocks `TFile` type; at
  // Runtime it is the aliased `obsidian` `TFile`, so cast to the `obsidian` type the handler expects.
  return castTo<TFile>(ensureNonNullable(app.vault.getFileByPath(path)));
}

describe('InvokeCommandHandler', () => {
  it('should create an instance', () => {
    const handler = createHandler();
    expect(handler).toBeInstanceOf(InvokeCommandHandler);
  });

  describe('canExecuteFile', () => {
    it('should return true when file is a markdown file', async () => {
      const app = createApp();
      const mdFile = getFile(app, MARKDOWN_FILE_PATH);
      const handler = createHandler({ shouldSupportNonMarkdownFiles: false });
      const { context } = createMockContext(mdFile);
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(true);
    });

    it('should return false when file is not markdown and non-markdown not supported', async () => {
      const app = createApp();
      const nonMdFile = getFile(app, NON_MARKDOWN_FILE_PATH);
      const handler = createHandler({ shouldSupportNonMarkdownFiles: false });
      const { context } = createMockContext(nonMdFile);
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(false);
    });

    it('should return true when file is not markdown but non-markdown files are supported', async () => {
      const app = createApp();
      const nonMdFile = getFile(app, NON_MARKDOWN_FILE_PATH);
      const handler = createHandler({ shouldSupportNonMarkdownFiles: true });
      const { context } = createMockContext(nonMdFile);
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(true);
    });
  });

  describe('executeFile', () => {
    it('should call smartRename with the file', async () => {
      const app = createApp();
      const mdFile = getFile(app, MARKDOWN_FILE_PATH);
      const smartRename = vi.fn<(file: TFile) => Promise<void>>().mockResolvedValue(undefined);
      const handler = createHandler({ smartRename });
      const { context } = createMockContext(mdFile);
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      command.checkCallback?.(false);

      await vi.waitFor(() => {
        expect(smartRename).toHaveBeenCalledWith(mdFile);
      });
    });
  });

  describe('shouldAddToFileMenu', () => {
    it('should add a menu item for a markdown file', async () => {
      const app = createApp();
      const mdFile = getFile(app, MARKDOWN_FILE_PATH);
      const handler = createHandler();
      const { context, fileMenuHandlers } = createMockContext(mdFile);
      await handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<Menu>({ addItem });
      fileMenuHandlers[0]?.(menu, mdFile, 'file-explorer-context-menu');

      expect(addItem).toHaveBeenCalledOnce();
    });

    it('should add a menu item for a non-markdown file', async () => {
      const app = createApp();
      const nonMdFile = getFile(app, NON_MARKDOWN_FILE_PATH);
      const handler = createHandler({ shouldSupportNonMarkdownFiles: true });
      const { context, fileMenuHandlers } = createMockContext(nonMdFile);
      await handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<Menu>({ addItem });
      fileMenuHandlers[0]?.(menu, nonMdFile, 'file-explorer-context-menu');

      expect(addItem).toHaveBeenCalledOnce();
    });
  });
});
