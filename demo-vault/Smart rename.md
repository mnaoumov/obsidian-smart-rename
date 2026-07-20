[Docs](https://github.com/mnaoumov/obsidian-smart-rename/)

# Smart rename

Smart Rename renames the **active note** and rewrites its backlinks so their **display text keeps showing the old title**. A plain rename would change the visible link text to the new name; Smart Rename turns `[[Old title]]` into `[[New title|Old title]]` so the reader still sees what you originally wrote.

## Try it

1. Open [[Rename me]] (the note this demo renames).
2. Run **Smart Rename: Invoke** from the Command Palette, or right-click the note in the file explorer and choose the smart rename option.
3. Type a new title - for example `Renamed note` - and confirm.
4. Open [[References/Note A]] and [[References/Note B]]. Their links now point at the new note, but still **display** the old title.

## What it preserves

- **Note links** - a bare `[[Rename me]]` becomes `[[Renamed note|Rename me]]`, keeping the old text visible (controlled by the note-links setting in [[Settings]]).
- **Frontmatter links** - links inside YAML frontmatter get the same treatment (controlled by the frontmatter-links setting).
- **The first header and a title key** - optionally kept in sync with the new name (see [[Settings]]).

Renaming to a title that contains characters Obsidian cannot use in a filename is handled separately - see [[Invalid characters]].
