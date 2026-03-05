import { InvalidCharacterAction } from './InvalidCharacterAction.ts';

export class PluginSettings {
  public invalidCharacterAction = InvalidCharacterAction.Error;

  public replacementCharacter = '_';
  public shouldPreservePreviousDisplayTextInFrontmatterLinks = true;
  public shouldPreservePreviousDisplayTextInNoteLinks = true;
  public shouldStoreInvalidTitle = true;
  public shouldSupportNonMarkdownFiles = true;
  public shouldUpdateFirstHeader = false;
  public shouldUpdateTitleKey = false;
}
