export function createClassifiedHelpersService({ Classified }) {
  const VIP_PUBLIC_EXCLUDE = {
    _id: 0,
    __v: 0,
    ipHash: 0,
    paymentRef: 0,
    paidBy: 0,
    amountDue: 0,
    sortWeight: 0,
    imagesMeta: 0,
  };

  async function listVipClassifieds() {
    return Classified.find({
      status: 'active',
      tier: 'vip',
      expiresAt: { $gt: new Date() },
    })
      .select(VIP_PUBLIC_EXCLUDE)
      .sort({ bumpedAt: -1, approvedAt: -1, id: -1 })
      .limit(3)
      .lean();
  }

  return {
    listVipClassifieds,
  };
}
