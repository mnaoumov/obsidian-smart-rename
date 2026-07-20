[Docs](https://github.com/mnaoumov/obsidian-smart-rename/)

# Settings

Open **Settings -> Community plugins -> Smart Rename** to configure the plugin. Each option below lists the setting key stored in the plugin's `data.json`.

## Invalid characters

- `invalidCharacterAction` - how to process invalid characters in the new title: show an error, remove them, or replace them.
- `replacementCharacter` - the character used to replace invalid characters (only when the action is *Replace*).
- `shouldStoreInvalidTitle` - keep the original, invalid title as the note's display text; if disabled, the sanitized version is stored.

## Title

- `shouldUpdateFirstHeader` - also update the first header of the note when it matches the old title.
- `shouldUpdateTitleKey` - update the `title` key in the note's frontmatter.

## Previous display text

- `shouldPreservePreviousDisplayTextInNoteLinks` - keep the old title as display text in ordinary note links.
- `shouldPreservePreviousDisplayTextInFrontmatterLinks` - keep the old title as display text in links inside frontmatter.

## Other

- `shouldSupportNonMarkdownFiles` - make the command and context menu available for non-markdown files too.
