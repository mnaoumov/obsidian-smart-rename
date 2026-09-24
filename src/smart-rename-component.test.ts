import type {
  App as AppOriginal,
  TFile
} from 'obsidian';
import type { AsyncEventRef } from 'obsidian-dev-utils/async-events';
import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import type { CombinedFrontmatter } from 'obsidian-dev-utils/obsidian/frontmatter';
import type {
  ModalCommandBuilder,
  ModalCommandsHost
} from 'obsidian-dev-utils/obsidian/modals/modal-command-builder';
import type { PluginEventSource } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';
import type { ResourceLockComponent } from 'obsidian-dev-utils/obsidian/resource-lock';

import { Scope } from 'obsidian';
import {
  noop,
  noopAsync
} from 'obsidian-dev-utils/function';
import {
  castTo,
  normalizeOptionalProperties
} from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { ensureNonNullable } from 'obsidian-dev-utils/type-guards';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettings } from './plugin-settings.ts';

const noticeMessages: string[] = [];

const hoisted = vi.hoisted(() => ({
  mockAddAlias: vi.fn(),
  mockAddToQueue: vi.fn(),
  mockEditBacklinksSnapshot: vi.fn(),
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
    Notice: vi.fn(function NoticeStub(message: DocumentFragment | string) {
      noticeMessages.push(typeof message === 'string' ? message : message.textContent);
      return {
        // Since obsidian-dev-utils >= 87 installs click tracking on the notice's containerEl, the stub must
        // expose an element with addEventListener for showNotice to attach its listener to.
        containerEl: { addEventListener: vi.fn() },
        hide: vi.fn(),
        setMessage: vi.fn()
      };
    })
  };
});

vi.mock('obsidian-dev-utils/obsidian/modals/prompt', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/modals/prompt')>(),
  prompt: (...$arguments: unknown[]): unknown => hoisted.mockPrompt(...$arguments)
}));

vi.mock('obsidian-dev-utils/obsidian/metadata-cache', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/metadata-cache')>(),
  getBacklinksForFileSafe: (...$arguments: unknown[]): unknown => hoisted.mockGetBacklinksForFileSafe(...$arguments),
  getCacheSafe: (...$arguments: unknown[]): unknown => hoisted.mockGetCacheSafe(...$arguments)
}));

vi.mock('obsidian-dev-utils/obsidian/file-system', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/file-system')>(),
  getFile: (...$arguments: unknown[]): unknown => hoisted.mockGetFile(...$arguments),
  isMarkdownFile: (...$arguments: unknown[]): unknown => hoisted.mockIsMarkdownFile(...$arguments)
}));

vi.mock('obsidian-dev-utils/obsidian/file-manager', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/file-manager')>(),
  addAlias: (...$arguments: unknown[]): unknown => hoisted.mockAddAlias(...$arguments),
  processFrontmatter: (...$arguments: unknown[]): unknown => hoisted.mockProcessFrontmatter(...$arguments)
}));

vi.mock('obsidian-dev-utils/obsidian/link', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/link')>(),
  // `buildBacklinksSnapshot` is deliberately NOT mocked: letting the real one run is what proves the
  // snapshot the converter is judged against was actually built from these backlinks (G49).
  editBacklinksSnapshot: (...$arguments: unknown[]): unknown => hoisted.mockEditBacklinksSnapshot(...$arguments),
  extractLinkFile: (...$arguments: unknown[]): unknown => hoisted.mockExtractLinkFile(...$arguments),
  generateMarkdownLink: (...$arguments: unknown[]): unknown => hoisted.mockGenerateMarkdownLink(...$arguments)
}));

vi.mock('obsidian-dev-utils/obsidian/queue', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/queue')>(),
  addToQueue: (...$arguments: unknown[]): unknown => hoisted.mockAddToQueue(...$arguments)
}));

vi.mock('obsidian-dev-utils/obsidian/vault', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/vault')>(),
  process: (...$arguments: unknown[]): unknown => hoisted.mockProcessVault(...$arguments)
}));

vi.mock('obsidian-dev-utils/obsidian/validation', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/validation')>(),
  getOsAndObsidianUnsafePathCharsRegExp: (): unknown => hoisted.mockGetOsAndObsidianUnsafePathCharsRegExp()
}));

