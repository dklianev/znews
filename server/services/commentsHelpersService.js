export function createCommentsHelpers({
  blockedCommentTerms,
  Comment,
  CommentReaction,
  normalizeText,
}) {
  function commentContainsBlockedTerms(text) {
    const normalized = normalizeText(text, 4000).toLowerCase();
    return blockedCommentTerms.some((term) => normalized.includes(term));
  }

  function normalizeCommentReaction(value) {
    const normalized = normalizeText(value, 16).toLowerCase();
    if (normalized === 'like' || normalized === 'dislike') return normalized;
    return null;
  }

  async function syncCommentReactionTotals(commentId) {
    const [likes, dislikes] = await Promise.all([
      CommentReaction.countDocuments({ commentId, value: 'like' }),
      CommentReaction.countDocuments({ commentId, value: 'dislike' }),
    ]);

    return Comment.findOneAndUpdate(
      { id: commentId },
      { $set: { likes, dislikes } },
      { returnDocument: 'after' }
    );
  }

  async function collectCommentThreadIds(rootId) {
    const parsedRootId = Number.parseInt(rootId, 10);
    if (!Number.isInteger(parsedRootId)) return [];

    const seen = new Set([parsedRootId]);
    const ids = [];
    let frontier = [parsedRootId];

    while (frontier.length > 0) {
      ids.push(...frontier);
      const children = await Comment.find({ parentId: { $in: frontier } })
        .select({ _id: 0, id: 1 })
        .lean();

      frontier = [];
      children.forEach((child) => {
        const childId = Number.parseInt(child?.id, 10);
        if (!Number.isInteger(childId) || seen.has(childId)) return;
        seen.add(childId);
        frontier.push(childId);
      });
    }

    return ids;
  }

  return {
    collectCommentThreadIds,
    commentContainsBlockedTerms,
    normalizeCommentReaction,
    syncCommentReactionTotals,
  };
}
