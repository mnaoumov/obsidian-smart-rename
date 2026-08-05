import { getOsAndObsidianUnsafePathCharsRegExp } from 'obsidian-dev-utils/obsidian/validation';

export function hasInvalidCharacters($string: string): boolean {
  return getOsAndObsidianUnsafePathCharsRegExp().test($string);
}