vi.mock('@obsidian-typings/obsidian-public-latest/implementations', async (importOriginal) => ({
  ...await importOriginal<typeof import('@obsidian-typings/obsidian-public-latest/implementations')>(),
  isFrontmatterLinkCache: (...$arguments: unknown[]): unknown => hoisted.mockIsFrontmatterLinkCache(...$arguments),
  isReferenceCache: (...$arguments: unknown[]): unknown => hoisted.mockIsReferenceCache(...$arguments)
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginSettingsComponent } from './plugin-settings-component.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { SmartRenameComponent } from './smart-rename-component.ts';

interface BacklinkConversion {
  readonly link: BacklinkLink;
  readonly payload: true | undefined;
  readonly sourcePath: string;
}

interface BacklinkLink {
  displayText?: string;
  original: string;
}

interface BacklinksStub {
  get: (key: string) => null | unknown[];
  keys: () => string[];
}

interface CapturedEditBacklinksSnapshotParams {
  readonly linkConverter: EditLinksCallback;
}

interface CapturedProcessFrontmatterParams {
  readonly frontmatterFunction: (frontmatter: CombinedFrontmatter<unknown>) => void;
}

interface CapturedProcessVaultParams {
  readonly newContentProvider: ProcessVaultCallback;
}

interface CapturedPromptParams {
  readonly commandBuilder: ModalCommandBuilder;
}

// Split from `CapturedEditBacklinksSnapshotParams` rather than folded into it: the capture callback reads
// only the converter, and `no-unused-params-members` (rightly) rejects a member its receiver never touches.
interface CapturedSnapshot {
  readonly linkIdentityKeyProvider?: (link: BacklinkLink) => string;
  readonly snapshot: ReadonlyMap<string, ReadonlyMap<string, true>>;
}

interface CreateComponentOptions {
  readonly app?: AppOriginal;
  readonly settings?: Partial<PluginSettings>;
}

type EditLinksCallback = (params: BacklinkConversion) => string | undefined;

interface EnqueuedOperation {
  operationFunction: () => Promise<void>;
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

class MockDataHandler implements DataHandler {
  public loadData = vi.fn(() => Promise.resolve(this.data));

  private _data: unknown;

  public saveData = vi.fn((d: unknown) => {
    this._data = d;
    return noopAsync();
  });

  public get data(): unknown {
    return this._data;
  }

  public constructor(data: unknown) {
    this._data = data;
  }
}

const ALIAS_CHECKBOX_INDEX = 2;

const DEFAULT_UNSAFE_CHARS_REGEXP = /[/\\]/;

const TITLE_KEY_CHECKBOX_INDEX = 3;

/**
 * Renders `commandBuilder`'s control strip the way `prompt` does, and hands back its checkboxes.
 *
 * The host is attached to the document because jsdom fires `change` on a checkbox `click()` only for a
 * connected element, and `change` is the event the builder binds `onChange` to.
 *
 * @param commandBuilder - The builder captured from the `prompt` call.
 * @returns The rendered checkboxes, in the order the builder declared them.
 */
function buildStrip(commandBuilder: ModalCommandBuilder): HTMLInputElement[] {
  const host: ModalCommandsHost = {
    containerEl: document.body.createDiv(),
    scope: new Scope()
  };
  commandBuilder.build(host);
  return [...host.containerEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
}

function clickCheckbox(checkboxEls: HTMLInputElement[], index: number): void {
  ensureNonNullable(checkboxEls[index]).click();
}

function createApp(): AppOriginal {
  const appMock = App.createConfigured__();
  const app = appMock.asOriginalType__();
  app.vault.exists = vi.fn().mockResolvedValue(false);
  app.vault.rename = vi.fn().mockResolvedValue(undefined);
  return app;
}

async function createComponent(options?: CreateComponentOptions): Promise<SmartRenameComponent> {
  const pluginSettingsComponent = await createSettingsComponent();
  if (options?.settings) {
    await pluginSettingsComponent.editAndSave((settings) => {
      Object.assign(settings, options.settings);
    });
  }

  const app = options?.app ?? createApp();
  return new SmartRenameComponent({
    app,
    pluginNoticeComponent: new PluginNoticeComponent({
      app,
      pluginName: 'Smart Rename'
    }),
    pluginSettingsComponent,
    resourceLockComponent: strictProxy<ResourceLockComponent>({})
  });
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

function createMockPluginEventSource(): PluginEventSource {
  const source: PluginEventSource = strictProxy<PluginEventSource>({
    offref: noop,
    on(name: string, callback: () => void, thisArgument?: unknown): AsyncEventRef {
      return { asyncEventSource: source, callback, name, thisArgument };
    }
  });
  return source;
}

async function createSettingsComponent(): Promise<PluginSettingsComponent> {
  const component = new PluginSettingsComponent({
    dataHandler: new MockDataHandler({}),
    pluginEventSource: createMockPluginEventSource(),
    pluginSettingsClass: PluginSettings
  });
  await component.loadWithPromises();
  return component;
}

function expectNoticeShown(message: string): void {
  expect(noticeMessages.some((noticeMessage) => noticeMessage.includes(message))).toBe(true);
}

async function runEnqueuedOperation(): Promise<void> {
  const addToQueueCall = hoisted.mockAddToQueue.mock.calls[0] as [EnqueuedOperation] | undefined;
  await addToQueueCall?.[0]?.operationFunction();
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
  document.body.empty();
  vi.clearAllMocks();
});

describe('SmartRenameComponent', () => {
  describe('smartRename', () => {
    it('should show notice when new title is empty (prompt returns empty string)', async () => {
      hoisted.mockPrompt.mockResolvedValue('');
      const component = await createComponent();
      await component.smartRename(createInputFile());
      expectNoticeShown('No new title provided');
    });

    it('should show notice when prompt returns null (cancelled)', async () => {
      hoisted.mockPrompt.mockResolvedValue(null);
      const component = await createComponent();
      await component.smartRename(createInputFile());
      expectNoticeShown('No new title provided');
    });

    it('should show notice when title did not change', async () => {
      hoisted.mockPrompt.mockResolvedValue('OldTitle');
      const component = await createComponent();
      await component.smartRename(createInputFile());
      expectNoticeShown('The title did not change');
    });

    it('should allow rename when only casing changes', async () => {
      hoisted.mockPrompt.mockResolvedValue('OLDTITLE');
      const component = await createComponent();
      await component.smartRename(createInputFile());
      expect(hoisted.mockAddToQueue).toHaveBeenCalled();
    });

    it('should show notice when file with new title already exists', async () => {
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      const app = createApp();
      app.vault.exists = vi.fn().mockResolvedValue(true);
      const component = await createComponent({ app });
      await component.smartRename(createInputFile());
      expectNoticeShown('Note with the new title already exists');
    });

    it('should show notice when title starts with a dot', async () => {
      hoisted.mockPrompt.mockResolvedValue('.hidden');
      const component = await createComponent();
      await component.smartRename(createInputFile());
      expectNoticeShown('The title cannot start with a dot');
    });

    it('should show notice when rename throws Error action for invalid characters', async () => {
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      const component = await createComponent({
        settings: { invalidCharacterAction: castTo<PluginSettings['invalidCharacterAction']>('Error') }
      });
      await component.smartRename(createInputFile());
      expectNoticeShown('The new title has invalid characters');
    });

    it('should remove invalid characters when action is Remove', async () => {
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      const component = await createComponent({
        settings: { invalidCharacterAction: castTo<PluginSettings['invalidCharacterAction']>('Remove') }
      });
      await component.smartRename(createInputFile());
      expect(hoisted.mockAddToQueue).toHaveBeenCalled();
    });

    it('should replace invalid characters when action is Replace', async () => {
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      const component = await createComponent({
        settings: {
          invalidCharacterAction: castTo<PluginSettings['invalidCharacterAction']>('Replace'),
          replacementCharacter: '_'
        }
      });
      await component.smartRename(createInputFile());
      expect(hoisted.mockAddToQueue).toHaveBeenCalled();
    });

    it('should throw when invalidCharacterAction is unknown', async () => {
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      const component = await createComponent({
        settings: { invalidCharacterAction: castTo<PluginSettings['invalidCharacterAction']>('Unknown') }
      });
      await expect(component.smartRename(createInputFile())).rejects.toThrow('Invalid character action');
    });

    it('should show notice when vault rename fails', async () => {
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const app = createApp();
      app.vault.rename = vi.fn().mockRejectedValue(new Error('rename failed'));
      const component = await createComponent({ app });
      await component.smartRename(createInputFile());
      expectNoticeShown('Failed to rename file');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should enqueue processRename after successful rename', async () => {
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      const component = await createComponent();
      await component.smartRename(createInputFile());
      expect(hoisted.mockAddToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ operationName: 'Smart rename' })
      );
    });

    it('should store sanitized title when shouldStoreInvalidTitle is false', async () => {
      hoisted.mockPrompt.mockResolvedValue('foo/bar');
      const component = await createComponent({
        settings: {
          invalidCharacterAction: castTo<PluginSettings['invalidCharacterAction']>('Remove'),
          shouldStoreInvalidTitle: false
        }
      });
      await component.smartRename(createInputFile());
      expect(hoisted.mockAddToQueue).toHaveBeenCalled();
    });

    it('should handle file with no parent (parent is null)', async () => {
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      const component = await createComponent();
      await component.smartRename(createInputFile({ parent: null }));
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

      const component = await createComponent({
        settings: {
          shouldStoreInvalidTitle: options.shouldStoreInvalidTitle ?? true,
          shouldUpdateFirstHeader: options.shouldUpdateFirstHeader ?? false,
          shouldUpdateTitleKey: options.shouldUpdateTitleKey ?? false
        }
      });

      await component.smartRename(createInputFile());
      await runEnqueuedOperation();
    }

    it('should call processBacklinks for all backlinks', async () => {
      const mockLink = { displayText: 'NewTitle', original: '[[OldTitle]]' };
      hoisted.mockExtractLinkFile.mockReturnValue(null);
      hoisted.mockEditBacklinksSnapshot.mockResolvedValue(undefined);
      await runProcessRename({
        backlinks: {
          get: (): unknown[] => [mockLink],
          keys: (): string[] => ['note.md']
        },
        isMarkdown: false
      });
      expect(hoisted.mockEditBacklinksSnapshot).toHaveBeenCalled();
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
      hoisted.mockProcessFrontmatter.mockImplementation((params: CapturedProcessFrontmatterParams) => {
        params.frontmatterFunction(capturedFrontmatter);
        return noopAsync();
      });

      const component = await createComponent({ settings: { shouldUpdateTitleKey: true } });

      await component.smartRename(createInputFile());
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

      const component = await createComponent({
        settings: {
          invalidCharacterAction: castTo<PluginSettings['invalidCharacterAction']>('Remove'),
          shouldStoreInvalidTitle: true
        }
      });

      await component.smartRename(createInputFile());
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
      hoisted.mockEditBacklinksSnapshot.mockImplementation((params: CapturedEditBacklinksSnapshotParams) => {
        editLinksCallback = params.linkConverter;
      });

      const component = await createComponent(options.settings ? { settings: options.settings } : undefined);

      await component.smartRename(createInputFile());
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
      // Absent from the snapshot (`payload: undefined`) AND resolving to some other file: the only
      // combination the converter declines.
      const result = callback({
        link: { displayText: 'SomeOther', original: '[[SomeOther]]' },
        payload: undefined,
        sourcePath: 'note.md'
      });
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
      const result = callback({ link: mockLink, payload: true, sourcePath: 'note.md' });
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
      callback({ link: mockLink, payload: true, sourcePath: 'note.md' });
      expect(hoisted.mockGenerateMarkdownLink).toHaveBeenCalledWith(
        expect.objectContaining({ alias: 'OldTitle' })
      );
    });

    it('should handle backlink path equal to oldPath (remapping to newPath)', async () => {
      const mockLink = { displayText: 'OldTitle', original: '[[OldTitle]]' };
      hoisted.mockGenerateMarkdownLink.mockReturnValue('[[NewTitle]]');
      hoisted.mockEditBacklinksSnapshot.mockResolvedValue(undefined);

      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(false);
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({
        get: (): unknown[] => [mockLink],
        keys: (): string[] => ['OldTitle.md']
      });
      hoisted.mockGetFile.mockReturnValue(strictProxy<TFile>({ basename: 'NewTitle', path: 'NewTitle.md' }));

      const component = await createComponent();
      await component.smartRename(createInputFile());
      await runEnqueuedOperation();

      // The remap is now a property of the SNAPSHOT rather than of a per-file call: the note's own
      // self-links were captured under its old path and must be rewritten at the new one.
      const params = ensureNonNullable(
        hoisted.mockEditBacklinksSnapshot.mock.calls[0]?.[0] as CapturedSnapshot | undefined
      );
      expect([...params.snapshot.keys()]).toEqual(['NewTitle.md']);
    });

    it('should key the snapshot the way editBacklinksSnapshot will look each captured link up', async () => {
      const mockLink = { displayText: 'OldTitle', original: '[[OldTitle]]' };
      hoisted.mockEditBacklinksSnapshot.mockResolvedValue(undefined);

      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(false);
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({
        get: (): unknown[] => [mockLink],
        keys: (): string[] => ['note.md']
      });
      hoisted.mockGetFile.mockReturnValue(strictProxy<TFile>({ basename: 'NewTitle', path: 'NewTitle.md' }));

      const component = await createComponent();
      await component.smartRename(createInputFile());
      await runEnqueuedOperation();

      /*
       * Every other converter case hands `payload` in directly, which skips the one step that joins the two
       * calls: `editBacklinksSnapshot` recomputing each link's key with ITS provider and reading the payload
       * under it. Doing that lookup here, with the documented `JSON.stringify` default when none is passed,
       * is what catches a snapshot keyed by a different provider - the shape that made every captured link
       * read as uncaptured and left every backlink on the old path.
       */
      const params = ensureNonNullable(
        hoisted.mockEditBacklinksSnapshot.mock.calls[0]?.[0] as CapturedSnapshot | undefined
      );
      const linkIdentityKeyProvider = params.linkIdentityKeyProvider ?? JSON.stringify;
      expect(params.snapshot.get('note.md')?.get(linkIdentityKeyProvider(mockLink))).toBe(true);
    });

    it('should still visit a backlink holder whose captured links array is null', async () => {
      hoisted.mockPrompt.mockResolvedValue('NewTitle');
      hoisted.mockIsMarkdownFile.mockReturnValue(false);
      hoisted.mockGetBacklinksForFileSafe.mockResolvedValue({
        get: (): null => null,
        keys: (): string[] => ['note.md']
      });
      hoisted.mockGetFile.mockReturnValue(strictProxy<TFile>({ basename: 'NewTitle', path: 'NewTitle.md' }));

      const component = await createComponent();
      await component.smartRename(createInputFile());
      await runEnqueuedOperation();

      /*
       * The old hand-rolled loop `continue`d past a holder with no captured links, skipping the file
       * outright. That contradicted this plugin's own widening: it visits links ABSENT from the snapshot
       * precisely so one already resolving to the renamed file still gets restyled, and skipping the whole
       * file denied those links the same chance. The holder is now visited with an empty capture set, and
       * every link in it is judged by `extractLinkFile` alone.
       */
      const params = ensureNonNullable(
        hoisted.mockEditBacklinksSnapshot.mock.calls[0]?.[0] as CapturedSnapshot | undefined
      );
      expect([...params.snapshot.keys()]).toEqual(['note.md']);
      expect(params.snapshot.get('note.md')?.size).toBe(0);
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
      const result = callback({ link: mockLink, payload: true, sourcePath: 'note.md' });
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
      callback({ link: mockLink, payload: true, sourcePath: 'note.md' });
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
      hoisted.mockProcessVault.mockImplementation((params: CapturedProcessVaultParams) => {
        processVaultCallback = params.newContentProvider;
      });
      hoisted.mockGetCacheSafe.mockResolvedValue(options.cache);

      const component = await createComponent({ settings: { shouldUpdateFirstHeader: true } });

      await component.smartRename(createInputFile());
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
      hoisted.mockProcessVault.mockImplementation((params: CapturedProcessVaultParams) => {
        processVaultCallback = params.newContentProvider;
      });

      const component = await createComponent({ settings: { shouldUpdateFirstHeader: true } });

      await component.smartRename(createInputFile());
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

  describe('rename prompt checkboxes', () => {
    interface RunRenameWithStripOptions {
      readonly isMarkdown?: boolean;
      readonly newFile?: Partial<TFile>;
      readonly newTitle?: string;
      readonly settings?: Partial<PluginSettings>;
      readonly toggleCheckboxes?: (checkboxEls: HTMLInputElement[]) => void;
    }

    async function runRenameWithStrip(options: RunRenameWithStripOptions = {}): Promise<HTMLInputElement[]> {
      let checkboxEls: HTMLInputElement[] = [];
      hoisted.mockIsMarkdownFile.mockReturnValue(options.isMarkdown ?? true);
      hoisted.mockGetFile.mockReturnValue(strictProxy<TFile>({
        basename: 'NewTitle',
        path: 'NewTitle.md',
        ...options.newFile
      }));
      hoisted.mockAddAlias.mockResolvedValue(undefined);
      hoisted.mockProcessFrontmatter.mockResolvedValue(undefined);
      hoisted.mockProcessVault.mockResolvedValue(undefined);
      hoisted.mockPrompt.mockImplementation((params: CapturedPromptParams) => {
        checkboxEls = buildStrip(params.commandBuilder);
        options.toggleCheckboxes?.(checkboxEls);
        return Promise.resolve(options.newTitle ?? 'NewTitle');
      });

      const component = await createComponent(normalizeOptionalProperties<CreateComponentOptions>({ settings: options.settings }));
      await component.smartRename(createInputFile());
      await runEnqueuedOperation();
      return checkboxEls;
    }

    it('should seed every checkbox from its setting', async () => {
      const checkboxEls = await runRenameWithStrip({
        settings: {
          shouldAddOldTitleAsAlias: false,
          shouldPreservePreviousDisplayTextInFrontmatterLinks: true,
          shouldPreservePreviousDisplayTextInNoteLinks: false,
          shouldUpdateFirstHeader: true,
          shouldUpdateTitleKey: false
        }
      });

      expect(checkboxEls.map((checkboxEl) => checkboxEl.checked)).toStrictEqual([false, true, false, false, true]);
    });

    it('should disable the markdown-only checkboxes for a non-markdown file', async () => {
      const checkboxEls = await runRenameWithStrip({ isMarkdown: false });

      expect(checkboxEls.map((checkboxEl) => checkboxEl.disabled)).toStrictEqual([false, false, true, true, true]);
    });

    it('should skip only the step whose checkbox is unticked', async () => {
      await runRenameWithStrip({
        settings: {
          shouldAddOldTitleAsAlias: true,
          shouldUpdateFirstHeader: true,
          shouldUpdateTitleKey: true
        },
        toggleCheckboxes: (checkboxEls) => {
          clickCheckbox(checkboxEls, ALIAS_CHECKBOX_INDEX);
        }
      });

      expect(hoisted.mockAddAlias).not.toHaveBeenCalled();
      expect(hoisted.mockProcessFrontmatter).toHaveBeenCalled();
      expect(hoisted.mockProcessVault).toHaveBeenCalled();
    });

    it('should run a step whose checkbox is ticked even though its setting is off', async () => {
      await runRenameWithStrip({
        settings: { shouldUpdateTitleKey: false },
        toggleCheckboxes: (checkboxEls) => {
          clickCheckbox(checkboxEls, TITLE_KEY_CHECKBOX_INDEX);
        }
      });

      expect(hoisted.mockProcessFrontmatter).toHaveBeenCalled();
    });

    it('should still store the invalid title when the old title alias is unticked', async () => {
      await runRenameWithStrip({
        newFile: {
          basename: 'foobar',
          path: 'foobar.md'
        },
        newTitle: 'foo/bar',
        settings: {
          invalidCharacterAction: castTo<PluginSettings['invalidCharacterAction']>('Remove'),
          shouldStoreInvalidTitle: true
        },
        toggleCheckboxes: (checkboxEls) => {
          clickCheckbox(checkboxEls, ALIAS_CHECKBOX_INDEX);
        }
      });

      expect(hoisted.mockAddAlias).toHaveBeenCalledTimes(1);
      expect(hoisted.mockAddAlias).toHaveBeenCalledWith(expect.objectContaining({ alias: 'foo/bar' }));
    });
  });
});
