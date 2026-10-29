/**
 * What a rename made through one of Obsidian's own rename surfaces is meant to do, as declared in the
 * rename intent dialog.
 */
export enum RenameIntent {
  /**
   * The file name changes and nothing else: `title:` and the first H1 stay, as with a rename made by code.
   */
  RenameOnly = 'RenameOnly',

  /**
   * As {@link RenameIntent.SyncTitleAndHeading}, and the previous name is kept: as an alias, and as the display text
   * of the links that showed it.
   */
  StorePreviousName = 'StorePreviousName',

  /**
   * `title:` and the first H1 become the new name.
   */
  SyncTitleAndHeading = 'SyncTitleAndHeading'
}
