/**
 * @file
 *
 * Exercises the rename intent dialog end-to-end against a real Obsidian: a rename made through Obsidian's own
 * surfaces asks what it is meant to do, and the choice decides what happens to `title:`, the first H1, the aliases
 * and the backlinks.
 *
 * Named `*.cross-platform.integration.test.ts` because `manifest.json` has
 * `isDesktopOnly: false`, so the desktop AND android projects both collect it.
 */

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

const INTENT_MODAL_SELECTOR = '.smart-rename-intent-modal';
const OLD_TITLE = 'intent-alpha';
const NEW_TITLE = 'intent-beta';
const TARGET_CONTENT = `---\ntitle: ${OLD_TITLE}\n---\n# ${OLD_TITLE}\n`;
const SOURCE_CONTENT = `[[${OLD_TITLE}]]`;
/**
 * Under the transport's ~30s per-closure cap, not at it: each closure spends this budget on six waits at most.
 */
const WAIT_TIMEOUT_IN_MILLISECONDS = 4000;

interface IntentRenameResult {
  readonly hasReadableLayout: boolean;
  readonly renamedContent: string;
  readonly sourceContentAfter: string;
  readonly wasDialogShown: boolean;
}

describe('Rename intent dialog', () => {
  it('keeps long paths readable and all actions in one row in a narrow dialog', async () => {
    const result = await runIntentRename({
      folder: `intent-layout-${'long-folder-name-'.repeat(8)}`,
      intent: 'RenameOnly',
      modalWidth: 288,
      surface: 'renameDialog'
    });

    expect(result.hasReadableLayout).toBe(true);
    expect(result.renamedContent).toBe(TARGET_CONTENT);
  });

  it('syncs title and H1 when the inline title is renamed with the default choice', async () => {
    const result = await runIntentRename({ folder: 'intent-inline-sync', intent: 'SyncTitleAndHeading', surface: 'inlineTitle' });

    expect(result.wasDialogShown).toBe(true);
    expect(result.hasReadableLayout).toBe(true);
    expect(result.renamedContent).toContain(`title: ${NEW_TITLE}`);
    expect(result.renamedContent).toContain(`# ${NEW_TITLE}`);
    expect(result.renamedContent).not.toContain('aliases');
    expect(result.sourceContentAfter).toBe(`[[${NEW_TITLE}]]`);
  });

  it('stores the previous name when the rename dialog is used with that choice', async () => {
    const result = await runIntentRename({ folder: 'intent-dialog-store', intent: 'StorePreviousName', surface: 'renameDialog' });

    expect(result.wasDialogShown).toBe(true);
    expect(result.renamedContent).toContain(`title: ${NEW_TITLE}`);
    expect(result.renamedContent).toContain(`# ${NEW_TITLE}`);
    expect(result.renamedContent).toContain(OLD_TITLE);
    expect(result.renamedContent).toContain('aliases');
    expect(result.sourceContentAfter).toBe(`[[${NEW_TITLE}|${OLD_TITLE}]]`);
  });

  it('syncs title and H1 when the file explorer renames the note', async () => {
    const result = await runIntentRename({ folder: 'intent-explorer-sync', intent: 'SyncTitleAndHeading', surface: 'fileExplorer' });

    expect(result.wasDialogShown).toBe(true);
    expect(result.renamedContent).toContain(`title: ${NEW_TITLE}`);
    expect(result.renamedContent).toContain(`# ${NEW_TITLE}`);
    expect(result.sourceContentAfter).toBe(`[[${NEW_TITLE}]]`);
  });

  it('names a just-created Untitled note without asking, and asks for its next rename', async () => {
    const result = await evalInObsidian({
      async callback({ app, intentModalSelector, lib: { clickElement, pressKey, waitUntil }, namedPath, namedTitle, obsidianModule, waitTimeoutInMilliseconds }) {
        const folder = app.vault.getFolderByPath('intent-new-note') ?? await app.vault.createFolder('intent-new-note');
        // What the New note command calls: no file name, so Obsidian picks the localized Untitled one.
        const file = await app.fileManager.createNewMarkdownFile(folder, '', '');
        const createdPath = file.path;

        const leaf = app.workspace.getLeaf(true);
        await leaf.openFile(file, { active: true, state: { mode: 'source' } });
        app.workspace.setActiveLeaf(leaf, { focus: true });
        const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
        if (view?.file !== file) {
          throw new Error('The new note is not the active markdown view');
        }

        // Naming the note through its inline title, as a user does right after New note.
        await clickElement({ element: view.inlineTitleEl });
        await waitUntil({
          message: 'inline title did not take focus',
          predicate: () => view.inlineTitleEl.ownerDocument.activeElement === view.inlineTitleEl,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });
        view.inlineTitleEl.setText(namedTitle);
        await pressKey({ key: 'Enter' });
        await waitUntil({
          message: 'the new note was not renamed',
          predicate: () => app.vault.getFileByPath(namedPath) !== null,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });
        const wasPromptShownForNewNote = document.querySelector(intentModalSelector) !== null;

        // The same note again: no longer just created, so the plugin's own rename prompt opens.
        const secondRename = app.fileManager.promptForFileRename(file);
        await waitUntil({
          message: 'the Smart Rename prompt did not open for the second rename',
          predicate: () => document.querySelector('.prompt-modal input.text-box') !== null,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });
        const wasPromptShownForSecondRename = true;
        await pressKey({ key: 'Escape' });
        await secondRename;

        leaf.detach();
        await app.fileManager.trashFile(file);
        return { createdPath, wasPromptShownForNewNote, wasPromptShownForSecondRename };
      },
      input: {
        intentModalSelector: INTENT_MODAL_SELECTOR,
        namedPath: 'intent-new-note/intent-named.md',
        namedTitle: 'intent-named',
        waitTimeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
      },
      vaultPath: getTemporaryVault().path
    });

    expect(result.createdPath).toMatch(/^intent-new-note\/.+\.md$/);
    expect(result.wasPromptShownForNewNote).toBe(false);
    expect(result.wasPromptShownForSecondRename).toBe(true);
  });

  it('changes only the file name when rename only is chosen', async () => {
    const result = await runIntentRename({ folder: 'intent-inline-only', intent: 'RenameOnly', surface: 'inlineTitle' });

    expect(result.wasDialogShown).toBe(true);
    expect(result.renamedContent).toBe(TARGET_CONTENT);
    expect(result.sourceContentAfter).toBe(`[[${NEW_TITLE}]]`);
  });
});

