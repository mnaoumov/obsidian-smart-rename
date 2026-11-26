/**
 * The frontmatter key `Update title key` writes when the `Title key` setting is left empty.
 */
export const DEFAULT_TITLE_KEY = 'title';

/**
 * The frontmatter key the `Update title key` step writes.
 *
 * An empty or blank setting falls back to {@link DEFAULT_TITLE_KEY}, as `Update Title on Rename` (MIT) does for its
 * `Title property name` setting, see `THIRD-PARTY-NOTICES.md`. Surrounding whitespace is dropped, because a YAML key
 * typed with a stray space would otherwise write a second, near-identical property.
 *
 * @param titleKey - The `Title key` setting as stored.
 * @returns The key to write.
 */
export function resolveTitleKey(titleKey: string): string {
  return titleKey.trim() || DEFAULT_TITLE_KEY;
}
