/**
 * @file
 *
 * Produces the five mobile screenshots the community-store listing needs
 * (T461-P21), driving the demo vault's fixtures in Obsidian Mobile on a real
 * Android emulator and writing `images/screenshots/screenshot-mobile-N.png`.
 *
 * The mobile counterpart of the desktop capture suite, showing the same five
 * steps of the same flow. It is worth taking rather than reusing the desktop
 * images because the prompt is a different control on a phone — a sheet with
 * full-width touch buttons rather than a small centred dialog.
 *
 * There is no mobile equivalent of the desktop viewport override, so the capture
 * is always the device's own framebuffer. The fix is to make the DEVICE the
 * right size: this runs on a dedicated `obsidian_screenshots` AVD built at
 * exactly 900x1600, so the frame already IS the store's size — no crop, no
 * rescale, no letterbox, no post-processing at all. That AVD needs ONE-TIME
 * provisioning, and both steps are non-obvious — see [[T461-P21]].
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
 * `App`, reduced to the font-size applier that `obsidian-typings` does not
 * declare. Setting `baseFontSize` alone changes nothing on screen.
 */
interface FontSizeApp {
  updateFontSize(this: void): void;
}

/**
 * `App`, reduced to the inline-title applier, likewise undeclared.
 */
interface InlineTitleApp {
  updateInlineTitleDisplay(this: void): void;
}

const WIDTH_IN_PIXELS = 900;
const HEIGHT_IN_PIXELS = 1600;

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

/**
 * Base font size for the mobile shots.
 *
 * Below Obsidian's own 16px default: the screenshot AVD is a 450x800 dp screen,
 * on which the reference note's four link rows wrap mid-link at 16 and stop
 * reading as a list of four ways to link one note.
 */
const MOBILE_FONT_SIZE_IN_PIXELS = 13;

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');
const DEMO_VAULT_PATH = join(process.cwd(), 'demo-vault');

/**
 * Diagnostics from the setup closure, surfaced by the first test so a failed
 * mobile layout is readable instead of silent.
 */
let setupDiagnostics: unknown;

beforeAll(async () => {
  const vault = getTemporaryVault();

  const demoVaultFiles = buildDemoVaultPopulate({ demoVaultPath: DEMO_VAULT_PATH });
  const fixtures = Object.fromEntries(
    Object.entries(demoVaultFiles).filter(([path]) => path.startsWith('Materials/'))
  );

  vault.populate({ ...fixtures, [REFERENCE_NOTE_PATH]: buildReferenceNote() });
  await vault.syncToDevice();

  setupDiagnostics = await evalInObsidian({
    async callback({ app, fontSizeInPixels, lib: { waitUntil }, referenceNotePath }) {
      // A closure runs inside ONE Appium `execute/sync` call, which WebDriver
      // Caps around 30s. A longer wait in here dies as an opaque `script
      // Timeout` rather than a readable failure, so keep every wait under it.
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 20_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      app.changeTheme('obsidian');

      await waitUntil({
        message: 'the staged reference note to appear in the vault',
        predicate: () => Boolean(app.vault.getFileByPath(referenceNotePath)),
        timeoutInMilliseconds: SETTLE_TIMEOUT_IN_MILLISECONDS
      });

      app.vault.setConfig('baseFontSize', fontSizeInPixels);
      const fontApp: unknown = app;
      (fontApp as FontSizeApp).updateFontSize();

      // Each note opens with its own `# H1`, so the inline title doubles it.
      app.vault.setConfig('showInlineTitle', false);
      (fontApp as InlineTitleApp).updateInlineTitleDisplay();

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      return { isVaultReady: Boolean(app.vault.getFileByPath(referenceNotePath)) };
    },
    input: { fontSizeInPixels: MOBILE_FONT_SIZE_IN_PIXELS, referenceNotePath: REFERENCE_NOTE_PATH },
    vaultPath: vaultPath()
  });
});

describe('mobile store screenshots', () => {
  it('stages the fixtures the shots are framed on', () => {
    // Surfaced as an assertion because vitest swallows console output from an
    // Integration worker, and a silently-wrong layout produces five bad images
    // Without a single failure.
    expect(setupDiagnostics).toMatchObject({ isVaultReady: true });
  });

  it('1 - the links before the rename', async () => {
    await openNote(REFERENCE_NOTE_PATH, 'source');
    await shoot(1, `Four ways to link one note, all reading ${OLD_TITLE}`);
  });

  it('2 - the prompt that asks for the new title', async () => {
    await openNote(SUBJECT_NOTE_PATH, 'source');
    await openRenamePrompt();
    await shoot(2, 'Smart Rename asks for the new title, and which steps to run');
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
 * Captures the device screen, captions it, and writes it as
 * `images/screenshot-mobile-<index>.png`.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 */
async function shoot(index: number, caption: string): Promise<void> {
  const captured = await captureObsidianScreenshot({ vaultPath: vaultPath() });

  // The AVD is 900x1600, so the device frame IS the store's size. Asserting it
  // Here is what keeps that true: run this against any other AVD and it fails
  // Loudly instead of quietly shipping an off-spec image.
  expect(readPngDimensions(captured)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  // Captioned AFTER capture, so the frame stays an untouched device screenshot
  // And rewording a label needs no re-shoot.
  const labeled = await labelScreenshot(captured, { text: caption });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-mobile-${String(index)}.png`), labeled);
}

/**
 * Types a new title into the open prompt and confirms it.
 *
 * @param newTitle - The title to rename to.
 */
async function submitRenamePrompt(newTitle: string): Promise<void> {
  await evalInObsidian({
    async callback({ app, lib: { clickElement, waitUntil }, newTitle: title }) {
      const RENAME_TIMEOUT_IN_MILLISECONDS = 20_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1200;

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

      await clickElement({ element: confirmButton });

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
