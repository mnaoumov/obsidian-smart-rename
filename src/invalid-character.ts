import { getOsAndObsidianUnsafePathCharsRegExp } from 'obsidian-dev-utils/obsidian/validation';

export function hasInvalidCharacters(str: string): boolean {
  return getOsAndObsidianUnsafePathCharsRegExp().test(str);
}
