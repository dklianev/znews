import assert from 'node:assert/strict';
import { createArticlePushHelpers } from '../server/services/articlePushHelpersService.js';

export async function runArticlePushHelpersTests() {
  const deletedIds = [];
  const sentPayloads = [];
  let subscriptions = [];

  const helpers = createArticlePushHelpers({
    PushSubscription: {
      async find() {
        return subscriptions;
      },
      async deleteOne(query) {
        deletedIds.push(query._id);
      },
    },
    webpush: {
      async sendNotification(sub, payload) {
        sentPayloads.push({ sub, payload: JSON.parse(payload) });
        if (sub.endpoint === 'gone') {
          const error = new Error('Gone');
          error.statusCode = 410;
          throw error;
        }
      },
    },
  });

  const now = new Date('2026-03-11T10:00:00.000Z');
  assert.equal(helpers.isImmediateBreakingArticle(null, now), false);
  assert.equal(helpers.isImmediateBreakingArticle({ breaking: true, status: 'draft' }, now), false);
  assert.equal(helpers.isImmediateBreakingArticle({ breaking: true, status: 'published' }, now), true);
  assert.equal(helpers.isImmediateBreakingArticle({ breaking: true, status: 'published', publishAt: 'bad-date' }, now), false);
  assert.equal(helpers.isImmediateBreakingArticle({ breaking: true, status: 'published', publishAt: '2026-03-11T09:59:59.000Z' }, now), true);
  assert.equal(helpers.isImmediateBreakingArticle({ breaking: true, status: 'published', publishAt: '2026-03-11T10:00:01.000Z' }, now), false);

  const originalPublic = process.env.VAPID_PUBLIC_KEY;
  const originalPrivate = process.env.VAPID_PRIVATE_KEY;

  try {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    subscriptions = [{ _id: 'skip', endpoint: 'skip' }];
    await helpers.sendPushNotificationForArticle({ id: 5, title: 'No env should skip' });
    assert.equal(sentPayloads.length, 0);

    process.env.VAPID_PUBLIC_KEY = 'public';
    process.env.VAPID_PRIVATE_KEY = 'private';
    subscriptions = [
      { _id: 'ok', endpoint: 'ok' },
      { _id: 'gone', endpoint: 'gone' },
    ];
    await helpers.sendPushNotificationForArticle({ id: 42, title: 'Breaking title' });

    assert.equal(sentPayloads.length, 2);
    assert.equal(sentPayloads[0].payload.url, '/article/42');
    assert.equal(sentPayloads[0].payload.body, 'Breaking title');
    assert.deepEqual(deletedIds, ['gone']);
  } finally {
    if (originalPublic === undefined) {
      delete process.env.VAPID_PUBLIC_KEY;
    } else {
      process.env.VAPID_PUBLIC_KEY = originalPublic;
    }
    if (originalPrivate === undefined) {
      delete process.env.VAPID_PRIVATE_KEY;
    } else {
      process.env.VAPID_PRIVATE_KEY = originalPrivate;
    }
  }
}
