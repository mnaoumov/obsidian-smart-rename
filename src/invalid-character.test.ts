import {
  describe,
  expect,
  it
} from 'vitest';

import { hasInvalidCharacters } from './invalid-character.ts';

describe('hasInvalidCharacters', () => {
  it('should return true when the string contains an invalid path character', () => {
    expect(hasInvalidCharacters('foo/bar')).toBe(true);
  });

  it('should return false when the string contains no invalid path characters', () => {
    expect(hasInvalidCharacters('valid-name')).toBe(false);
  });
});
