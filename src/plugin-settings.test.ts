import {
  describe,
  expect,
  it
} from 'vitest';

import { InvalidCharacterAction } from './invalid-character-action.ts';
import { PluginSettings } from './plugin-settings.ts';

describe('PluginSettings', () => {
  it('should default invalidCharacterAction to Error', () => {
    const settings = new PluginSettings();
    expect(settings.invalidCharacterAction).toBe(InvalidCharacterAction.Error);
  });

  it('should default replacementCharacter to underscore', () => {
    const settings = new PluginSettings();
    expect(settings.replacementCharacter).toBe('_');
  });

  it('should default shouldPreservePreviousDisplayTextInFrontmatterLinks to true', () => {
    const settings = new PluginSettings();
    expect(settings.shouldPreservePreviousDisplayTextInFrontmatterLinks).toBe(true);
  });

  it('should default shouldPreservePreviousDisplayTextInNoteLinks to true', () => {
    const settings = new PluginSettings();
    expect(settings.shouldPreservePreviousDisplayTextInNoteLinks).toBe(true);
  });

  it('should default shouldStoreInvalidTitle to true', () => {
    const settings = new PluginSettings();
    expect(settings.shouldStoreInvalidTitle).toBe(true);
  });

  it('should default shouldSupportNonMarkdownFiles to true', () => {
    const settings = new PluginSettings();
    expect(settings.shouldSupportNonMarkdownFiles).toBe(true);
  });

  it('should default shouldUpdateFirstHeader to false', () => {
    const settings = new PluginSettings();
    expect(settings.shouldUpdateFirstHeader).toBe(false);
  });

  it('should default shouldUpdateTitleKey to false', () => {
    const settings = new PluginSettings();
    expect(settings.shouldUpdateTitleKey).toBe(false);
  });
});
