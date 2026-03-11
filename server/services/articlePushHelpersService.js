export function createArticlePushHelpers({
  PushSubscription,
  webpush,
}) {
  function isImmediateBreakingArticle(article, now = new Date()) {
    if (!article || !article.breaking || article.status !== 'published') return false;
    if (!article.publishAt) return true;
    const publishAtTs = new Date(article.publishAt).getTime();
    if (Number.isNaN(publishAtTs)) return false;
    return publishAtTs <= now.getTime();
  }
  
  async function sendPushNotificationForArticle(article) {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
    try {
      const payload = JSON.stringify({
        title: '🚨 ИЗВЪНРЕДНО',
        body: article.title || 'Гореща новина от zNews',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        url: `/article/${article.id}`
      });
  
      const subscriptions = await PushSubscription.find({});
      const pushPromises = subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, payload);
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await PushSubscription.deleteOne({ _id: sub._id });
          }
        }
      });
      await Promise.allSettled(pushPromises);
      console.log(`Sent push notification to ${subscriptions.length} devices.`);
    } catch (e) {
      console.error('Failed to trigger push notifications:', e);
    }
  }

  return {
    isImmediateBreakingArticle,
    sendPushNotificationForArticle,
  };
}
