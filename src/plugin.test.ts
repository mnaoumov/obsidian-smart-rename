import type {
  App as AppOriginal,
  Command,
  PluginManifest,
  TFile
} from 'obsidian';
import type { CombinedFrontmatter } from 'obsidian-dev-utils/obsidian/frontmatter';

import { noopAsync } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';
import type { PluginSettings } from './plugin-settings.ts';

const noticeMessages: string[] = [];

const hoisted = vi.hoisted(() => ({
  mockAddAlias: vi.fn(),
  mockAddToQueue: vi.fn(),
  mockEditLinks: vi.fn(),
  mockExtractLinkFile: vi.fn(),
  mockGenerateMarkdownLink: vi.fn(),
  mockGetBacklinksForFileSafe: vi.fn(),
  mockGetCacheSafe: vi.fn(),
  mockGetFile: vi.fn(),
  mockGetOsAndObsidianUnsafePathCharsRegExp: vi.fn(),
  mockIsFrontmatterLinkCache: vi.fn(),
  mockIsMarkdownFile: vi.fn(),
  mockIsReferenceCache: vi.fn(),
  mockProcessFrontmatter: vi.fn(),
  mockProcessVault: vi.fn(),
  mockPrompt: vi.fn()
}));

vi.mock('obsidian', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian')>();
  return {
    ...actual,
    // eslint-disable-next-line prefer-arrow-callback -- constructor stub needs `function` to be used with `new`.
    Notice: vi.fn(function NoticeStub(message: string) {
      noticeMessages.push(message);
      return {
        hide: vi.fn(),
        setMessage: vi.fn()
      };
    })
  };
});

vi.mock('obsidian-dev-utils/obsidian/app', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/app')>(),
  getObsidianDevUtilsState: vi.fn((_app: unknown, _key: string, defaultValue: unknown) => ({ value: defaultValue }))
}));

vi.mock('obsidian-dev-utils/obsidian/modals/prompt', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/modals/prompt')>(),
  prompt: (...args: unknown[]): unknown => hoisted.mockPrompt(...args)
}));

vi.mock('obsidian-dev-utils/obsidian/metadata-cache', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/metadata-cache')>(),
  getBacklinksForFileSafe: (...args: unknown[]): unknown => hoisted.mockGetBacklinksForFileSafe(...args),
  getCacheSafe: (...args: unknown[]): unknown => hoisted.mockGetCacheSafe(...args)
}));

vi.mock('obsidian-dev-utils/obsidian/file-system', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/file-system')>(),
  getFile: (...args: unknown[]): unknown => hoisted.mockGetFile(...args),
  isMarkdownFile: (...args: unknown[]): unknown => hoisted.mockIsMarkdownFile(...args)
}));

vi.mock('obsidian-dev-utils/obsidian/file-manager', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/file-manager')>(),
  addAlias: (...args: unknown[]): unknown => hoisted.mockAddAlias(...args),
  processFrontmatter: (...args: unknown[]): unknown => hoisted.mockProcessFrontmatter(...args)
}));

vi.mock('obsidian-dev-utils/obsidian/link', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/link')>(),
  editLinks: (...args: unknown[]): unknown => hoisted.mockEditLinks(...args),
  extractLinkFile: (...args: unknown[]): unknown => hoisted.mockExtractLinkFile(...args),
  generateMarkdownLink: (...args: unknown[]): unknown => hoisted.mockGenerateMarkdownLink(...args)
}));

vi.mock('obsidian-dev-utils/obsidian/queue', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/queue')>(),
  addToQueue: (...args: unknown[]): unknown => hoisted.mockAddToQueue(...args)
}));

vi.mock('obsidian-dev-utils/obsidian/vault', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/vault')>(),
  process: (...args: unknown[]): unknown => hoisted.mockProcessVault(...args)
}));

vi.mock('obsidian-dev-utils/obsidian/validation', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/validation')>(),
  getOsAndObsidianUnsafePathCharsRegExp: (): unknown => hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp()
}));

