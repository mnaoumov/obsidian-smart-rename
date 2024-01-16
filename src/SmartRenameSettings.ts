import { InvalidCharacterAction } from "./InvalidCharacterAction";

export default class SmartRenameSettings {
  public invalidCharacterAction: InvalidCharacterAction = InvalidCharacterAction.Error;
  public replacementCharacter = "_";
  public shouldStoreInvalidTitle = true;
  public shouldUpdateTitleKey = false;
  public shouldUpdateFirstHeader = false;
}

