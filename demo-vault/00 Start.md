Welcome to the [Smart Rename](https://github.com/mnaoumov/obsidian-smart-rename/) demo vault. When you rename a note, Obsidian normally rewrites every link to point at the new name - and the visible text changes with it. **Smart Rename** instead preserves the old title as the link's display text, so your notes keep reading the way you wrote them. It also handles invalid characters, the first header, and a frontmatter title key.

**How to try it:** open [[Rename me]], run **Smart Rename: Invoke** from the Command Palette (or right-click the note and choose the smart rename option), and type a new title. Then look at [[References/Note A]] and [[References/Note B]] - the links still show the old title.

> [!TIP] Interactive buttons
>
> The two setup notes have **Run** buttons, powered by [`CodeScript Toolkit`](https://github.com/mnaoumov/obsidian-codescript-toolkit/), which this vault installs for you automatically on first open (see [[05 CodeScript Toolkit prerequisite]]). Renaming itself is a manual command, so the feature notes have no buttons.

## Feature

- [[01 Smart rename]]
- [[02 Invalid characters]]
- [[03 Settings]]

## Setup

- [[04 Code buttons check]]
- [[05 CodeScript Toolkit prerequisite]]
