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

import {
  ContextId,
  evalInObsidian,
  pollInObsidian
} from 'obsidian-integration-testing';
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
 * Under the transport's ~30s per-closure cap, not at it: each closure spends this budget on two waits at most.
 */
const WAIT_TIMEOUT_IN_MILLISECONDS = 4000;

/**
 * The Node-side budget for the rename to land, the backlink to be rewritten and the post-rename steps to run.
 *
 * That is the one step here doing real work, and on a loaded one-core Android emulator it overran the 4s
 * in-closure ceiling. It is polled from Node with {@link pollInObsidian}, one short read per eval, so this
 * budget is not bounded by the per-eval cap.
 */
const RENAME_POLL_TIMEOUT_IN_MILLISECONDS = 30_000;

/**
 * The Node-side budget for the backlink to resolve, and for the intent dialog to open once a rename is committed.
 *
 * Under bulk load on desktop the dialog took longer than the 4s in-closure ceiling, so both waits are polled from
 * Node with {@link pollInObsidian} instead.
 */
const DIALOG_POLL_TIMEOUT_IN_MILLISECONDS = 20_000;

/**
 * Above the Android project's 60s default, which the two {@link DIALOG_POLL_TIMEOUT_IN_MILLISECONDS} polls plus
 * {@link RENAME_POLL_TIMEOUT_IN_MILLISECONDS} plus the eval round trips of a starved emulator could reach.
 */
const RENAME_TEST_TIMEOUT_IN_MILLISECONDS = 90_000;

/**
 * How many Escape presses the cleanup spends closing a dialog a failed case left open.
 */
const MAX_MODAL_CLOSE_ATTEMPTS = 3;

interface IntentRenameResult {
  readonly hasReadableLayout: boolean;
  readonly renamedContent: string;
  readonly sourceContentAfter: string;
  readonly wasDialogShown: boolean;
}

