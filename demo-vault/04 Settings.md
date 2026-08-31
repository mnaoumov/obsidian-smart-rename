# Settings

Open **Settings -> Community plugins -> Smart Rename** to configure the plugin. Each option below lists the setting key stored in the plugin's `data.json`.

The two title options are the ones worth seeing rather than reading - turn both on, run a rename from [01 Smart rename](<./01 Smart rename.md>), and watch the note's first header and frontmatter `title` follow the new name:

```code-button
---
caption: Also update the first header and the title key
---
await require('/demoSetup.ts').changeSettings(app, { shouldUpdateFirstHeader: true, shouldUpdateTitleKey: true });
```

Manual equivalent: turn on **Should update first header** and **Should update title key** below.

```code-button
---
caption: Restore every setting this vault changes
---
await require('/demoSetup.ts').changeSettings(app, { invalidCharacterAction: 'Error', replacementCharacter: '_', shouldStoreInvalidTitle: true, shouldUpdateFirstHeader: false, shouldUpdateTitleKey: false });
```

Manual equivalent: set **Invalid characters action** back to *Error*, **Replacement character** to `_`, **Should store invalid title** on, and both title options off.

## Invalid characters

- `invalidCharacterAction`
  - how to process invalid characters in the new title: show an error, remove them, or replace them.
- `replacementCharacter`
  - the character used to replace invalid characters (only when the action is *Replace*).
- `shouldStoreInvalidTitle`
  - keep the original, invalid title as the note's display text; if disabled, the sanitized version is stored.

## Title

- `shouldUpdateFirstHeader`
  - also update the first header of the note when it matches the old title.
- `shouldUpdateTitleKey`
  - update the `title` key in the note's frontmatter.

## Previous display text

- `shouldPreservePreviousDisplayTextInNoteLinks`
  - keep the old title as display text in ordinary note links.
- `shouldPreservePreviousDisplayTextInFrontmatterLinks`
  - keep the old title as display text in links inside frontmatter.

## Other

- `shouldSupportNonMarkdownFiles`
  - make the command and context menu available for non-markdown files too.
