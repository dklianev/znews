export function createArticlePushHelpers({
  PushSubscription,
  webpush,
}) {
  const PUSH_ICON_PATH = '/icon-192.png';
  const PUSH_SUBSCRIPTION_BATCH_SIZE = 500;

  function hasVapidKeys() {
    return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  }

  function buildArticlePushPayload(article) {
    return JSON.stringify({
      title: 'Breaking News',
      body: article.title || 'New article on zNews',
      icon: PUSH_ICON_PATH,
      badge: PUSH_ICON_PATH,
      url: `/article/${article.id}`,
    });
  }

  async function removeStaleSubscription(subscription, error) {
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      await PushSubscription.deleteOne({ _id: subscription._id });
    }
  }

  async function sendPushToSubscription(subscription, payload) {
    try {
      await webpush.sendNotification(subscription, payload);
    } catch (error) {
      await removeStaleSubscription(subscription, error);
    }
  }

  async function loadSubscriptionBatch(lastId = null) {
    const filter = lastId ? { _id: { $gt: lastId } } : {};
    let query = PushSubscription.find(filter, { _id: 1, endpoint: 1, keys: 1 });
    if (typeof query.sort === 'function') query = query.sort({ _id: 1 });
    if (typeof query.limit === 'function') query = query.limit(PUSH_SUBSCRIPTION_BATCH_SIZE);
    if (typeof query.lean === 'function') query = query.lean();
    const batch = await query;
    return Array.isArray(batch) ? batch : [];
  }

  function isImmediateBreakingArticle(article, now = new Date()) {
    if (!article || !article.breaking || article.status !== 'published') return false;
    if (!article.publishAt) return true;

    const publishAtTs = new Date(article.publishAt).getTime();
    if (Number.isNaN(publishAtTs)) return false;

    return publishAtTs <= now.getTime();
  }

  async function sendPushNotificationForArticle(article) {
    if (!hasVapidKeys()) return;

    try {
      const payload = buildArticlePushPayload(article);
      let lastId = null;
      let totalSubscriptions = 0;

      while (true) {
        const subscriptions = await loadSubscriptionBatch(lastId);
        if (subscriptions.length === 0) break;

        totalSubscriptions += subscriptions.length;
        await Promise.allSettled(subscriptions.map((subscription) => sendPushToSubscription(subscription, payload)));
        lastId = subscriptions[subscriptions.length - 1]?._id || null;
        if (!lastId) break;
      }

      console.log(`Sent push notification to ${totalSubscriptions} devices.`);
    } catch (error) {
      console.error('Failed to trigger push notifications:', error);
    }
  }

  return {
    isImmediateBreakingArticle,
    sendPushNotificationForArticle,
  };
}
