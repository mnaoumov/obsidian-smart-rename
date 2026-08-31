import type {
  App as AppOriginal,
  Editor,
  TFile
} from 'obsidian';

import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { ensureNonNullable } from 'obsidian-dev-utils/type-guards';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import { resolveLinkFileAtEditorCursor } from './link-target.ts';

const SOURCE_PATH = 'Source.md';
const TARGET_PATH = 'Target.md';
const SPACED_TARGET_PATH = 'Target with space.md';
const ATTACHMENT_PATH = 'attachment.png';

function createApp(): AppOriginal {
  return App.createConfigured__({
    files: {
      [ATTACHMENT_PATH]: '',
      [SOURCE_PATH]: '',
      [SPACED_TARGET_PATH]: '',
      [TARGET_PATH]: ''
    }
  }).asOriginalType__();
}

// `strictProxy` rather than a hand-rolled object so the test fails loudly if the resolver ever starts
// Reaching for an editor member beyond these two.
function createEditor(line: string, ch: number): Editor {
  return strictProxy<Editor>({
    getCursor: () => ({ ch, line: 0 }),
    getLine: () => line
  });
}

function getFile(app: AppOriginal, path: string): TFile {
  return ensureNonNullable(app.vault.getFileByPath(path));
}

function resolve(line: string, ch: number): null | TFile {
  const app = createApp();
  return resolveLinkFileAtEditorCursor({
    app,
    editor: createEditor(line, ch),
    sourceFile: getFile(app, SOURCE_PATH)
  });
}

describe('resolveLinkFileAtEditorCursor', () => {
  describe('link forms it resolves', () => {
    it('should resolve a bare wikilink', () => {
      expect(resolve('[[Target]]', 3)?.path).toBe(TARGET_PATH);
    });

    it('should resolve a wikilink with display text', () => {
      expect(resolve('[[Target|shown]]', 3)?.path).toBe(TARGET_PATH);
    });

    it('should resolve a wikilink with a subpath', () => {
      expect(resolve('[[Target#Heading]]', 3)?.path).toBe(TARGET_PATH);
    });

    it('should resolve a markdown link', () => {
      expect(resolve('[shown](Target.md)', 3)?.path).toBe(TARGET_PATH);
    });

    it('should resolve an angle-bracketed markdown link', () => {
      expect(resolve('[shown](<Target with space.md>)', 3)?.path).toBe(SPACED_TARGET_PATH);
    });

    it('should resolve a URL-encoded markdown link', () => {
      expect(resolve('[shown](Target%20with%20space.md)', 3)?.path).toBe(SPACED_TARGET_PATH);
    });

    it('should resolve an embed', () => {
      expect(resolve('![[Target]]', 4)?.path).toBe(TARGET_PATH);
    });

    // The reason this module parses the line instead of asking for a clickable token: Obsidian decorates
    // No link inside the frontmatter block, so `getClickableTokenAt` reports nothing here.
    it('should resolve a link on a frontmatter line', () => {
      expect(resolve('related: "[[Target]]"', 13)?.path).toBe(TARGET_PATH);
    });

    it('should resolve a link to a non-markdown file', () => {
      expect(resolve('[[attachment.png]]', 3)?.path).toBe(ATTACHMENT_PATH);
    });

    it('should resolve with the cursor at either edge of the link', () => {
      expect(resolve('[[Target]]', 0)?.path).toBe(TARGET_PATH);
      expect(resolve('[[Target]]', '[[Target]]'.length)?.path).toBe(TARGET_PATH);
    });
  });

  describe('cases it declines', () => {
    it('should return null when the line has no link', () => {
      expect(resolve('just some prose', 4)).toBeNull();
    });

    it('should return null when the cursor sits outside the link', () => {
      expect(resolve('[[Target]] and some trailing prose', 20)).toBeNull();
    });

    it('should return null for an external link', () => {
      expect(resolve('[shown](https://example.com)', 3)).toBeNull();
    });

    it('should return null when the link points at no existing file', () => {
      expect(resolve('[[Missing]]', 3)).toBeNull();
    });

    it('should return null when the editor is not backed by a file', () => {
      const app = createApp();
      const file = resolveLinkFileAtEditorCursor({
        app,
        editor: createEditor('[[Target]]', 3),
        sourceFile: null
      });

      expect(file).toBeNull();
    });
  });
});
