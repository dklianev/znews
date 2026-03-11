import assert from 'node:assert/strict';
import { createSearchCollectionHelpers } from '../server/services/searchCollectionHelpersService.js';

export async function runSearchCollectionHelpersTests() {
  const queries = [];
  const datasets = {
    text: [{ _id: 'a', __v: 0, id: 2, title: 'Text hit' }],
    regex: [{ _id: 'b', __v: 0, id: 2, title: 'Text hit' }, { _id: 'c', __v: 0, id: 1, title: 'Regex hit' }],
  };

  const Model = {
    find(filter) {
      const kind = filter.$text ? 'text' : 'regex';
      queries.push({ kind, filter });
      return {
        sort() { return this; },
        limit() { return this; },
        select() { return this; },
        lean() { return Promise.resolve(datasets[kind]); },
      };
    },
  };

  const helpers = createSearchCollectionHelpers({
    stripDocumentList(items) {
      return items.map((item) => {
        const next = { ...item };
        delete next._id;
        delete next.__v;
        return next;
      });
    },
  });

  assert.equal(helpers.isTextSearchUnavailableError({ code: 27 }), true);
  assert.equal(helpers.isTextSearchUnavailableError({ message: 'text index required for $text query' }), true);
  assert.equal(helpers.isTextSearchUnavailableError({ message: 'boom' }), false);

  const merged = await helpers.searchCollectionByTextAndRegex(Model, {
    textSearch: 'query',
    regexFilter: { title: /query/i },
    limit: 3,
    projection: { _id: 0, __v: 0 },
  });
  assert.deepEqual(merged, [
    { id: 2, title: 'Text hit' },
    { id: 1, title: 'Regex hit' },
  ]);
  assert.equal(queries.length, 2);

  const unavailableModel = {
    find(filter) {
      const kind = filter.$text ? 'text' : 'regex';
      return {
        sort() { return this; },
        limit() { return this; },
        select() { return this; },
        lean() {
          if (kind === 'text') return Promise.reject({ code: 27 });
          return Promise.resolve([{ _id: 'd', __v: 0, id: 5, title: 'Fallback only' }]);
        },
      };
    },
  };

  const fallbackOnly = await helpers.searchCollectionByTextAndRegex(unavailableModel, {
    textSearch: 'query',
    regexFilter: { title: /query/i },
    limit: 2,
    projection: { _id: 0, __v: 0 },
  });
  assert.deepEqual(fallbackOnly, [{ id: 5, title: 'Fallback only' }]);
}
