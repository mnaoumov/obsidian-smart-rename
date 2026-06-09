/* eslint-disable @typescript-eslint/no-extraneous-class, @typescript-eslint/no-useless-constructor, @typescript-eslint/no-empty-function -- Test mocks require empty constructors and flexible patterns. */
import type { TFile } from 'obsidian';
import type { ReadonlyDeep } from 'type-fest';

import { noopAsync } from 'obsidian-dev-utils/function';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettings } from '../plugin-settings.ts';

import { InvokeCommandHandler } from './invoke-command-handler.ts';

vi.mock('obsidian-dev-utils/obsidian/command-handlers/file-command-handler', () => ({
  FileCommandHandler: class MockFileCommandHandler {
    public constructor(_params: unknown) {}
  }
}));

interface CreateHandlerOptions {
  checkIsMarkdownFile?(file: TFile): boolean;
  getSettings?(): ReadonlyDeep<PluginSettings>;
  smartRename?(file: TFile): Promise<void>;
}

function createHandler(opts?: CreateHandlerOptions): InvokeCommandHandler {
  return new InvokeCommandHandler({
    checkIsMarkdownFile: opts?.checkIsMarkdownFile ?? ((): boolean => true),
    getSettings: opts?.getSettings ?? ((): ReadonlyDeep<PluginSettings> => strictProxy<ReadonlyDeep<PluginSettings>>({ shouldSupportNonMarkdownFiles: false })),
    smartRename: opts?.smartRename ?? ((): Promise<void> => noopAsync())
  });
}

describe('InvokeCommandHandler', () => {
  it('should create an instance', () => {
    const handler = createHandler();
    expect(handler).toBeInstanceOf(InvokeCommandHandler);
  });

  describe('canExecuteFile', () => {
    it('should return true when file is a markdown file', () => {
      const handler = createHandler({
        checkIsMarkdownFile: (): boolean => true,
        getSettings: (): ReadonlyDeep<PluginSettings> => strictProxy<ReadonlyDeep<PluginSettings>>({ shouldSupportNonMarkdownFiles: false })
      });
      const mockFile = strictProxy<TFile>({ path: 'note.md' });
      expect(handler['canExecuteFile'](mockFile)).toBe(true);
    });

    it('should return false when file is not markdown and non-markdown not supported', () => {
      const handler = createHandler({
        checkIsMarkdownFile: (): boolean => false,
        getSettings: (): ReadonlyDeep<PluginSettings> => strictProxy<ReadonlyDeep<PluginSettings>>({ shouldSupportNonMarkdownFiles: false })
      });
      const mockFile = strictProxy<TFile>({ path: 'note.pdf' });
      expect(handler['canExecuteFile'](mockFile)).toBe(false);
    });

    it('should return true when file is not markdown but non-markdown files are supported', () => {
      const handler = createHandler({
        checkIsMarkdownFile: (): boolean => false,
        getSettings: (): ReadonlyDeep<PluginSettings> => strictProxy<ReadonlyDeep<PluginSettings>>({ shouldSupportNonMarkdownFiles: true })
      });
      const mockFile = strictProxy<TFile>({ path: 'note.pdf' });
      expect(handler['canExecuteFile'](mockFile)).toBe(true);
    });
  });

  describe('executeFile', () => {
    it('should call smartRename with the file', async () => {
      const smartRename = vi.fn<(file: TFile) => Promise<void>>().mockResolvedValue(undefined);
      const handler = createHandler({ smartRename });
      const mockFile = strictProxy<TFile>({ path: 'note.md' });
      await handler['executeFile'](mockFile);
      expect(smartRename).toHaveBeenCalledWith(mockFile);
    });
  });

  describe('shouldAddToFileMenu', () => {
    it('should return true for any file', () => {
      const handler = createHandler();
      const mockFile = strictProxy<TFile>({ path: 'note.md' });
      expect(handler['shouldAddToFileMenu'](mockFile, 'file-explorer')).toBe(true);
    });

    it('should return true for non-markdown file', () => {
      const handler = createHandler();
      const mockFile = strictProxy<TFile>({ path: 'image.png' });
      expect(handler['shouldAddToFileMenu'](mockFile, 'file-explorer')).toBe(true);
    });
  });
});
/* eslint-enable @typescript-eslint/no-extraneous-class, @typescript-eslint/no-useless-constructor, @typescript-eslint/no-empty-function -- End of test file. */
