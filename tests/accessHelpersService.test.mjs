import assert from 'node:assert/strict';
import { createAccessHelpers } from '../server/services/accessHelpersService.js';

export async function runAccessHelpersTests() {
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
  assert.equal(await helpers.nextNumericId(Model, 'articles'), 99);
  assert.deepEqual(allocateCalls, [{ Model, CounterModel: { key: 'counter-model' }, counterKey: 'articles' }]);

  assert.equal(await helpers.hasPermissionForSection(null, 'articles'), false);
  assert.equal(await helpers.hasPermissionForSection({ role: 'admin' }, 'articles'), true);
  assert.equal(await helpers.hasPermissionForSection({ role: 'editor' }, 'articles'), true);
  assert.equal(await helpers.hasPermissionForSection({ role: 'editor' }, 'ads'), false);
  assert.deepEqual(permissionLookups, [{ role: 'editor' }, { role: 'editor' }]);

  assert.equal(await helpers.isKnownRole(''), false);
  assert.equal(await helpers.isKnownRole('admin'), true);
  assert.equal(await helpers.isKnownRole(' reporter '), true);
  assert.equal(await helpers.isKnownRole('guest-writer'), true);
  assert.equal(await helpers.isKnownRole('unknown-role'), false);
  assert.deepEqual(roleExistChecks, [{ role: 'guest-writer' }, { role: 'unknown-role' }]);
}
