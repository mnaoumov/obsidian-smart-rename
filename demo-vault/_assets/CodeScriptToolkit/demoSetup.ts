import type { App } from 'obsidian';

import { Notice } from 'obsidian';
import { configureCommunityPlugin } from 'obsidian-dev-utils/obsidian/community-plugins';

const PLUGIN_ID = 'smart-rename';
const DEMO_FOLDER_PATH = 'Materials/01 Smart rename';
const REFERENCES_FOLDER_PATH = `${DEMO_FOLDER_PATH}/References`;

interface DemoSettingsPatch {
  invalidCharacterAction?: string;
  replacementCharacter?: string;
  shouldPreservePreviousDisplayTextInNoteLinks?: boolean;
  shouldStoreInvalidTitle?: boolean;
  shouldUpdateFirstHeader?: boolean;
  shouldUpdateTitleKey?: boolean;
}

// The pristine fixture. Renaming is destructive by nature, so the walkthrough is only repeatable if
// The vault can be put back — which is what the reset button is for.
const FIXTURE_NOTES: Record<string, string> = {
  [`${DEMO_FOLDER_PATH}/Rename me.md`]: [
    '# Rename me',
    '',
    'This is the note the [01 Smart rename](<../../01 Smart rename.md>) demo renames. With this note active, run **Smart Rename: Invoke** and give it a new title.',
    '',
    'Two notes link here - [References/Note A](<./References/Note A.md>) and [References/Note B](<./References/Note B.md>). After the rename, their links will keep showing "Rename me" as their display text instead of switching to the new name.',
    ''
  ].join('\n'),
  [`${REFERENCES_FOLDER_PATH}/Note A.md`]: [
    '# Note A',
    '',
    'A note that links to [Rename me](<../Rename me.md>) with a plain link (no alias). After a smart rename, this becomes `[[New title|Rename me]]` so it still reads "Rename me".',
    ''
  ].join('\n'),
  [`${REFERENCES_FOLDER_PATH}/Note B.md`]: [
    '# Note B',
    '',
    'Another note linking to [our starting note](<../Rename me.md>). It already has a custom alias, so the link keeps showing "our starting note" - smart rename only swaps the target, never your chosen display text.',
    ''
  ].join('\n')
};

/**
 * Puts the three demo notes back exactly as they ship, so the rename can be tried again.
 *
 * Manual equivalent: rename the note back by hand and undo the link rewrites in both referencing
 * notes — which is the tedium this button exists to remove.
 */
export async function resetDemo(app: App): Promise<void> {
  const folder = app.vault.getFolderByPath(DEMO_FOLDER_PATH);
  if (folder) {
    await app.fileManager.trashFile(folder);
  }

  await app.vault.createFolder(DEMO_FOLDER_PATH);
  await app.vault.createFolder(REFERENCES_FOLDER_PATH);

  for (const [path, content] of Object.entries(FIXTURE_NOTES)) {
    await app.vault.create(path, content);
  }

  new Notice('Demo notes restored. Open "Rename me" and try again.');
}

/**
 * Opens the note the walkthrough renames and starts the rename prompt on it.
 *
 * Manual equivalent: open `Materials/01 Smart rename/Rename me.md` and run **Smart Rename: Invoke**
 * from the Command Palette.
 */
export async function startRename(app: App): Promise<void> {
  const note = app.vault.getFileByPath(`${DEMO_FOLDER_PATH}/Rename me.md`);
  if (!note) {
    new Notice('"Rename me" is not there — press the reset button first.');
    return;
  }

  await app.workspace.getLeaf(false).openFile(note);
  app.commands.executeCommandById(`${PLUGIN_ID}:invoke`);
}

/**
 * Applies a settings patch, live, through the plugin's own settings component.
 *
 * Manual equivalent: change the same option in **Settings -> Community plugins -> Smart Rename**.
 */
export async function changeSettings(app: App, patch: DemoSettingsPatch): Promise<void> {
  await configureCommunityPlugin({ app, pluginId: PLUGIN_ID, settings: patch });
  new Notice('Applied. The setting is live — no reload needed.');
}
