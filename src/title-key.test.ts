import {
  describe,
  expect,
  it
} from 'vitest';

import {
  DEFAULT_TITLE_KEY,
  resolveTitleKey
} from './title-key.ts';

describe('resolveTitleKey', () => {
  it('should default to title', () => {
    expect(DEFAULT_TITLE_KEY).toBe('title');
  });

  it.each([
    ['name', 'name'],
    [' heading ', 'heading'],
    ['', 'title'],
    ['  ', 'title']
  ])('should resolve %j to %j', (titleKey, expected) => {
    expect(resolveTitleKey(titleKey)).toBe(expected);
  });
});
