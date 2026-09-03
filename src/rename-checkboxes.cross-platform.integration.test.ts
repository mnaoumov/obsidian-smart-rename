/**
 * @file
 *
 * Exercises the rename prompt's per-rename checkboxes end-to-end against a real Obsidian.
 *
 * The five post-rename steps are pre-ticked from their settings, and a checkbox change applies to that
 * one rename only. This drives the real modal: it unticks **Add old title as alias** with a genuine
 * pointer click, confirms the rename, and asserts that the renamed note carries no `aliases` while the
 * backlink — whose own checkbox stayed ticked — still displays the old title.
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

const ALIAS_CHECKBOX_PURPOSE = 'Add old title as alias';
const COMMAND_ID = 'smart-rename:invoke';
const OLD_TITLE = 'checkbox-alias-alpha';
const TARGET_PATH = `${OLD_TITLE}.md`;
const NEW_TITLE = 'checkbox-alias-beta';
const RENAMED_TARGET_PATH = `${NEW_TITLE}.md`;
const TARGET_CONTENT = '# Alpha';
const SOURCE_PATH = 'checkbox-alias-source.md';
const SOURCE_CONTENT = `[[${OLD_TITLE}]]`;
const WAIT_TIMEOUT_IN_MILLISECONDS = 20_000;

describe('Rename prompt checkboxes', () => {
  it('skips the alias step for the one rename whose alias checkbox is unticked', async () => {
    const result = await evalInObsidian({
      async callback({
        aliasCheckboxPurpose,
        app,
        commandId,
        lib: {
          clickElement,
          createNote,
          waitUntil
        },
        newTitle,
        obsidianModule,
        renamedTargetPath,
        sourceContent,
        sourcePath,
        targetContent,
        targetPath,
        waitTimeoutInMilliseconds
      }) {
        const failure = {
          didCommandRun: false,
          renamedContent: '',
          sourceContentAfter: '',
          wasAliasCheckboxTicked: false,
          wasRenamed: false
        };

        for (const path of [sourcePath, targetPath, renamedTargetPath]) {
          const existing = app.vault.getAbstractFileByPath(path);
          if (existing) {
            await app.fileManager.trashFile(existing);
          }
        }

        const targetFile = await createNote({ content: targetContent, path: targetPath });
        const sourceFile = await createNote({ content: sourceContent, path: sourcePath });

        const leaf = app.workspace.getLeaf(true);
        await leaf.openFile(targetFile, { state: { mode: 'source' } });

        await waitUntil({
          message: 'target note did not become the active markdown view',
          predicate: () => app.workspace.getActiveViewOfType(obsidianModule.MarkdownView)?.file?.path === targetPath,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });

        await waitUntil({
          message: 'backlink did not resolve',
          predicate: () => app.metadataCache.getFirstLinkpathDest(targetPath.replace('.md', ''), sourcePath) !== null,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });

        const didCommandRun = app.commands.executeCommandById(commandId);
        if (!didCommandRun) {
          return failure;
        }

        await waitUntil({
          message: 'rename prompt did not open',
          predicate: () => document.querySelector('.prompt-modal input.text-box') !== null,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });

        const instructionEls = [...document.querySelectorAll<HTMLElement>('.prompt-modal .prompt-instruction')];
        const aliasInstructionEl = instructionEls.find((instructionEl) => instructionEl.textContent.includes(aliasCheckboxPurpose));
        const aliasCheckboxEl = aliasInstructionEl?.querySelector<HTMLInputElement>('input[type="checkbox"]');
        const inputEl = document.querySelector<HTMLInputElement>('.prompt-modal input.text-box');
        const okButtonEl = document.querySelector<HTMLElement>('.prompt-modal .ok-button');
        if (!aliasCheckboxEl || !inputEl || !okButtonEl) {
          return {
            ...failure,
            didCommandRun: true
          };
        }

        // Pre-ticked from `shouldAddOldTitleAsAlias`, which defaults to on — the state the click flips.
        const wasAliasCheckboxTicked = aliasCheckboxEl.checked;

        // A real pointer click, not a dispatched event: ticking a checkbox is a user gesture (G107).
        await clickElement({ element: aliasCheckboxEl });

        // The injected click is delivered asynchronously, so the confirm below must not race it.
        await waitUntil({
          message: 'alias checkbox did not untick',
          predicate: () => !aliasCheckboxEl.checked,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });

        inputEl.value = newTitle;
        // A notification event, not a simulated user gesture — `AbstractTextComponent` listens for
        // `input` to publish the new value, and nothing on that path gates on `isTrusted` (G107).
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        okButtonEl.click();

        await waitUntil({
          message: 'note was not renamed',
          predicate: () => app.vault.getFileByPath(renamedTargetPath) !== null,
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });

        await waitUntil({
          message: 'backlink was not rewritten to the new title',
          predicate: async () => {
            const content = await app.vault.read(sourceFile);
            return content.includes(newTitle);
          },
          timeoutInMilliseconds: waitTimeoutInMilliseconds
        });

        const renamedFile = app.vault.getFileByPath(renamedTargetPath);
        const renamedContent = renamedFile ? await app.vault.read(renamedFile) : '';
        const sourceContentAfter = await app.vault.read(sourceFile);

        for (const path of [sourcePath, targetPath, renamedTargetPath]) {
          const existing = app.vault.getAbstractFileByPath(path);
          if (existing) {
            await app.fileManager.trashFile(existing);
          }
        }

        return {
          didCommandRun: true,
          renamedContent,
          sourceContentAfter,
          wasAliasCheckboxTicked,
          wasRenamed: true
        };
      },
      input: {
        aliasCheckboxPurpose: ALIAS_CHECKBOX_PURPOSE,
        commandId: COMMAND_ID,
        newTitle: NEW_TITLE,
        renamedTargetPath: RENAMED_TARGET_PATH,
        sourceContent: SOURCE_CONTENT,
        sourcePath: SOURCE_PATH,
        targetContent: TARGET_CONTENT,
        targetPath: TARGET_PATH,
        waitTimeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
      },
      vaultPath: getTemporaryVault().path
    });

    expect(result.didCommandRun).toBe(true);
    expect(result.wasRenamed).toBe(true);

    // The strip seeded itself from the settings, where the alias step is on by default.
    expect(result.wasAliasCheckboxTicked).toBe(true);

    // Unticked for this rename, so no alias was written — the step the checkbox controls, and only it.
    expect(result.renamedContent).not.toContain('aliases');
    expect(result.renamedContent).not.toContain(OLD_TITLE);

    // The display-text checkbox stayed ticked, so the backlink still reads as the old title.
    expect(result.sourceContentAfter).toContain(NEW_TITLE);
    expect(result.sourceContentAfter).toContain(OLD_TITLE);
  });
});