describe('Rename intent dialog', () => {
  it('keeps long paths readable and all actions in one row in a narrow dialog', { timeout: RENAME_TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    const result = await runIntentRename({
      folder: `intent-layout-${'long-folder-name-'.repeat(8)}`,
      intent: 'RenameOnly',
      modalWidth: 288,
      surface: 'renameDialog'
    });

    expect(result.hasReadableLayout).toBe(true);
    expect(result.renamedContent).toBe(TARGET_CONTENT);
  });

  it('syncs title and H1 when the inline title is renamed with the default choice', { timeout: RENAME_TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    const result = await runIntentRename({ folder: 'intent-inline-sync', intent: 'SyncTitleAndHeading', surface: 'inlineTitle' });

    expect(result.wasDialogShown).toBe(true);
    expect(result.hasReadableLayout).toBe(true);
    expect(result.renamedContent).toContain(`title: ${NEW_TITLE}`);
    expect(result.renamedContent).toContain(`# ${NEW_TITLE}`);
    expect(result.renamedContent).not.toContain('aliases');
    expect(result.sourceContentAfter).toBe(`[[${NEW_TITLE}]]`);
  });

  it('stores the previous name when the rename dialog is used with that choice', { timeout: RENAME_TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    const result = await runIntentRename({ folder: 'intent-dialog-store', intent: 'StorePreviousName', surface: 'renameDialog' });

    expect(result.wasDialogShown).toBe(true);
    expect(result.renamedContent).toContain(`title: ${NEW_TITLE}`);
    expect(result.renamedContent).toContain(`# ${NEW_TITLE}`);
    expect(result.renamedContent).toContain(OLD_TITLE);
    expect(result.renamedContent).toContain('aliases');
    expect(result.sourceContentAfter).toBe(`[[${NEW_TITLE}|${OLD_TITLE}]]`);
  });

  it('syncs title and H1 when the file explorer renames the note', { timeout: RENAME_TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
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

  it('changes only the file name when rename only is chosen', { timeout: RENAME_TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
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

/**
 * What survives in the Obsidian process from the eval that starts a rename to the eval that picks its intent.
 */
interface SubmitIntentRenameContext {
  /**
   * The rename dialog's pending `promptForFileRename`, awaited once the intent is picked.
   */
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- The eval that starts the rename stores it here for a later eval.
  renamePromise?: Promise<void>;
}

interface SubmitIntentRenamePaths {
  readonly renamedTargetPath: string;
  readonly sourcePath: string;
  readonly targetPath: string;
  readonly vaultPath: string;
}

async function pickIntent(
  params: RunIntentRenameParams,
  notePaths: SubmitIntentRenamePaths,
  contextId: ContextId<SubmitIntentRenameContext>
): Promise<Pick<IntentRenameResult, 'hasReadableLayout' | 'wasDialogShown'>> {
  const { renamedTargetPath, targetPath, vaultPath } = notePaths;

  await pollInObsidian({
    contextId,
    input: {
      intent: params.intent,
      intentModalSelector: INTENT_MODAL_SELECTOR,
      newTitle: NEW_TITLE,
      surface: params.surface,
      targetPath,
      waitTimeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
    },
    poll({ intent, intentModalSelector }) {
      return document.querySelector(`${intentModalSelector} button[data-intent="${CSS.escape(intent)}"]`) !== null;
    },
    async start({
      app,
      context,
      lib: {
        clickElement,
        pressKey,
        waitUntil
      },
      newTitle,
      obsidianModule,
      surface,
      targetPath: targetNotePath,
      waitTimeoutInMilliseconds
    }) {
      const targetFile = app.vault.getFileByPath(targetNotePath);
      if (!targetFile) {
        throw new Error('The target note is missing');
      }

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
        const innerEl = fileExplorerView.fileItems[targetNotePath]?.innerEl;
        if (!innerEl) {
          throw new Error('No file explorer item');
        }

        // Replacing the text is not a gesture anything listens for; the Enter that commits it is, and is trusted.
        innerEl.setText(newTitle);
        await pressKey({ key: 'Enter' });
      } else {
        // `promptForFileRename` is what F2 opens when no title is shown, and what the pane and tab menus call.
        context.renamePromise = app.fileManager.promptForFileRename(targetFile);
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
    },
    timeoutInMilliseconds: DIALOG_POLL_TIMEOUT_IN_MILLISECONDS,
    timeoutMessage: 'rename intent dialog did not open',
    until: (isDialogOpen) => isDialogOpen,
    vaultPath
  });

  return await evalInObsidian({
    async callback({
      context,
      intent,
      intentModalSelector,
      lib: { clickElement },
      modalWidth,
      renamedTargetPath: renamedPath,
      targetPath: targetNotePath
    }) {
      const intentButtonEl = document.querySelector<HTMLElement>(`${intentModalSelector} button[data-intent="${CSS.escape(intent)}"]`);
      if (!intentButtonEl) {
        throw new Error('Intent button is missing');
      }

      const hasReadableLayout = checkDialogLayout();
      await clickElement({ element: intentButtonEl });
      await context.renamePromise;

      // The rename and its backlink rewrite are awaited from Node by `runIntentRename`, outside this eval's cap.
      return { hasReadableLayout, wasDialogShown: true };

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
        return paths[0]?.querySelector('code')?.textContent === targetNotePath
          && paths[2]?.querySelector('code')?.textContent === renamedPath
          && pathRects.every((rect, index) => index === 0 || rect.top >= (pathRects[index - 1]?.bottom ?? 0))
          && buttons.length === 3
          && buttonRects.every((rect) => rect.width > 0 && rect.top === firstButtonRect?.top)
          && [...paths, ...buttons, modalEl].every((el) => el.scrollWidth <= el.clientWidth + 1);
      }
    },
    contextId,
    input: {
      intent: params.intent,
      intentModalSelector: INTENT_MODAL_SELECTOR,
      modalWidth: params.modalWidth ?? null,
      renamedTargetPath,
      targetPath
    },
    vaultPath
  });
}

/**
 * Runs one rename through the intent dialog, then polls from Node for its outcome.
 *
 * Cleanup runs in a `finally`: a case that throws would otherwise leave its renamed `intent-beta` note in the
 * vault, after which `intent-beta` is no longer unique and every later case gets a path-qualified link.
 *
 * @param params - The case to run.
 * @returns What the dialog showed and what the two notes hold once the rename has landed.
 */
async function runIntentRename(params: RunIntentRenameParams): Promise<IntentRenameResult> {
  const vaultPath = getTemporaryVault().path;
  const renamedTargetPath = `${params.folder}/${NEW_TITLE}.md`;
  const sourcePath = `${params.folder}/intent-source.md`;
  const targetPath = `${params.folder}/${OLD_TITLE}.md`;

  try {
    const dialogResult = await submitIntentRename(params, { renamedTargetPath, sourcePath, targetPath, vaultPath });

    const outcome = await pollInObsidian({
      input: { renamedTargetPath, sourcePath },
      async poll({ app, renamedTargetPath: renamedPath, sourcePath: sourceNotePath }) {
        const renamedFile = app.vault.getFileByPath(renamedPath);
        const sourceFile = app.vault.getFileByPath(sourceNotePath);
        return {
          isRenamedTargetPresent: renamedFile !== null,
          renamedContent: renamedFile ? await app.vault.read(renamedFile) : '',
          sourceContentAfter: sourceFile ? await app.vault.read(sourceFile) : ''
        };
      },
      timeoutInMilliseconds: RENAME_POLL_TIMEOUT_IN_MILLISECONDS,
      timeoutMessage: 'the backlink was not rewritten, or the post-rename steps did not land',
      until: ({ isRenamedTargetPresent, renamedContent, sourceContentAfter }) =>
        isRenamedTargetPresent
        && sourceContentAfter.includes(NEW_TITLE)
        && (params.intent === 'RenameOnly' || renamedContent.includes(`# ${NEW_TITLE}`)),
      vaultPath
    });

    return {
      ...dialogResult,
      renamedContent: outcome.renamedContent,
      sourceContentAfter: outcome.sourceContentAfter
    };
  } finally {
    await evalInObsidian({
      async callback({ app, folder, lib: { pressKey }, maxModalCloseAttempts, obsidianModule, paths }) {
        // A case that failed with its dialog still open would leave it over the next case's view.
        for (let attempt = 0; attempt < maxModalCloseAttempts && document.querySelector('.modal-container'); attempt++) {
          await pressKey({ key: 'Escape' });
        }

        for (const leaf of app.workspace.getLeavesOfType('markdown')) {
          if (leaf.view instanceof obsidianModule.MarkdownView && leaf.view.file?.path.startsWith(`${folder}/`)) {
            leaf.detach();
          }
        }

        for (const path of paths) {
          const existing = app.vault.getAbstractFileByPath(path);
          if (existing) {
            await app.fileManager.trashFile(existing);
          }
        }
      },
      input: { folder: params.folder, maxModalCloseAttempts: MAX_MODAL_CLOSE_ATTEMPTS, paths: [sourcePath, targetPath, renamedTargetPath] },
      vaultPath
    });
  }
}

/**
 * Drives one rename up to the intent being picked, in short eval calls with the real waits polled from Node.
 *
 * The backlink resolving and the intent dialog opening are the two waits that do real work, and under bulk load
 * the dialog wait overran its 4s in-closure ceiling on desktop. Each is polled with {@link pollInObsidian}, one
 * short read per eval, so neither is bounded by the transport's per-eval cap.
 *
 * @param params - The case to run.
 * @param notePaths - The notes the case works with.
 * @returns Whether the dialog was shown and whether its layout is readable.
 */
async function submitIntentRename(
  params: RunIntentRenameParams,
  notePaths: SubmitIntentRenamePaths
): Promise<Pick<IntentRenameResult, 'hasReadableLayout' | 'wasDialogShown'>> {
  const { renamedTargetPath, sourcePath, targetPath, vaultPath } = notePaths;

  await evalInObsidian({
    async callback({ app, lib: { createNote }, renamedTargetPath: renamedPath, sourceContent, sourcePath: sourceNotePath, targetContent, targetPath: targetNotePath }) {
      // A leftover from an earlier run of the same case; `runIntentRename` trashes these again in its `finally`.
      for (const path of [sourceNotePath, targetNotePath, renamedPath]) {
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing) {
          await app.fileManager.trashFile(existing);
        }
      }

      const folderPath = targetNotePath.slice(0, targetNotePath.lastIndexOf('/'));
      if (!app.vault.getFolderByPath(folderPath)) {
        await app.vault.createFolder(folderPath);
      }

      const targetFile = await createNote({ content: targetContent, path: targetNotePath });
      await createNote({ content: sourceContent, path: sourceNotePath });

      const leaf = app.workspace.getLeaf(true);
      await leaf.openFile(targetFile, { active: true, state: { mode: 'source' } });
      // Activated explicitly: after the file explorer case, the explorer holds the focus and would stay active.
      app.workspace.setActiveLeaf(leaf, { focus: true });
    },
    input: { renamedTargetPath, sourceContent: SOURCE_CONTENT, sourcePath, targetContent: TARGET_CONTENT, targetPath },
    vaultPath
  });

  await pollInObsidian({
    input: { sourcePath, targetPath },
    poll({ app, obsidianModule, sourcePath: sourceNotePath, targetPath: targetNotePath }) {
      return app.workspace.getActiveViewOfType(obsidianModule.MarkdownView)?.file?.path === targetNotePath
        && app.metadataCache.getFirstLinkpathDest(targetNotePath.replace('.md', ''), sourceNotePath) !== null;
    },
    timeoutInMilliseconds: DIALOG_POLL_TIMEOUT_IN_MILLISECONDS,
    timeoutMessage: 'backlink did not resolve',
    until: (isResolved) => isResolved,
    vaultPath
  });

  const contextId = new ContextId<SubmitIntentRenameContext>();
  try {
    return await pickIntent(params, notePaths, contextId);
  } finally {
    await contextId.dispose(vaultPath);
  }
}
