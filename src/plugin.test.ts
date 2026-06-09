/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-empty-function, @typescript-eslint/no-extraneous-class, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-useless-constructor, no-restricted-syntax, obsidianmd/no-tfile-tfolder-cast -- Test mocking patterns require flexible typing, type assertions, empty constructors, and mock calls. */
import type {
  App,
  PluginManifest,
  TFile
} from 'obsidian';

import { noopAsync } from 'obsidian-dev-utils/function';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

const addedChildren: unknown[] = [];

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
  mockIsMarkdownFile: vi.fn(),
  mockNotice: vi.fn(),
  mockProcessFrontmatter: vi.fn(),
  mockProcessVault: vi.fn(),
  mockPrompt: vi.fn()
}));

vi.mock('obsidian', () => ({
  Notice: hoisted.mockNotice,
  TFile: class MockTFile {
    public basename = '';
    public extension = 'md';
    public parent: { getParentPrefix(): string } | null = null;
    public path = '';
  }
}));

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin', () => ({
  PluginBase: class MockPluginBase {
    public app: unknown;
    public manifest: unknown;

    public constructor(app: unknown, manifest: unknown) {
      this.app = app;
      this.manifest = manifest;
    }

    public addChild<T>(child: T): T {
      addedChildren.push(child);
      return child;
    }

    public loadData(): unknown {
      return undefined;
    }

    public async onload(): Promise<void> {}
    public saveData(): unknown {
      return undefined;
    }
  }
}));

