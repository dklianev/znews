import assert from 'node:assert/strict';
import { createCommentsHelpers } from '../server/services/commentsHelpersService.js';

export async function runCommentsHelpersTests() {
  const findCalls = [];
  const updateCalls = [];

  const treeByParent = new Map([
    ['1', [{ id: 2 }, { id: 3 }]],
    ['2,3', [{ id: 4 }, { id: 2 }, { id: 'oops' }]],
    ['4', []],
  ]);

  const helpers = createCommentsHelpers({
    blockedCommentTerms: ['http://', 'spam'],
    normalizeText(value, maxLen = 255) {
      return typeof value === 'string' ? value.slice(0, maxLen) : String(value ?? '').slice(0, maxLen);
    },
    Comment: {
      findOneAndUpdate(filter, update, options) {
        updateCalls.push({ filter, update, options });
        return { toJSON: () => ({ id: filter.id, ...update.$set }) };
      },
      find(filter) {
        findCalls.push(filter);
        const key = filter.parentId.$in.join(',');
        return {
          select() {
            return this;
          },
          lean() {
            return Promise.resolve(treeByParent.get(key) || []);
          },
        };
      },
    },
    CommentReaction: {
      countDocuments(filter) {
        return Promise.resolve(filter.value === 'like' ? 5 : 2);
      },
    },
  });

  assert.equal(helpers.commentContainsBlockedTerms('Visit HTTP://example.com now'), true);
  assert.equal(helpers.commentContainsBlockedTerms('clean text only'), false);
  assert.equal(helpers.normalizeCommentReaction('LIKE'), 'like');
  assert.equal(helpers.normalizeCommentReaction('clear'), null);

  const updated = await helpers.syncCommentReactionTotals(17);
  assert.deepEqual(updateCalls, [{
    filter: { id: 17 },
    update: { $set: { likes: 5, dislikes: 2 } },
    options: { new: true },
  }]);
  assert.deepEqual(updated.toJSON(), { id: 17, likes: 5, dislikes: 2 });

  const threadIds = await helpers.collectCommentThreadIds(1);
  assert.deepEqual(threadIds, [1, 2, 3, 4]);
  assert.deepEqual(findCalls, [
    { parentId: { $in: [1] } },
    { parentId: { $in: [2, 3] } },
    { parentId: { $in: [4] } },
  ]);
  assert.deepEqual(await helpers.collectCommentThreadIds('bad'), []);
}
