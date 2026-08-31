# Rename the link target

Everything so far renames the note you are *in*. This renames the note you are *pointing at*.

Put the cursor on a link and run **Smart Rename: Invoke on link under cursor** - the note that link points to is smart-renamed, with its backlinks rewritten and its old title kept as display text, exactly as [01 Smart rename](<./01 Smart rename.md>) describes. You never open the note being renamed.

## Try it

The button opens [Note with links](<./Materials/03 Rename the link target/Note with links.md>) and puts the cursor inside its first link:

```code-button
---
caption: Open "Note with links" with the cursor on a link
---
await require('/demoSetup.ts').openLinkDemo(app);
```

Manual equivalent: open that note and click inside the `Target note` wikilink.

Then:

1. Run **Smart Rename: Invoke on link under cursor** from the Command Palette - or right-click the link and choose **Smart rename link target**.
2. Type a new title, for example `Renamed target`, and confirm.
3. [Note with links](<./Materials/03 Rename the link target/Note with links.md>) still has its own name, but every link in it now points at `Renamed target` while still reading `Target note`.

```code-button
---
caption: Reset the demo notes
---
await require('/demoSetup.ts').resetLinkDemo(app);
```

Manual equivalent: rename the target back and undo the link rewrites.

## Which links it works on

- **Wikilinks**
  - with or without display text, and with a `#heading` subpath.
- **Markdown links**
  - including angle-bracketed and URL-encoded paths.
- **Embeds**
  - the cursor may sit anywhere in `![[Target note]]`, the `!` included.
- **Frontmatter links**
  - Obsidian decorates no link inside a frontmatter block, so a plugin that asked Obsidian for the clickable token under the cursor could not offer this there. The line is parsed instead, so it can.
- **Attachments and other non-markdown files**
  - only when the support-non-markdown-files setting is on, exactly as for the active-note command. See [04 Settings](<./04 Settings.md>).

The command is offered only when the cursor is actually on a link to a file that exists - so it stays out of the Command Palette and the right-click menu everywhere else, including on external links.
