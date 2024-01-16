import { InvalidCharacterAction } from 'InvalidCharacterAction';

export default class SmartRenameSettings {
    invalidCharacterAction: InvalidCharacterAction = InvalidCharacterAction.Error;
    replacementCharacter: string = '_';
    shouldStoreInvalidTitle: boolean = true;
    shouldUpdateTitleKey: boolean = false;
    shouldUpdateFirstHeader: boolean = false;
}

