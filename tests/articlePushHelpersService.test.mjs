import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createArticlePushHelpers } from '../server/services/articlePushHelpersService.js';

describe('articlePushHelpersService', () => {
  it('keeps articlePushHelpersService legacy coverage green', async () => {
      const deletedIds = [];
      const sentPayloads = [];
      let subscriptions = [];
      const findCalls = [];

      function createQuery(batch) {
        return {
          sort() {
            return this;
          },
          limit() {
            return this;
          },
          lean: async () => batch,
        };
      }
    
      const helpers = createArticlePushHelpers({
        PushSubscription: {
          find(filter, projection) {
            findCalls.push({ filter, projection });
            if (filter?._id?.$gt) {
              const index = subscriptions.findIndex((item) => item._id === filter._id.$gt);
              return createQuery(index >= 0 ? subscriptions.slice(index + 1) : []);
            }
            return createQuery(subscriptions);
          },
          async deleteOne(query) {
            deletedIds.push(query._id);
          },
        },
        webpush: {
          async sendNotification(sub, payload) {
            sentPayloads.push({ sub, payload: JSON.parse(payload) });
            if (sub.endpoint === 'gone' || sub.endpoint === 'missing') {
              const error = new Error('Gone');
              error.statusCode = sub.endpoint === 'missing' ? 404 : 410;
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
        subscriptions = [{ _id: 'skip', endpoint: 'skip', keys: { p256dh: 'skip', auth: 'skip' } }];
        await helpers.sendPushNotificationForArticle({ id: 5, title: 'No env should skip' });
        assert.equal(sentPayloads.length, 0);
    
        process.env.VAPID_PUBLIC_KEY = 'public';
        process.env.VAPID_PRIVATE_KEY = 'private';
        subscriptions = [
          { _id: 'ok', endpoint: 'ok', keys: { p256dh: 'ok', auth: 'ok' } },
          { _id: 'gone', endpoint: 'gone', keys: { p256dh: 'gone', auth: 'gone' } },
          { _id: 'missing', endpoint: 'missing', keys: { p256dh: 'missing', auth: 'missing' } },
        ];
        await helpers.sendPushNotificationForArticle({ id: 42, title: 'Breaking title' });
    
        assert.equal(sentPayloads.length, 3);
        assert.equal(sentPayloads[0].payload.url, '/article/42');
        assert.equal(sentPayloads[0].payload.body, 'Breaking title');
        assert.deepEqual(deletedIds, ['gone', 'missing']);
        assert.deepEqual(findCalls[0], {
          filter: {},
          projection: { _id: 1, endpoint: 1, keys: 1 },
        });
    
        sentPayloads.length = 0;
        subscriptions = [{ _id: 'fallback', endpoint: 'ok', keys: { p256dh: 'f', auth: 'g' } }];
        await helpers.sendPushNotificationForArticle({ id: 43 });
        assert.equal(sentPayloads[0].payload.title, 'Breaking News');
        assert.equal(sentPayloads[0].payload.body, 'New article on zNews');
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
  });
});
