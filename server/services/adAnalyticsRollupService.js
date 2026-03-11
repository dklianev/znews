export function createAdAnalyticsRollupService(deps) {
  const {
    AdAnalyticsAggregate,
    AdEvent,
    adAnalyticsRollupDays,
    adEventTypes,
  } = deps;

  function toBucketDate(date) {
    return new Date(date).toISOString().slice(0, 10);
  }

  async function aggregateAdAnalyticsJob() {
    const cutoff = new Date(Date.now() - (adAnalyticsRollupDays * 24 * 60 * 60 * 1000));
    const cutoffBucketDate = toBucketDate(cutoff);
    const rows = await AdEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: cutoff },
          eventType: { $in: adEventTypes },
        },
      },
      {
        $group: {
          _id: {
            bucketDate: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            adId: '$adId',
            slot: '$slot',
            pageType: '$pageType',
            articleId: { $ifNull: ['$articleId', null] },
            categoryId: { $ifNull: ['$categoryId', ''] },
            eventType: '$eventType',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const buckets = new Map();
    rows.forEach((row) => {
      const bucketKey = JSON.stringify({
        bucketDate: row?._id?.bucketDate || '',
        adId: row?._id?.adId || 0,
        slot: row?._id?.slot || '',
        pageType: row?._id?.pageType || '',
        articleId: row?._id?.articleId ?? null,
        categoryId: row?._id?.categoryId || '',
      });
      const current = buckets.get(bucketKey) || {
        bucketDate: row?._id?.bucketDate || '',
        adId: Number.parseInt(row?._id?.adId, 10) || 0,
        slot: String(row?._id?.slot || ''),
        pageType: String(row?._id?.pageType || ''),
        articleId: Number.isInteger(Number(row?._id?.articleId)) ? Number(row._id.articleId) : null,
        categoryId: String(row?._id?.categoryId || ''),
        impressions: 0,
        clicks: 0,
      };
      if (row?._id?.eventType === 'impression') current.impressions = Number(row.count) || 0;
      if (row?._id?.eventType === 'click') current.clicks = Number(row.count) || 0;
      buckets.set(bucketKey, current);
    });

    const aggregateItems = [...buckets.values()].map((item) => ({
      ...item,
      ctr: item.impressions > 0 ? Number(((item.clicks / item.impressions) * 100).toFixed(2)) : 0,
      aggregatedAt: new Date(),
    }));

    if (aggregateItems.length === 0) {
      const cleanupResult = await AdAnalyticsAggregate.deleteMany({ bucketDate: { $lt: cutoffBucketDate } });
      return {
        message: 'No ad analytics events to aggregate',
        metrics: {
          aggregates: 0,
          prunedBuckets: Number(cleanupResult?.deletedCount || 0),
        },
      };
    }

    await Promise.all(aggregateItems.map((item) => AdAnalyticsAggregate.updateOne(
      {
        bucketDate: item.bucketDate,
        adId: item.adId,
        slot: item.slot,
        pageType: item.pageType,
        articleId: item.articleId,
        categoryId: item.categoryId,
      },
      { $set: item },
      { upsert: true }
    )));

    const cleanupResult = await AdAnalyticsAggregate.deleteMany({ bucketDate: { $lt: cutoffBucketDate } });

    return {
      message: `Aggregated ${aggregateItems.length} ad analytics buckets`,
      metrics: {
        aggregates: aggregateItems.length,
        latestBucketDate: aggregateItems.map((item) => item.bucketDate).sort().slice(-1)[0] || null,
        prunedBuckets: Number(cleanupResult?.deletedCount || 0),
      },
    };
  }

  return {
    aggregateAdAnalyticsJob,
    toBucketDate,
  };
}
