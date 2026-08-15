/**
 * @file
 *
 * Produces the desktop screenshots the community-store listing needs
 * (T461-P21), driving the demo vault's fixtures in a real Obsidian and writing
 * `images/screenshots/screenshot-desktop-N.png`.
 *
 * Each shot shows a DIFFERENT step of one flow, and each is CAPTIONED by
 * `labelScreenshot` after capture — a listing carousel shows screenshots one at
 * a time with no caption of its own, so an image has to say what it is showing.
 *
 * The storyboard is the plugin's whole argument in five frames: the links
 * before, the prompt, the links after, the SAME state in reading view (where
 * nothing appears to have changed, which is the point), and the alias left
 * behind.
 *
 * Two framing decisions worth keeping:
 *
 * - The shots are taken in SOURCE mode, not reading mode, because the change
 *   this plugin makes is invisible in reading mode by design. That is exactly
 *   why shot 4 is a reading-mode frame: the pair says "the link was rewritten"
 *   and "you cannot tell", which is the sales pitch.
 * - The demo vault's own fixtures link with MARKDOWN links, where a plain
 *   Obsidian rename would already preserve the display text. A staged note adds
 *   the wikilink forms, which is where the plugin earns its keep.
 */

import {
  mkdirSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import {
  buildDemoVaultPopulate,
  captureObsidianScreenshot,
  evalInObsidian,
  labelScreenshot,
  readPngDimensions
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

/**
 * `App`, reduced to the inline-title toggle that `obsidian-typings` does not
 * declare. Setting the config alone changes nothing on screen.
 */
interface InlineTitleApp {
  updateInlineTitleDisplay(this: void): void;
}

/**
 * The desktop side dock, reduced to the resize call.
 */
interface ResizableSideDock {
  setSize(this: void, size: number): void;
}

const WIDTH_IN_PIXELS = 1200;
const HEIGHT_IN_PIXELS = 800;

/**
 * The note the demo renames, as it ships in the demo vault.
 */
const SUBJECT_NOTE_PATH = 'Materials/01 Smart rename/Rename me.md';

/**
 * The staged note that links to the subject every way a note can be linked.
 */
const REFERENCE_NOTE_PATH = 'Materials/01 Smart rename/Every link form.md';

const OLD_TITLE = 'Rename me';
const NEW_TITLE = 'Renamed note';

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');
const DEMO_VAULT_PATH = join(process.cwd(), 'demo-vault');

beforeAll(async () => {
  const vault = getTemporaryVault();

  const demoVaultFiles = buildDemoVaultPopulate({ demoVaultPath: DEMO_VAULT_PATH });
  const fixtures = Object.fromEntries(
    Object.entries(demoVaultFiles).filter(([path]) => path.startsWith('Materials/'))
  );

  vault.populate({ ...fixtures, [REFERENCE_NOTE_PATH]: buildReferenceNote() });
  await vault.syncToDevice();

  await evalInObsidian({
    async callback({ app, lib: { waitUntil }, referenceNotePath }) {
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 30_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1000;

      app.changeTheme('obsidian');

      await waitUntil({
        message: 'the staged reference note to appear in the vault',
        predicate: () => Boolean(app.vault.getFileByPath(referenceNotePath)),
        timeoutInMilliseconds: SETTLE_TIMEOUT_IN_MILLISECONDS
      });

      // Nothing but the note matters in these shots: the file explorer and an
      // Empty right dock would otherwise take a third of a 1200x800 frame.
      app.workspace.leftSplit.collapse();
      const rightSplit: unknown = app.workspace.rightSplit;
      (rightSplit as ResizableSideDock).setSize(0);
      app.workspace.rightSplit.collapse();

      // Each note opens with its own `# H1`, so the inline title doubles it.
      app.vault.setConfig('showInlineTitle', false);
      const inlineTitleApp: unknown = app;
      (inlineTitleApp as InlineTitleApp).updateInlineTitleDisplay();

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { referenceNotePath: REFERENCE_NOTE_PATH },
    vaultPath: vaultPath()
  });
});

describe('desktop store screenshots', () => {
  it('1 - the links before the rename', async () => {
    await openNote(REFERENCE_NOTE_PATH, 'source');
    await shoot(1, `Four ways to link one note, all reading ${OLD_TITLE}`);
  });

  it('2 - the prompt that asks for the new title', async () => {
    await openNote(SUBJECT_NOTE_PATH, 'source');
    await openRenamePrompt();
    await shoot(2, 'Smart Rename asks for the new title, once');
  });

  it('3 - the links after the rename, in source', async () => {
    await submitRenamePrompt(NEW_TITLE);
    await openNote(REFERENCE_NOTE_PATH, 'source');
    await shoot(3, `Every link now points at ${NEW_TITLE}`);
  });

  it('4 - the same note in reading view, unchanged', async () => {
    await openNote(REFERENCE_NOTE_PATH, 'preview');
    await shoot(4, `...and every one still reads ${OLD_TITLE}`);
  });

  it('5 - the old title kept as an alias', async () => {
    await openNote(`Materials/01 Smart rename/${NEW_TITLE}.md`, 'source');
    await shoot(5, 'The old title is kept as an alias, so search still finds it');
  });
});

/**
 * Builds the staged note that links the subject every way a note can be linked.
 *
 * Forms 1 and 2 are what the plugin exists for: each displays the old title
 * today, and each still does afterwards. Form 3 already had display text the
 * author chose, so it is left alone — and showing that in the same frame is
 * honest about what the plugin does not touch.
 *
 * @returns The note's Markdown.
 */
function buildReferenceNote(): string {
  return '# Every link form\n\n'
    + `1. Wikilink [[${OLD_TITLE}]]\n`
    + `2. Wikilink repeating the title [[${OLD_TITLE}|${OLD_TITLE}]]\n`
    + `3. Wikilink with your own display text [[${OLD_TITLE}|the note in question]]\n`
    + `4. Markdown link [${OLD_TITLE}](<${OLD_TITLE}.md>)\n`;
}

/**
 * Opens a note in the given editor mode.
 *
 * @param path - Vault-relative path of the note.
 * @param mode - `source` to show the Markdown, `preview` to show it rendered.
 */
async function openNote(path: string, mode: string): Promise<void> {
  await evalInObsidian({
    async callback({ app, mode: viewMode, path: notePath }) {
      const SETTLE_DELAY_IN_MILLISECONDS = 900;

      const file = app.vault.getFileByPath(notePath);
      if (!file) {
        throw new Error(`Note is missing from the vault: ${notePath}`);
      }

      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(file);
      // `source: true` forces RAW Markdown rather than live preview, which is
      // What makes the link syntax visible at all.
      await leaf.setViewState({
        state: { file: notePath, mode: viewMode, source: viewMode === 'source' },
        type: 'markdown'
      });

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { mode, path },
    vaultPath: vaultPath()
  });
}

/**
 * Runs the plugin's command so its prompt appears, without waiting for it: the
 * prompt blocks until answered, so awaiting the command would deadlock.
 */
async function openRenamePrompt(): Promise<void> {
  await evalInObsidian({
    async callback({ app, lib: { waitUntil } }) {
      const PROMPT_TIMEOUT_IN_MILLISECONDS = 10_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 700;

      // Deliberately NOT awaited. `smartRename` opens a prompt and resolves only
      // Once it is answered, so awaiting here would hang the whole closure.
      app.commands.executeCommandById('smart-rename:invoke');

      await waitUntil({
        message: 'the rename prompt to appear',
        predicate: () => Boolean(document.querySelector('.modal input')),
        timeoutInMilliseconds: PROMPT_TIMEOUT_IN_MILLISECONDS
      });

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    vaultPath: vaultPath()
  });
}

/**
 * Captures the window, captions it, and writes it as
 * `images/screenshot-desktop-<index>.png`.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 */
async function shoot(index: number, caption: string): Promise<void> {
  const bytes = await captureObsidianScreenshot({
    heightInPixels: HEIGHT_IN_PIXELS,
    vaultPath: vaultPath(),
    widthInPixels: WIDTH_IN_PIXELS
  });

  const labeled = await labelScreenshot(bytes, { text: caption });

  expect(readPngDimensions(labeled)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-desktop-${String(index)}.png`), labeled);
}

/**
 * Types a new title into the open prompt and confirms it.
 *
 * @param newTitle - The title to rename to.
 */
async function submitRenamePrompt(newTitle: string): Promise<void> {
  await evalInObsidian({
    async callback({ app, lib: { waitUntil }, newTitle: title }) {
      const RENAME_TIMEOUT_IN_MILLISECONDS = 20_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1200;

      // Let the previous shot's capture settle first. `captureObsidianScreenshot`
      // Overrides the device metrics and clears them again, and the re-layout
      // That lands afterwards closes a modal — including this prompt, which the
      // Previous shot photographed and this one has to fill in.
      const RESIZE_SETTLE_DELAY_IN_MILLISECONDS = 2000;
      await sleep(RESIZE_SETTLE_DELAY_IN_MILLISECONDS);

      const input = document.querySelector('.modal input');
      if (!(input instanceof HTMLInputElement)) {
        throw new TypeError('The rename prompt has no text input.');
      }

      input.value = title;
      // The modal tracks the value through its own `input` handler, so setting
      // `value` alone would submit an empty title.
      input.dispatchEvent(new Event('input'));

      const confirmButton = document.querySelector('.modal button.mod-cta');
      if (!(confirmButton instanceof HTMLElement)) {
        throw new TypeError('The rename prompt has no confirm button.');
      }

      confirmButton.click();

      await waitUntil({
        message: 'the renamed note to exist',
        predicate: () => Boolean(app.vault.getFileByPath(`Materials/01 Smart rename/${title}.md`)),
        timeoutInMilliseconds: RENAME_TIMEOUT_IN_MILLISECONDS
      });

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { newTitle },
    vaultPath: vaultPath()
  });
}

function vaultPath(): string {
  return getTemporaryVault().path;
}
