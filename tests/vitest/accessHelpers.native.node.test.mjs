import { describe, expect, it } from 'vitest';

import { createAccessHelpers } from '../../server/services/accessHelpersService.js';

describe('accessHelpers', () => {
  it('allocates ids, resolves permissions and checks known roles', async () => {
    const permissionLookups = [];
    const roleExistChecks = [];
    const allocateCalls = [];

    const helpers = createAccessHelpers({
      Counter: { key: 'counter-model' },
      Permission: {
        findOne(query) {
          permissionLookups.push(query);
          return {
            async lean() {
              if (query.role === 'editor') {
                return { permissions: { articles: true, ads: false } };
              }
              return null;
            },
          };
        },
        async exists(query) {
          roleExistChecks.push(query);
          return query.role === 'guest-writer';
        },
      },
      allocateNumericId(Model, CounterModel, counterKey) {
        allocateCalls.push({ Model, CounterModel, counterKey });
        return Promise.resolve(99);
      },
      hasBuiltInRole(role) {
        return role === 'reporter';
      },
      normalizeText(value, maxLen = 255) {
        return String(value ?? '').trim().slice(0, maxLen);
      },
    });

    const Model = { modelName: 'Article' };
    expect(await helpers.nextNumericId(Model, 'articles')).toBe(99);
    expect(allocateCalls).toEqual([{ Model, CounterModel: { key: 'counter-model' }, counterKey: 'articles' }]);

    expect(await helpers.hasPermissionForSection(null, 'articles')).toBe(false);
    expect(await helpers.hasPermissionForSection({ role: 'admin' }, 'articles')).toBe(true);
    expect(await helpers.hasPermissionForSection({ role: 'editor' }, 'articles')).toBe(true);
    expect(await helpers.hasPermissionForSection({ role: 'editor' }, 'ads')).toBe(false);
    expect(permissionLookups).toEqual([{ role: 'editor' }]);

    helpers.invalidatePermissionRoleCache('editor');
    expect(await helpers.hasPermissionForSection({ role: 'editor' }, 'articles')).toBe(true);
    expect(permissionLookups).toEqual([{ role: 'editor' }, { role: 'editor' }]);

    expect(await helpers.isKnownRole('')).toBe(false);
    expect(await helpers.isKnownRole('admin')).toBe(true);
    expect(await helpers.isKnownRole(' reporter ')).toBe(true);
    expect(await helpers.isKnownRole('editor')).toBe(true);
    expect(await helpers.isKnownRole('unknown-role')).toBe(false);
    expect(roleExistChecks).toEqual([]);
  });
});
