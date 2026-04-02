import { describe, expect, it } from 'vitest';

import { createFramePolicyHelpers } from '../../server/services/framePolicyService.js';

describe('frame policy service', () => {
  it('uses the default public ancestors and protects admin/api paths', () => {
    const helpers = createFramePolicyHelpers();

    expect(helpers.publicFrameAncestors).toEqual(["'self'", 'http:', 'https:', 'nui:']);
    expect(helpers.isProtectedFramePath('/')).toBe(false);
    expect(helpers.isProtectedFramePath('/category/crime')).toBe(false);
    expect(helpers.isProtectedFramePath('/admin')).toBe(true);
    expect(helpers.isProtectedFramePath('/admin/login')).toBe(true);
    expect(helpers.isProtectedFramePath('/api/search')).toBe(true);
    expect(helpers.getFrameAncestorsForPath('/')).toEqual(["'self'", 'http:', 'https:', 'nui:']);
    expect(helpers.getFrameAncestorsForPath('/admin/login')).toEqual(["'none'"]);
    expect(helpers.getFrameAncestorsDirectiveValue('/games')).toBe("'self' http: https: nui:");
    expect(helpers.getFrameAncestorsDirectiveValue('/api/bootstrap')).toBe("'none'");
  });

  it('normalizes custom frame ancestor lists', () => {
    const helpers = createFramePolicyHelpers({
      publicFrameAncestors: 'self, https://discord.com, https://example.com',
    });

    expect(helpers.publicFrameAncestors).toEqual(["'self'", 'https://discord.com', 'https://example.com']);
    expect(helpers.getFrameAncestorsDirectiveValue('/article/12')).toBe("'self' https://discord.com https://example.com");
  });

  it('honors explicit none in custom frame ancestors', () => {
    const helpers = createFramePolicyHelpers({
      publicFrameAncestors: "'none', https://example.com",
    });

    expect(helpers.publicFrameAncestors).toEqual(["'none'"]);
    expect(helpers.getFrameAncestorsDirectiveValue('/')).toBe("'none'");
  });
});
