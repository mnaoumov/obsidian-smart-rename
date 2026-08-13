# Smart rename

Smart Rename renames the **active note** and rewrites its backlinks so their **display text keeps showing the old title**. A plain rename would change the visible link text to the new name; Smart Rename turns `[[Old title]]` into `[[New title|Old title]]` so the reader still sees what you originally wrote.

## Try it

1. Open [Rename me](<./Materials/01 Smart rename/Rename me.md>) (the note this demo renames).
2. Run **Smart Rename: Invoke** from the Command Palette, or right-click the note in the file explorer and choose the smart rename option.
3. Type a new title - for example `Renamed note` - and confirm.
4. Open [References/Note A](<./Materials/01 Smart rename/References/Note A.md>) and [References/Note B](<./Materials/01 Smart rename/References/Note B.md>). Their links now point at the new note, but still **display** the old title.

## What it preserves

- **Note links**
  - a bare `[[Rename me]]` becomes `[[Renamed note|Rename me]]`, keeping the old text visible (controlled by the note-links setting in [03 Settings](<./03 Settings.md>)).
- **Frontmatter links**
  - links inside YAML frontmatter get the same treatment (controlled by the frontmatter-links setting).
- **The first header and a title key**
  - optionally kept in sync with the new name (see [03 Settings](<./03 Settings.md>)).

Renaming to a title that contains characters Obsidian cannot use in a filename is handled separately - see [02 Invalid characters](<./02 Invalid characters.md>).

## Every link form, before and after

The five ways a note can be linked, and what renaming `OldName` to `NewName` does to each. Start with
`OldName.md`:

```markdown
This is a note `OldName.md` that is going to be renamed to `NewName.md`.
```

and `OtherNote.md` linking to it five different ways:

```markdown
This note references

1. Wikilink [[OldName]]
2. Wikilink with the same display text [[OldName|OldName]]
3. Wikilink with a custom display text [[OldName|Custom display text]]
4. Markdown link [OldName](OldName.md)
5. Markdown link with a custom display text [Custom display text](OldName.md)
```

Invoke the command with `NewName` as the new title, and you get `NewName.md` — carrying the old title
as an alias, so anything still searching for it finds it:

```markdown
---
aliases:
  - OldName
---

This is a note `OldName.md` that is going to be renamed to `NewName.md`.
```

and `OtherNote.md`:

```markdown
This note references

1. Wikilink [[NewName|OldName]]
2. Wikilink with the same display text [[NewName|OldName]]
3. Wikilink with a custom display text [[NewName|Custom display text]]
4. Markdown link [OldName](NewName.md)
5. Markdown link with a custom display text [Custom display text](NewName.md)
```

Links **1, 2 and 4** are the ones this plugin exists for: each was displaying `OldName`, and each still
does. Links 3 and 5 already had display text you chose yourself, so they are left alone — a plain
Obsidian rename would have been correct for those two all along.
