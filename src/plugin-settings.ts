import { InvalidCharacterAction } from './invalid-character-action.ts';
import { RenameIntent } from './rename-intent.ts';

export class PluginSettings {
  public invalidCharacterAction = InvalidCharacterAction.Error;

  public lastRenameIntent = RenameIntent.SyncTitleAndHeading;
  public replacementCharacter = '_';
  public shouldAddOldTitleAsAlias = true;
  public shouldAskRenameIntent = true;
  public shouldPreservePreviousDisplayTextInFrontmatterLinks = true;
  public shouldPreservePreviousDisplayTextInNoteLinks = true;
  public shouldSaveLastRenameIntent = false;
  public shouldStoreInvalidTitle = true;
  public shouldSupportNonMarkdownFiles = true;
  public shouldUpdateFirstHeader = false;
  public shouldUpdateTitleKey = false;
}
