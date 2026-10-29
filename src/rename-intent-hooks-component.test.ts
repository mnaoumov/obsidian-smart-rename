import type {
  App as AppOriginal,
  TFile,
  WorkspaceLeaf
} from 'obsidian';

import { sleep } from '@mnaoumov/typescript-lib/async';
import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { waitForAllAsyncOperations } from '@mnaoumov/typescript-test-toolkit/async-operation-tracking';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { EditableFileView } from 'obsidian';
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
import type { SmartRenameComponent } from './smart-rename-component.ts';

import { PluginSettings } from './plugin-settings.ts';
import { RenameIntentHooksComponent } from './rename-intent-hooks-component.ts';

interface EditableFileViewTitleMembers {
  readonly file: null | TFile;
  readonly fileBeingRenamed: null | TFile;
  readonly saveTitle: (titleEl: HTMLElement) => Promise<boolean>;
}

interface FileTreeItemStub {
  readonly innerEl: HTMLElement;
}

interface Fixture {
  readonly app: AppOriginal;
  readonly component: RenameIntentHooksComponent;
  readonly markdownFile: TFile;
  readonly originalPromptForFileRename: ReturnType<typeof vi.fn>;
  readonly otherFile: TFile;
  readonly promptAndRenameWithIntent: ReturnType<typeof vi.fn>;
  readonly renameWithIntent: ReturnType<typeof vi.fn>;
  readonly settings: PluginSettings;
}

class FileExplorerViewStub {
  public fileBeingRenamed: null | TFile = null;

  public exitRename = vi.fn(() => {
    this.fileBeingRenamed = null;
  });

  public readonly fileItems: Record<string, FileTreeItemStub> = {};

  public async saveRename(): Promise<boolean> {
    return await originalSaveRename();
  }
}

const originalSaveRename = vi.fn(() => Promise.resolve(true));
const originalSaveTitle = vi.fn(() => Promise.resolve(true));

let fixture: Fixture;

function createEditableView(file: null | TFile, fileBeingRenamed: null | TFile): EditableFileViewTitleMembers {
  return castTo<EditableFileViewTitleMembers>(Object.assign(Object.create(EditableFileView.prototype), { file, fileBeingRenamed }));
}

async function createFixture(leaves: WorkspaceLeaf[] = []): Promise<Fixture> {
  const appMock = App.createConfigured__({ files: { 'Note.md': '', 'Picture.png': '' } });
  appMock.workspace.onLayoutReady = vi.fn((callback: () => void) => {
    callback();
  });
  const app = appMock.asOriginalType__();
  const originalPromptForFileRename = vi.fn(noopAsync);
  // Not on the mock: the hooks patch it, and a patch needs the member to exist.
  app.fileManager.promptForFileRename = originalPromptForFileRename;
  app.workspace.getLeavesOfType = vi.fn(() => leaves);

  const settings = new PluginSettings();
  const promptAndRenameWithIntent = vi.fn(noopAsync);
  const renameWithIntent = vi.fn(() => Promise.resolve(true));
  const component = new RenameIntentHooksComponent({
    app,
    pluginSettingsComponent: strictProxy<PluginSettingsComponent>({ settings }),
    smartRenameComponent: strictProxy<SmartRenameComponent>({ promptAndRenameWithIntent, renameWithIntent })
  });
  component.load();
  // The layout-ready callback is deferred to a timer and then run as tracked async work.
  await sleep({ milliseconds: 0 });
  await waitForAllAsyncOperations();

  return {
    app,
    component,
    markdownFile: ensureNonNullable(app.vault.getFileByPath('Note.md')),
    originalPromptForFileRename,
    otherFile: ensureNonNullable(app.vault.getFileByPath('Picture.png')),
    promptAndRenameWithIntent,
    renameWithIntent,
    settings
  };
}

function createTitleEl(text: string): HTMLElement {
  return createDiv({ text });
}

beforeEach(() => {
  // Not on the mock: the hooks patch it, and a patch needs the member to exist.
  Object.assign(EditableFileView.prototype, { saveTitle: originalSaveTitle });
});

afterEach(() => {
  fixture.component.unload();
  Reflect.deleteProperty(EditableFileView.prototype, 'saveTitle');
  vi.clearAllMocks();
});

