# Smart Rename

This is a plugin for [Obsidian](https://obsidian.md/) that adds the command `Smart Rename` which performs the following steps after renaming the note:

1. Adds the previous title as an alias to the renamed note
2. Preserves the backlinks to the renamed note that were using previous title as a display text.

## Detailed explanation

1. You have

`OldName.md`:

```markdown
This is a note `OldName.md` that is going to be renamed to `NewName.md`.
```

`OtherNote.md`:

```markdown
This note references

1. Wikilink [[OldName]]
2. Wikilink with the same display text [[OldName|OldName]]
3. Wikilink with a custom display text [[OldName|Custom display text]]
4. Markdown link [OldName](OldName.md)
5. Markdown link with a custom display text [Custom display text](OldName.md)
```

2. You invoke current plugin providing `NewName` as a new title

3. Now you have

`NewName.md`:

```markdown
---
aliases:
  - OldName
---

This is a note `OldName.md` that is going to be renamed to `NewName.md`.
```

`OtherNote.md`:

```markdown
This note references

1. Wikilink [[NewName|OldName]]
2. Wikilink with the same display text [[NewName|OldName]]
3. Wikilink with a custom display text [[NewName|Custom display text]]
4. Markdown link [OldName](NewName.md)
5. Markdown link with a custom display text [Custom display text](NewName.md)
```

Current plugin's aim is to preserve `OldName` display text in links 1, 2, 4

## Installation

- `Smart Rename` is available on [the official Community Plugins repository](https://obsidian.md/plugins?id=smart-rename).
- Beta releases can be installed through [BRAT](https://github.com/TfTHacker/obsidian42-brat)

## Support

<a href="https://www.buymeacoffee.com/mnaoumov" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;"></a>

## License

© [Michael Naumov](https://github.com/mnaoumov/)
