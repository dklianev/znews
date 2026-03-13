export function createArticlePushHelpers({
  PushSubscription,
  webpush,
}) {
  const PUSH_ICON_PATH = '/icon-192.png';

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
      const subscriptions = await PushSubscription.find({});
      const pushPromises = subscriptions.map((subscription) => sendPushToSubscription(subscription, payload));
      await Promise.allSettled(pushPromises);
      console.log(`Sent push notification to ${subscriptions.length} devices.`);
    } catch (error) {
      console.error('Failed to trigger push notifications:', error);
    }
  }

  return {
    isImmediateBreakingArticle,
    sendPushNotificationForArticle,
  };
}