describe('RenameIntentHooksComponent', () => {
  describe('promptForFileRename', () => {
    it('should ask the rename intent for a markdown note', async () => {
      fixture = await createFixture();

      await fixture.app.fileManager.promptForFileRename(fixture.markdownFile);

      expect(fixture.promptAndRenameWithIntent).toHaveBeenCalledWith(fixture.markdownFile);
      expect(fixture.originalPromptForFileRename).not.toHaveBeenCalled();
    });

    it('should leave a non-markdown file to Obsidian', async () => {
      fixture = await createFixture();

      await fixture.app.fileManager.promptForFileRename(fixture.otherFile);

      expect(fixture.originalPromptForFileRename).toHaveBeenCalledWith(fixture.otherFile);
      expect(fixture.promptAndRenameWithIntent).not.toHaveBeenCalled();
    });

    it('should leave a markdown note to Obsidian when the setting is off', async () => {
      fixture = await createFixture();
      fixture.settings.shouldAskRenameIntent = false;

      await fixture.app.fileManager.promptForFileRename(fixture.markdownFile);

      expect(fixture.originalPromptForFileRename).toHaveBeenCalledWith(fixture.markdownFile);
    });
  });

  describe('saveTitle', () => {
    it('should rename with intent when the title of the note being renamed changed', async () => {
      fixture = await createFixture();
      const view = createEditableView(fixture.markdownFile, fixture.markdownFile);

      const isResult = await view.saveTitle(createTitleEl(' NewTitle '));

      expect(isResult).toBe(true);
      expect(fixture.renameWithIntent).toHaveBeenCalledWith({ file: fixture.markdownFile, typedTitle: 'NewTitle' });
      expect(view.fileBeingRenamed).toBeNull();
      expect(originalSaveTitle).not.toHaveBeenCalled();
    });

    it('should restore the title when the rename does not happen', async () => {
      fixture = await createFixture();
      fixture.renameWithIntent.mockResolvedValue(false);
      const view = createEditableView(fixture.markdownFile, fixture.markdownFile);
      const titleEl = createTitleEl('NewTitle');

      const isResult = await view.saveTitle(titleEl);

      expect(isResult).toBe(true);
      expect(titleEl.getText()).toBe('Note');
    });

    it.each([
      ['no rename is in progress', false, 'NewTitle'],
      ['the title is unchanged', true, 'Note'],
      ['the title is empty', true, '']
    ])('should leave it to Obsidian when %s', async (_description, isRenaming, text) => {
      fixture = await createFixture();
      const view = createEditableView(fixture.markdownFile, isRenaming ? fixture.markdownFile : null);
      const titleEl = createTitleEl(text);

      await view.saveTitle(titleEl);

      expect(originalSaveTitle).toHaveBeenCalledWith(titleEl);
      expect(fixture.renameWithIntent).not.toHaveBeenCalled();
    });

    it('should leave a view with no file to Obsidian', async () => {
      fixture = await createFixture();
      const view = createEditableView(null, null);

      await view.saveTitle(createTitleEl('NewTitle'));

      expect(originalSaveTitle).toHaveBeenCalled();
    });
  });

  describe('file explorer saveRename', () => {
    function createExplorerLeaf(view: FileExplorerViewStub): WorkspaceLeaf {
      return castTo<WorkspaceLeaf>({ view });
    }

    function startRename(view: FileExplorerViewStub, file: TFile, text: string): void {
      view.fileBeingRenamed = file;
      view.fileItems[file.path] = { innerEl: createDiv({ text }) };
    }

    it('should rename with intent when the explorer renames a markdown note', async () => {
      const view = new FileExplorerViewStub();
      fixture = await createFixture([castTo<WorkspaceLeaf>({ view: {} }), createExplorerLeaf(view)]);
      startRename(view, fixture.markdownFile, 'NewTitle');

      const isResult = await view.saveRename();

      expect(isResult).toBe(true);
      expect(view.exitRename).toHaveBeenCalled();
      expect(fixture.renameWithIntent).toHaveBeenCalledWith({ file: fixture.markdownFile, typedTitle: 'NewTitle' });
      expect(originalSaveRename).not.toHaveBeenCalled();
    });

    it('should patch the explorer once, when it appears after layout ready', async () => {
      const leaves: WorkspaceLeaf[] = [];
      fixture = await createFixture(leaves);
      const view = new FileExplorerViewStub();
      leaves.push(createExplorerLeaf(view));

      fixture.app.workspace.trigger('layout-change');
      fixture.app.workspace.trigger('layout-change');
      startRename(view, fixture.markdownFile, 'NewTitle');
      await view.saveRename();

      expect(fixture.renameWithIntent).toHaveBeenCalledOnce();
    });

    it.each([
      ['nothing is being renamed', null, 'NewTitle'],
      ['the name is unchanged', 'Note.md', 'Note'],
      ['the file is not markdown', 'Picture.png', 'Other']
    ])('should leave it to Obsidian when %s', async (_description, path, text) => {
      const view = new FileExplorerViewStub();
      fixture = await createFixture([createExplorerLeaf(view)]);
      const file = path === null ? null : ensureNonNullable(fixture.app.vault.getFileByPath(path));
      if (file) {
        startRename(view, file, text);
      }

      await view.saveRename();

      expect(originalSaveRename).toHaveBeenCalled();
      expect(fixture.renameWithIntent).not.toHaveBeenCalled();
    });

    it('should leave it to Obsidian when the tree item is missing', async () => {
      const view = new FileExplorerViewStub();
      fixture = await createFixture([createExplorerLeaf(view)]);
      view.fileBeingRenamed = fixture.markdownFile;

      await view.saveRename();

      expect(originalSaveRename).toHaveBeenCalled();
    });
  });
});
