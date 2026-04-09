import { describe, expect, it } from 'vitest';

import { buildAdminSearchParams } from '../../src/utils/adminSearchParams.js';

describe('adminSearchParams', () => {
  it('preserves spaces inside URL-synced search queries', () => {
    const params = buildAdminSearchParams(new URLSearchParams(), { q: 'los santos' });
    expect(params.get('q')).toBe('los santos');
  });

  it('preserves trailing spaces while the user is typing', () => {
    const params = buildAdminSearchParams(new URLSearchParams(), { q: 'los ' });
    expect(params.get('q')).toBe('los ');
  });

  it('still removes blank values and exact all filters', () => {
    const params = buildAdminSearchParams(
      new URLSearchParams('q=test&status=active'),
      { q: '   ', status: 'all' },
    );
    expect(params.get('q')).toBeNull();
    expect(params.get('status')).toBeNull();
  });
});