vi.mock('@obsidian-typings/obsidian-public-latest/implementations', async (importOriginal) => ({
  ...await importOriginal<typeof import('@obsidian-typings/obsidian-public-latest/implementations')>(),
  isFrontmatterLinkCache: (...args: unknown[]): unknown => hoisted.mockIsFrontmatterLinkCache(...args),
  isReferenceCache: (...args: unknown[]): unknown => hoisted.mockIsReferenceCache(...args)
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';

interface BacklinkLink {
  displayText?: string;
  original: string;
}

interface BacklinksStub {
  get(key: string): null | unknown[];
  keys(): string[];
}

interface CommandsHolder {
  commands: Map<string, Command>;
}

type EditLinksCallback = (link: BacklinkLink) => string | undefined;

interface EnqueuedOperation {
  operationFn(): Promise<void>;
}

interface HeadingsCache {
  headings: never[];
}

type ProcessVaultCallback = (context: ProcessVaultContext) => Promise<null | string>;

interface ProcessVaultContext {
  abortSignal: AbortSignal;
  content: string;
}

interface SetupBacklinkCallbackOptions {
  readonly backlinks: BacklinksStub;
  readonly newFile: Partial<TFile>;
  readonly settings?: Partial<PluginSettings>;
}

interface SetupProcessVaultCallbackOptions {
  readonly cache: unknown;
}

interface Testable {
  pluginSettingsComponent: PluginSettingsComponent;
}

const DEFAULT_UNSAFE_CHARS_REGEXP = /[/\\]/;

async function applySettings(plugin: Plugin, overrides: Partial<PluginSettings>): Promise<void> {
  const component = castTo<Testable>(plugin).pluginSettingsComponent;
  await component.editAndSave((settings) => {
    Object.assign(settings, overrides);
  });
}

function createApp(): AppOriginal {
  const appMock = App.createConfigured__();
  appMock.workspace.onLayoutReady = vi.fn((cb: () => void) => {
    cb();
  });
  const app = appMock.asOriginalType__();
  app.vault.exists = vi.fn().mockResolvedValue(false);
  app.vault.rename = vi.fn().mockResolvedValue(undefined);
  return app;
}

function createInputFile(overrides?: Partial<TFile>): TFile {
  return strictProxy<TFile>({
    basename: 'OldTitle',
    extension: 'md',
    parent: strictProxy({
      getParentPrefix: (): string => ''
    }),
    path: 'OldTitle.md',
    ...overrides
  });
}

async function createLoadedPlugin(app: AppOriginal): Promise<Plugin> {
  const plugin = new Plugin(app, createManifest());
  await plugin.onload();
  return plugin;
}

function createManifest(): PluginManifest {
  return strictProxy<PluginManifest>({
    id: 'smart-rename',
    name: 'Smart Rename',
    version: '1.0.0'
  });
}

async function getRegisteredInvokeCommand(): Promise<Command> {
  const appMock = App.createConfigured__({ files: { 'OldTitle.md': '# OldTitle' } });
  appMock.workspace.onLayoutReady = vi.fn((cb: () => void) => {
    cb();
  });
  const activeFile = appMock.vault.getFileByPath('OldTitle.md');
  appMock.workspace.getActiveFile = vi.fn(() => activeFile);
  const plugin = await createLoadedPlugin(appMock.asOriginalType__());
  const command = castTo<CommandsHolder>(plugin).commands.get('invoke');
  if (!command) {
    throw new Error('invoke command was not registered');
  }

  return command;
}

async function runEnqueuedOperation(): Promise<void> {
  const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [EnqueuedOperation] | undefined;
  await addToQueueCall?.[0]?.operationFn();
}

beforeEach(() => {
  noticeMessages.length = 0;
  hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(DEFAULT_UNSAFE_CHARS_REGEXP);
  hoisted.mockIsFrontmatterLinkCache.mockReturnValue(false);
  hoisted.mockIsReferenceCache.mockReturnValue(true);
  hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({
    get: (): null => null,
    keys: (): string[] => []
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Plugin', () => {
  describe('constructor', () => {
    it('should create a plugin instance', async () => {
      const plugin = await createLoadedPlugin(createApp());
      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('should register the smart rename command via its child command handler', async () => {
      const plugin = new Plugin(createApp(), createManifest());
      const addCommandSpy = vi.spyOn(plugin, 'addCommand');
      await plugin.onload();
      expect(addCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'invoke', name: 'Invoke' })
      );
    });

    it('should add the plugin settings tab via its child component', async () => {
      const plugin = new Plugin(createApp(), createManifest());
      const addSettingTabSpy = vi.spyOn(plugin, 'addSettingTab');
      await plugin.onload();
      expect(addSettingTabSpy).toHaveBeenCalled();
    });

    it('should expose a live pluginSettingsComponent whose getSettings backing returns the plugin settings', async () => {
      const app = createApp();
      const plugin = await createLoadedPlugin(app);
      const settings = castTo<Testable>(plugin).pluginSettingsComponent.settings;
      expect(settings).toBeDefined();
      expect(settings.invalidCharacterAction).toBeDefined();
    });

    it('should invoke the checkIsMarkdownFile lambda when the registered command checks the active file', async () => {
      hoisted.mockIsMarkdownFile.mockReturnValue(true);
      const command = await getRegisteredInvokeCommand();
      const canExecute = command.checkCallback?.(true);
      expect(canExecute).toBe(true);
      expect(hoisted.mockIsMarkdownFile).toHaveBeenCalled();
    });

    it('should fall back to the getSettings lambda when checkIsMarkdownFile returns false', async () => {
      hoisted.mockIsMarkdownFile.mockReturnValue(false);
      const command = await getRegisteredInvokeCommand();
      // CheckIsMarkdownFile is false, so canExecuteFile reads getSettings().shouldSupportNonMarkdownFiles (default true).
      const canExecute = command.checkCallback?.(true);
      expect(canExecute).toBe(true);
      expect(hoisted.mockIsMarkdownFile).toHaveBeenCalled();
    });
  });

  describe('hasInvalidCharacters', () => {
    it('should return true when string has invalid characters', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\:*?"<>|]/);
      const plugin = await createLoadedPlugin(createApp());
      expect(plugin.hasInvalidCharacters('foo/bar')).toBe(true);
    });

    it('should return false when string has no invalid characters', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\:*?"<>|]/);
      const plugin = await createLoadedPlugin(createApp());
      expect(plugin.hasInvalidCharacters('valid-name')).toBe(false);
    });
  });

  describe('smartRename', () => {
    it('should show notice when new title is empty (prompt returns empty string)', async () => {
      hoisted.mockPrompt.mockResolvedValue('');
      const plugin = await createLoadedPlugin(createApp());
      await plugin.smartRename(createInputFile());
      expect(noticeMessages).toContain('No new title provided');
    });

    it('should show notice when prompt returns null (cancelled)', async () => {
      hoisted.mockPrompt.mockResolvedValue(null);
      const plugin = await createLoadedPlugin(createApp());
      await plugin.smartRename(createInputFile());
      expect(noticeMessages).toContain('No new title provided');
    });

    it('should show notice when title did not change', async () => {
      hoisted.mockPrompt.mockResolvedValue('OldTitle');
      const plugin = await createLoadedPlugin(createApp());
      await plugin.smartRename(createInputFile());
      expect(noticeMessages).toContain('The title did not change');
    });

    it('should allow rename when only casing changes', async () => {
      hoisted.mockPrompt.mockResolvedValue('OLDTITLE');
      const plugin = await createLoadedPlugin(createApp());
      await plugin.smartRename(createInputFile());
      expect(hoisted.mockAddToQueue).toHaveBeenCalled();
    });

    it('should show notice when file with new title already exists', async () => {
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      const app = createApp();
      app.vault.exists = vi.fn().mockResolvedValue(true);
      const plugin = await createLoadedPlugin(app);
      await plugin.smartRename(createInputFile());
      expect(noticeMessages).toContain('Note with the new title already exists');
    });

    it('should show notice when title starts with a dot', async () => {
      hoisted.mockPrompt.mockResolvedValue('.hidden');
      const plugin = await createLoadedPlugin(createApp());
      await plugin.smartRename(createInputFile());
      expect(noticeMessages).toContain('The title cannot start with a dot');
    });

    it('should show notice when rename throws Error action for invalid characters', async () => {
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      const plugin = await createLoadedPlugin(createApp());
      await applySettings(plugin, { invalidCharacterAction: castTo<PluginSettings['invalidCharacterAction']>('Error') });
      await plugin.smartRename(createInputFile());
      expect(noticeMessages).toContain('The new title has invalid characters');
    });

    it('should remove invalid characters when action is Remove', async () => {
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      const plugin = await createLoadedPlugin(createApp());
      await applySettings(plugin, { invalidCharacterAction: castTo<PluginSettings['invalidCharacterAction']>('Remove') });
      await plugin.smartRename(createInputFile());
      expect(hoisted.mockAddToQueue).toHaveBeenCalled();
    });

    it('should replace invalid characters when action is Replace', async () => {
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      const plugin = await createLoadedPlugin(createApp());
      await applySettings(plugin, {
        invalidCharacterAction: castTo<PluginSettings['invalidCharacterAction']>('Replace'),
        replacementCharacter: '_'
      });
      await plugin.smartRename(createInputFile());
      expect(hoisted.mockAddToQueue).toHaveBeenCalled();
    });

    it('should throw when invalidCharacterAction is unknown', async () => {
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      const plugin = await createLoadedPlugin(createApp());
      await applySettings(plugin, { invalidCharacterAction: castTo<PluginSettings['invalidCharacterAction']>('Unknown') });
      await expect(plugin.smartRename(createInputFile())).rejects.toThrow('Invalid character action');
    });

    it('should show notice when vault rename fails', async () => {
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const app = createApp();
      app.vault.rename = vi.fn().mockRejectedValue(new Error('rename failed'));
      const plugin = await createLoadedPlugin(app);
      await plugin.smartRename(createInputFile());
      expect(noticeMessages).toContain('Failed to rename file');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should enqueue processRename after successful rename', async () => {
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      const plugin = await createLoadedPlugin(createApp());
      await plugin.smartRename(createInputFile());
      expect(hoisted.mockAddToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ operationName: 'Smart rename' })
      );
    });

    it('should store sanitized title when shouldStoreInvalidTitle is false', async () => {
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      const plugin = await createLoadedPlugin(createApp());
      await applySettings(plugin, {
        invalidCharacterAction: castTo<PluginSettings['invalidCharacterAction']>('Remove'),
        shouldStoreInvalidTitle: false
      });
      await plugin.smartRename(createInputFile());
      expect(hoisted.mockAddToQueue).toHaveBeenCalled();
    });

    it('should handle file with no parent (parent is null)', async () => {
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      const plugin = await createLoadedPlugin(createApp());
      await plugin.smartRename(createInputFile({ parent: null }));
      expect(hoisted.mockAddToQueue).toHaveBeenCalled();
    });
  });

  describe('processRename (via addToQueue callback)', () => {
    interface RunProcessRenameOptions {
      readonly backlinks?: BacklinksStub;
      readonly isMarkdown?: boolean;
      readonly newFile?: Partial<TFile>;
      readonly shouldStoreInvalidTitle?: boolean;
      readonly shouldUpdateFirstHeader?: boolean;
      readonly shouldUpdateTitleKey?: boolean;
    }

    async function runProcessRename(options: RunProcessRenameOptions): Promise<void> {
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue(
        options.backlinks ?? {
          get: (): null => null,
          keys: (): string[] => []
        }
      );
      hoisted.mockIsMarkdownFile.mockReturnValue(options.isMarkdown ?? true);
      hoisted.mockGetFile.mockReturnValue(strictProxy<TFile>({
        basename: 'NewTitle',
        path: 'NewTitle.md',
        ...options.newFile
      }));
      hoisted.mockAddAlias.mockResolvedValue(undefined);
      hoisted.mockProcessFrontmatter.mockResolvedValue(undefined);

      const plugin = await createLoadedPlugin(createApp());
      await applySettings(plugin, {
        shouldStoreInvalidTitle: options.shouldStoreInvalidTitle ?? true,
        shouldUpdateFirstHeader: options.shouldUpdateFirstHeader ?? false,
        shouldUpdateTitleKey: options.shouldUpdateTitleKey ?? false
      });

      await plugin.smartRename(createInputFile());
      await runEnqueuedOperation();
    }

    it('should call processBacklinks for all backlinks', async () => {
      const mockLink = { displayText: 'NewTitle', original: '[[OldTitle]]' };
      hoisted.mockExtractLinkFile.mockReturnValue(null);
      hoisted.mockEditLinks.mockResolvedValue(undefined);
      await runProcessRename({
        backlinks: {
          get: (): unknown[] => [mockLink],
          keys: (): string[] => ['note.md']
        },
        isMarkdown: false
      });
      expect(hoisted.mockEditLinks).toHaveBeenCalled();
    });

    it('should skip processBacklinks links section for non-markdown files', async () => {
      await runProcessRename({ isMarkdown: false });
      expect(hoisted.mockAddAlias).not.toHaveBeenCalled();
    });

    it('should call updateTitle when shouldUpdateTitleKey is true', async () => {
      await runProcessRename({ isMarkdown: true, shouldUpdateTitleKey: true });
      expect(hoisted.mockProcessFrontmatter).toHaveBeenCalled();
    });

    it('should set frontmatter title in the processFrontmatter callback', async () => {
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(true);
      hoisted.mockGetFile.mockReturnValue(strictProxy<TFile>({ basename: 'NewTitle', path: 'NewTitle.md' }));
      hoisted.mockAddAlias.mockResolvedValue(undefined);

      const capturedFrontmatter = castTo<CombinedFrontmatter<unknown>>({});
      hoisted.mockProcessFrontmatter.mockImplementation((_app: unknown, _path: string, cb: (fm: CombinedFrontmatter<unknown>) => void) => {
        cb(capturedFrontmatter);
        return noopAsync();
      });

      const plugin = await createLoadedPlugin(createApp());
      await applySettings(plugin, { shouldUpdateTitleKey: true });

      await plugin.smartRename(createInputFile());
      await runEnqueuedOperation();

      expect(capturedFrontmatter['title']).toBe('NewTitle');
    });

    it('should not call updateTitle when shouldUpdateTitleKey is false', async () => {
      await runProcessRename({ isMarkdown: true, shouldUpdateTitleKey: false });
      expect(hoisted.mockProcessFrontmatter).not.toHaveBeenCalled();
    });

    it('should call updateFirstHeader when shouldUpdateFirstHeader is true', async () => {
      hoisted.mockProcessVault.mockResolvedValue(undefined);
      await runProcessRename({ isMarkdown: true, shouldUpdateFirstHeader: true });
      expect(hoisted.mockProcessVault).toHaveBeenCalled();
    });

    it('should not call updateFirstHeader when shouldUpdateFirstHeader is false', async () => {
      await runProcessRename({ isMarkdown: true, shouldUpdateFirstHeader: false });
      expect(hoisted.mockProcessVault).not.toHaveBeenCalled();
    });

    it('should call addAlias for markdown files', async () => {
      await runProcessRename({ isMarkdown: true });
      expect(hoisted.mockAddAlias).toHaveBeenCalled();
    });

    it('should call addAlias with titleToStore when shouldStoreInvalidTitle is true and titleToStore differs', async () => {
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      hoisted.mockIsMarkdownFile.mockReturnValue(true);
      hoisted.mockGetFile.mockReturnValue(strictProxy<TFile>({
        basename: 'foobar',
        path: 'foobar.md'
      }));
      hoisted.mockAddAlias.mockResolvedValue(undefined);

      const plugin = await createLoadedPlugin(createApp());
      await applySettings(plugin, {
        invalidCharacterAction: castTo<PluginSettings['invalidCharacterAction']>('Remove'),
        shouldStoreInvalidTitle: true
      });

      await plugin.smartRename(createInputFile());
      await runEnqueuedOperation();

      expect(hoisted.mockAddAlias).toHaveBeenCalled();
    });
  });

  describe('processBacklinks (editLinks callback)', () => {
    async function setupBacklinkCallback(options: SetupBacklinkCallbackOptions): Promise<EditLinksCallback> {
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(false);
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue(options.backlinks);
      hoisted.mockGetFile.mockReturnValue(strictProxy<TFile>(options.newFile));

      let editLinksCallback: EditLinksCallback | undefined;
      hoisted.mockEditLinks.mockImplementation((_app: unknown, _path: string, cb: typeof editLinksCallback) => {
        editLinksCallback = cb;
      });

      const plugin = await createLoadedPlugin(createApp());
      if (options.settings) {
        await applySettings(plugin, options.settings);
      }

      await plugin.smartRename(createInputFile());
      await runEnqueuedOperation();

      if (!editLinksCallback) {
        throw new Error('editLinks callback was not captured');
      }

      return editLinksCallback;
    }

    it('should return undefined for link not matching newFile or linkJsons', async () => {
      const mockLink = { displayText: 'OtherNote', original: '[[OtherNote]]' };
      const callback = await setupBacklinkCallback({
        backlinks: {
          get: (): unknown[] => [mockLink],
          keys: (): string[] => ['note.md']
        },
        newFile: { basename: 'NewTitle', path: 'NewTitle.md' }
      });

      hoisted.mockExtractLinkFile.mockReturnValue(null);
      const result = callback({ displayText: 'SomeOther', original: '[[SomeOther]]' });
      expect(result).toBeUndefined();
    });

    it('should generate markdown link for matching link', async () => {
      const mockLink = { displayText: 'OldTitle', original: '[[OldTitle]]' };
      const newFile = { basename: 'NewTitle', path: 'NewTitle.md' };
      hoisted.mockGenerateMarkdownLink.mockReturnValue('[[NewTitle|OldTitle]]');

      const callback = await setupBacklinkCallback({
        backlinks: {
          get: (): unknown[] => [mockLink],
          keys: (): string[] => ['note.md']
        },
        newFile
      });

      hoisted.mockExtractLinkFile.mockReturnValue(hoisted.mockGetFile());
      const result = callback(mockLink);
      expect(result).toBe('[[NewTitle|OldTitle]]');
    });

    it('should use oldTitle as alias when displayText matches newTitle and shouldPreservePreviousDisplayTextInNoteLinks is true', async () => {
      hoisted.mockIsReferenceCache.mockReturnValue(true);
      const mockLink = { displayText: 'NewTitle', original: '[[OldTitle]]' };
      const newFile = { basename: 'NewTitle', path: 'NewTitle.md' };
      hoisted.mockGenerateMarkdownLink.mockReturnValue('[[NewTitle|OldTitle]]');

      const callback = await setupBacklinkCallback({
        backlinks: {
          get: (): unknown[] => [mockLink],
          keys: (): string[] => ['note.md']
        },
        newFile,
        settings: { shouldPreservePreviousDisplayTextInNoteLinks: true }
      });

      hoisted.mockExtractLinkFile.mockReturnValue(hoisted.mockGetFile());
      callback(mockLink);
      expect(hoisted.mockGenerateMarkdownLink).toHaveBeenCalledWith(
        expect.objectContaining({ alias: 'OldTitle' })
      );
    });

    it('should handle backlink path equal to oldPath (remapping to newPath)', async () => {
      const mockLink = { displayText: 'OldTitle', original: '[[OldTitle]]' };
      hoisted.mockGenerateMarkdownLink.mockReturnValue('[[NewTitle]]');
      hoisted.mockEditLinks.mockResolvedValue(undefined);

      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(false);
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({
        get: (): unknown[] => [mockLink],
        keys: (): string[] => ['OldTitle.md']
      });
      hoisted.mockGetFile.mockReturnValue(strictProxy<TFile>({ basename: 'NewTitle', path: 'NewTitle.md' }));

      const plugin = await createLoadedPlugin(createApp());
      await plugin.smartRename(createInputFile());
      await runEnqueuedOperation();

      expect(hoisted.mockEditLinks).toHaveBeenCalledWith(
        expect.anything(),
        'NewTitle.md',
        expect.any(Function)
      );
    });

    it('should skip backlink keys with null links array', async () => {
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(false);
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({
        get: (): null => null,
        keys: (): string[] => ['note.md']
      });
      hoisted.mockGetFile.mockReturnValue(strictProxy<TFile>({ basename: 'NewTitle', path: 'NewTitle.md' }));

      const plugin = await createLoadedPlugin(createApp());
      await plugin.smartRename(createInputFile());
      await runEnqueuedOperation();

      expect(hoisted.mockEditLinks).not.toHaveBeenCalled();
    });

    it('should handle link with undefined displayText (covers ?? empty string branch)', async () => {
      const mockLink: BacklinkLink = { original: '[[OldTitle]]' };
      const newFile = { basename: 'NewTitle', path: 'NewTitle.md' };
      hoisted.mockGenerateMarkdownLink.mockReturnValue('[[NewTitle]]');

      const callback = await setupBacklinkCallback({
        backlinks: {
          get: (): unknown[] => [mockLink],
          keys: (): string[] => ['note.md']
        },
        newFile
      });

      hoisted.mockExtractLinkFile.mockReturnValue(hoisted.mockGetFile());
      const result = callback(mockLink);
      expect(result).toBe('[[NewTitle]]');
    });

    it('should use oldTitle as alias when frontmatter link displayText matches newTitle and shouldPreservePreviousDisplayTextInFrontmatterLinks is true', async () => {
      hoisted.mockIsFrontmatterLinkCache.mockReturnValue(true);
      hoisted.mockIsReferenceCache.mockReturnValue(false);
      const mockLink = { displayText: 'NewTitle', original: '[[OldTitle]]' };
      const newFile = { basename: 'NewTitle', path: 'NewTitle.md' };
      hoisted.mockGenerateMarkdownLink.mockReturnValue('[[NewTitle|OldTitle]]');

      const callback = await setupBacklinkCallback({
        backlinks: {
          get: (): unknown[] => [mockLink],
          keys: (): string[] => ['note.md']
        },
        newFile,
        settings: { shouldPreservePreviousDisplayTextInFrontmatterLinks: true }
      });

      hoisted.mockExtractLinkFile.mockReturnValue(hoisted.mockGetFile());
      callback(mockLink);
      expect(hoisted.mockGenerateMarkdownLink).toHaveBeenCalledWith(
        expect.objectContaining({ alias: 'OldTitle' })
      );
    });
  });

  describe('updateFirstHeader (via addToQueue callback)', () => {
    async function setupProcessVaultCallback(options: SetupProcessVaultCallbackOptions): Promise<ProcessVaultCallback> {
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(true);
      hoisted.mockGetFile.mockReturnValue(strictProxy<TFile>({ basename: 'NewTitle', path: 'NewTitle.md' }));
      hoisted.mockAddAlias.mockResolvedValue(undefined);

      let processVaultCallback: ProcessVaultCallback | undefined;
      hoisted.mockProcessVault.mockImplementation((_app: unknown, _path: string, cb: typeof processVaultCallback) => {
        processVaultCallback = cb;
      });
      hoisted.mockGetCacheSafe.mockResolvedValue(options.cache);

      const plugin = await createLoadedPlugin(createApp());
      await applySettings(plugin, { shouldUpdateFirstHeader: true });

      await plugin.smartRename(createInputFile());
      await runEnqueuedOperation();

      if (!processVaultCallback) {
        throw new Error('process callback was not captured');
      }

      return processVaultCallback;
    }

    it('should return early when cache is null', async () => {
      const callback = await setupProcessVaultCallback({ cache: null });
      const controller = new AbortController();
      const result = await callback({ abortSignal: controller.signal, content: '# OldTitle\n\ncontent' });
      expect(result).toBeNull();
    });

    it('should return content unchanged when no first heading is found', async () => {
      const callback = await setupProcessVaultCallback({ cache: { headings: [] } });
      const content = 'no headings here';
      const controller = new AbortController();
      const result = await callback({ abortSignal: controller.signal, content });
      expect(result).toBe(content);
    });

    it('should update first heading when found', async () => {
      const heading = {
        level: 1,
        position: {
          end: { offset: 10 },
          start: { offset: 0 }
        }
      };
      const callback = await setupProcessVaultCallback({ cache: { headings: [heading] } });
      const controller = new AbortController();
      const result = await callback({ abortSignal: controller.signal, content: '# OldTitle\n\nContent' });
      expect(result).toBe('# NewTitle\n\nContent');
    });

    it('should throw when abortSignal is aborted before getCacheSafe', async () => {
      const callback = await setupProcessVaultCallback({ cache: { headings: [] } });
      const controller = new AbortController();
      controller.abort(new Error('aborted'));
      await expect(callback({ abortSignal: controller.signal, content: '# OldTitle' })).rejects.toThrow('aborted');
    });

    it('should throw when abortSignal is aborted after getCacheSafe', async () => {
      const controller = new AbortController();
      hoisted.mockGetCacheSafe.mockImplementation((): HeadingsCache => {
        controller.abort(new Error('aborted after cache'));
        return { headings: [] };
      });

      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(true);
      hoisted.mockGetFile.mockReturnValue(strictProxy<TFile>({ basename: 'NewTitle', path: 'NewTitle.md' }));
      hoisted.mockAddAlias.mockResolvedValue(undefined);

      let processVaultCallback: ProcessVaultCallback | undefined;
      hoisted.mockProcessVault.mockImplementation((_app: unknown, _path: string, cb: typeof processVaultCallback) => {
        processVaultCallback = cb;
      });

      const plugin = await createLoadedPlugin(createApp());
      await applySettings(plugin, { shouldUpdateFirstHeader: true });

      await plugin.smartRename(createInputFile());
      await runEnqueuedOperation();

      await expect(processVaultCallback?.({ abortSignal: controller.signal, content: '# OldTitle' })).rejects.toThrow('aborted after cache');
    });

    it('should pick the earliest first heading when multiple level-1 headings exist', async () => {
      const laterHeading = {
        level: 1,
        position: {
          end: { offset: 30 },
          start: { offset: 20 }
        }
      };
      const earlierHeading = {
        level: 1,
        position: {
          end: { offset: 10 },
          start: { offset: 0 }
        }
      };
      const callback = await setupProcessVaultCallback({ cache: { headings: [laterHeading, earlierHeading] } });
      const controller = new AbortController();
      const result = await callback({ abortSignal: controller.signal, content: '# OldTitle\n\nContent\n\n# Another' });
      expect(result).toBe('# NewTitle\n\nContent\n\n# Another');
    });
  });
});
