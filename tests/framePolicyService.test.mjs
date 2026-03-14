import assert from 'node:assert/strict';
import { createFramePolicyHelpers } from '../server/services/framePolicyService.js';

export async function runFramePolicyServiceTests() {
  {
    const helpers = createFramePolicyHelpers();
    assert.deepEqual(helpers.publicFrameAncestors, ["'self'", 'http:', 'https:', 'nui:']);
    assert.equal(helpers.isProtectedFramePath('/'), false);
    assert.equal(helpers.isProtectedFramePath('/category/crime'), false);
    assert.equal(helpers.isProtectedFramePath('/admin'), true);
    assert.equal(helpers.isProtectedFramePath('/admin/login'), true);
    assert.equal(helpers.isProtectedFramePath('/api/search'), true);
    assert.deepEqual(helpers.getFrameAncestorsForPath('/'), ["'self'", 'http:', 'https:', 'nui:']);
    assert.deepEqual(helpers.getFrameAncestorsForPath('/admin/login'), ["'none'"]);
    assert.equal(helpers.getFrameAncestorsDirectiveValue('/games'), "'self' http: https: nui:");
    assert.equal(helpers.getFrameAncestorsDirectiveValue('/api/bootstrap'), "'none'");
  }

  {
    const helpers = createFramePolicyHelpers({
      publicFrameAncestors: 'self, https://discord.com, https://example.com',
    });
    assert.deepEqual(helpers.publicFrameAncestors, ["'self'", 'https://discord.com', 'https://example.com']);
    assert.equal(
      helpers.getFrameAncestorsDirectiveValue('/article/12'),
      "'self' https://discord.com https://example.com"
    );
  }

  {
    const helpers = createFramePolicyHelpers({
      publicFrameAncestors: "'none', https://example.com",
    });
    assert.deepEqual(helpers.publicFrameAncestors, ["'none'"]);
    assert.equal(helpers.getFrameAncestorsDirectiveValue('/'), "'none'");
  }
}
