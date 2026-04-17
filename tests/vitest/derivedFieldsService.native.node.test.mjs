import { describe, expect, it } from 'vitest';

import {
  deriveArticlePublishAtDate,
  normalizeClassifiedPriceValue,
  normalizeSearchField,
  normalizeSearchList,
  normalizeUsernameLower,
} from '../../server/services/derivedFieldsService.js';

describe('derivedFieldsService', () => {
  it('normalizes search fields and lists consistently', () => {
    expect(normalizeSearchField('  ШОК   НОВИНА  ', 32)).toBe('шок новина');
    expect(normalizeSearchField(null)).toBe('');
    expect(normalizeSearchList(['  Шок ', 'шок', '  НОВИНА  ', '', null], 16, 5)).toEqual(['шок', 'новина']);
  });

  it('derives article publish dates from publishAt and date fallbacks', () => {
    expect(deriveArticlePublishAtDate({ publishAt: '2026-04-17T13:22:00.000Z' })?.toISOString()).toBe('2026-04-17T13:22:00.000Z');
    expect(deriveArticlePublishAtDate({ date: '2026-04-17' })?.toISOString()).toBe('2026-04-17T00:00:00.000Z');
    expect(deriveArticlePublishAtDate({ date: 'invalid' })).toBeNull();
  });

  it('normalizes usernames and classified numeric shadow values', () => {
    expect(normalizeUsernameLower('  Admin.User  ')).toBe('admin.user');
    expect(normalizeUsernameLower('')).toBe('');
    expect(normalizeClassifiedPriceValue('12 500 $')).toBe(12500);
    expect(normalizeClassifiedPriceValue('без цена')).toBeNull();
  });
});
