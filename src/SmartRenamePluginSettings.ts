import { InvalidCharacterAction } from './InvalidCharacterAction.ts';

export default class SmartRenamePluginSettings {
  public invalidCharacterAction = InvalidCharacterAction.Error;
  public replacementCharacter = '_';
  public shouldStoreInvalidTitle = true;
  public shouldUpdateFirstHeader = false;
  public shouldUpdateTitleKey = false;
}
