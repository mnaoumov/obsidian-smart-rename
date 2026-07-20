[Docs](https://github.com/mnaoumov/obsidian-smart-rename/)

# Invalid characters

Some characters (like `:` `/` `\` `*` `?`) cannot appear in a file name. Smart Rename lets you decide what happens when your new title contains one.

## Try it

1. Open [[Rename me]] and run **Smart Rename: Invoke**.
2. Type a title that contains an invalid character, such as `Chapter 1: Beginnings`.
3. Depending on the **Invalid characters action** setting, Smart Rename will either show an error, remove the invalid character, or replace it.

## The three actions

- **Error** - refuse the rename and show a notice (the default).
- **Remove** - strip the invalid characters from the file name.
- **Replace** - swap each invalid character for the configured replacement character (default `_`).

When the invalid title is stored as the note's display text (so the reader still sees `Chapter 1: Beginnings` even though the file name is sanitized) is controlled by the store-invalid-title setting. See [[03 Settings]] for all of these keys.
