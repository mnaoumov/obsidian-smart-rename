---
obsidian-dev-utils:
  demo-vault-validation:
    allow-wikilinks: These links ARE the fixture - the command acts on whichever one the cursor is in, and the point is that every link form resolves.
---
# Note with links

Put the cursor inside any link below and run **Smart Rename: Invoke on link under cursor**. The link's *target* is renamed; this note keeps its own name.

Walkthrough in [03 Rename the link target](<../../03 Rename the link target.md>).

A wikilink: [[Target note]]

A wikilink with its own display text: [[Target note|a note worth renaming]]

A markdown link: [the same note](<./Target note.md>)

An embed: ![[Target note]]

A link in frontmatter counts too - `Editor.getClickableTokenAt` reports nothing inside a frontmatter block, so a plugin built on clickable tokens could not offer the command there. This one parses the line instead, so it can.
