import assert from 'node:assert/strict';
import { createGamesCatalogService } from '../server/services/gamesCatalogService.js';

export async function runGamesCatalogServiceTests() {
  const calls = [];
  const helpers = createGamesCatalogService({
    GameDefinition: {
      find(query) {
        calls.push({ step: 'find', query });
        return {
          sort(sortValue) {
            calls.push({ step: 'sort', sortValue });
            return {
              async lean() {
                return [
                  { _id: 'one', __v: 0, slug: 'spelling-bee', active: true, sortOrder: 1 },
                  { _id: 'two', __v: 3, slug: 'crossword', active: true, sortOrder: 2 },
                ];
              },
            };
          },
        };
      },
    },
    stripDocumentMetadata(item) {
      return { ...item, _id: undefined, __v: undefined, stripped: true };
    },
  });

  const games = await helpers.listPublicGames();
  assert.deepEqual(calls, [
    { step: 'find', query: { active: true } },
    { step: 'sort', sortValue: 'sortOrder' },
  ]);
  assert.deepEqual(games, [
    { _id: undefined, __v: undefined, slug: 'spelling-bee', active: true, sortOrder: 1, stripped: true },
    { _id: undefined, __v: undefined, slug: 'crossword', active: true, sortOrder: 2, stripped: true },
  ]);
}
