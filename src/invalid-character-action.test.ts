import {
  describe,
  expect,
  it
} from 'vitest';

import { InvalidCharacterAction } from './invalid-character-action.ts';

describe('InvalidCharacterAction', () => {
  it('should have Error value equal to "Error"', () => {
    expect(InvalidCharacterAction.Error).toBe('Error');
  });

  it('should have Remove value equal to "Remove"', () => {
    expect(InvalidCharacterAction.Remove).toBe('Remove');
  });

  it('should have Replace value equal to "Replace"', () => {
    expect(InvalidCharacterAction.Replace).toBe('Replace');
  });

  it('should have exactly three members', () => {
    const EXPECTED_MEMBER_COUNT = 3;
    const values = Object.values(InvalidCharacterAction);
    expect(values).toHaveLength(EXPECTED_MEMBER_COUNT);
  });
});
