import { getOsAndObsidianUnsafePathCharsRegExp } from '@mnaoumov/obsidian-lib/validation';

export function hasInvalidCharacters($string: string): boolean {
  return getOsAndObsidianUnsafePathCharsRegExp().test($string);
}