interface RunIntentRenameParams {
  /**
   * The folder each case works in, so no case recreates a note another case has just trashed.
   */
  readonly folder: string;
  readonly intent: string;
  readonly modalWidth?: number;
  readonly surface: 'fileExplorer' | 'inlineTitle' | 'renameDialog';
}

async function runIntentRename(params: RunIntentRenameParams): Promise<IntentRenameResult> {
  return await evalInObsidian({
    async callback({
      app,
      intent,
      intentModalSelector,
      lib: {
        clickElement,
        createNote,
        pressKey,
        waitUntil
      },
      modalWidth,
      newTitle,
      obsidianModule,
      renamedTargetPath,
      sourceContent,
      sourcePath,
      surface,
      targetContent,
      targetPath,
      waitTimeoutInMilliseconds
    }) {
      async function cleanUp(): Promise<void> {
        for (const path of [sourcePath, targetPath, renamedTargetPath]) {
          const existing = app.vault.getAbstractFileByPath(path);
          if (existing) {
            await app.fileManager.trashFile(existing);
          }
        }
      }

      await cleanUp();
      const folderPath = targetPath.slice(0, targetPath.lastIndexOf('/'));
      if (!app.vault.getFolderByPath(folderPath)) {
        await app.vault.createFolder(folderPath);
      }

      const targetFile = await createNote({ content: targetContent, path: targetPath });
      const sourceFile = await createNote({ content: sourceContent, path: sourcePath });

      const leaf = app.workspace.getLeaf(true);
      await leaf.openFile(targetFile, { active: true, state: { mode: 'source' } });
      // Activated explicitly: after the file explorer case, the explorer holds the focus and would stay active.
      app.workspace.setActiveLeaf(leaf, { focus: true });

      await waitUntil({
        message: 'backlink did not resolve',
        predicate: () =>
          app.workspace.getActiveViewOfType(obsidianModule.MarkdownView)?.file?.path === targetPath
          && app.metadataCache.getFirstLinkpathDest(targetPath.replace('.md', ''), sourcePath) !== null,
        timeoutInMilliseconds: waitTimeoutInMilliseconds
      });

      let renamePromise: null | Promise<void> = null;
      if (surface === 'inlineTitle') {
        const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
        if (!view) {
          throw new Error('No active markdown view');
        }

        // A real pointer click focuses the title the way a user starts a rename there.
        await clickElement({ element: view.inlineTitleEl });
        await waitUntil({
          message: 'inline title did not take focus',
          predicate: () => view.inlineTitleEl.ownerDocument.activeElement === view.inlineTitleEl,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });
        // Replacing the text is not a gesture anything listens for; the Enter that commits it is, and is trusted.
        view.inlineTitleEl.setText(newTitle);
        await pressKey({ key: 'Enter' });
      } else if (surface === 'fileExplorer') {
        const fileExplorerLeaf = app.workspace.getLeavesOfType('file-explorer')[0];
        await fileExplorerLeaf?.loadIfDeferred();
        const fileExplorerView = fileExplorerLeaf?.view;
        if (!fileExplorerView || !('fileItems' in fileExplorerView)) {
          throw new Error('No file explorer view');
        }

        // What the explorer's own Rename menu item calls, so the tree item becomes editable as for a user.
        await fileExplorerView.startRenameFile(targetFile);
        const innerEl = fileExplorerView.fileItems[targetPath]?.innerEl;
        if (!innerEl) {
          throw new Error('No file explorer item');
        }

        // Replacing the text is not a gesture anything listens for; the Enter that commits it is, and is trusted.
        innerEl.setText(newTitle);
        await pressKey({ key: 'Enter' });
      } else {
        // `promptForFileRename` is what F2 opens when no title is shown, and what the pane and tab menus call.
        renamePromise = app.fileManager.promptForFileRename(targetFile);
        await waitUntil({
          message: 'rename prompt did not open',
          predicate: () => document.querySelector('.prompt-modal input.text-box') !== null,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });
        const inputEl = document.querySelector<HTMLInputElement>('.prompt-modal input.text-box');
        const okButtonEl = document.querySelector<HTMLElement>('.prompt-modal .ok-button');
        if (!inputEl || !okButtonEl) {
          throw new Error('Rename prompt controls are missing');
        }

        inputEl.value = newTitle;
        // A notification event, not a simulated user gesture — `AbstractTextComponent` listens for
        // `input` to publish the new value, and nothing on that path gates on `isTrusted`.
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        await clickElement({ element: okButtonEl });
      }

      function findIntentButtonEl(): HTMLElement | null {
        return document.querySelector<HTMLElement>(`${intentModalSelector} button[data-intent="${CSS.escape(intent)}"]`);
      }

      await waitUntil({
        message: 'rename intent dialog did not open',
        predicate: () => findIntentButtonEl() !== null,
        timeoutInMilliseconds: waitTimeoutInMilliseconds
      });
      const wasDialogShown = true;
      const intentButtonEl = findIntentButtonEl();
      if (!intentButtonEl) {
        throw new Error('Intent button is missing');
      }

      const hasReadableLayout = checkDialogLayout();
      await clickElement({ element: intentButtonEl });
      await renamePromise;

      await waitUntil({
        message: 'backlink was not rewritten',
        predicate: async () => {
          const sourceContentNow = await app.vault.read(sourceFile);
          return app.vault.getFileByPath(renamedTargetPath) !== null && sourceContentNow.includes(newTitle);
        },
        timeoutInMilliseconds: waitTimeoutInMilliseconds
      });

      const shouldExpectFrontmatterChange = intent !== 'RenameOnly';
      await waitUntil({
        message: 'post-rename steps did not land',
        predicate: async () => {
          const renamedFile = app.vault.getFileByPath(renamedTargetPath);
          if (!shouldExpectFrontmatterChange) {
            return true;
          }

          const renamedContentNow = renamedFile ? await app.vault.read(renamedFile) : '';
          return renamedContentNow.includes(`# ${newTitle}`);
        },
        timeoutInMilliseconds: waitTimeoutInMilliseconds
      });

      const renamedFile = app.vault.getFileByPath(renamedTargetPath);
      const renamedContent = renamedFile ? await app.vault.read(renamedFile) : '';
      const sourceContentAfter = await app.vault.read(sourceFile);
      leaf.detach();
      await cleanUp();

      return { hasReadableLayout, renamedContent, sourceContentAfter, wasDialogShown };

      function checkDialogLayout(): boolean {
        const modalEl = document.querySelector<HTMLElement>(`${intentModalSelector} .modal`);
        if (!modalEl) {
          throw new Error('Intent modal is missing');
        }

        if (modalWidth) {
          modalEl.style.width = `${String(modalWidth)}px`;
        }

        const paths = [...modalEl.querySelectorAll<HTMLElement>(':scope .smart-rename-intent-paths > *')];
        const pathRects = paths.map((el) => el.getBoundingClientRect());
        const buttons = [...modalEl.querySelectorAll<HTMLElement>('button[data-intent]')];
        const buttonRects = buttons.map((el) => el.getBoundingClientRect());
        const firstButtonRect = buttonRects[0];
        return paths[0]?.querySelector('code')?.textContent === targetPath
          && paths[2]?.querySelector('code')?.textContent === renamedTargetPath
          && pathRects.every((rect, index) => index === 0 || rect.top >= (pathRects[index - 1]?.bottom ?? 0))
          && buttons.length === 3
          && buttonRects.every((rect) => rect.width > 0 && rect.top === firstButtonRect?.top)
          && [...paths, ...buttons, modalEl].every((el) => el.scrollWidth <= el.clientWidth + 1);
      }
    },
    input: {
      intent: params.intent,
      intentModalSelector: INTENT_MODAL_SELECTOR,
      modalWidth: params.modalWidth ?? null,
      newTitle: NEW_TITLE,
      renamedTargetPath: `${params.folder}/${NEW_TITLE}.md`,
      sourceContent: SOURCE_CONTENT,
      sourcePath: `${params.folder}/intent-source.md`,
      surface: params.surface,
      targetContent: TARGET_CONTENT,
      targetPath: `${params.folder}/${OLD_TITLE}.md`,
      waitTimeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
    },
    vaultPath: getTemporaryVault().path
  });
}
