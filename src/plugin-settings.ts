import { InvalidCharacterAction } from './invalid-character-action.ts';

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