vi.mock('obsidian-dev-utils/obsidian/data-handler', () => ({
  PluginDataHandler: class MockPluginDataHandler {
    public constructor(_plugin: unknown) {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/components/plugin-settings-component', () => ({
  PluginSettingsComponentBase: class MockPluginSettingsComponentBase {
    public settings = {
      invalidCharacterAction: 'Error',
      replacementCharacter: '_',
      shouldPreservePreviousDisplayTextInFrontmatterLinks: true,
      shouldPreservePreviousDisplayTextInNoteLinks: true,
      shouldStoreInvalidTitle: true,
      shouldSupportNonMarkdownFiles: true,
      shouldUpdateFirstHeader: false,
      shouldUpdateTitleKey: false
    };

    public registerValidator(_key: string, _fn: unknown): void {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/components/plugin-settings-tab-component', () => ({
  PluginSettingsTabComponent: class MockPluginSettingsTabComponent {
    public constructor(_params: unknown) {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/components/menu-event-registrar-component', () => ({
  MenuEventRegistrarComponent: class MockMenuEventRegistrarComponent {
    public constructor(_app: unknown) {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/command-handlers/command-handler-component', () => ({
  CommandHandlerComponent: class MockCommandHandlerComponent {
    public constructor(_params: unknown) {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/active-file-provider', () => ({
  AppActiveFileProvider: class MockAppActiveFileProvider {
    public constructor(_app: unknown) {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/command-registrar', () => ({
  PluginCommandRegistrar: class MockPluginCommandRegistrar {
    public constructor(_plugin: unknown) {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin-settings-tab', () => ({
  PluginSettingsTabBase: class MockPluginSettingsTabBase {
    public constructor(_params: unknown) {}
  }
}));

vi.mock('./plugin-settings-tab.ts', () => ({
  PluginSettingsTab: class MockPluginSettingsTab {
    public constructor(_params: unknown) {}
  }
}));

vi.mock('./plugin-settings-component.ts', () => ({
  PluginSettingsComponent: class MockPluginSettingsComponent {
    public settings = {
      invalidCharacterAction: 'Error',
      replacementCharacter: '_',
      shouldPreservePreviousDisplayTextInFrontmatterLinks: true,
      shouldPreservePreviousDisplayTextInNoteLinks: true,
      shouldStoreInvalidTitle: true,
      shouldSupportNonMarkdownFiles: true,
      shouldUpdateFirstHeader: false,
      shouldUpdateTitleKey: false
    };

    public constructor(_params: unknown) {}
  }
}));

interface InvokeCommandHandlerOptions {
  checkIsMarkdownFile(file: TFile): boolean;
  getSettings(): unknown;
  smartRename(file: TFile): Promise<void>;
}

const capturedInvokeHandlerOptions: InvokeCommandHandlerOptions[] = [];

vi.mock('./command-handlers/invoke-command-handler.ts', () => ({
  InvokeCommandHandler: class MockInvokeCommandHandler {
    public constructor(params: InvokeCommandHandlerOptions) {
      capturedInvokeHandlerOptions.push(params);
    }
  }
}));

vi.mock('obsidian-dev-utils/obsidian/modals/prompt', () => ({
  prompt: (...args: unknown[]) => hoisted.mockPrompt(...args)
}));

vi.mock('obsidian-dev-utils/obsidian/metadata-cache', () => ({
  getBacklinksForFileSafe: (...args: unknown[]) => hoisted.mockGetBacklinksForFileSafe(...args),

  getCacheSafe: (...args: unknown[]) => hoisted.mockGetCacheSafe(...args)
}));

vi.mock('obsidian-dev-utils/obsidian/file-system', () => ({
  getFile: (...args: unknown[]) => hoisted.mockGetFile(...args),

  isMarkdownFile: (...args: unknown[]) => hoisted.mockIsMarkdownFile(...args)
}));

vi.mock('obsidian-dev-utils/obsidian/file-manager', () => ({
  addAlias: (...args: unknown[]) => hoisted.mockAddAlias(...args),

  processFrontmatter: (...args: unknown[]) => hoisted.mockProcessFrontmatter(...args)
}));

vi.mock('obsidian-dev-utils/obsidian/link', () => ({
  editLinks: (...args: unknown[]) => hoisted.mockEditLinks(...args),

  extractLinkFile: (...args: unknown[]) => hoisted.mockExtractLinkFile(...args),

  generateMarkdownLink: (...args: unknown[]) => hoisted.mockGenerateMarkdownLink(...args)
}));

vi.mock('obsidian-dev-utils/obsidian/queue', () => ({
  addToQueue: (...args: unknown[]) => hoisted.mockAddToQueue(...args)
}));

vi.mock('obsidian-dev-utils/obsidian/vault', () => ({
  process: (...args: unknown[]) => hoisted.mockProcessVault(...args)
}));

vi.mock('obsidian-dev-utils/obsidian/validation', () => ({
  getOsAndObsidianUnsafePathCharsRegExp: () => hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp()
}));

vi.mock('obsidian-dev-utils/object-utils', () => ({
  normalizeOptionalProperties: (obj: unknown) => obj,
  toJson: (obj: unknown) => JSON.stringify(obj)
}));

vi.mock('obsidian-dev-utils/path', () => ({
  basename: (path: string, ext: string) => path.replace(ext, '').split('/').pop() ?? path,
  extname: (path: string) => {
    const dot = path.lastIndexOf('.');
    return dot >= 0 ? path.slice(dot) : '';
  },
  join: (...parts: string[]) => parts.filter(Boolean).join('/'),
  makeFileName: (name: string, ext: string) => (ext ? `${name}.${ext}` : name)
}));

vi.mock('obsidian-dev-utils/string', () => ({
  insertAt: (_content: string, replacement: string, _start: number, _end: number) => replacement
}));

vi.mock('@obsidian-typings/obsidian-public-latest/implementations', () => ({
  isFrontmatterLinkCache: vi.fn().mockReturnValue(false),
  isReferenceCache: vi.fn().mockReturnValue(true)
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';

interface MockPluginSettings {
  invalidCharacterAction: string;
  replacementCharacter: string;
  shouldPreservePreviousDisplayTextInFrontmatterLinks: boolean;
  shouldPreservePreviousDisplayTextInNoteLinks: boolean;
  shouldStoreInvalidTitle: boolean;
  shouldSupportNonMarkdownFiles: boolean;
  shouldUpdateFirstHeader: boolean;
  shouldUpdateTitleKey: boolean;
}

interface MockSettingsComponent {
  settings: MockPluginSettings;
}

function createMockApp(): App {
  return {
    vault: {
      exists: vi.fn().mockResolvedValue(false),
      rename: vi.fn().mockResolvedValue(undefined)
    }
  } as unknown as App;
}

function createMockManifest(): PluginManifest {
  return { id: 'smart-rename', name: 'Smart Rename', version: '1.0.0' } as unknown as PluginManifest;
}

function createPlugin(app?: App): Plugin {
  addedChildren.length = 0;
  return new Plugin(app ?? createMockApp(), createMockManifest());
}

function getSettingsComponent(_plugin: Plugin): MockSettingsComponent {
  // The PluginSettingsComponent is the first child added.
  const SETTINGS_COMPONENT_INDEX = 0;
  return addedChildren[SETTINGS_COMPONENT_INDEX] as MockSettingsComponent;
}

describe('Plugin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    addedChildren.length = 0;
    capturedInvokeHandlerOptions.length = 0;
  });

  describe('constructor', () => {
    it('should create a plugin instance', () => {
      const plugin = createPlugin();
      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('should add child components', () => {
      createPlugin();
      expect(addedChildren.length).toBeGreaterThan(0);
    });

    it('should pass checkIsMarkdownFile lambda that delegates to isMarkdownFile', () => {
      capturedInvokeHandlerOptions.length = 0;
      hoisted.mockIsMarkdownFile.mockReturnValue(true);
      createPlugin();
      const options = capturedInvokeHandlerOptions[0];
      expect(options).toBeDefined();
      const mockFile = { path: 'note.md' } as unknown as TFile;
      const result = options?.checkIsMarkdownFile(mockFile);
      expect(result).toBe(true);
      expect(hoisted.mockIsMarkdownFile).toHaveBeenCalled();
    });

    it('should pass getSettings lambda that returns plugin settings', () => {
      capturedInvokeHandlerOptions.length = 0;
      createPlugin();
      const options = capturedInvokeHandlerOptions[0];
      expect(options).toBeDefined();
      const settings = options?.getSettings();
      expect(settings).toBeDefined();
    });
  });

  describe('hasInvalidCharacters', () => {
    it('should return true when string has invalid characters', () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\:*?"<>|]/);
      const plugin = createPlugin();
      expect(plugin.hasInvalidCharacters('foo/bar')).toBe(true);
    });

    it('should return false when string has no invalid characters', () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\:*?"<>|]/);
      const plugin = createPlugin();
      expect(plugin.hasInvalidCharacters('valid-name')).toBe(false);
    });
  });

  describe('smartRename', () => {
    function createMockFile(overrides?: Partial<TFile>): TFile {
      return {
        basename: 'OldTitle',
        extension: 'md',
        parent: { getParentPrefix: () => '' },
        path: 'OldTitle.md',
        ...overrides
      } as unknown as TFile;
    }

    it('should show notice when new title is empty (prompt returns empty string)', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('');
      const app = createMockApp();
      const plugin = createPlugin(app);
      await plugin.smartRename(createMockFile());
      expect(hoisted.mockNotice).toHaveBeenCalledWith('No new title provided');
    });

    it('should show notice when prompt returns null (cancelled)', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue(null);
      const app = createMockApp();
      const plugin = createPlugin(app);
      await plugin.smartRename(createMockFile());
      expect(hoisted.mockNotice).toHaveBeenCalledWith('No new title provided');
    });

    it('should show notice when title did not change', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('OldTitle');
      const app = createMockApp();
      const plugin = createPlugin(app);
      await plugin.smartRename(createMockFile());
      expect(hoisted.mockNotice).toHaveBeenCalledWith('The title did not change');
    });

    it('should allow rename when only casing changes', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('OLDTITLE');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({ get: () => null, keys: () => [] });
      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);
      const plugin = createPlugin(app);
      await plugin.smartRename(createMockFile());
      expect(hoisted.mockAddToQueue).toHaveBeenCalled();
    });

    it('should show notice when file with new title already exists', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(true);
      const plugin = createPlugin(app);
      await plugin.smartRename(createMockFile());
      expect(hoisted.mockNotice).toHaveBeenCalledWith('Note with the new title already exists');
    });

    it('should show notice when title starts with a dot', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('.hidden');
      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      const plugin = createPlugin(app);
      await plugin.smartRename(createMockFile());
      expect(hoisted.mockNotice).toHaveBeenCalledWith('The title cannot start with a dot');
    });

    it('should show notice when rename throws Error action for invalid characters', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      const app = createMockApp();
      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.invalidCharacterAction = 'Error';
      await plugin.smartRename(createMockFile());
      expect(hoisted.mockNotice).toHaveBeenCalledWith('The new title has invalid characters');
    });

    it('should remove invalid characters when action is Remove', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({ get: () => null, keys: () => [] });
      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);
      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.invalidCharacterAction = 'Remove';
      await plugin.smartRename(createMockFile());
      expect(hoisted.mockAddToQueue).toHaveBeenCalled();
    });

    it('should replace invalid characters when action is Replace', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({ get: () => null, keys: () => [] });
      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);
      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.invalidCharacterAction = 'Replace';
      settingsComponent.settings.replacementCharacter = '_';
      await plugin.smartRename(createMockFile());
      expect(hoisted.mockAddToQueue).toHaveBeenCalled();
    });

    it('should throw when invalidCharacterAction is unknown', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      const app = createMockApp();
      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.invalidCharacterAction = 'Unknown';
      await expect(plugin.smartRename(createMockFile())).rejects.toThrow('Invalid character action');
    });

    it('should show notice when vault rename fails', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({ get: () => null, keys: () => [] });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockRejectedValue(
        new Error('rename failed')
      );
      const plugin = createPlugin(app);
      await plugin.smartRename(createMockFile());
      expect(hoisted.mockNotice).toHaveBeenCalledWith('Failed to rename file');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should enqueue processRename after successful rename', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({ get: () => null, keys: () => [] });
      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);
      const plugin = createPlugin(app);
      await plugin.smartRename(createMockFile());
      expect(hoisted.mockAddToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ operationName: 'Smart rename' })
      );
    });

    it('should store sanitized title when shouldStoreInvalidTitle is false', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({ get: () => null, keys: () => [] });
      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);
      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.invalidCharacterAction = 'Remove';
      settingsComponent.settings.shouldStoreInvalidTitle = false;
      await plugin.smartRename(createMockFile());
      expect(hoisted.mockAddToQueue).toHaveBeenCalled();
    });

    it('should handle file with no parent (parent is null)', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({ get: () => null, keys: () => [] });
      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);
      const plugin = createPlugin(app);
      await plugin.smartRename(createMockFile({ parent: null }));
      expect(hoisted.mockAddToQueue).toHaveBeenCalled();
    });
  });

  describe('processRename (via addToQueue callback)', () => {
    function createMockFile(overrides?: Partial<TFile>): TFile {
      return {
        basename: 'NewTitle',
        extension: 'md',
        parent: { getParentPrefix: () => '' },
        path: 'NewTitle.md',
        ...overrides
      } as unknown as TFile;
    }

    async function runProcessRename(opts: {
      backlinks?: { get(k: string): null | unknown[]; keys(): string[] };
      isMarkdown?: boolean;
      shouldStoreInvalidTitle?: boolean;
      shouldUpdateFirstHeader?: boolean;
      shouldUpdateTitleKey?: boolean;
    }): Promise<void> {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue(opts.backlinks ?? { get: () => null, keys: () => [] });
      hoisted.mockIsMarkdownFile.mockReturnValue(opts.isMarkdown ?? true);
      hoisted.mockGetFile.mockReturnValue(createMockFile());
      hoisted.mockAddAlias.mockResolvedValue(undefined);
      hoisted.mockProcessFrontmatter.mockResolvedValue(undefined);

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.shouldUpdateFirstHeader = opts.shouldUpdateFirstHeader ?? false;
      settingsComponent.settings.shouldUpdateTitleKey = opts.shouldUpdateTitleKey ?? false;
      settingsComponent.settings.shouldStoreInvalidTitle = opts.shouldStoreInvalidTitle ?? true;

      await plugin.smartRename(createMockFile({ basename: 'OldTitle', path: 'OldTitle.md' }));

      // Now invoke the processRename callback that was enqueued
      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();
    }

    it('should call processBacklinks for all backlinks', async () => {
      const mockLink = { displayText: 'NewTitle', original: '[[OldTitle]]' };
      const backlinks = {
        get: () => [mockLink],
        keys: () => ['note.md']
      };
      hoisted.mockExtractLinkFile.mockReturnValue(null);
      hoisted.mockEditLinks.mockResolvedValue(undefined);
      hoisted.mockIsMarkdownFile.mockReturnValue(false);
      await runProcessRename({ backlinks });
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
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({ get: () => null, keys: () => [] });
      hoisted.mockIsMarkdownFile.mockReturnValue(true);
      hoisted.mockGetFile.mockReturnValue({ basename: 'NewTitle', path: 'NewTitle.md' });
      hoisted.mockAddAlias.mockResolvedValue(undefined);

      const capturedFrontmatter: Record<string, unknown> = {};
      hoisted.mockProcessFrontmatter.mockImplementation((_app: unknown, _path: string, cb: (fm: Record<string, unknown>) => void) => {
        cb(capturedFrontmatter);
        return noopAsync();
      });

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.shouldUpdateTitleKey = true;

      await plugin.smartRename({ basename: 'OldTitle', extension: 'md', parent: { getParentPrefix: () => '' }, path: 'OldTitle.md' } as unknown as TFile);
      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();

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
      // When shouldStoreInvalidTitle=true and invalid chars removed, titleToStore (original) differs from sanitized newTitle
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({ get: () => null, keys: () => [] });
      hoisted.mockIsMarkdownFile.mockReturnValue(true);
      hoisted.mockGetFile.mockReturnValue({
        basename: 'foobar',
        path: 'foobar.md'
      });
      hoisted.mockAddAlias.mockResolvedValue(undefined);

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.invalidCharacterAction = 'Remove';
      settingsComponent.settings.shouldStoreInvalidTitle = true;

      await plugin.smartRename({ basename: 'OldTitle', extension: 'md', parent: { getParentPrefix: () => '' }, path: 'OldTitle.md' } as unknown as TFile);

      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();

      expect(hoisted.mockAddAlias).toHaveBeenCalled();
    });
  });

  describe('processBacklinks (editLinks callback)', () => {
    it('should return undefined for link not matching newFile or linkJsons', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(false);

      const mockLink = { displayText: 'OtherNote', original: '[[OtherNote]]' };
      const backlinks = {
        get: () => [mockLink],
        keys: () => ['note.md']
      };
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue(backlinks);

      const newFile = { basename: 'NewTitle', path: 'NewTitle.md' };
      hoisted.mockGetFile.mockReturnValue(newFile);

      let editLinksCallback: ((link: { displayText?: string; original: string }) => string | undefined) | undefined;
      hoisted.mockEditLinks.mockImplementation((_app: unknown, _path: string, cb: typeof editLinksCallback) => {
        editLinksCallback = cb;
      });

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      await plugin.smartRename({ basename: 'OldTitle', extension: 'md', parent: { getParentPrefix: () => '' }, path: 'OldTitle.md' } as unknown as TFile);
      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();

      // Simulate a link that doesn't match newFile and isn't in linkJsons
      hoisted.mockExtractLinkFile.mockReturnValue(null);
      const result = editLinksCallback?.({ displayText: 'SomeOther', original: '[[SomeOther]]' });
      expect(result).toBeUndefined();
    });

    it('should generate markdown link for matching link', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(false);

      const mockLink = { displayText: 'OldTitle', original: '[[OldTitle]]' };
      const backlinks = {
        get: () => [mockLink],
        keys: () => ['note.md']
      };
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue(backlinks);

      const newFile = { basename: 'NewTitle', path: 'NewTitle.md' };
      hoisted.mockGetFile.mockReturnValue(newFile);
      hoisted.mockGenerateMarkdownLink.mockReturnValue('[[NewTitle|OldTitle]]');

      let editLinksCallback: ((link: { displayText?: string; original: string }) => string | undefined) | undefined;
      hoisted.mockEditLinks.mockImplementation((_app: unknown, _path: string, cb: typeof editLinksCallback) => {
        editLinksCallback = cb;
      });

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      await plugin.smartRename({ basename: 'OldTitle', extension: 'md', parent: { getParentPrefix: () => '' }, path: 'OldTitle.md' } as unknown as TFile);
      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();

      // Use the matching link (same JSON as mockLink in backlinks)
      hoisted.mockExtractLinkFile.mockReturnValue(newFile);
      const result = editLinksCallback?.(mockLink);
      expect(result).toBe('[[NewTitle|OldTitle]]');
    });

    it('should use oldTitle as alias when displayText matches newTitle and shouldPreservePreviousDisplayTextInNoteLinks is true', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(false);

      const mockLink = { displayText: 'NewTitle', original: '[[OldTitle]]' };
      const backlinks = {
        get: () => [mockLink],
        keys: () => ['note.md']
      };
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue(backlinks);

      const newFile = { basename: 'NewTitle', path: 'NewTitle.md' };
      hoisted.mockGetFile.mockReturnValue(newFile);
      hoisted.mockGenerateMarkdownLink.mockReturnValue('[[NewTitle|OldTitle]]');

      const { isReferenceCache } = await import('@obsidian-typings/obsidian-public-latest/implementations');
      vi.mocked(isReferenceCache).mockReturnValue(true);

      let editLinksCallback: ((link: { displayText?: string; original: string }) => string | undefined) | undefined;
      hoisted.mockEditLinks.mockImplementation((_app: unknown, _path: string, cb: typeof editLinksCallback) => {
        editLinksCallback = cb;
      });

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.shouldPreservePreviousDisplayTextInNoteLinks = true;

      await plugin.smartRename({ basename: 'OldTitle', extension: 'md', parent: { getParentPrefix: () => '' }, path: 'OldTitle.md' } as unknown as TFile);
      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();

      hoisted.mockExtractLinkFile.mockReturnValue(newFile);
      editLinksCallback?.(mockLink);
      expect(hoisted.mockGenerateMarkdownLink).toHaveBeenCalledWith(
        expect.objectContaining({ alias: 'OldTitle' })
      );
    });

    it('should handle backlink path equal to oldPath (remapping to newPath)', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(false);

      const mockLink = { displayText: 'OldTitle', original: '[[OldTitle]]' };
      const backlinks = {
        get: () => [mockLink],
        // Backlink path equals oldPath
        keys: () => ['OldTitle.md']
      };
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue(backlinks);

      const newFile = { basename: 'NewTitle', path: 'NewTitle.md' };
      hoisted.mockGetFile.mockReturnValue(newFile);
      hoisted.mockGenerateMarkdownLink.mockReturnValue('[[NewTitle]]');
      hoisted.mockEditLinks.mockResolvedValue(undefined);

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      await plugin.smartRename({ basename: 'OldTitle', extension: 'md', parent: { getParentPrefix: () => '' }, path: 'OldTitle.md' } as unknown as TFile);
      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();

      // EditLinks should be called with newPath (not oldPath) for backlinkNotePath === oldPath
      expect(hoisted.mockEditLinks).toHaveBeenCalledWith(
        expect.anything(),
        'NewTitle.md',
        expect.any(Function)
      );
    });

    it('should skip backlink keys with null links array', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(false);

      const backlinks = {
        get: () => null,
        keys: () => ['note.md']
      };
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue(backlinks);
      hoisted.mockGetFile.mockReturnValue({ basename: 'NewTitle', path: 'NewTitle.md' });

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      await plugin.smartRename({ basename: 'OldTitle', extension: 'md', parent: { getParentPrefix: () => '' }, path: 'OldTitle.md' } as unknown as TFile);
      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();

      expect(hoisted.mockEditLinks).not.toHaveBeenCalled();
    });

    it('should handle link with undefined displayText (covers ?? empty string branch)', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(false);

      const mockLink: { displayText?: string; original: string } = { original: '[[OldTitle]]' };
      const backlinks = {
        get: () => [mockLink],
        keys: () => ['note.md']
      };
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue(backlinks);

      const newFile = { basename: 'NewTitle', path: 'NewTitle.md' };
      hoisted.mockGetFile.mockReturnValue(newFile);
      hoisted.mockGenerateMarkdownLink.mockReturnValue('[[NewTitle]]');

      let editLinksCallback: ((link: { displayText?: string; original: string }) => string | undefined) | undefined;
      hoisted.mockEditLinks.mockImplementation((_app: unknown, _path: string, cb: typeof editLinksCallback) => {
        editLinksCallback = cb;
      });

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      await plugin.smartRename({ basename: 'OldTitle', extension: 'md', parent: { getParentPrefix: () => '' }, path: 'OldTitle.md' } as unknown as TFile);
      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();

      hoisted.mockExtractLinkFile.mockReturnValue(newFile);
      const result = editLinksCallback?.(mockLink);
      expect(result).toBe('[[NewTitle]]');
    });

    it('should use oldTitle as alias when frontmatter link displayText matches newTitle and shouldPreservePreviousDisplayTextInFrontmatterLinks is true', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(false);

      const { isFrontmatterLinkCache } = await import('@obsidian-typings/obsidian-public-latest/implementations');
      vi.mocked(isFrontmatterLinkCache).mockReturnValue(true);
      const { isReferenceCache } = await import('@obsidian-typings/obsidian-public-latest/implementations');
      vi.mocked(isReferenceCache).mockReturnValue(false);

      const mockLink = { displayText: 'NewTitle', original: '[[OldTitle]]' };
      const backlinks = {
        get: () => [mockLink],
        keys: () => ['note.md']
      };
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue(backlinks);

      const newFile = { basename: 'NewTitle', path: 'NewTitle.md' };
      hoisted.mockGetFile.mockReturnValue(newFile);
      hoisted.mockGenerateMarkdownLink.mockReturnValue('[[NewTitle|OldTitle]]');

      let editLinksCallback: ((link: { displayText?: string; original: string }) => string | undefined) | undefined;
      hoisted.mockEditLinks.mockImplementation((_app: unknown, _path: string, cb: typeof editLinksCallback) => {
        editLinksCallback = cb;
      });

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.shouldPreservePreviousDisplayTextInFrontmatterLinks = true;

      await plugin.smartRename({ basename: 'OldTitle', extension: 'md', parent: { getParentPrefix: () => '' }, path: 'OldTitle.md' } as unknown as TFile);
      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();

      hoisted.mockExtractLinkFile.mockReturnValue(newFile);
      editLinksCallback?.(mockLink);
      expect(hoisted.mockGenerateMarkdownLink).toHaveBeenCalledWith(
        expect.objectContaining({ alias: 'OldTitle' })
      );
    });
  });

  describe('updateFirstHeader (via addToQueue callback)', () => {
    it('should return early when cache is null', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({ get: () => null, keys: () => [] });
      hoisted.mockIsMarkdownFile.mockReturnValue(true);
      hoisted.mockGetFile.mockReturnValue({ basename: 'NewTitle', path: 'NewTitle.md' });
      hoisted.mockAddAlias.mockResolvedValue(undefined);

      let processVaultCallback: ((ctx: { abortSignal: AbortSignal; content: string }) => Promise<null | string>) | undefined;
      hoisted.mockProcessVault.mockImplementation((_app: unknown, _path: string, cb: typeof processVaultCallback) => {
        processVaultCallback = cb;
      });

      hoisted.mockGetCacheSafe.mockResolvedValue(null);

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.shouldUpdateFirstHeader = true;

      await plugin.smartRename({ basename: 'OldTitle', extension: 'md', parent: { getParentPrefix: () => '' }, path: 'OldTitle.md' } as unknown as TFile);
      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();

      const controller = new AbortController();
      const result = await processVaultCallback?.({ abortSignal: controller.signal, content: '# OldTitle\n\ncontent' });
      expect(result).toBeNull();
    });

    it('should return content unchanged when no first heading is found', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({ get: () => null, keys: () => [] });
      hoisted.mockIsMarkdownFile.mockReturnValue(true);
      hoisted.mockGetFile.mockReturnValue({ basename: 'NewTitle', path: 'NewTitle.md' });
      hoisted.mockAddAlias.mockResolvedValue(undefined);

      let processVaultCallback: ((ctx: { abortSignal: AbortSignal; content: string }) => Promise<null | string>) | undefined;
      hoisted.mockProcessVault.mockImplementation((_app: unknown, _path: string, cb: typeof processVaultCallback) => {
        processVaultCallback = cb;
      });

      hoisted.mockGetCacheSafe.mockResolvedValue({ headings: [] });

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.shouldUpdateFirstHeader = true;

      await plugin.smartRename({ basename: 'OldTitle', extension: 'md', parent: { getParentPrefix: () => '' }, path: 'OldTitle.md' } as unknown as TFile);
      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();

      const content = 'no headings here';
      const controller = new AbortController();
      const result = await processVaultCallback?.({ abortSignal: controller.signal, content });
      expect(result).toBe(content);
    });

    it('should update first heading when found', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({ get: () => null, keys: () => [] });
      hoisted.mockIsMarkdownFile.mockReturnValue(true);
      hoisted.mockGetFile.mockReturnValue({ basename: 'NewTitle', path: 'NewTitle.md' });
      hoisted.mockAddAlias.mockResolvedValue(undefined);

      let processVaultCallback: ((ctx: { abortSignal: AbortSignal; content: string }) => Promise<null | string>) | undefined;
      hoisted.mockProcessVault.mockImplementation((_app: unknown, _path: string, cb: typeof processVaultCallback) => {
        processVaultCallback = cb;
      });

      const heading = {
        level: 1,
        position: {
          end: { offset: 10 },
          start: { offset: 0 }
        }
      };
      hoisted.mockGetCacheSafe.mockResolvedValue({ headings: [heading] });

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.shouldUpdateFirstHeader = true;

      await plugin.smartRename({ basename: 'OldTitle', extension: 'md', parent: { getParentPrefix: () => '' }, path: 'OldTitle.md' } as unknown as TFile);
      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();

      const controller = new AbortController();
      const result = await processVaultCallback?.({ abortSignal: controller.signal, content: '# OldTitle\n\nContent' });
      // InsertAt is mocked to return the replacement string
      expect(result).toBe('# NewTitle');
    });

    it('should throw when abortSignal is aborted before getCacheSafe', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({ get: () => null, keys: () => [] });
      hoisted.mockIsMarkdownFile.mockReturnValue(true);
      hoisted.mockGetFile.mockReturnValue({ basename: 'NewTitle', path: 'NewTitle.md' });
      hoisted.mockAddAlias.mockResolvedValue(undefined);

      let processVaultCallback: ((ctx: { abortSignal: AbortSignal; content: string }) => Promise<null | string>) | undefined;
      hoisted.mockProcessVault.mockImplementation((_app: unknown, _path: string, cb: typeof processVaultCallback) => {
        processVaultCallback = cb;
      });

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.shouldUpdateFirstHeader = true;

      await plugin.smartRename({ basename: 'OldTitle', extension: 'md', parent: { getParentPrefix: () => '' }, path: 'OldTitle.md' } as unknown as TFile);
      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();

      const controller = new AbortController();
      controller.abort(new Error('aborted'));
      await expect(processVaultCallback?.({ abortSignal: controller.signal, content: '# OldTitle' })).rejects.toThrow('aborted');
    });

    it('should throw when abortSignal is aborted after getCacheSafe', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({ get: () => null, keys: () => [] });
      hoisted.mockIsMarkdownFile.mockReturnValue(true);
      hoisted.mockGetFile.mockReturnValue({ basename: 'NewTitle', path: 'NewTitle.md' });
      hoisted.mockAddAlias.mockResolvedValue(undefined);

      let processVaultCallback: ((ctx: { abortSignal: AbortSignal; content: string }) => Promise<null | string>) | undefined;
      hoisted.mockProcessVault.mockImplementation((_app: unknown, _path: string, cb: typeof processVaultCallback) => {
        processVaultCallback = cb;
      });

      const controller = new AbortController();
      hoisted.mockGetCacheSafe.mockImplementation((): { headings: never[] } => {
        controller.abort(new Error('aborted after cache'));
        return { headings: [] };
      });

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.shouldUpdateFirstHeader = true;

      await plugin.smartRename({ basename: 'OldTitle', extension: 'md', parent: { getParentPrefix: () => '' }, path: 'OldTitle.md' } as unknown as TFile);
      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();

      await expect(processVaultCallback?.({ abortSignal: controller.signal, content: '# OldTitle' })).rejects.toThrow('aborted after cache');
    });

    it('should pick the earliest first heading when multiple level-1 headings exist', async () => {
      hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp.mockReturnValue(/[/\\]/);
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({ get: () => null, keys: () => [] });
      hoisted.mockIsMarkdownFile.mockReturnValue(true);
      hoisted.mockGetFile.mockReturnValue({ basename: 'NewTitle', path: 'NewTitle.md' });
      hoisted.mockAddAlias.mockResolvedValue(undefined);

      let processVaultCallback: ((ctx: { abortSignal: AbortSignal; content: string }) => Promise<null | string>) | undefined;
      hoisted.mockProcessVault.mockImplementation((_app: unknown, _path: string, cb: typeof processVaultCallback) => {
        processVaultCallback = cb;
      });

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
      // Provide the later heading first so sort comparator is exercised
      hoisted.mockGetCacheSafe.mockResolvedValue({ headings: [laterHeading, earlierHeading] });

      const app = createMockApp();
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.exists = vi.fn().mockResolvedValue(false);
      (app as unknown as { vault: { exists: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> } }).vault.rename = vi.fn().mockResolvedValue(undefined);

      const plugin = createPlugin(app);
      const settingsComponent = getSettingsComponent(plugin);
      settingsComponent.settings.shouldUpdateFirstHeader = true;

      await plugin.smartRename({ basename: 'OldTitle', extension: 'md', parent: { getParentPrefix: () => '' }, path: 'OldTitle.md' } as unknown as TFile);
      const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [{ operationFn(): Promise<void> }] | undefined;
      await addToQueueCall?.[0]?.operationFn();

      const controller = new AbortController();
      const result = await processVaultCallback?.({ abortSignal: controller.signal, content: '# OldTitle\n\nContent\n\n# Another' });
      // InsertAt is mocked to return the replacement string; verify it was called
      expect(result).toBe('# NewTitle');
    });
  });
});
/* eslint-enable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-empty-function, @typescript-eslint/no-extraneous-class, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-useless-constructor, no-restricted-syntax, obsidianmd/no-tfile-tfolder-cast -- End of test file. */
