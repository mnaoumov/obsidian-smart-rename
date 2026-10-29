# Rename intent

Renaming a note through Obsidian itself - its inline title, the file explorer, F2, or **Rename...** in a menu - asks what the rename is meant to do:

1. **Rename and sync to title/H1** - the default, picked by Enter. The note's frontmatter `title` and its first H1 become the new name.
2. **Rename and store previous name/title/H1** - as 1, and the previous name is kept: as an alias, and as the display text of the links that showed it, which is what [01 Smart rename](<./01 Smart rename.md>) does.
3. **Rename only** - the file name changes and nothing else, for a file name you only want to shorten or adjust.

Renames made by other plugins, by sync or by scripts never ask, and behave as **Rename only**. So do renames of anything that is not a markdown note.

When the new name has characters a file name cannot hold, they are handled as [02 Invalid characters](<./02 Invalid characters.md>) describes, and the `title` keeps the name exactly as you typed it.

## Try it

The button opens [Rename me](<./Materials/01 Smart rename/Rename me.md>) and starts Obsidian's own rename on it, as F2 does:

```code-button
---
caption: Rename "Rename me" through Obsidian
---
await require('/demoSetup.ts').startIntentRename(app);
```

Manual equivalent: open that note and press F2, or click its inline title.

Then:

1. Type a new title, for example `Renamed note`, and press Enter.
2. The rename intent dialog opens with **Rename and sync to title/H1** preselected. Press Enter, or pick another choice.
3. Look at [References/Note A](<./Materials/01 Smart rename/References/Note A.md>): with the first or third choice its links follow the new name, and with the second they still read `Rename me`.

```code-button
---
caption: Reset the demo notes
---
await require('/demoSetup.ts').resetDemo(app);
```

## Save last used choice

The dialog's **Save last used choice** checkbox, off by default, makes the next dialog preselect the choice made this time instead of the default. The checkbox remembers its own state, so it stays on until you untick it. It is also in [04 Settings](<./04 Settings.md>).

## Mobile

The same dialog opens on mobile: the inline title, the file explorer and the rename dialog all go through it.
