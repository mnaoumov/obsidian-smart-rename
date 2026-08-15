# Invalid characters

Some characters (like `:` `/` `\` `*` `?`) cannot appear in a file name. Smart Rename lets you decide what happens when your new title contains one.

## Try it

Pick which of the three behaviors to see, then start a rename and type a title containing an invalid character, such as `Chapter 1: Beginnings`:

```code-button
---
caption: Action - Error (the default)
---
await require('/demoSetup.ts').changeSettings(app, { invalidCharacterAction: 'Error' });
```

```code-button
---
caption: Action - Remove
---
await require('/demoSetup.ts').changeSettings(app, { invalidCharacterAction: 'Remove' });
```

```code-button
---
caption: Action - Replace (with `_`)
---
await require('/demoSetup.ts').changeSettings(app, { invalidCharacterAction: 'Replace', replacementCharacter: '_' });
```

Manual equivalent for all three: choose from **Invalid characters action** in **Settings -> Community plugins -> Smart Rename** (and set **Replacement character** for the third).

```code-button
---
caption: Open "Rename me" and start the rename
---
await require('/demoSetup.ts').startRename(app);
```

1. With the action chosen above, run the rename.
2. Type a title that contains an invalid character, such as `Chapter 1: Beginnings`.
3. Smart Rename either shows an error, strips the invalid character, or replaces it - matching the action you picked.

Each attempt changes the vault, so reset between runs:

```code-button
---
caption: Reset the demo notes
---
await require('/demoSetup.ts').resetDemo(app);
```

## The three actions

- **Error**
  - refuse the rename and show a notice (the default).
- **Remove**
  - strip the invalid characters from the file name.
- **Replace**
  - swap each invalid character for the configured replacement character (default `_`).

When the invalid title is stored as the note's display text (so the reader still sees `Chapter 1: Beginnings` even though the file name is sanitized) is controlled by the store-invalid-title setting. See [03 Settings](<./03 Settings.md>) for all of these keys.
