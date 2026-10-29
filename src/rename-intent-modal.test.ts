import type { App as AppOriginal } from 'obsidian';

import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import {
  App,
  Modal
} from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type {
  RenameIntentChoice,
  SelectRenameIntentParams
} from './rename-intent-modal.ts';

import { selectRenameIntent } from './rename-intent-modal.ts';
import { RenameIntent } from './rename-intent.ts';

interface OpenedDialog {
  readonly choicePromise: Promise<null | RenameIntentChoice>;
  readonly modal: Modal;
}

function createApp(): AppOriginal {
  return App.createConfigured__().asOriginalType__();
}

function findButton(modal: Modal, intent: RenameIntent): HTMLButtonElement {
  return ensureNonNullable(modal.contentEl.querySelector<HTMLButtonElement>(`button[data-intent="${CSS.escape(intent)}"]`));
}

function findCheckbox(modal: Modal): HTMLInputElement {
  return ensureNonNullable(modal.modalEl.querySelector<HTMLInputElement>('input[type="checkbox"]'));
}

/**
 * Opens the dialog and hands back the modal it opened.
 *
 * The modal is attached to the document because jsdom fires `change` on a checkbox `click()` only for a connected
 * element, and focus moves only to a connected one.
 *
 * @param params - The dialog parameters to override.
 * @returns The modal and the pending choice.
 */
function openDialog(params?: Partial<SelectRenameIntentParams>): OpenedDialog {
  const constructorSpy = vi.spyOn(Modal.prototype, 'constructor__');
  const choicePromise = selectRenameIntent({
    app: createApp(),
    newTitle: 'NewTitle',
    oldTitle: 'OldTitle',
    preselectedIntent: RenameIntent.SyncTitleAndHeading,
    shouldSaveLastUsedChoice: false,
    ...params
  });
  const modal = ensureNonNullable(constructorSpy.mock.contexts[0]) as Modal;
  document.body.append(modal.containerEl);
  return { choicePromise, modal };
}

afterEach(() => {
  document.body.empty();
  vi.restoreAllMocks();
});

describe('selectRenameIntent', () => {
  it('should show the old and new title and one button per intent', () => {
    const { modal } = openDialog();

    expect(modal.containerEl.hasClass('smart-rename-intent-modal')).toBe(true);
    expect(modal.titleEl.getText()).toBe('Rename note');
    expect(modal.contentEl.getText()).toContain('OldTitle → NewTitle');
    expect(findButton(modal, RenameIntent.SyncTitleAndHeading).getText()).toBe('Rename and sync to title/H1');
    expect(findButton(modal, RenameIntent.StorePreviousName).getText()).toBe('Rename and store previous name/title/H1');
    expect(findButton(modal, RenameIntent.RenameOnly).getText()).toBe('Rename only');
  });

  it('should preselect and focus the given intent', () => {
    // Spied, because the modal focuses its button while opening, before the test can attach it to the document.
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    const { modal } = openDialog({ preselectedIntent: RenameIntent.RenameOnly });

    const renameOnlyButton = findButton(modal, RenameIntent.RenameOnly);
    expect(renameOnlyButton.hasClass('mod-cta')).toBe(true);
    expect(findButton(modal, RenameIntent.SyncTitleAndHeading).hasClass('mod-cta')).toBe(false);
    expect(focusSpy.mock.contexts).toContain(renameOnlyButton);
  });

  it('should resolve with the clicked intent and the checkbox state', async () => {
    const { choicePromise, modal } = openDialog({ shouldSaveLastUsedChoice: true });

    expect(findCheckbox(modal).checked).toBe(true);
    findButton(modal, RenameIntent.StorePreviousName).click();

    await expect(choicePromise).resolves.toStrictEqual({ intent: RenameIntent.StorePreviousName, shouldSaveLastUsedChoice: true });
  });

  it('should report a checkbox the user ticked', async () => {
    const { choicePromise, modal } = openDialog();

    findCheckbox(modal).click();
    findButton(modal, RenameIntent.SyncTitleAndHeading).click();

    await expect(choicePromise).resolves.toStrictEqual({ intent: RenameIntent.SyncTitleAndHeading, shouldSaveLastUsedChoice: true });
  });

  it('should resolve with null when dismissed', async () => {
    const { choicePromise, modal } = openDialog();

    modal.close();

    await expect(choicePromise).resolves.toBeNull();
  });
});
