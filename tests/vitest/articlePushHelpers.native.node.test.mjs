import { describe, expect, it } from 'vitest';

import { createArticlePushHelpers } from '../../server/services/articlePushHelpersService.js';

describe('article push helpers', () => {
  it('detects immediate breaking articles correctly', () => {
    const helpers = createArticlePushHelpers({
      PushSubscription: {
        async find() {
          return [];
        },
        async deleteOne() {},
      },
      webpush: {
        async sendNotification() {},
      },
    });

    const now = new Date('2026-03-11T10:00:00.000Z');
    expect(helpers.isImmediateBreakingArticle(null, now)).toBe(false);
    expect(helpers.isImmediateBreakingArticle({ breaking: true, status: 'draft' }, now)).toBe(false);
    expect(helpers.isImmediateBreakingArticle({ breaking: true, status: 'published' }, now)).toBe(true);
    expect(helpers.isImmediateBreakingArticle({ breaking: true, status: 'published', publishAt: 'bad-date' }, now)).toBe(false);
    expect(helpers.isImmediateBreakingArticle({ breaking: true, status: 'published', publishAt: '2026-03-11T09:59:59.000Z' }, now)).toBe(true);
    expect(helpers.isImmediateBreakingArticle({ breaking: true, status: 'published', publishAt: '2026-03-11T10:00:01.000Z' }, now)).toBe(false);
  });

  it('skips when vapid env is missing and removes gone subscriptions after send attempts', async () => {
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
          if (sub.endpoint === 'gone' || sub.endpoint === 'missing') {
            const error = new Error('Gone');
            error.statusCode = sub.endpoint === 'missing' ? 404 : 410;
            throw error;
          }
        },
      },
    });

    const originalPublic = process.env.VAPID_PUBLIC_KEY;
    const originalPrivate = process.env.VAPID_PRIVATE_KEY;

    try {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      subscriptions = [{ _id: 'skip', endpoint: 'skip' }];
      await helpers.sendPushNotificationForArticle({ id: 5, title: 'No env should skip' });
      expect(sentPayloads).toHaveLength(0);

      process.env.VAPID_PUBLIC_KEY = 'public';
      process.env.VAPID_PRIVATE_KEY = 'private';
      subscriptions = [
        { _id: 'ok', endpoint: 'ok' },
        { _id: 'gone', endpoint: 'gone' },
        { _id: 'missing', endpoint: 'missing' },
      ];
      await helpers.sendPushNotificationForArticle({ id: 42, title: 'Breaking title' });

      expect(sentPayloads).toHaveLength(3);
      expect(sentPayloads[0].payload.url).toBe('/article/42');
      expect(sentPayloads[0].payload.body).toBe('Breaking title');
      expect(deletedIds).toEqual(['gone', 'missing']);

      sentPayloads.length = 0;
      subscriptions = [{ _id: 'fallback', endpoint: 'ok' }];
      await helpers.sendPushNotificationForArticle({ id: 43 });
      expect(sentPayloads[0].payload.title).toBe('Breaking News');
      expect(sentPayloads[0].payload.body).toBe('New article on zNews');
    } finally {
      if (originalPublic === undefined) delete process.env.VAPID_PUBLIC_KEY;
      else process.env.VAPID_PUBLIC_KEY = originalPublic;
      if (originalPrivate === undefined) delete process.env.VAPID_PRIVATE_KEY;
      else process.env.VAPID_PRIVATE_KEY = originalPrivate;
    }
  });
});
