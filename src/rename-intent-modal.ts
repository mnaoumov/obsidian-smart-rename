import type { ModalBaseConstructorParams } from '@mnaoumov/obsidian-lib/modals/modal';
import type { App } from 'obsidian';

import {
  ModalBase,
  showModal
} from '@mnaoumov/obsidian-lib/modals/modal';
import { ModalCommandBuilder } from '@mnaoumov/obsidian-lib/modals/modal-command-builder';
import { ButtonComponent } from 'obsidian';

import { RenameIntent } from './rename-intent.ts';

/**
 * What the user answered in the {@link RenameIntentModal}.
 */
export interface RenameIntentChoice {
  readonly intent: RenameIntent;
  readonly shouldSaveLastUsedChoice: boolean;
}

/**
 * Parameters for {@link selectRenameIntent}.
 */
export interface SelectRenameIntentParams {
  readonly app: App;
  readonly newTitle: string;
  readonly oldTitle: string;
  readonly preselectedIntent: RenameIntent;
  readonly shouldSaveLastUsedChoice: boolean;
}

type RenameIntentModalConstructorParams = ModalBaseConstructorParams<null | RenameIntentChoice> & SelectRenameIntentParams;

interface RenameIntentOption {
  readonly intent: RenameIntent;
  readonly text: string;
}

const RENAME_INTENT_MODAL_CSS_CLASS = 'smart-rename-intent-modal';

const RENAME_INTENT_OPTIONS: readonly RenameIntentOption[] = [
  { intent: RenameIntent.SyncTitleAndHeading, text: 'Rename and sync to title/H1' },
  { intent: RenameIntent.StorePreviousName, text: 'Rename and store previous name/title/H1' },
  { intent: RenameIntent.RenameOnly, text: 'Rename only' }
];

class RenameIntentModal extends ModalBase<null | RenameIntentChoice> {
  private isChosen = false;
  private readonly newTitle: string;
  private readonly oldTitle: string;
  private readonly preselectedIntent: RenameIntent;
  private shouldSaveLastUsedChoice: boolean;

  public constructor(params: RenameIntentModalConstructorParams) {
    super(params);
    this.addCssClasses(RENAME_INTENT_MODAL_CSS_CLASS);
    this.newTitle = params.newTitle;
    this.oldTitle = params.oldTitle;
    this.preselectedIntent = params.preselectedIntent;
    this.shouldSaveLastUsedChoice = params.shouldSaveLastUsedChoice;
  }

  public override onClose(): void {
    if (!this.isChosen) {
      this.promiseResolve(null);
    }
  }

  public override onOpen(): void {
    this.titleEl.setText('Rename note');
    this.contentEl.createEl('p', { text: `${this.oldTitle} → ${this.newTitle}` });

    // Obsidian's own button row, which wraps, so the three long labels stay readable on a phone.
    const buttonsEl = this.contentEl.createDiv({ cls: 'modal-button-container' });
    let preselectedButton: ButtonComponent | null = null;

    for (const option of RENAME_INTENT_OPTIONS) {
      const button = new ButtonComponent(buttonsEl);
      button.setButtonText(option.text);
      button.buttonEl.dataset['intent'] = option.intent;
      button.onClick(() => {
        this.choose(option.intent);
      });
      if (option.intent !== this.preselectedIntent) {
        continue;
      }

      button.setCta();
      preselectedButton = button;
    }

    new ModalCommandBuilder()
      .addCheckbox({
        key: 's',
        modifiers: ['Alt'],
        onChange: (isChecked) => {
          this.shouldSaveLastUsedChoice = isChecked;
        },
        onInit: (checkboxEl) => {
          checkboxEl.checked = this.shouldSaveLastUsedChoice;
        },
        purpose: 'Save last used choice'
      })
      .build(this);

    // Focused, so Enter picks the preselected choice the way it confirms any Obsidian dialog.
    preselectedButton?.buttonEl.focus();
  }

  private choose(intent: RenameIntent): void {
    this.isChosen = true;
    this.promiseResolve({ intent, shouldSaveLastUsedChoice: this.shouldSaveLastUsedChoice });
    this.close();
  }
}

/**
 * Asks the user what a rename is meant to do.
 *
 * @param params - The parameters.
 * @returns The choice, or `null` if the dialog was dismissed.
 */
export async function selectRenameIntent(params: SelectRenameIntentParams): Promise<null | RenameIntentChoice> {
  return await showModal<null | RenameIntentChoice>((promiseResolve) =>
    new RenameIntentModal({
      ...params,
      promiseResolve
    })
  );
}
