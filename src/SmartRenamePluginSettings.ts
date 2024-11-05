import { InvalidCharacterAction } from './InvalidCharacterAction.ts';

export default class SmartRenamePluginSettings {
  public invalidCharacterAction = InvalidCharacterAction.Error;
  public replacementCharacter = '_';
  public shouldStoreInvalidTitle = true;
  public shouldUpdateTitleKey = false;
  public shouldUpdateFirstHeader = false;
}
