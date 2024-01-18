import { InvalidCharacterAction } from "./InvalidCharacterAction";

export default class SmartRenameSettings {
  public invalidCharacterAction = InvalidCharacterAction.Error;
  public replacementCharacter = "_";
  public shouldStoreInvalidTitle = true;
  public shouldUpdateTitleKey = false;
  public shouldUpdateFirstHeader = false;
}

