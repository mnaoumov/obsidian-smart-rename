/**
 * @file
 *
 * Exercises `Smart Rename: Invoke on link under cursor` end-to-end against a real Obsidian.
 *
 * It creates a target note and a source note linking to it, opens the SOURCE note, puts the cursor on the
 * link, runs the command, drives the real prompt modal, and asserts that the TARGET was renamed while the
 * source note kept its own name — the whole point of the command — and that the link in the source note
 * still displays the old title.
 *
 * Named `*.cross-platform.integration.test.ts` (per G47) because `manifest.json` has
 * `isDesktopOnly: false`, so the desktop AND android projects both collect it.
 */

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

const COMMAND_ID = 'smart-rename:invoke-on-link';
const SOURCE_PATH = 'invoke-on-link-source.md';
const TARGET_LINK_TEXT = 'invoke-on-link-alpha';
const TARGET_PATH = `${TARGET_LINK_TEXT}.md`;
const NEW_TARGET_TITLE = 'invoke-on-link-beta';
const RENAMED_TARGET_PATH = `${NEW_TARGET_TITLE}.md`;
const TARGET_CONTENT = '# Alpha';
const INITIAL_SOURCE_CONTENT = `[[${TARGET_LINK_TEXT}]]`;

/**
 * Inside `[[…]]`, so the parsed link's offsets contain it.
 */
const CURSOR_CH = 3;
const WAIT_TIMEOUT_IN_MILLISECONDS = 20_000;

describe('Invoke on link under cursor', () => {
  it('renames the link target rather than the active note, and keeps the old title as display text', async () => {
    const result = await evalInObsidian({
      async callback({
        app,
        commandId,
        cursorCh,
        initialSourceContent,
        lib: { createNote, waitUntil },
        newTargetTitle,
        obsidianModule,
        renamedTargetPath,
        sourcePath,
        targetContent,
        targetLinkText,
        targetPath,
        waitTimeoutInMilliseconds
      }) {
        for (const path of [sourcePath, targetPath, renamedTargetPath]) {
          const existing = app.vault.getAbstractFileByPath(path);
          if (existing) {
            await app.fileManager.trashFile(existing);
          }
        }

        await createNote({ content: targetContent, path: targetPath });
        const sourceFile = await createNote({ content: initialSourceContent, path: sourcePath });

        const leaf = app.workspace.getLeaf(true);
        await leaf.openFile(sourceFile, { state: { mode: 'source' } });

        await waitUntil({
          message: 'source note did not become the active markdown view',
          predicate: () => app.workspace.getActiveViewOfType(obsidianModule.MarkdownView)?.file?.path === sourcePath,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });

        await waitUntil({
          message: 'link target did not resolve',
          predicate: () => app.metadataCache.getFirstLinkpathDest(targetLinkText, sourcePath) !== null,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });

        const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
        if (!view) {
          return {
            didCommandRun: false,
            didModalOpen: false,
            sourceContent: '',
            wasSourceRenamed: false,
            wasTargetRenamed: false
          };
        }

        view.editor.focus();
        view.editor.setCursor({ ch: cursorCh, line: 0 });

        const didCommandRun = app.commands.executeCommandById(commandId);
        if (!didCommandRun) {
          return {
            didCommandRun: false,
            didModalOpen: false,
            sourceContent: '',
            wasSourceRenamed: false,
            wasTargetRenamed: false
          };
        }

        await waitUntil({
          message: 'rename prompt did not open',
          predicate: () => document.querySelector('.prompt-modal input.text-box') !== null,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });

        const inputEl = document.querySelector<HTMLInputElement>('.prompt-modal input.text-box');
        const okButtonEl = document.querySelector<HTMLElement>('.prompt-modal .ok-button');
        if (!inputEl || !okButtonEl) {
          return {
            didCommandRun: true,
            didModalOpen: false,
            sourceContent: '',
            wasSourceRenamed: false,
            wasTargetRenamed: false
          };
        }

        inputEl.value = newTargetTitle;
        // A notification event, not a simulated user gesture — `AbstractTextComponent` listens for
        // `input` to publish the new value, and nothing on that path gates on `isTrusted` (G107).
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        okButtonEl.click();

        await waitUntil({
          message: 'link target was not renamed',
          predicate: () => app.vault.getFileByPath(renamedTargetPath) !== null,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });

        await waitUntil({
          message: 'source link was not rewritten to the new target',
          predicate: async () => {
            const content = await app.vault.read(sourceFile);
            return content.includes(newTargetTitle);
          },
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });

        const sourceContent = await app.vault.read(sourceFile);
        const wasSourceRenamed = app.vault.getFileByPath(sourcePath) === null;
        const wasTargetRenamed = app.vault.getFileByPath(targetPath) === null;

        for (const path of [sourcePath, targetPath, renamedTargetPath]) {
          const existing = app.vault.getAbstractFileByPath(path);
          if (existing) {
            await app.fileManager.trashFile(existing);
          }
        }

        return {
          didCommandRun: true,
          didModalOpen: true,
          sourceContent,
          wasSourceRenamed,
          wasTargetRenamed
        };
      },
      input: {
        commandId: COMMAND_ID,
        cursorCh: CURSOR_CH,
        initialSourceContent: INITIAL_SOURCE_CONTENT,
        newTargetTitle: NEW_TARGET_TITLE,
        renamedTargetPath: RENAMED_TARGET_PATH,
        sourcePath: SOURCE_PATH,
        targetContent: TARGET_CONTENT,
        targetLinkText: TARGET_LINK_TEXT,
        targetPath: TARGET_PATH,
        waitTimeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
      },
      vaultPath: getTemporaryVault().path
    });

    expect(result.didCommandRun).toBe(true);
    expect(result.didModalOpen).toBe(true);

    // The command renamed the LINK'S TARGET, and left the note the cursor was in alone.
    expect(result.wasTargetRenamed).toBe(true);
    expect(result.wasSourceRenamed).toBe(false);

    // The rewritten link points at the new name but still reads as the old one — the plugin's whole
    // Premise, now reachable without opening the linked note first.
    expect(result.sourceContent).toContain(NEW_TARGET_TITLE);
    expect(result.sourceContent).toContain(TARGET_LINK_TEXT);
  });
});
