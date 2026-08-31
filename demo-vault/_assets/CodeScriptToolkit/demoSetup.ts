import type { App } from 'obsidian';

import {
  MarkdownView,
  Notice
} from 'obsidian';
import { configureCommunityPlugin } from 'obsidian-dev-utils/obsidian/community-plugins';

const PLUGIN_ID = 'smart-rename';
const DEMO_FOLDER_PATH = 'Materials/01 Smart rename';
const REFERENCES_FOLDER_PATH = `${DEMO_FOLDER_PATH}/References`;
const LINK_DEMO_FOLDER_PATH = 'Materials/03 Rename the link target';
const LINK_DEMO_SOURCE_PATH = `${LINK_DEMO_FOLDER_PATH}/Note with links.md`;
const LINK_DEMO_TARGET_PATH = `${LINK_DEMO_FOLDER_PATH}/Target note.md`;

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

// The prefix of the line holding the first wikilink. Located by content rather than by a hard-coded
// Line number, so editing the note's prose or its frontmatter cannot silently move the cursor off the
// Link and leave the button doing nothing.
const WIKILINK_LINE_PREFIX = 'A wikilink: ';

// Far enough past `[[` to land inside the link rather than on its edge.
const WIKILINK_CURSOR_OFFSET = 4;

const LINK_FIXTURE_NOTES: Record<string, string> = {
  [LINK_DEMO_SOURCE_PATH]: [
    '---',
    'obsidian-dev-utils:',
    '  demo-vault-validation:',
    '    allow-wikilinks: These links ARE the fixture - the command acts on whichever one the cursor is in, and the point is that every link form resolves.',
    '---',
    '# Note with links',
    '',
    'Put the cursor inside any link below and run **Smart Rename: Invoke on link under cursor**. The link\'s *target* is renamed; this note keeps its own name.',
    '',
    'Walkthrough in [03 Rename the link target](<../../03 Rename the link target.md>).',
    '',
    `${WIKILINK_LINE_PREFIX}[[Target note]]`,
    '',
    'A wikilink with its own display text: [[Target note|a note worth renaming]]',
    '',
    'A markdown link: [the same note](<./Target note.md>)',
    '',
    'An embed: ![[Target note]]',
    '',
    'A link in frontmatter counts too - `Editor.getClickableTokenAt` reports nothing inside a frontmatter block, so a plugin built on clickable tokens could not offer the command there. This one parses the line instead, so it can.',
    ''
  ].join('\n'),
  [LINK_DEMO_TARGET_PATH]: [
    '# Target note',
    '',
    'This is the note the [03 Rename the link target](<../../03 Rename the link target.md>) demo renames - and you never open it to do so.',
    '',
    'You reached it from [Note with links](<./Note with links.md>), which points here three different ways. That note is where the cursor goes.',
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
 * Opens the note that links to the target and drops the cursor inside its first wikilink, so the
 * command is immediately available.
 *
 * Manual equivalent: open `Materials/03 Rename the link target/Note with links.md` and click inside the
 * `Target note` wikilink.
 */
export async function openLinkDemo(app: App): Promise<void> {
  const note = app.vault.getFileByPath(LINK_DEMO_SOURCE_PATH);
  if (!note) {
    new Notice('"Note with links" is not there — press the reset button first.');
    return;
  }

  await app.workspace.getLeaf(false).openFile(note, { state: { mode: 'source' } });

  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (!view) {
    new Notice('Could not reach the editor. Open the note and click inside a link yourself.');
    return;
  }

  const editor = view.editor;
  const lineIndex = editor.getValue().split('\n').findIndex((line) => line.startsWith(WIKILINK_LINE_PREFIX));
  if (lineIndex === -1) {
    new Notice('The wikilink line is gone — press the reset button first.');
    return;
  }

  editor.focus();
  editor.setCursor({ ch: WIKILINK_LINE_PREFIX.length + WIKILINK_CURSOR_OFFSET, line: lineIndex });
  new Notice('Cursor is on the link. Run "Smart Rename: Invoke on link under cursor".');
}

/**
 * Puts the link-target demo notes back exactly as they ship, so the rename can be tried again.
 *
 * Manual equivalent: rename the target back by hand and undo the link rewrites in the note that points
 * at it.
 */
export async function resetLinkDemo(app: App): Promise<void> {
  const folder = app.vault.getFolderByPath(LINK_DEMO_FOLDER_PATH);
  if (folder) {
    await app.fileManager.trashFile(folder);
  }

  await app.vault.createFolder(LINK_DEMO_FOLDER_PATH);

  for (const [path, content] of Object.entries(LINK_FIXTURE_NOTES)) {
    await app.vault.create(path, content);
  }

  new Notice('Demo notes restored. Press the open button and try again.');
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
