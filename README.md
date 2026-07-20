# Smart Rename

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/mnaoumov)
[![GitHub release](https://img.shields.io/github/v/release/mnaoumov/obsidian-smart-rename)](https://github.com/mnaoumov/obsidian-smart-rename/releases)
[![GitHub downloads](https://img.shields.io/github/downloads/mnaoumov/obsidian-smart-rename/total)](https://github.com/mnaoumov/obsidian-smart-rename/releases)
[![Coverage: 100%](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/mnaoumov/obsidian-smart-rename)

This is a plugin for [Obsidian](https://obsidian.md/) that adds the command `Smart Rename` which performs the following steps after renaming the note:

1. Adds the previous title as an alias to the renamed note
2. Preserves the backlinks to the renamed note that were using previous title as a display text.

## Demo vault

A demo vault with usage examples ships with every release. You can access it via any of the following:

1. Running the **Smart Rename: Open demo vault** command.
2. Downloading `smart-rename.demo-vault.zip` from the [Releases](https://github.com/mnaoumov/obsidian-smart-rename/releases).
3. Browsing its source in [`demo-vault/`](./demo-vault/README.md) in this repository.

## Detailed explanation

### Step 1

You have

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

### Step 2

You invoke current plugin providing `NewName` as a new title

### Step 3

Now you have

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

The plugin is available in [the official Community Plugins repository](https://community.obsidian.md/plugins/smart-rename).

### Beta versions

To install the latest beta release of this plugin (regardless if it is available in [the official Community Plugins repository](https://community.obsidian.md) or not), follow these steps:

1. Ensure you have the [BRAT plugin](https://community.obsidian.md/plugins/obsidian42-brat) installed and enabled.
2. Click [Install via BRAT](https://intradeus.github.io/http-protocol-redirector?r=obsidian://brat?plugin=https://github.com/mnaoumov/obsidian-smart-rename).
3. An Obsidian pop-up window should appear. In the window, click the `Add plugin` button once and wait a few seconds for the plugin to install.

## Debugging

By default, debug messages for this plugin are hidden.

To show them, run the following command:

```js
window.DEBUG.enable('smart-rename');
```

For more details, refer to the [documentation](https://mnaoumov.dev/obsidian-dev-utils/guides/debugging/).

## Support

<!-- markdownlint-disable MD033 -->

<a href="https://www.buymeacoffee.com/mnaoumov" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60" width="217"></a>

<!-- markdownlint-enable MD033 -->

## My other Obsidian resources

[See my other Obsidian resources](https://github.com/mnaoumov/obsidian-resources).

## License

© [Michael Naumov](https://github.com/mnaoumov/)
